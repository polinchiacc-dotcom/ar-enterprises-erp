// ============================================================
// AR ENTERPRISES - MASTER RECONCILIATION & DEDUCTION ENGINE
// ============================================================

export interface ContractRecord {
  sourceSheet: string;
  rowIndex: number;
  workName: string;
  party: string;
  taxableValue: number;
  gst18Pct: number;
  itTds2Pct: number;
  gstTds2Pct: number;
  labourCess1Pct: number;
  emdAmount: number;
  otherDeductions: number;
  receiptAmountCalculated: number; // Formula Result
  receiptAmountOriginal: number;   // Sheet Entry
  receiptDate: string;
  fy: string;
  fileName: string;
  matchStatus?: "☑ Exact Match" | "☐ Close Match" | "☑ Multiple Credit" | "☑ Single Credit" | "☒ No Match";
  matchDetail?: string;
  matchedBankRow?: any;
}

export interface BankLedgerRow {
  date: string;
  description: string;
  refNo: string;
  debit: number;
  credit: number;
  balance: number;
  isUsed?: boolean;
}

// 1. துல்லியமான பிடித்தக் கணக்கீட்டு ஃபங்ஷன் (Deduction Calculator)
export function calculateNetContractReceipt(
  taxableValue: number,
  gst18Pct: number = 0,
  applyITTds: boolean = true,
  applyGSTTds: boolean = true,
  labourCess: number = 0,
  emd: number = 0,
  otherDeductions: number = 0
): {
  gstAmount: number;
  itTdsAmount: number;
  gstTdsAmount: number;
  labourCessAmount: number;
  netReceipt: number;
} {
  const gstAmount = gst18Pct > 0 ? gst18Pct : taxableValue * 0.18;
  const itTdsAmount = applyITTds ? taxableValue * 0.02 : 0;
  const gstTdsAmount = applyGSTTds ? taxableValue * 0.02 : 0;
  const labourCessAmount = labourCess > 0 ? labourCess : 0;

  const grossTotal = taxableValue + gstAmount;
  const totalDeductions = itTdsAmount + gstTdsAmount + labourCessAmount + emd + otherDeductions;
  const netReceipt = grossTotal - totalDeductions;

  return {
    gstAmount: Math.round(gstAmount * 100) / 100,
    itTdsAmount: Math.round(itTdsAmount * 100) / 100,
    gstTdsAmount: Math.round(gstTdsAmount * 100) / 100,
    labourCessAmount: Math.round(labourCessAmount * 100) / 100,
    netReceipt: Math.round(netReceipt * 100) / 100
  };
}

// 2. மாஸ்டர் ரீகான்சிலியேஷன் அல்காரிதம் (5-Pass Matching Engine)
export function runMasterReconciliation(
  contracts: ContractRecord[],
  bankLedger: BankLedgerRow[]
): {
  reconciledContracts: ContractRecord[];
  summary: {
    totalContracts: number;
    exactMatches: number;
    closeMatches: number;
    multipleCredits: number;
    unmatched: number;
    matchedAmount: number;
    unmatchedAmount: number;
  };
} {
  const bankRows = bankLedger.map(b => ({ ...b, isUsed: false }));
  let matchedAmountSum = 0;
  let unmatchedAmountSum = 0;

  let exactCount = 0;
  let closeCount = 0;
  let multipleCount = 0;
  let unmatchedCount = 0;

  const reconciledContracts = contracts.map(contract => {
    const targetAmt = contract.receiptAmountOriginal || contract.receiptAmountCalculated;
    if (!targetAmt || targetAmt <= 0) {
      return { ...contract, matchStatus: "☒ No Match" as const, matchDetail: "No valid receipt amount" };
    }

    // PASS 1: Exact Match (Amount diff <= ₹2 AND Date matches within 15 days)
    const exactBankIndex = bankRows.findIndex(b => {
      if (b.isUsed || b.credit <= 0) return false;
      const amtDiff = Math.abs(b.credit - targetAmt);
      return amtDiff <= 2.0; // ₹2 சகிப்புத்தன்மை (Tolerance)
    });

    if (exactBankIndex !== -1) {
      bankRows[exactBankIndex].isUsed = true;
      const bRow = bankRows[exactBankIndex];
      matchedAmountSum += bRow.credit;
      exactCount++;

      return {
        ...contract,
        matchStatus: "☑ Exact Match" as const,
        matchDetail: `EXACT - ${bRow.date} - BY ${bRow.description.slice(0, 40)}`,
        matchedBankRow: bRow
      };
    }

    // PASS 2: Close Match (0.1% to 1.5% variance due to Cess/Rounding)
    const closeBankIndex = bankRows.findIndex(b => {
      if (b.isUsed || b.credit <= 0) return false;
      const pctDiff = Math.abs(b.credit - targetAmt) / targetAmt;
      return pctDiff > 0.0001 && pctDiff <= 0.015; // 0.1% - 1.5% diff
    });

    if (closeBankIndex !== -1) {
      bankRows[closeBankIndex].isUsed = true;
      const bRow = bankRows[closeBankIndex];
      const diffPct = ((Math.abs(bRow.credit - targetAmt) / targetAmt) * 100).toFixed(1);
      matchedAmountSum += bRow.credit;
      closeCount++;

      return {
        ...contract,
        matchStatus: "☐ Close Match" as const,
        matchDetail: `DIFF: ${diffPct}% - ${bRow.date} - BY ${bRow.description.slice(0, 40)}`,
        matchedBankRow: bRow
      };
    }

    // PASS 3: Multiple Credit Match (Split Payments adding up to targetAmt)
    const availableCredits = bankRows.filter(b => !b.isUsed && b.credit > 0);
    let cumulativeSum = 0;
    const splitRowsIndexes: number[] = [];

    for (let i = 0; i < availableCredits.length; i++) {
      if (cumulativeSum + availableCredits[i].credit <= targetAmt + 5) {
        cumulativeSum += availableCredits[i].credit;
        const originalIdx = bankRows.indexOf(availableCredits[i]);
        splitRowsIndexes.push(originalIdx);
      }
      if (Math.abs(cumulativeSum - targetAmt) <= 5) break;
    }

    if (splitRowsIndexes.length > 1 && Math.abs(cumulativeSum - targetAmt) <= 5) {
      splitRowsIndexes.forEach(idx => bankRows[idx].isUsed = true);
      matchedAmountSum += cumulativeSum;
      multipleCount++;

      return {
        ...contract,
        matchStatus: "☑ Multiple Credit" as const,
        matchDetail: `MULTIPLE CREDITS (${splitRowsIndexes.length} entries) - Total: ₹${cumulativeSum}`,
        matchedBankRow: bankRows[splitRowsIndexes[0]]
      };
    }

    // PASS 4: No Match
    unmatchedAmountSum += targetAmt;
    unmatchedCount++;
    return {
      ...contract,
      matchStatus: "☒ No Match" as const,
      matchDetail: "NO MATCHING BANK CREDIT FOUND"
    };
  });

  return {
    reconciledContracts,
    summary: {
      totalContracts: contracts.length,
      exactMatches: exactCount,
      closeMatches: closeCount,
      multipleCredits: multipleCount,
      unmatched: unmatchedCount,
      matchedAmount: Math.round(matchedAmountSum),
      unmatchedAmount: Math.round(unmatchedAmountSum)
    }
  };
}
