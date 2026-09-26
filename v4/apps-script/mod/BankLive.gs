/**
 * mod/BankLive.gs — Live Google Sheets Bank ↔ Contract Reconciliation — Mini-Tally
 * FOCUS: 3 Contract Work sheets = 200 entries main (67 + 68 + 65), Bank Statement = confirmation only
 * Spreadsheet: 1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw
 * - Contract work 2024-25 gid 1782489685: 65 entries
 * - Contract work 2025-26 gid 790298656: 68 entries
 * - Contract work 2022-24 gid 1882690159: 67 entries
 * - Bank Statement gid 2024650928: confirmation by date + amount (BY credits only)
 * If new Contract Work sheet created, auto-include (name contains "Contract")
 */
var BankLive = (function () {
  "use strict";

  var EXTERNAL_ID = "1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw";
  var GIDS = {
    bank: 2024650928,
    contract2024: 1782489685,
    contract2025: 790298656,
    contract2022: 1882690159
  };

  function getExternalId() {
    try {
      var props = PropertiesService.getScriptProperties();
      var custom = props.getProperty("EXTERNAL_BANK_SHEETS_ID");
      return custom || EXTERNAL_ID;
    } catch (e) {
      return EXTERNAL_ID;
    }
  }

  function openExternal() {
    var id = getExternalId();
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      throw new ApiErr_("NOT_FOUND", "External Bank Sheets not accessible: " + id + " — share with " + Session.getActiveUser().getEmail());
    }
  }

  function getSheetByGid(ss, gid) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === gid) return sheets[i];
    }
    return null;
  }

  // Robust date parser: returns YYYY-MM-DD or "" 
  function parseDateAny(raw) {
    if (!raw) return "";
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      return Utilities.formatDate(raw, "Asia/Kolkata", "yyyy-MM-dd");
    }
    var s = String(raw).trim();
    if (!s) return "";
    // Already ISO YYYY-MM-DD
    var iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (iso) {
      var y = iso[1], mo = iso[2].padStart(2, "0"), d = iso[3].padStart(2, "0");
      return y + "-" + mo + "-" + d;
    }
    // DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
    var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      var d1 = m[1].padStart(2, "0");
      var mo1 = m[2].padStart(2, "0");
      var y1 = m[3];
      if (y1.length === 2) y1 = "20" + y1;
      // Basic sanity: if day>31 swap? Assume DD/MM
      return y1 + "-" + mo1 + "-" + d1;
    }
    // DD-MMM-YY or DD-MMM-YYYY or DD-MMM-YY with spaces: 21-Apr-25, 24-Dec-25, 21-Jun-25, 13/02/2023 handled above
    var m2 = s.match(/^(\d{1,2})[\-\/]([A-Za-z]{3,9})[\-\/](\d{2,4})$/);
    if (m2) {
      var months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12", jna: "01" };
      var mon = months[m2[2].toLowerCase().slice(0,3)] || "01";
      var yr = m2[3]; if (yr.length === 2) yr = "20" + yr;
      return yr + "-" + mon + "-" + m2[1].padStart(2, "0");
    }
    // MMM-YY or MMM-YYYY or MMM YY: Dec-25, Nov-23, Mar-23, Sep-25, Aug-25, Jan-26, Feb-23, etc
    var m3 = s.match(/^([A-Za-z]{3,9})[\-\s\/\.]+(\d{2,4})$/);
    if (m3) {
      var months2 = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12", jna: "01" };
      var mon2 = months2[m3[1].toLowerCase().slice(0,3)] || "";
      if (mon2) {
        var yr2 = m3[2]; if (yr2.length === 2) yr2 = "20" + yr2;
        return yr2 + "-" + mon2 + "-01"; // first day of month
      }
    }
    // Try Date.parse as fallback
    try {
      var d = new Date(s);
      if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, "Asia/Kolkata", "yyyy-MM-dd");
      }
    } catch (e) {}
    return "";
  }

  function parseBankSheet() {
    var ss = openExternal();
    var sheet = getSheetByGid(ss, GIDS.bank);
    if (!sheet) sheet = ss.getSheets()[0];
    var values = sheet.getDataRange().getValues();
    if (values.length < 6) return [];
    var headerRow = -1;
    for (var r = 0; r < Math.min(10, values.length); r++) {
      var rowStr = values[r].join("|").toLowerCase();
      if (rowStr.indexOf("description") >= 0 && (rowStr.indexOf("credit") >= 0 || rowStr.indexOf("running") >= 0)) { headerRow = r; break; }
    }
    if (headerRow < 0) headerRow = 4;
    var headers = values[headerRow].map(function (h) { return String(h).toLowerCase().trim(); });
    var dateIdx = -1, descIdx = -1, creditIdx = -1, debitIdx = -1, balIdx = -1;
    for (var c = 0; c < headers.length; c++) {
      var h = headers[c];
      if (h.indexOf("date") >= 0 && dateIdx < 0) dateIdx = c;
      if ((h.indexOf("description") >= 0 || h.indexOf("particular") >= 0) && descIdx < 0) descIdx = c;
      if (h.indexOf("credit") >= 0 && creditIdx < 0) creditIdx = c;
      if ((h.indexOf("debit") >= 0) && debitIdx < 0) debitIdx = c;
      if (h.indexOf("balance") >= 0 && balIdx < 0) balIdx = c;
    }
    if (dateIdx < 0) dateIdx = 1;
    if (descIdx < 0) descIdx = 2;
    if (creditIdx < 0) creditIdx = 6;
    if (balIdx < 0) balIdx = 7;
    if (debitIdx < 0) debitIdx = 8;

    var rows = [];
    for (var i = headerRow + 1; i < values.length; i++) {
      var v = values[i];
      if (!v || v.length === 0) continue;
      var desc = String(v[descIdx] || "").trim();
      if (!desc) continue;
      if (desc.toLowerCase().indexOf("description") >= 0) continue;
      var dateStr = parseDateAny(v[dateIdx]);
      // Amount parsing: credit column may contain both BY and TO amounts
      var amtRaw = 0;
      try { amtRaw = Number(String(v[creditIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0; } catch (e) {}
      if (amtRaw === 0) {
        try { amtRaw = Number(String(v[debitIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0; } catch (e2) {}
      }
      // If still 0, try to find amount in row (but not balance) — look for column with $ and numbers
      if (amtRaw === 0) {
        // Try column 5,6,7
        for (var cc = 4; cc < Math.min(9, v.length); cc++) {
          if (cc === balIdx) continue;
          var num = Number(String(v[cc] || "0").replace(/[^0-9.\-]/g, ""));
          if (num > 0 && num < 100000000) { amtRaw = num; break; }
        }
      }
      if (amtRaw === 0) continue;
      if (!dateStr && !desc) continue;

      var isCredit = desc.toUpperCase().indexOf("BY ") === 0 || desc.toUpperCase().indexOf("BY") === 0;
      var isDebit = desc.toUpperCase().indexOf("TO ") === 0 || desc.toUpperCase().indexOf("TO") === 0;
      // If description contains BY TRANSFER, BY CASH, BY RTGS, etc -> credit
      // TO TRANSFER, TO NEFT, TO CHQ -> debit
      var credit = 0, debit = 0;
      if (isCredit || desc.toLowerCase().indexOf("by ") >= 0 && desc.toLowerCase().indexOf("to ") < 0) {
        credit = amtRaw;
      } else if (isDebit || desc.toLowerCase().indexOf("to ") >= 0) {
        debit = amtRaw;
      } else {
        // Default: if BY in description -> credit else if TO -> debit else treat as credit if amount small?
        // For safety, treat as credit if description contains transfer/rtgs/neft/cash and not charges
        if (desc.toLowerCase().indexOf("charges") >= 0 || desc.toLowerCase().indexOf("fee") >= 0 || desc.toLowerCase().indexOf("maintenance") >= 0) {
          debit = amtRaw;
        } else {
          credit = amtRaw;
        }
      }
      var balance = 0;
      try { balance = Number(String(v[balIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0; } catch (e) {}

      var type = "other";
      var dl = desc.toLowerCase();
      if (dl.indexOf("rtgs") >= 0) type = "rtgs";
      else if (dl.indexOf("neft") >= 0) type = "neft";
      else if (dl.indexOf("cash") >= 0 || dl.indexOf("atm") >= 0) type = "cash";
      else if (dl.indexOf("charges") >= 0 || dl.indexOf("fee") >= 0) type = "charges";
      else if (dl.indexOf("loan") >= 0) type = "loan";
      else if (dl.indexOf("transfer") >= 0) type = "transfer";

      // Only keep credit entries for confirmation (BY) to avoid huge total and wrong matching
      // Keep debit as well but mark, but for stats we sum only credits
      rows.push({
        id: "B" + i,
        date: dateStr,
        description: desc.slice(0, 300),
        credit: credit,
        debit: debit,
        balance: balance,
        type: type,
        isCredit: credit > 0
      });
    }
    return rows;
  }

  function parseContractSheet(gid, fyLabel) {
    var ss = openExternal();
    var sheet = getSheetByGid(ss, gid);
    if (!sheet) return [];
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];
    var headerRow = -1;
    for (var r = 0; r < Math.min(5, values.length); r++) {
      var rs = values[r].join("|").toLowerCase();
      if (rs.indexOf("work name") >= 0 && rs.indexOf("receipt") >= 0) { headerRow = r; break; }
    }
    if (headerRow < 0) headerRow = 0;
    var headers = values[headerRow].map(function (h) { return String(h).toLowerCase().trim(); });
    function findIdx(keys) {
      for (var k = 0; k < keys.length; k++) {
        for (var c = 0; c < headers.length; c++) {
          if (headers[c].indexOf(keys[k]) >= 0) return c;
        }
      }
      return -1;
    }
    var workNameIdx = findIdx(["work name"]);
    var workPlaceIdx = findIdx(["work place"]);
    var receiptAmtIdx = findIdx(["receipt amount"]);
    var receiptDateIdx = findIdx(["receipt date"]);
    var fyIdx = findIdx(["fy", "financial year"]);
    var fileNameIdx = findIdx(["file name", "file"]);
    var partyIdx = findIdx(["party"]);
    var workTypeIdx = findIdx(["work type"]);
    var engNameIdx = findIdx(["eng name", "engineer"]);
    var taxableIdx = findIdx(["taxable value"]);
    var labourIdx = findIdx(["labour welfare", "lwf"]);
    var gstIdx = findIdx(["18% gst", "18%"]);
    var invoiceIdx = findIdx(["invoice value"]);
    var tdsIdx = findIdx(["income tax tds", "income tax"]);
    var gstTdsIdx = findIdx(["gst tds"]);
    var withHeldIdx = findIdx(["with held", "withheld"]);
    var emdIdx = findIdx(["emd"]);
    var otherDedIdx = findIdx(["other deduction"]);
    var receivableIdx = findIdx(["receiveble", "receivable", "receivable amount"]);
    var deptIdx = findIdx(["department"]);
    if (workNameIdx < 0) workNameIdx = 2;
    if (receiptAmtIdx < 0) receiptAmtIdx = 4;
    if (workPlaceIdx < 0) workPlaceIdx = 5;
    if (receiptDateIdx < 0) receiptDateIdx = 19;

    var rows = [];
    for (var i = headerRow + 1; i < values.length; i++) {
      var v = values[i];
      if (!v || v.length < 2) continue;
      var sNoRaw = v[0];
      var sNo = String(sNoRaw || "").trim();
      // Skip if entire row empty
      var hasAnyData = false;
      for (var cc = 0; cc < v.length; cc++) { if (String(v[cc] || "").trim() !== "") { hasAnyData = true; break; } }
      if (!hasAnyData) continue;
      // Skip total rows: any cell contains "total" and S.No empty or S.No is total
      var rowJoinedLower = v.join("|").toLowerCase();
      if (rowJoinedLower.indexOf("total") >= 0) {
        // If S.No empty or S.No is not numeric or contains total, skip
        if (!sNo || isNaN(Number(sNo)) || sNo.toLowerCase().indexOf("total") >= 0) continue;
        // Also if workName empty and S.No empty? Already handled
        // If row has Total in last columns and S.No empty, skip
        if (!sNo) continue;
      }
      // Skip if S.No empty — user says S.No mandatory, empty columns kept as empty but S.No must exist
      if (!sNo) continue;
      // Skip if S.No is header like "S.No"
      if (sNo.toLowerCase().indexOf("s.no") >= 0) continue;

      var workName = String(v[workNameIdx] || "").trim();
      var fileNameTmp = fileNameIdx >= 0 ? String(v[fileNameIdx] || "").trim() : "";
      // Keep empty as empty per user — don't fallback to placeholder, keep "" if empty
      // Only for display we show placeholder, but store empty
      if (workName.toLowerCase().indexOf("work name") >= 0) continue;

      // Amounts
      function numAt(idx) {
        if (idx < 0 || idx >= v.length) return 0;
        return Number(String(v[idx] || "0").replace(/[^0-9.\-]/g, "")) || 0;
      }
      var receiptAmt = numAt(receiptAmtIdx);
      var taxable = numAt(taxableIdx);
      var labour = numAt(labourIdx);
      var gst = numAt(gstIdx);
      var invoice = numAt(invoiceIdx);
      var tds = numAt(tdsIdx);
      var gstTds = numAt(gstTdsIdx);
      var withHeld = numAt(withHeldIdx);
      var emd = numAt(emdIdx);
      var otherDed = numAt(otherDedIdx);
      var receivable = numAt(receivableIdx);

      // If receiptAmt 0, try fallback to known amount columns in priority
      if (receiptAmt === 0) {
        var tryCols = [receivableIdx, invoiceIdx, taxableIdx, 21, 22]; // 21,22 are duplicate Receipt Amount columns
        for (var ac = 0; ac < tryCols.length; ac++) {
          var col = tryCols[ac];
          var num = numAt(col);
          if (num > 0) { receiptAmt = num; break; }
        }
      }
      // Keep row even if receiptAmt 0, but only if S.No exists and has at least one other amount or workName
      // This keeps empty columns as empty for future update
      var hasAmount = receiptAmt > 0 || taxable > 0 || invoice > 0 || receivable > 0 || gst > 0;
      if (!hasAmount && !workName && !fileNameTmp) {
        // Row with only S.No but no data — skip (likely blank)
        continue;
      }

      var dateStr = parseDateAny(v[receiptDateIdx]);
      // If date empty, try other date-like columns (col 19, 20)
      if (!dateStr) {
        // Try col 19, 20, 1?
        for (var dc = 18; dc <= 22; dc++) {
          if (dc === receiptDateIdx) continue;
          var dTry = parseDateAny(v[dc]);
          if (dTry) { dateStr = dTry; break; }
        }
      }

      var fy = fyIdx >= 0 ? String(v[fyIdx] || fyLabel || "").trim() : fyLabel;
      if (!fy) fy = fyLabel;
      var fileName = fileNameIdx >= 0 ? String(v[fileNameIdx] || "").trim() : "";
      var workPlace = workPlaceIdx >= 0 ? String(v[workPlaceIdx] || "").trim() : "";
      var party = partyIdx >= 0 ? String(v[partyIdx] || "").trim() : "";
      var workType = workTypeIdx >= 0 ? String(v[workTypeIdx] || "").trim() : "";
      var engName = engNameIdx >= 0 ? String(v[engNameIdx] || "").trim() : "";
      var dept = deptIdx >= 0 ? String(v[deptIdx] || "").trim() : "";

      rows.push({
        id: "C" + gid + "_" + i,
        sNo: sNo,
        workName: workName.slice(0, 500),
        workPlace: workPlace.slice(0, 200),
        party: party,
        receiptAmount: receiptAmt,
        workType: workType,
        engName: engName,
        taxableValue: taxable,
        labourWelfare: labour,
        gst: gst,
        invoiceValue: invoice,
        tds: tds,
        gstTds: gstTds,
        withHeld: withHeld,
        emd: emd,
        otherDeduction: otherDed,
        receivableAmount: receivable,
        receiptDate: dateStr,
        department: dept,
        fy: fy,
        fileName: fileName,
        sheetGid: gid,
        rowIndex: i + 1
      });
    }
    return rows;
  }

  function parseAllContractSheets() {
    var ss = openExternal();
    var allSheets = ss.getSheets();
    var contractSheets = [];
    var knownGids = [GIDS.contract2024, GIDS.contract2025, GIDS.contract2022];
    for (var i = 0; i < allSheets.length; i++) {
      var sh = allSheets[i];
      var name = sh.getName().toLowerCase();
      var gid = sh.getSheetId();
      if (knownGids.indexOf(gid) >= 0 || name.indexOf("contract") >= 0) {
        contractSheets.push({ sheet: sh, gid: gid, name: sh.getName() });
      }
    }
    var rows = [];
    var counts = {};
    for (var j = 0; j < contractSheets.length; j++) {
      var cs = contractSheets[j];
      var fyLabel = cs.name;
      var fyMatch = cs.name.match(/(20\d{2}[\-–]?\d{2})/);
      if (fyMatch) fyLabel = fyMatch[1];
      var parsed = parseContractSheet(cs.gid, fyLabel);
      counts[cs.name] = parsed.length;
      rows = rows.concat(parsed);
    }
    return { rows: rows, counts: counts, sheets: contractSheets.map(function (s) { return { name: s.name, gid: s.gid }; }) };
  }

  function smartMatch(bank, contract) {
    var bAmt = bank.credit || 0;
    if (bAmt === 0) return { type: "unmatched", confidence: 0, dateDiff: 999, amountDiff: 100 };
    var cAmt = contract.receiptAmount || contract.receivableAmount || contract.invoiceValue || 0;
    if (cAmt === 0) return { type: "unmatched", confidence: 0, dateDiff: 999, amountDiff: 100 };
    var denom = Math.max(bAmt, cAmt, 1);
    var amountDiff = Math.abs(bAmt - cAmt) / denom * 100;
    var bTime = bank.date ? new Date(bank.date).getTime() : 0;
    var cTime = contract.receiptDate ? new Date(contract.receiptDate).getTime() : 0;
    var dateDiff = (bTime && cTime) ? Math.abs(bTime - cTime) / (1000 * 60 * 60 * 24) : 999;
    var confidence = 0;
    var type = "unmatched";

    // Strict matching: same date same amount is exact
    if (amountDiff === 0 && dateDiff === 0) {
      confidence = 100; type = "exact";
    } else if (amountDiff === 0 && dateDiff <= 1) {
      confidence = 95; type = "exact";
    } else if (amountDiff === 0 && dateDiff <= 3) {
      confidence = 90; type = "exact";
    } else if (amountDiff === 0 && dateDiff <= 7) {
      confidence = 80; type = "exact";
    } else if (amountDiff === 0 && dateDiff <= 15) {
      confidence = 60; type = "partial"; // same amount but date far
    } else if (amountDiff <= 0.5 && dateDiff === 0) {
      confidence = 85; type = "exact";
    } else if (amountDiff <= 0.5 && dateDiff <= 3) {
      confidence = 75; type = "partial";
    } else if (amountDiff <= 1 && dateDiff <= 3) {
      confidence = 65; type = "partial";
    } else if (amountDiff <= 2 && dateDiff <= 7) {
      confidence = 50; type = "near";
    } else if (amountDiff <= 5 && dateDiff <= 3) {
      confidence = 40; type = "near";
    } else {
      confidence = 0; type = "unmatched";
    }

    // If dateDiff > 30 days, force unmatched unless amount exact and keyword matches work place
    if (dateDiff > 30) {
      if (amountDiff !== 0) {
        confidence = 0; type = "unmatched";
      } else {
        // Same amount but date far — keep as near with low confidence, but not exact
        if (confidence > 50) confidence = 30;
        type = "near";
      }
    }

    // Keyword boost only if dateDiff <=7
    if (dateDiff <= 7) {
      var workWords = String(contract.workName || "").toLowerCase().split(/\s+/).filter(function (w) { return w.length > 3; });
      var descLower = String(bank.description || "").toLowerCase();
      var keywordMatches = 0;
      for (var i = 0; i < workWords.length; i++) { if (descLower.indexOf(workWords[i]) >= 0) keywordMatches++; }
      if (keywordMatches > 0) confidence = Math.min(100, confidence + Math.min(10, keywordMatches * 2));
    }

    var displayDateDiff = dateDiff === 999 ? 0 : Math.round(dateDiff);
    return { type: type, confidence: Math.min(100, confidence), dateDiff: displayDateDiff, amountDiff: Math.round(amountDiff * 100) / 100, _rawDateDiff: dateDiff };
  }

  function liveRecon(p, requestId, user) {
    var bankRowsAll = parseBankSheet();
    // For matching, only consider credit rows (BY) — incoming
    var bankRows = bankRowsAll.filter(function (b) { return b.credit > 0; });
    var contractData = parseAllContractSheets();
    var contractRows = contractData.rows;

    var filterStatus = p.filterStatus || "all";
    var filterFY = p.filterFY || "all";
    var search = (p.search || "").toLowerCase();
    var dateFrom = p.dateFrom || "";
    var dateTo = p.dateTo || "";
    var workPlaceFilter = p.workPlace || "all";

    var combined = [];
    for (var ci = 0; ci < contractRows.length; ci++) {
      var c = contractRows[ci];
      var bestMatch = null;
      var bestScore = null;
      // First try exact date+amount map for speed
      for (var bj = 0; bj < bankRows.length; bj++) {
        var bb = bankRows[bj];
        // Quick filter: if amount diff >5% skip
        var bAmt = bb.credit;
        var cAmt = c.receiptAmount || c.receivableAmount || c.invoiceValue || 0;
        if (cAmt === 0) continue;
        var denom = Math.max(bAmt, cAmt, 1);
        var amtDiffQuick = Math.abs(bAmt - cAmt) / denom * 100;
        if (amtDiffQuick > 5) continue;
        var m = smartMatch(bb, c);
        if (m.type !== "unmatched" && (!bestScore || m.confidence > bestScore.confidence)) {
          bestScore = m;
          bestMatch = bb;
        }
      }
      // If no match found with quick filter, try all with exact amount
      if (!bestMatch) {
        for (var bj2 = 0; bj2 < bankRows.length; bj2++) {
          var bb2 = bankRows[bj2];
          if (bb2.credit === c.receiptAmount && bb2.credit > 0) {
            var m2 = smartMatch(bb2, c);
            if (m2.type !== "unmatched" && (!bestScore || m2.confidence > bestScore.confidence)) {
              bestScore = m2;
              bestMatch = bb2;
            }
          }
        }
      }
      var matchType = bestScore ? bestScore.type : "unmatched";
      var confidence = bestScore ? bestScore.confidence : 0;
      var dateDiff = bestScore ? bestScore.dateDiff : 0;
      var amountDiff = bestScore ? bestScore.amountDiff : 0;
      // If bestScore has raw dateDiff >30 and type not exact, force unmatched for clean BRS
      if (bestScore && bestScore._rawDateDiff > 30 && bestScore.amountDiff !== 0) {
        matchType = "unmatched";
        confidence = 0;
        dateDiff = 0;
        bestMatch = null;
      }

      combined.push({
        contract: c,
        bank: bestMatch,
        matchType: matchType,
        confidence: confidence,
        dateDiff: dateDiff,
        amountDiff: amountDiff
      });
    }

    var filtered = combined.filter(function (r) {
      if (filterStatus !== "all" && r.matchType !== filterStatus) return false;
      if (filterFY !== "all") {
        var f = String(filterFY).toLowerCase();
        var cfy = String(r.contract.fy || "").toLowerCase();
        // substring match both ways
        if (cfy.indexOf(f) < 0 && f.indexOf(cfy) < 0) {
          // Also try to match 2024-25 with 24-25 etc
          var fShort = f.replace("20", "");
          if (cfy.indexOf(fShort) < 0) return false;
        }
      }
      if (workPlaceFilter !== "all") {
        var wp = String(r.contract.workPlace || "").toLowerCase();
        if (wp.indexOf(String(workPlaceFilter).toLowerCase()) < 0) return false;
      }
      if (search) {
        var hay = (r.contract.workName || "") + " " + (r.contract.workPlace || "") + " " + (r.contract.fileName || "") + " " + ((r.bank && r.bank.description) || "") + " " + (r.contract.sNo || "");
        if (hay.toLowerCase().indexOf(search) < 0) return false;
      }
      if (dateFrom && r.contract.receiptDate && r.contract.receiptDate < dateFrom) return false;
      if (dateTo && r.contract.receiptDate && r.contract.receiptDate > dateTo) return false;
      return true;
    });

    filtered.sort(function (a, b) {
      var da = a.contract.receiptDate || "";
      var db = b.contract.receiptDate || "";
      return db.localeCompare(da);
    });

    var totalBank = 0, totalContract = 0;
    for (var i = 0; i < bankRows.length; i++) totalBank += bankRows[i].credit || 0;
    for (var j = 0; j < contractRows.length; j++) totalContract += contractRows[j].receiptAmount || 0;
    var matched = 0, partial = 0, near = 0, unmatched = 0;
    for (var k = 0; k < combined.length; k++) {
      if (combined[k].matchType === "exact") matched++;
      else if (combined[k].matchType === "partial") partial++;
      else if (combined[k].matchType === "near") near++;
      else unmatched++;
    }

    return {
      bankRows: bankRowsAll,
      contractRows: contractRows,
      combined: filtered,
      allCombined: combined,
      stats: {
        totalBank: totalBank,
        totalContract: totalContract,
        matched: matched,
        partial: partial,
        near: near,
        unmatched: unmatched,
        total: combined.length,
        bankCount: bankRowsAll.length,
        bankCreditCount: bankRows.length,
        contractCount: contractRows.length,
        countsBySheet: contractData.counts
      },
      externalId: getExternalId(),
      gids: GIDS,
      sheets: contractData.sheets,
      lastSync: new Date().toISOString()
    };
  }

  function liveSheets(p, requestId, user) {
    var ss = openExternal();
    var sheets = ss.getSheets().map(function (s) {
      return { name: s.getName(), id: s.getSheetId(), rows: s.getLastRow(), cols: s.getLastColumn() };
    });
    var contractData = parseAllContractSheets();
    return { externalId: getExternalId(), sheets: sheets, gids: GIDS, contractSheets: contractData.sheets, counts: contractData.counts };
  }

  function liveUpdate(p, requestId, user) {
    if (user.role !== "super_admin" && user.role !== "auditor") {
      throw new ApiErr_("FORBIDDEN", "Only admin/auditor can edit live sheets");
    }
    var errors = V.run(p, {
      gid: function () { return V.num(p, "gid", { required: true }); },
      rowIndex: function () { return V.num(p, "rowIndex", { required: true, min: 1 }); },
      workName: function () { return V.str(p, "workName", { max: 500 }); },
      workPlace: function () { return V.str(p, "workPlace", { max: 200 }); }
    });
    if (errors.length) throw new ApiErr_("VALIDATION_ERROR", "Validation failed", errors);
    var ss = openExternal();
    var sheet = getSheetByGid(ss, Number(p.gid));
    if (!sheet) throw new ApiErr_("NOT_FOUND", "Sheet not found for gid " + p.gid);
    var values = sheet.getDataRange().getValues();
    var headerRow = 0;
    for (var r = 0; r < Math.min(5, values.length); r++) {
      if (String(values[r].join("|")).toLowerCase().indexOf("work name") >= 0) { headerRow = r; break; }
    }
    var headers = values[headerRow].map(function (h) { return String(h).toLowerCase(); });
    var workNameCol = -1, workPlaceCol = -1;
    for (var c = 0; c < headers.length; c++) {
      if (headers[c].indexOf("work name") >= 0) workNameCol = c;
      if (headers[c].indexOf("work place") >= 0) workPlaceCol = c;
    }
    if (workNameCol >= 0 && p.workName !== undefined) {
      sheet.getRange(p.rowIndex, workNameCol + 1).setValue(p.workName);
    }
    if (workPlaceCol >= 0 && p.workPlace !== undefined) {
      sheet.getRange(p.rowIndex, workPlaceCol + 1).setValue(p.workPlace);
    }
    Audit.log(user, "UPDATE", "bank_live", p.gid + ":" + p.rowIndex, null, { workName: p.workName, workPlace: p.workPlace }, "Live sheet edit", requestId);
    return { ok: true, gid: p.gid, rowIndex: p.rowIndex };
  }

  return { liveRecon: liveRecon, liveSheets: liveSheets, liveUpdate: liveUpdate };
})();
