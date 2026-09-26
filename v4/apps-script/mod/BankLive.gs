/**
 * mod/BankLive.gs — Live Google Sheets Bank ↔ Contract Reconciliation — Mini-Tally
 * FOCUS: 3 Contract Work sheets = 200 entries main (67 + 68 + 65), Bank Statement = confirmation only
 * Spreadsheet: 1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw
 * - Contract work 2024-25 gid 1782489685: 65 entries
 * - Contract work 2025-26 gid 790298656: 68 entries
 * - Contract work 2022-24 gid 1882690159: 67 entries
 * - Bank Statement gid 2024650928: confirmation by date + amount
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

  function parseBankSheet() {
    var ss = openExternal();
    var sheet = getSheetByGid(ss, GIDS.bank);
    if (!sheet) sheet = ss.getSheets()[0];
    var values = sheet.getDataRange().getValues();
    if (values.length < 6) return [];
    var headerRow = -1;
    for (var r = 0; r < Math.min(10, values.length); r++) {
      var rowStr = values[r].join("|").toLowerCase();
      if (rowStr.indexOf("description") >= 0 && rowStr.indexOf("credit") >= 0) { headerRow = r; break; }
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
      var dateRaw = v[dateIdx];
      var dateStr = "";
      if (dateRaw instanceof Date) {
        dateStr = Utilities.formatDate(dateRaw, "Asia/Kolkata", "yyyy-MM-dd");
      } else {
        dateStr = String(dateRaw || "").trim();
        var m = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (m) {
          var d = m[1].padStart(2, "0");
          var mo = m[2].padStart(2, "0");
          var y = m[3];
          if (y.length === 2) y = "20" + y;
          dateStr = y + "-" + mo + "-" + d;
        }
      }
      var credit = 0, debit = 0, balance = 0;
      try { credit = Number(String(v[creditIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0; } catch (e) {}
      try { debit = Number(String(v[debitIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0; } catch (e) {}
      try { balance = Number(String(v[balIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0; } catch (e) {}
      // FIX: Don't fallback to any number — that caused huge total ₹4,12,24,78,61,42,09,98,660 (was picking balance as credit)
      // Only keep row if credit>0 or debit>0 and description exists — bank confirmation only needs date+amount+details
      if (credit === 0 && debit === 0) continue;
      if (!dateStr && !desc) continue;
      var type = "other";
      var dl = desc.toLowerCase();
      if (dl.indexOf("rtgs") >= 0) type = "rtgs";
      else if (dl.indexOf("neft") >= 0) type = "neft";
      else if (dl.indexOf("cash") >= 0 || dl.indexOf("atm") >= 0) type = "cash";
      else if (dl.indexOf("charges") >= 0 || dl.indexOf("fee") >= 0) type = "charges";
      else if (dl.indexOf("loan") >= 0) type = "loan";
      else if (dl.indexOf("transfer") >= 0) type = "transfer";

      rows.push({
        id: "B" + i,
        date: dateStr,
        description: desc.slice(0, 300),
        credit: credit,
        debit: debit,
        balance: balance,
        type: type
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

    var rows = [];
    for (var i = headerRow + 1; i < values.length; i++) {
      var v = values[i];
      if (!v || v.length < 2) continue;
      var sNo = String(v[0] || "").trim();
      // Skip if S.No empty and entire row empty
      var hasAnyData = false;
      for (var cc = 0; cc < v.length; cc++) { if (String(v[cc] || "").trim() !== "") { hasAnyData = true; break; } }
      if (!hasAnyData) continue;
      // Skip total row
      var firstCellLower = String(v[0] || "").toLowerCase() + String(v[2] || "").toLowerCase();
      if (firstCellLower.indexOf("total") >= 0) continue;

      var workName = String(v[workNameIdx] || "").trim();
      var fileNameTmp = fileNameIdx >= 0 ? String(v[fileNameIdx] || "").trim() : "";
      // If Work Name empty, use S.No + File Name or fallback to keep empty columns as empty per user request
      if (!workName) {
        if (fileNameTmp) workName = fileNameTmp;
        else if (sNo) workName = "Work S.No " + sNo;
        else workName = ""; // Keep empty as empty, but still include row
      }
      // Still include even if workName empty — user wants all data, empty columns kept as empty
      if (workName.toLowerCase().indexOf("work name") >= 0) continue;

      var receiptAmt = 0;
      try { receiptAmt = Number(String(v[receiptAmtIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0; } catch (e) {}
      // Try other amount columns if receiptAmt 0 — contract sheets have Taxable Value, Invoice Value etc
      if (receiptAmt === 0) {
        // Priority: try columns that look like amounts: Receipt Amount (E), Taxable (I), Invoice (L), Receivable (S)
        var tryCols = [receiptAmtIdx, taxableIdx, invoiceIdx, 18, 20, 4, 8, 10, 11];
        for (var ac = 0; ac < tryCols.length; ac++) {
          var col = tryCols[ac];
          if (col >= 0 && col < v.length) {
            var num = Number(String(v[col] || "").replace(/[^0-9.\-]/g, ""));
            if (num > 0) { receiptAmt = num; break; }
          }
        }
        // Last resort: any number > 1000 in row
        if (receiptAmt === 0) {
          for (var ac2 = 0; ac2 < v.length; ac2++) {
            var num2 = Number(String(v[ac2] || "").replace(/[^0-9.\-]/g, ""));
            if (num2 > 1000) { receiptAmt = num2; break; }
          }
        }
      }
      // Keep row even if receiptAmt 0? User wants all data, but we need amount for matching — keep with 0 and show as empty
      // For now, include even if 0, but mark receiptAmount 0 — will show as empty in UI, can be updated later in Google Sheet
      if (receiptAmt === 0) {
        // Check if row has any other data — if S.No exists, include with 0 amount to keep empty columns as empty
        if (!sNo) continue;
      }
      var dateRaw = v[receiptDateIdx];
      var dateStr = "";
      if (dateRaw instanceof Date) {
        dateStr = Utilities.formatDate(dateRaw, "Asia/Kolkata", "yyyy-MM-dd");
      } else {
        dateStr = String(dateRaw || "").trim();
        var m = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (m) {
          var d = m[1].padStart(2, "0");
          var mo = m[2].padStart(2, "0");
          var y = m[3];
          if (y.length === 2) y = "20" + y;
          dateStr = y + "-" + mo + "-" + d;
        } else {
          var m2 = dateStr.match(/(\d{1,2})\-([A-Za-z]{3})\-(\d{2,4})/);
          if (m2) {
            var months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
            var mon = months[m2[2].toLowerCase()] || "01";
            var yr = m2[3]; if (yr.length === 2) yr = "20" + yr;
            dateStr = yr + "-" + mon + "-" + m2[1].padStart(2, "0");
          }
        }
      }
      var fy = fyIdx >= 0 ? String(v[fyIdx] || fyLabel || "").trim() : fyLabel;
      if (!fy) fy = fyLabel;
      var fileName = fileNameIdx >= 0 ? String(v[fileNameIdx] || "").trim() : "";
      var workPlace = workPlaceIdx >= 0 ? String(v[workPlaceIdx] || "").trim() : "";
      var party = partyIdx >= 0 ? String(v[partyIdx] || "").trim() : "";
      var workType = workTypeIdx >= 0 ? String(v[workTypeIdx] || "").trim() : "";
      var engName = engNameIdx >= 0 ? String(v[engNameIdx] || "").trim() : "";
      var taxable = taxableIdx >= 0 ? Number(String(v[taxableIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      var labour = labourIdx >= 0 ? Number(String(v[labourIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      var gst = gstIdx >= 0 ? Number(String(v[gstIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      var invoice = invoiceIdx >= 0 ? Number(String(v[invoiceIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      var tds = tdsIdx >= 0 ? Number(String(v[tdsIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      var gstTds = gstTdsIdx >= 0 ? Number(String(v[gstTdsIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      var withHeld = withHeldIdx >= 0 ? Number(String(v[withHeldIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      var emd = emdIdx >= 0 ? Number(String(v[emdIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      var otherDed = otherDedIdx >= 0 ? Number(String(v[otherDedIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      var receivable = receivableIdx >= 0 ? Number(String(v[receivableIdx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
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
    // Known gids
    var knownGids = [GIDS.contract2024, GIDS.contract2025, GIDS.contract2022];
    for (var i = 0; i < allSheets.length; i++) {
      var sh = allSheets[i];
      var name = sh.getName().toLowerCase();
      var gid = sh.getSheetId();
      // Auto-include if name contains "contract" or gid is known
      if (name.indexOf("contract") >= 0 || knownGids.indexOf(gid) >= 0) {
        contractSheets.push({ sheet: sh, gid: gid, name: sh.getName() });
      }
    }
    // Sort by gid to keep consistent
    var rows = [];
    var counts = {};
    for (var j = 0; j < contractSheets.length; j++) {
      var cs = contractSheets[j];
      var fyLabel = cs.name;
      // Extract FY from name if possible
      var fyMatch = cs.name.match(/(20\d{2}[\-–]?\d{2})/);
      if (fyMatch) fyLabel = fyMatch[1];
      var parsed = parseContractSheet(cs.gid, fyLabel);
      counts[cs.name] = parsed.length;
      rows = rows.concat(parsed);
    }
    return { rows: rows, counts: counts, sheets: contractSheets.map(function (s) { return { name: s.name, gid: s.gid }; }) };
  }

  function smartMatch(bank, contract) {
    var bAmt = bank.credit || bank.debit || 0;
    var cAmt = contract.receiptAmount || 0;
    var denom = Math.max(bAmt, cAmt, 1);
    var amountDiff = Math.abs(bAmt - cAmt) / denom * 100;
    var bTime = bank.date ? new Date(bank.date).getTime() : 0;
    var cTime = contract.receiptDate ? new Date(contract.receiptDate).getTime() : 0;
    var dateDiff = (bTime && cTime) ? Math.abs(bTime - cTime) / (1000 * 60 * 60 * 24) : 999;
    var confidence = 0;
    var type = "unmatched";
    // Amount exact is strongest signal — give 80 directly for Tally BRS exact match
    if (amountDiff === 0) { confidence += 80; type = "exact"; }
    else if (amountDiff <= 0.5) { confidence += 70; type = "exact"; }
    else if (amountDiff <= 2) { confidence += 50; type = "near"; }
    else if (amountDiff <= 5) { confidence += 30; type = "partial"; }
    else if (amountDiff <= 10) { confidence += 10; type = "near"; }

    if (dateDiff === 0) confidence += 20;
    else if (dateDiff <= 3) confidence += 15;
    else if (dateDiff <= 7) confidence += 8;
    else if (dateDiff <= 15) confidence += 3;
    else if (dateDiff === 999) {
      // Date missing — don't penalize, keep amount confidence, but don't show 999d
      confidence += 0;
    }

    var workWords = String(contract.workName || "").toLowerCase().split(/\s+/).filter(function (w) { return w.length > 3; });
    var descLower = String(bank.description || "").toLowerCase();
    var keywordMatches = 0;
    for (var i = 0; i < workWords.length; i++) { if (descLower.indexOf(workWords[i]) >= 0) keywordMatches++; }
    if (keywordMatches > 0) confidence += Math.min(10, keywordMatches * 3);

    if (confidence >= 80) type = "exact";
    else if (confidence >= 50) type = "partial";
    else if (confidence >= 25) type = "near";
    else type = "unmatched";

    // For display, hide 999 diff
    var displayDateDiff = dateDiff === 999 ? 0 : Math.round(dateDiff);
    return { type: type, confidence: Math.min(100, confidence), dateDiff: displayDateDiff, amountDiff: Math.round(amountDiff * 100) / 100 };
  }

  function liveRecon(p, requestId, user) {
    var bankRows = parseBankSheet();
    var contractData = parseAllContractSheets();
    var contractRows = contractData.rows;

    // FOCUS: 200 entries from contract sheets only as main list
    // Bank is confirmation at end
    var filterStatus = p.filterStatus || "all";
    var filterFY = p.filterFY || "all";
    var search = (p.search || "").toLowerCase();
    var dateFrom = p.dateFrom || "";
    var dateTo = p.dateTo || "";

    // Build bank lookup by date+amount for fast confirmation
    var bankByDateAmount = {};
    for (var bi = 0; bi < bankRows.length; bi++) {
      var b = bankRows[bi];
      var key = (b.date || "") + "|" + (b.credit || b.debit);
      if (!bankByDateAmount[key]) bankByDateAmount[key] = [];
      bankByDateAmount[key].push(b);
    }

    var combined = [];
    for (var ci = 0; ci < contractRows.length; ci++) {
      var c = contractRows[ci];
      // Find matching bank entry by date + amount (exact) or near date
      var bestMatch = null;
      var bestScore = null;
      for (var bj = 0; bj < bankRows.length; bj++) {
        var bb = bankRows[bj];
        var m = smartMatch(bb, c);
        if (m.type !== "unmatched" && (!bestScore || m.confidence > bestScore.confidence)) {
          bestScore = m;
          bestMatch = bb;
        }
      }
      var matchType = bestScore ? bestScore.type : "unmatched";
      var confidence = bestScore ? bestScore.confidence : 0;
      var dateDiff = bestScore ? bestScore.dateDiff : 0;
      var amountDiff = bestScore ? bestScore.amountDiff : 0;

      combined.push({
        contract: c,
        bank: bestMatch, // Bank confirmation attached at end
        matchType: matchType,
        confidence: confidence,
        dateDiff: dateDiff,
        amountDiff: amountDiff
      });
    }

    // Apply filters — but main list is always 200 contract entries
    var filtered = combined.filter(function (r) {
      if (filterStatus !== "all" && r.matchType !== filterStatus) return false;
      if (filterFY !== "all") {
        if (r.contract.fy !== filterFY) return false;
      }
      if (search) {
        var hay = (r.contract.workName || "") + " " + (r.contract.workPlace || "") + " " + (r.contract.fileName || "") + " " + ((r.bank && r.bank.description) || "");
        if (hay.toLowerCase().indexOf(search) < 0) return false;
      }
      if (dateFrom && r.contract.receiptDate && r.contract.receiptDate < dateFrom) return false;
      if (dateTo && r.contract.receiptDate && r.contract.receiptDate > dateTo) return false;
      return true;
    });

    // Sort by receipt date descending (latest first) like Tally Day Book
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
      bankRows: bankRows,
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
        bankCount: bankRows.length,
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
    if (workNameCol >= 0 && p.workName) {
      sheet.getRange(p.rowIndex, workNameCol + 1).setValue(p.workName);
    }
    if (workPlaceCol >= 0 && p.workPlace) {
      sheet.getRange(p.rowIndex, workPlaceCol + 1).setValue(p.workPlace);
    }
    Audit.log(user, "UPDATE", "bank_live", p.gid + ":" + p.rowIndex, null, { workName: p.workName, workPlace: p.workPlace }, "Live sheet edit", requestId);
    return { ok: true, gid: p.gid, rowIndex: p.rowIndex };
  }

  return { liveRecon: liveRecon, liveSheets: liveSheets, liveUpdate: liveUpdate };
})();
