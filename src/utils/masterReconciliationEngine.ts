// ============================================================
// FULL RECONCILIATION PAGE WITH MASTER ENGINE INTEGRATION
// ============================================================
import React, { useState } from "react";
import { 
  runMasterReconciliation, 
  ContractRecord, 
  BankLedgerRow 
} from "../utils/masterReconciliationEngine";

export function ReconciliationPage({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "exact" | "close" | "multiple" | "unmatched" | "bank">("summary");
  const [summaryData, setSummaryData] = useState<any>(null);
  const [reconciledList, setReconciledList] = useState<ContractRecord[]>([]);
  const [unmatchedBankRows, setUnmatchedBankRows] = useState<BankLedgerRow[]>([]);

  // 1. Master Sheet ID & Public URLs
  const SHEET_ID = "1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw";
  const BANK_GID = "2024650928"; // Polinchi B/S 1712

  // எண்களைப் பிரித்தெடுக்கும் உதவிக் குறியீடு
  const parseNum = (val: any): number => {
    if (!val && val !== 0) return 0;
    if (typeof val === "number") return val;
    const clean = String(val).replace(/[$₹,\s#]/g, "").replace(/[^0-9.-]/g, "").trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  };

  // 2. ரீகான்சிலியேஷன் இயக்கும் பிரதான செயல்பாடு
  const handleRunReconciliation = async () => {
    setLoading(true);
    setLoaded(false);

    try {
      // ------------------------------------------------------------
      // A. CONTRACT WORKS SHEET-ஐ படித்தல் (24 காலம்கள்)
      // ------------------------------------------------------------
      const contractsUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
      const contractRes = await fetch(contractsUrl);
      const contractCsv = await contractRes.text();

      const contractLines = contractCsv.split("\n").filter(l => l.trim());
      const parsedContracts: ContractRecord[] = [];

      for (let i = 1; i < contractLines.length; i++) {
        // CSV Split Logic
        const cols: string[] = [];
        let cur = "", inQ = false;
        for (const ch of contractLines[i]) {
          if (ch === '"') inQ = !inQ;
          else if (ch === "," && !inQ) { cols.push(cur.replace(/"/g, "").trim()); cur = ""; }
          else cur += ch;
        }
        cols.push(cur.replace(/"/g, "").trim());

        if (cols.length < 5) continue;

        const sourceSheet = cols[0] || "General";
        const workName = cols[4] || cols[1] || "";
        const party = cols[6] || "";
        const taxableValue = parseNum(cols[9] || cols[8]);
        const gst18Pct = parseNum(cols[10]);
        const itTds2Pct = parseNum(cols[11]);
        const gstTds2Pct = parseNum(cols[12]);
        const labourCess1Pct = parseNum(cols[13]);
        const emdAmount = parseNum(cols[14]);
        const otherDeductions = parseNum(cols[15]);
        const receiptAmtOriginal = parseNum(cols[16] || cols[17]);
        const receiptDate = cols[17] || cols[18] || "";
        const fy = cols[20] || cols[19] || "FY 24-25";
        const fileName = cols[21] || "";

        if (taxableValue > 0 || receiptAmtOriginal > 0) {
          parsedContracts.push({
            sourceSheet,
            rowIndex: i,
            workName,
            party,
            taxableValue,
            gst18Pct,
            itTds2Pct,
            gstTds2Pct,
            labourCess1Pct,
            emdAmount,
            otherDeductions,
            receiptAmountCalculated: receiptAmtOriginal,
            receiptAmountOriginal,
            receiptDate,
            fy,
            fileName
          });
        }
      }

      // ------------------------------------------------------------
      // B. BANK STATEMENT SHEET-ஐ படித்தல் (Polinchi B/S 1712)
      // ------------------------------------------------------------
      const bankUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${BANK_GID}`;
      const bankRes = await fetch(bankUrl);
      const bankCsv = await bankRes.text();

      const bankLines = bankCsv.split("\n").filter(l => l.trim());
      const parsedBankRows: BankLedgerRow[] = [];

      for (let i = 2; i < bankLines.length; i++) {
        const cols = bankLines[i].split(",").map(c => c.replace(/"/g, "").trim());
        if (cols.length < 4) continue;

        const date = cols[0] || cols[1] || "";
        const description = cols[2] || cols[1] || "";
        const refNo = cols[3] || "";
        const credit = parseNum(cols[5] || cols[6]);
        const debit = parseNum(cols[4]);
        const balance = parseNum(cols[7] || cols[6]);

        if (credit > 0 || debit > 0) {
          parsedBankRows.push({
            date,
            description,
            refNo,
            debit,
            credit,
            balance
          });
        }
      }

      // ------------------------------------------------------------
      // C. NEW MASTER ENGINE-ஐ இயக்குதல்
      // ------------------------------------------------------------
      const result = runMasterReconciliation(parsedContracts, parsedBankRows);

      setReconciledList(result.reconciledContracts);
      setSummaryData(result.summary);
      setUnmatchedBankRows(parsedBankRows.filter(b => b.credit > 0 && !b.isUsed));
      setLoaded(true);

    } catch (err) {
      console.error("Reconciliation Error:", err);
      alert("❌ Data Load செய்வதில் பிழை ஏற்பட்டது. Internet / Sheet Permission சரிபார்க்கவும்.");
    } finally {
      setLoading(false);
    }
  };

  const fmtR = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });

  // Filter List by Active Tab
  const getFilteredList = () => {
    switch (activeTab) {
      case "exact": return reconciledList.filter(c => c.matchStatus === "☑ Exact Match");
      case "close": return reconciledList.filter(c => c.matchStatus === "☐ Close Match");
      case "multiple": return reconciledList.filter(c => c.matchStatus === "☑ Multiple Credit");
      case "unmatched": return reconciledList.filter(c => c.matchStatus === "☒ No Match");
      default: return reconciledList;
    }
  };

  const filteredData = getFilteredList();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔄</span>
          <div>
            <h1 className="font-bold text-lg">Master Bank Reconciliation Engine V3.0</h1>
            <p className="text-xs text-slate-400">Sri Polinchi & Co — ₹55 Crore Multi-Pass Deduction Reconciliation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="px-4 py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-lg transition">
            ← Back
          </button>
          <button
            onClick={handleRunReconciliation}
            disabled={loading}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-md"
          >
            {loading ? "⏳ Reconciling..." : loaded ? "↻ Re-Run Engine" : "▶ Run Engine"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {!loaded && !loading && (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm space-y-4">
            <span className="text-6xl block">📊</span>
            <h2 className="text-2xl font-bold text-slate-800">Master Reconciliation Engine ready</h2>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">
              IT TDS (2%), GST TDS (2%), Labour Cess (1%), மற்றும் EMD பிடித்தங்களைக் கணக்கிட்டு, ₹55 கோடி மதிப்பிலான லெட்ஜர் வரவுகளைத் துல்லியமாக ஒப்பிடும் எஞ்சின்.
            </p>
            <button
              onClick={handleRunReconciliation}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition"
            >
              ▶ Start Reconciliation Now
            </button>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm space-y-3">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="font-bold text-slate-700">Master Data லோடு ஆகிறது...</p>
            <p className="text-xs text-slate-400">24 காலம்கள் மற்றும் 5-Pass அல்காரிதம் பகுப்பாய்வு செய்யப்படுகிறது</p>
          </div>
        )}

        {loaded && summaryData && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500 font-bold uppercase">மொத்த ஒப்பந்தங்கள்</p>
                <p className="text-2xl font-extrabold mt-1 text-slate-800">{summaryData.totalContracts}</p>
                <p className="text-[11px] text-slate-400 mt-1">Total Bills</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
                <p className="text-xs text-emerald-600 font-bold uppercase">☑ Exact Match</p>
                <p className="text-2xl font-extrabold mt-1 text-emerald-700">{summaryData.exactMatches}</p>
                <p className="text-[11px] text-emerald-600 mt-1">100% Diff 0</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm">
                <p className="text-xs text-blue-600 font-bold uppercase">☐ Close Match</p>
                <p className="text-2xl font-extrabold mt-1 text-blue-700">{summaryData.closeMatches}</p>
                <p className="text-[11px] text-blue-600 mt-1">Diff 0.1% - 1.5%</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm">
                <p className="text-xs text-purple-600 font-bold uppercase">☑ Multiple Credit</p>
                <p className="text-2xl font-extrabold mt-1 text-purple-700">{summaryData.multipleCredits}</p>
                <p className="text-[11px] text-purple-600 mt-1">Split Payments</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
                <p className="text-xs text-rose-600 font-bold uppercase">☒ No Match</p>
                <p className="text-2xl font-extrabold mt-1 text-rose-700">{summaryData.unmatched}</p>
                <p className="text-[11px] text-rose-600 mt-1">Pending Treasury</p>
              </div>
            </div>

            {/* Total Financial Summary */}
            <div className="bg-slate-900 text-white rounded-xl p-5 shadow-md flex justify-between items-center flex-wrap gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold">பொருந்திய மொத்தத் தொகை (Matched Amount)</p>
                <p className="text-3xl font-extrabold text-emerald-400 mt-1">{fmtR(summaryData.matchedAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase font-bold">பொருந்தாத தொகை (Unmatched Amount)</p>
                <p className="text-2xl font-extrabold text-rose-400 mt-1">{fmtR(summaryData.unmatchedAmount)}</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 gap-2 bg-white px-4 pt-2 rounded-t-xl">
              {[
                { id: "summary", label: "அனைத்தும்", count: reconciledList.length },
                { id: "exact", label: "☑ Exact Match", count: summaryData.exactMatches },
                { id: "close", label: "☐ Close Match", count: summaryData.closeMatches },
                { id: "multiple", label: "☑ Multiple Credit", count: summaryData.multipleCredits },
                { id: "unmatched", label: "☒ No Match", count: summaryData.unmatched },
                { id: "bank", label: "🏦 Unmatched Bank Credits", count: unmatchedBankRows.length },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
                    activeTab === t.id
                      ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            {/* Main Table View */}
            <div className="bg-white rounded-b-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b">
                    <tr>
                      <th className="p-3">வரிசை</th>
                      <th className="p-3">ஆதாரம் (Sheet)</th>
                      <th className="p-3">பணியின் பெயர் (Work Name)</th>
                      <th className="p-3 text-right">அசல் மதிப்பு (Taxable)</th>
                      <th className="p-3 text-right">இறுதி வரவு (Receipt)</th>
                      <th className="p-3 text-center">மேட்ச் நிலை (Status)</th>
                      <th className="p-3">வங்கி மேட்ச் விபரம் (Match Detail)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeTab !== "bank" ? (
                      filteredData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono text-gray-400">{idx + 1}</td>
                          <td className="p-3 font-semibold text-slate-700">{row.sourceSheet}</td>
                          <td className="p-3 font-bold text-slate-800 max-w-xs truncate" title={row.workName}>
                            {row.workName}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600">{fmtR(row.taxableValue)}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            {fmtR(row.receiptAmountOriginal || row.receiptAmountCalculated)}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                              row.matchStatus === "☑ Exact Match" ? "bg-emerald-100 text-emerald-800" :
                              row.matchStatus === "☐ Close Match" ? "bg-blue-100 text-blue-800" :
                              row.matchStatus === "☑ Multiple Credit" ? "bg-purple-100 text-purple-800" :
                              "bg-rose-100 text-rose-800"
                            }`}>
                              {row.matchStatus}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-600 max-w-md truncate" title={row.matchDetail}>
                            {row.matchDetail}
                          </td>
                        </tr>
                      ))
                    ) : (
                      unmatchedBankRows.map((bRow, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono text-gray-400">{idx + 1}</td>
                          <td className="p-3 font-mono text-slate-600">{bRow.date}</td>
                          <td className="p-3 font-semibold text-slate-800" colSpan={2}>{bRow.description}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">{fmtR(bRow.credit)}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Unmatched Bank Credit
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-400">Ref: {bRow.refNo || "N/A"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
