/********************************************************************
 * AR ENTERPRISES ERP — Gmail → Sheet Sync + Bank Statement v3
 *
 * v4 புதியவை:
 *   • arStmtParseMails() — CUB statement PDF mails → PDF→Doc convert →
 *     transaction lines parse → "Polinchi BS 1712" tab-ல் append
 *     (duplicate தவிர்ப்பு; StmtLog/StmtRaw tab-ல் அறிக்கை)
 *   • arStmtRenumber() — S.No மீட்டமைப்பு
 *   முன்நிபந்தனை: Editor → Services (+) → Drive API → Add
 * v3 புதியவை:
 *  1) City Union Bank mails சரியாக "Bank" வகைப்படும் (classifier fix)
 *  2) arMailReclassify() — ஏற்கனவே உள்ள எல்லா mails-ஐயும் மீண்டும்
 *     வகைப்படுத்தும் (ஒரு முறை run செய்யவும்)
 *  3) arStmtDumpSample() — bank statement mails-ன் உள்ளடக்கத்தை
 *     "MailRaw" tab-ல் எழுதும் (auto-parser வடிவமைக்க உதவும்)
 *  4) arStmtToken() — website-ல் இருந்து Description Details edit-ஐ
 *     Sheet-ல் எழுத write-back-க்கு token உருவாக்கும்
 *  5) doPost() — website "Bank Statement" page edit → Sheet write
 *
 * வரிசை: பழையதை முழுவதும் நீக்கி இதை paste → Save →
 *   Run arMailSetup (ஒரே முறை) → Run arMailReclassify →
 *   Run arStmtToken (token-ஐ log-ல் copy செய்யவும்) →
 *   Run arStmtDumpSample (statement mail format ஆராய) →
 *   Deploy → New deployment → Web app (Execute as: Me, Access: Anyone)
 *   → /exec URL-ஐ website Bank Statement page-ன் 🔗 Connect-ல் paste.
 ********************************************************************/

// ---- CONFIG ----
var WORKBOOK_ID = '1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw';
var TAB_NAME = 'MailInbox';
var STMT_TAB = 'Polinchi B/S 1712'; // கவனம்: உண்மையான பெயரில் slash — xlsx export மட்டும் 'BS' என காட்டும்
var STMT_TAB_GID = 2024650928;
function arStmtSheet_(ss, tab) {
  tab = String(tab || '');
  var sheets = ss.getSheets(), i, s2;
  if (tab.indexOf('gid:') === 0) {
    var g = tab.slice(4);
    for (i = 0; i < sheets.length; i++) if (String(sheets[i].getSheetId()) === g) return sheets[i];
  }
  if (tab) { s2 = ss.getSheetByName(tab); if (s2) return s2; }
  for (i = 0; i < sheets.length; i++) if (String(sheets[i].getSheetId()) === String(STMT_TAB_GID)) return sheets[i];
  var als = ['Polinchi B/S 1712', 'Polinchi BS 1712'];
  for (i = 0; i < als.length; i++) { s2 = ss.getSheetByName(als[i]); if (s2) return s2; }
  return null;
}
var INITIAL_DAYS = 366;
var MAX_PER_RUN = 200;
var SAVE_ATTACHMENTS = true;

function arMailSheet_() {
  var ss = SpreadsheetApp.openById(WORKBOOK_ID);
  var sh = ss.getSheetByName(TAB_NAME);
  if (!sh) {
    sh = ss.insertSheet(TAB_NAME);
    sh.appendRow(['Date', 'From', 'Subject', 'Category', 'Invoice No', 'Amount', 'Attachment', 'Gmail Link', 'MsgID']);
    sh.getRange(1, 1, 1, 9).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function arMailSeen_(sh) {
  var seen = {}, data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) seen[String(data[r][8])] = true;
  return seen;
}

function arMailRow_(msg, thread, saveAtts) {
  var dt = msg.getDate();
  var from = msg.getFrom();
  var subj = msg.getSubject() || '(no subject)';
  var body = '';
  try { body = msg.getPlainBody().slice(0, 4000); } catch (e) { body = ''; }
  var cat = arMailClassify(from, subj, body);
  var inv = '', amt = '';
  var mInv = body.match(/(?:invoice|inv|bill)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Za-z0-9\/\-\.]{4,20})/i);
  if (mInv) inv = mInv[1];
  var mAmt = body.match(/(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (mAmt) amt = Number(mAmt[1].replace(/,/g, ''));
  var attNames = '', attLinks = '';
  try {
    var atts = msg.getAttachments();
    attNames = atts.map(function (a) { return a.getName(); }).join(', ');
    if (saveAtts) {
      atts.forEach(function (a) {
        try {
          var fl = DriveApp.createFile(a.copyBlob());
          fl.setName(arMailToday() + '_' + a.getName());
          attLinks += (attLinks ? ' | ' : '') + fl.getUrl();
        } catch (e2) {}
      });
    }
  } catch (e3) {}
  return [dt, from, subj, cat, inv, amt, attLinks || attNames, thread.getPermalink(), msg.getId()];
}

function arMailSync() {
  var sh = arMailSheet_();
  var props = PropertiesService.getScriptProperties();
  var lastEpoch = Number(props.getProperty('arMailLast') || 0);
  if (!lastEpoch) lastEpoch = Math.floor(Date.now() / 1000) - INITIAL_DAYS * 86400;
  var seen = arMailSeen_(sh);
  var threads = GmailApp.search('after:' + Math.floor(lastEpoch), 0, 60);
  var rows = [], newest = lastEpoch;
  for (var t = 0; t < threads.length && rows.length < MAX_PER_RUN; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length && rows.length < MAX_PER_RUN; m++) {
      var msg = msgs[m];
      if (seen[msg.getId()]) continue;
      var epoch = Math.floor(msg.getDate().getTime() / 1000);
      if (epoch <= lastEpoch) continue;
      if (epoch > newest) newest = epoch;
      rows.push(arMailRow_(msg, threads[t], SAVE_ATTACHMENTS));
    }
  }
  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
    props.setProperty('arMailLast', String(newest));
  } else {
    props.setProperty('arMailLast', String(Math.floor(Date.now() / 1000)));
  }
  return rows.length + ' mail(s) synced';
}

function arMailBackfillAll() {
  var sh = arMailSheet_();
  var props = PropertiesService.getScriptProperties();
  var seen = arMailSeen_(sh);
  var start = Number(props.getProperty('arBackfillStart') || 0);
  var deadline = Date.now() + 270000;
  var PAGEZ = 150, totalNew = 0;
  while (Date.now() < deadline) {
    var threads = GmailApp.search('after:2020/01/01', start, PAGEZ);
    if (!threads.length) { props.setProperty('arBackfillStart', '0'); break; }
    var batch = [];
    for (var t = 0; t < threads.length; t++) {
      var msgs = threads[t].getMessages();
      for (var m = 0; m < msgs.length; m++) {
        if (seen[msgs[m].getId()]) continue;
        seen[msgs[m].getId()] = true;
        batch.push(arMailRow_(msgs[m], threads[t], false));
      }
    }
    for (var b = 0; b < batch.length; b += 400) {
      var part = batch.slice(b, b + 400);
      sh.getRange(sh.getLastRow() + 1, 1, part.length, 9).setValues(part);
      totalNew += part.length;
    }
    start += threads.length;
    props.setProperty('arBackfillStart', String(start));
    if (threads.length < PAGEZ) { props.setProperty('arBackfillStart', '0'); break; }
  }
  var cont = Number(props.getProperty('arBackfillStart') || 0) > 0;
  return totalNew + ' mails backfilled' + (cont ? ' — மீண்டும் run செய்யவும்' : ' — முடிந்தது!');
}

// ---- வகைப்பாடு (v3: cityunionbank / cub / cheque / statement fix) ----
function arMailClassify(from, subj, body) {
  from = String(from || ''); subj = String(subj || ''); body = String(body || '');
  var s = (subj + ' ' + from + ' ' + body.slice(0, 600));
  if (/income\s?tax|incometax|\bpan\b|\btds\b|26as|traces|efiling|\bitr[\s\-]?\d|form\s?16/i.test(s)) return 'Income Tax';
  if (/gst|gstr|goods\s?and\s?services|gstn|e-?way\s?bill|e-?invoice/i.test(s)) return 'GST';
  if (/bank|cityunionbank|\bcub\b|neft|rtgs|\bimps\b|\bupi\b|credited|debited|\bemi\b|loan statement|cheque|statement of account/i.test(s)) return 'Bank';
  if (/invoice|purchase\s?order|quotation|delivery\s?challan|payment\s?due|proforma/i.test(s)) return 'Vendor';
  if (/municipality|panchayat|twad|jelc|electricity|\btneb\b|property\s?tax|\b Court\b|taluk|registrar/i.test(s)) return 'Government';
  return 'Other';
}

// ---- ஏற்கனவே உள்ள mails-ஐ மீண்டும் வகைப்படுத்த (ஒரு முறை run) ----
function arMailReclassify() {
  var sh = arMailSheet_();
  var data = sh.getDataRange().getValues();
  var n = 0;
  for (var r = 1; r < data.length; r++) {
    var cat = arMailClassify(String(data[r][1]), String(data[r][2]), '');
    if (cat !== data[r][3]) { sh.getRange(r + 1, 4).setValue(cat); n++; }
  }
  Logger.log('Reclassified: ' + n + ' rows updated');
  return n + ' rows reclassified';
}

// ---- Statement mail format ஆராய (MailRaw tab-ல் sample எழுதும்) ----
function arStmtDumpSample() {
  var ss = SpreadsheetApp.openById(WORKBOOK_ID);
  var sh = ss.getSheetByName('MailRaw') || ss.insertSheet('MailRaw');
  sh.clear();
  sh.appendRow(['Date', 'From', 'Subject', 'Attachments', 'Body (first 3000 chars)']);
  var threads = GmailApp.search('(statement OR "account statement") (cityunionbank OR CUB)', 0, 20);
  if (!threads.length) threads = GmailApp.search('statement', 0, 20);
  var n = 0;
  for (var t = 0; t < threads.length && n < 10; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length && n < 10; m++) {
      var msg = msgs[m];
      var body = '';
      try { body = msg.getPlainBody().slice(0, 3000); } catch (e) {}
      var atts = '';
      try { atts = msg.getAttachments().map(function (a) { return a.getName(); }).join(', '); } catch (e2) {}
      sh.appendRow([msg.getDate(), msg.getFrom(), msg.getSubject(), atts, body]);
      n++;
    }
  }
  Logger.log('MailRaw: ' + n + ' statement mail samples written');
  return n + ' samples in MailRaw';
}

// ---- Write-back token ----
function arStmtToken() {
  var props = PropertiesService.getScriptProperties();
  var tk = props.getProperty('arStmtToken');
  if (!tk) {
    tk = 'ARST-' + Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty('arStmtToken', tk);
  }
  Logger.log('Website Token (copy செய்யவும்): ' + tk);
  return tk;
}

// ---- Website edit → Sheet write (Web App POST) ----
function doPost(e) {
  var out = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);
  try {
    var b = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    if (String(b.token || '') !== String(props.getProperty('arStmtToken') || '')) {
      return out.setContent(JSON.stringify({ ok: false, error: 'bad token' }));
    }
    var tab = String(b.tab || STMT_TAB);
    var sh = arStmtSheet_(SpreadsheetApp.openById(WORKBOOK_ID), tab);
    if (!sh) return out.setContent(JSON.stringify({ ok: false, error: 'tab missing' }));
    var colNum = 0, letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', cl = String(b.col || 'J').toUpperCase();
    for (var i = 0; i < cl.length; i++) colNum = colNum * 26 + (letters.indexOf(cl[i]) + 1);
    var row = parseInt(b.row, 10);
    // v5.3: balKey+snoKey கொடுக்கப்பட்டால் சரியான row-ஐ தேடி எழுது (gviz row-கணக்கு தவறாக இருந்தாலும் சரி)
    if (b.balKey !== undefined && b.balKey !== '') {
      var dataR = sh.getDataRange().getValues();
      var hdrR = 0;
      for (var hI = 0; hI < Math.min(dataR.length, 25); hI++) {
        if (String(dataR[hI][2]).indexOf('Description') >= 0) hdrR = hI;
      }
      var balT = parseFloat(String(b.balKey).replace(/[^0-9.\-]/g, ''));
      var snoT = String(b.snoKey || '').replace(/[^0-9.\-]/g, '');
      var hits = [];
      for (var dI = hdrR + 1; dI < dataR.length; dI++) {
        var hv = parseFloat(String(dataR[dI][7]).replace(/[^0-9.\-]/g, ''));
        if (!isNaN(hv) && !isNaN(balT) && Math.abs(hv - balT) < 0.005) {
          if (snoT !== '') {
            var sv = String(dataR[dI][0]).replace(/[^0-9.\-]/g, '');
            if (sv !== '' && !isNaN(parseFloat(sv)) && Math.abs(parseFloat(sv) - parseFloat(snoT)) < 0.5) hits.push(dI + 1);
          } else hits.push(dI + 1);
        }
      }
      if (hits.length === 1) row = hits[0];
      else if (hits.length > 1) return out.setContent(JSON.stringify({ ok: false, error: 'ambiguous row (' + hits.length + ') — Refresh செய்து முயற்சிக்கவும்' }));
      else return out.setContent(JSON.stringify({ ok: false, error: 'row not found — website Refresh செய்யவும்' }));
      Logger.log('write-back row resolved: ' + row + ' (balKey ' + balT + ')');
    }
    if (!(row > 0) || !colNum) return out.setContent(JSON.stringify({ ok: false, error: 'bad row/col' }));
    // header label இல்லையெனில் எழுது
    var hdr = sh.getRange(row - (b.rowOffset || 1), colNum).getValue();
    sh.getRange(row, colNum).setValue(String(b.value || ''));
    return out.setContent(JSON.stringify({ ok: true, row: row, col: cl, value: String(b.value || '') }));
  } catch (err) {
    return out.setContent(JSON.stringify({ ok: false, error: String(err) }));
  }
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'AR Mail Sync v5.7' })).setMimeType(ContentService.MimeType.JSON);
}

function arMailToday() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function arMailSetup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'arMailSync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('arMailSync').timeBased().everyMinutes(10).create();
  Logger.log('Setup OK — trigger 10 நிமிடம் ஒன்றுக்கு run ஆகும்.');
}

// ==================================================================
// v4 — பேங்க் ஸ்டேட்மெண்ட் PDF mails-ஐ தானாக parse செய்து BS tab-ல் சேர்த்தல்
// முன்நிபந்தனை: Editor → Services (+) → Drive API (v2) → Add
// ==================================================================

// ==================================================================
// v5.8 — netbanking balance-first PDF ஆதரவு: IL parser glue-split + next-line amount pairing + printed-Total gate + legacy-crash fix; v5.7 — queue-based D/C from bank's own columns + per-page chain-mis counters; extra PDF ids via ScriptProperties arStmtExtraPdf
// Run செய்து Execution log-ல் வருவதை முழுவதும் copy செய்யவும்
// ==================================================================
function arStmtDiag() {
  var out = [];
  out.push('1) STMT_TAB = "' + STMT_TAB + '" (gid ' + STMT_TAB_GID + ')');
  var ss = SpreadsheetApp.openById(WORKBOOK_ID);
  var sh = arStmtSheet_(ss, STMT_TAB);
  out.push('2) getSheetByName → ' + (sh ? 'FOUND (rows=' + sh.getLastRow() + ')' : '*** NULL — tab கிடைக்கவில்லை! ***'));
  var names = ss.getSheets().map(function (x) { return x.getName(); });
  out.push('3) tabs = ' + names.join(' | '));
  var t1 = GmailApp.search('from:cityunionbank.in (statement OR statementofaccount OR "statement of account")', 0, 50);
  out.push('4) search A (from:cityunionbank.in + statement) threads = ' + t1.length);
  var t2 = GmailApp.search('statement', 0, 50);
  out.push('5) search B (statement plain) threads = ' + t2.length);
  var t3 = GmailApp.search('from:cityunionbank.in', 0, 50);
  out.push('6) search C (from:cityunionbank.in only) threads = ' + t3.length);
  var pdfCount = 0;
  for (var i = 0; i < Math.min(t1.length, 20); i++) {
    var msgs = t1[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var atts = msgs[j].getAttachments();
      for (var k = 0; k < atts.length; k++) if (/\.pdf$/i.test(atts[k].getName())) pdfCount++;
    }
  }
  out.push('7) PDF attachments in search-A sample = ' + pdfCount);
  try {
    var tst = Drive.Files.list({ maxResults: 1 });
    out.push('8) Drive API OK (Files.list works)');
  } catch (eD) {
    out.push('8) *** Drive API FAIL: ' + String(eD).slice(0, 120) + ' ***');
  }
  var msg = out.join('\n');
  Logger.log('\n' + msg);
  return msg;
}

function arStmtParseMails() {
  Logger.log('arStmtParseMails: START');
  var props = PropertiesService.getScriptProperties();
  var processed = {};
  var pr = props.getProperty('arStmtProcessed') || '';
  if (pr) pr.split(',').forEach(function (x) { processed[x] = 1; });

  var ss = SpreadsheetApp.openById(WORKBOOK_ID);
  var sh = arStmtSheet_(ss, STMT_TAB);
  if (!sh) { Logger.log('FATAL: statement tab கிடைக்கவில்லை (gid ' + STMT_TAB_GID + ')'); return 'Tab missing'; }
  Logger.log('stmt tab resolved: "' + sh.getName() + '" (gid ' + sh.getSheetId() + ', rows=' + sh.getLastRow() + ')');
  var log = ss.getSheetByName('StmtLog');
  if (!log) { log = ss.insertSheet('StmtLog'); log.appendRow(['Time', 'MailID', 'Status', 'Detail']); }
  var raw = ss.getSheetByName('StmtRaw');
  if (!raw) { raw = ss.insertSheet('StmtRaw'); raw.appendRow(['MailID', 'PDF Name', 'Text (first 5000)']); }

  var added = 0, skipped = 0, failed = 0, start = 0;
  var QUERY = 'from:cityunionbank.in (statement OR statementofaccount OR "statement of account")';
  while (start < 200) {
  var threads = GmailApp.search(QUERY, start, 50);
  if (!threads.length) break;
  Logger.log('search page ' + start + ' → ' + threads.length + ' threads');

  for (var t = 0; t < threads.length; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var msg = msgs[m], mid = msg.getId();
      if (processed[mid]) { skipped++; continue; }
      var pdf = null, pdfName = '';
      try {
        var atts = msg.getAttachments();
        for (var a = 0; a < atts.length; a++) {
          if (/\.pdf$/i.test(atts[a].getName())) { pdf = atts[a]; pdfName = atts[a].getName(); break; }
        }
      } catch (e) {}
      if (!pdf) {
        processed[mid] = 1;
        log.appendRow([new Date(), mid, 'SKIP', 'no pdf: ' + msg.getSubject()]);
        continue;
      }
      try {
        var blob = pdf.copyBlob();
        var docFile = Drive.Files.insert({
          title: 'STMT_' + mid,
          mimeType: 'application/vnd.google-apps.document'
        }, blob, { convert: true });
        var text = arStmtDocText_(docFile.id);
        var res = arStmtParseText_(text);
        if (res.stats && !res.stats.pass) {
          failed++;
          var st = res.stats;
          log.appendRow([new Date(), mid, 'INTEGRITY FAIL', 'rows=' + st.rows + ' C=' + st.credits + ' D=' + st.debits + ' open=' + st.opening + ' close=' + st.closing + ' — SKIP (மீண்டும் முயற்சிக்கப்படும்)']);
          var rawF = ss.getSheetByName('StmtRaw');
          if (!rawF) { rawF = ss.insertSheet('StmtRaw'); rawF.appendRow(['MailID', 'PDF Name', 'Text (first 5000)']); }
          rawF.appendRow([mid, pdfName, String(text).slice(0, 300000)]);
          continue;
        }
        if (res.rows.length) {
          var nAdd = arStmtAppendRows_(sh, res.rows);
          added += nAdd;
          log.appendRow([new Date(), mid, 'OK', nAdd + ' new rows | ' + pdfName + ' | unparsed:' + res.unparsed]);
        } else {
          failed++;
          log.appendRow([new Date(), mid, 'NOPARSE', '0 rows | ' + pdfName + ' — StmtRaw-ல் text பார்க்கவும்']);
          raw.appendRow([mid, pdfName, text.slice(0, 5000)]);
        }
        processed[mid] = 1;
        try { Drive.Files.remove(docFile.id); } catch (e2) {}
      } catch (err) {
        failed++;
        log.appendRow([new Date(), mid, 'ERROR', String(err).slice(0, 200)]);
        if (/Drive is not defined|Cannot read|Files/.test(String(err))) {
          log.appendRow([new Date(), mid, 'HINT', 'Editor → Services (+) → Drive API v2 Add செய்யவும்']);
        }
      }
    }
  }
  start += threads.length;
  if (threads.length < 50) break;
  }
  props.setProperty('arStmtProcessed', Object.keys(processed).join(','));
  try { arStmtFinalize_(sh); } catch (eS) { Logger.log('finalize: ' + String(eS)); }
  var msg2 = added + ' NEW rows, ' + skipped + ' skipped, ' + failed + ' failed — date ஏற்றம் முடிந்தது, விவரம் StmtLog tab';
  Logger.log(msg2);
  return msg2;
}

// v4.3: Doc text via Drive export (documents scope தேவையே இல்லை)
function arStmtDocText_(docId) {
  var errs = [];
  // வழி 1: Drive v2 REST export (UrlFetchApp)
  try {
    var resp = UrlFetchApp.fetch('https://www.googleapis.com/drive/v2/files/' + docId + '/export?mimeType=text/plain', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) return resp.getContentText('utf-8');
    errs.push('rest:' + resp.getResponseCode() + ':' + resp.getContentText().slice(0, 140));
  } catch (e1) { errs.push('rest:' + String(e1).slice(0, 140)); }
  // வழி 2: DocumentApp
  try {
    return DocumentApp.openById(docId).getBody().getText();
  } catch (e2) { errs.push('docapp:' + String(e2).slice(0, 140)); }
  throw new Error('docText failed [' + errs.join(' | ') + ']');
}

// v4.9 CUB column-block parser: ஒவ்வொரு பக்கத்திற்கும் Amt Brought Forward seed + balance-block சரிபார்ப்பு
// (dates-line + continuation lines → N tx; amounts-ல் expected closing-ஐ தேடி balance block அமைத்தல்; diff-ஆல் debit/credit)
function arStmtParseCUB_(text) {
  var T = String(text || '');
  if (T.indexOf('STATEMENT OF ACCOUNT') < 0 && T.indexOf('CITY UNION BANK') < 0) return { rows: [], unparsed: 0 };
  var pages = T.split(/\n(?=Account No : \d+)/);
  var AMT = /\d{1,3}(?:,\d{2,3})*\.\d{2}/g;
  var DATE = /\d{2}-[A-Z]{3}-\d{4}/g;
  var MO = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  var meta = [];
  for (var q = 0; q < pages.length; q++) {
    var bf = pages[q].match(/(?:Amt Brought Forward\s*:?\s*|Opening Balance as on \d{2}-[A-Z]{3}-\d{4}\s+)([\d,]+\.\d{2})/);
    meta.push({ bf: bf ? parseFloat(bf[1].replace(/,/g, '')) : null });
  }
  var rows = [], unparsed = 0, carryBal = null, pgs = [];
  for (var p = 0; p < pages.length; p++) {
    if (/END OF REPORT|Total Debits|Total Credits/.test(pages[p])) { Logger.log('CUB page ' + (p + 1) + ' = summary, skipped'); pgs.push({ p: p + 1, dates: 0, built: 0, mode: 'summary' }); continue; }
    var ilLines = 0;
    for (var li = 0; li < pages[p].split(/\r?\n/).length; li++) {
      if (/^\s*\d{2}-[A-Z]{3}-\d{4}\b/.test(pages[p].split(/\r?\n/)[li]) && /\b(TO|BY)\b/.test(pages[p].split(/\r?\n/)[li])) ilLines++;
    }
    if (ilLines >= 2) { Logger.log('CUB page ' + (p + 1) + ' = interleaved (' + ilLines + ' lines), block-skip'); pgs.push({ p: p + 1, dates: 0, built: 0, mode: 'interleaved' }); continue; }
    var lines = pages[p].split(/\r?\n/);
    var di = -1, best = 0, dates = [];
    for (var i = 0; i < lines.length; i++) {
      var ds = lines[i].match(DATE);
      if (ds && ds.length > best) { best = ds.length; di = i; dates = ds; }
    }
    if (di < 0) continue;
    // dates-வரி அடுத்த வரியிலும் தொடரலாம் (date-only lines சேர்)
    var k = di + 1;
    while (k < lines.length) {
      var dd = lines[k].match(DATE);
      if (dd && lines[k].replace(DATE, '').replace(/[\s\t]/g, '') === '') { dates = dates.concat(dd); k++; }
      else break;
    }
    var N = dates.length;
    if (!N) continue;
    // amounts + particulars சேகரிப்பு
    var amounts = [], parts = [], cur = null;
    for (var j = di + 1; j < lines.length; j++) {
      var t = lines[j].replace(/\t/g, ' ').trim();
      if (!t || /Page \d+ of \d+/.test(t) || /^Regd\. Office|^Telephone No|^CIN :/.test(t)) {
        if (/Page \d+ of \d+|^Regd\. Office|^Telephone No|^CIN :/.test(t)) break;
        continue;
      }
      if (/^(TO|BY)\b/.test(t)) {
        var items = t.split(/\s+(?=(?:TO|BY)\b)/);
        for (var x = 0; x < items.length; x++) { cur = items[x].trim(); parts.push(cur); }
        continue;
      }
      if (/^[\d\s]+$/.test(t)) continue; // chq-no block
      var amts = t.match(AMT);
      var pureAmt = amts && t.replace(/[\d,.\s]/g, '') === '';
      if (cur && !pureAmt) { cur = (cur + ' ' + t).trim(); parts[parts.length - 1] = cur; continue; }
      if (amts) { for (var a = 0; a < amts.length; a++) amounts.push(parseFloat(amts[a].replace(/,/g, ''))); }
      else if (cur) { cur = (cur + ' ' + t).trim(); parts[parts.length - 1] = cur; }
    }
    if (amounts.length < N) { Logger.log('CUB page ' + (p + 1) + ' SKIP: dates=' + N + ' amounts=' + amounts.length); unparsed += N; pgs.push({ p: p + 1, dates: N, built: 0, mode: 'SKIP:amounts' }); continue; }
    // balance block: அடுத்த பக்கத்தின் Brought Forward = இப்பக்க closing → amounts-ல் கடைசி நிகழ்வை தேடு
    var endIdx = amounts.length - 1;
    var expClose = (p + 1 < pages.length && meta[p + 1].bf !== null) ? meta[p + 1].bf : null;
    if (expClose !== null) {
      for (var y = amounts.length - 1; y >= N - 1; y--) {
        if (Math.abs(amounts[y] - expClose) < 0.005) { endIdx = y; break; }
      }
    }
    var startIdx = endIdx - N + 1;
    if (startIdx < 0) { Logger.log('CUB page ' + (p + 1) + ' SKIP2: N=' + N + ' amounts=' + amounts.length); unparsed += N; pgs.push({ p: p + 1, dates: N, built: 0, mode: 'SKIP:anchor' }); continue; }
    Logger.log('CUB page ' + (p + 1) + ' OK: N=' + N + ' endIdx=' + endIdx + '/' + (amounts.length - 1) + (expClose !== null ? ' anchored' : ' blind'));
    // v5.7: bank-ன் சொந்த Debit/Credit column values-ஐ queue முறையில் பயன்படுத்துதல்
    // text வரிசை = [Debit values] [Credit values] [Balance values]; TO/BY கணக்கு பொருந்தினால் மட்டும் queue முறை
    var pre = amounts.slice(0, startIdx);
    var cntTo = 0, cntBy = 0;
    for (var pr = 0; pr < parts.length; pr++) {
      var upc = String(parts[pr]).toUpperCase();
      if (/^TO\b/.test(upc)) cntTo++;
      else if (/^BY\b/.test(upc)) cntBy++;
    }
    var useQ = (pre.length === cntTo + cntBy && (cntTo + cntBy) > 0);
    var dQ = useQ ? pre.slice(0, cntTo) : [];
    var cQ = useQ ? pre.slice(cntTo) : [];
    var pgBefore = rows.length, pgMis = 0, qUsed = 0, qFall = 0;
    var prev = (meta[p].bf !== null) ? meta[p].bf : carryBal;
    for (var r = 0; r < N; r++) {
      var bal = amounts[startIdx + r];
      var desc = parts[r] || '';
      var upr = desc.toUpperCase();
      var amt = '', credit = false;
      if (useQ && /^TO\b/.test(upr) && dQ.length) { amt = dQ.shift(); credit = false; qUsed++; }
      else if (useQ && /^BY\b/.test(upr) && cQ.length) { amt = cQ.shift(); credit = true; qUsed++; }
      else {
        qFall++;
        var diff2 = (prev !== null && prev !== undefined) ? Math.round((bal - prev) * 100) / 100 : null;
        credit = (diff2 !== null && diff2 !== 0) ? diff2 > 0 : /^BY\b/.test(upr);
        amt = (diff2 !== null && diff2 !== 0) ? Math.abs(diff2) : '';
      }
      if (amt !== '' && prev !== null && prev !== undefined) {
        var expBal = Math.round((credit ? prev + amt : prev - amt) * 100) / 100;
        if (Math.abs(expBal - bal) > 0.02) pgMis++;
      }
      var dm = dates[r].match(/(\d{2})-([A-Z]{3})-(\d{4})/);
      var dt = new Date(Number(dm[3]), MO[dm[2]] - 1, Number(dm[1]));
      rows.push([null, dt, desc, '', '', credit ? '' : amt, credit ? amt : '', String(bal)]);
      prev = bal; carryBal = bal;
    }
    Logger.log('CUB page ' + (p + 1) + ' assign: ' + (useQ ? 'queue(TO=' + cntTo + ',BY=' + cntBy + ')' : 'diff-fallback') + ' used=' + qUsed + ' fall=' + qFall + ' chainMis=' + pgMis);
    pgs.push({ p: p + 1, dates: N, built: rows.length - pgBefore, mode: (useQ ? 'queue' : 'diff') + '/' + (expClose !== null ? 'anchored' : 'blind') + '/mis' + pgMis });
  }
  return { rows: rows, unparsed: unparsed, pages: pgs };
}

// v5.4b: interleaved candidates (dt, desc, chq, amount-pair options) — chain தீர்வு arStmtParseText_ merge-walk-ல்
function arStmtParseCUBIL_(text) {
  var T = String(text || '');
  if (T.indexOf('CITY UNION BANK') < 0) return [];
  var DATER = /\d{2}-[A-Z]{3}-\d{4}/g;
  var AMTR = /\d{1,3}(?:,\d{2,3})*\.\d{2}/g;
  var MO = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  var cands = [], lines = T.split(/\r?\n/);
  var isDateStart = function (s) { return /^\d{2}-[A-Z]{3}-\d{4}\b/.test(s); };
  var leadBalOf = function (s) { var m = s.match(/^(\d{1,3}(?:,\d{2,3})*\.\d{2})\s*(\d{2}-[A-Z]{3}-\d{4})\b/); return m ? parseFloat(m[1].replace(/,/g, '')) : null; };
  // v5.8: netbanking balance-first layout ("1,000.0007-MAR-2022 BY ...") + பழைய date-start layout இரண்டும் ஆதரவு
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i].replace(/\t/g, ' ').trim();
    raw = raw.replace(/(\.\d{2})(\d{2}-[A-Z]{3}-\d{4})/g, '$1 $2').replace(/(\d{2}-[A-Z]{3}-\d{4})(\d)/g, '$1 $2'); // glue split
    if (/Brought\s*Forward|Opening\s*Balance/i.test(raw)) continue; // anchor/heading lines — ஒருபோதும் txn இல்லை
    var leadBal = leadBalOf(raw);
    if (!isDateStart(raw) && leadBal === null) continue;
    var hasTB = /\b(TO|BY)\b/.test(raw);
    var dts = [], mD;
    DATER.lastIndex = 0;
    while ((mD = DATER.exec(raw)) !== null) dts.push({ d: mD[0], i: mD.index });
    if (!dts.length) continue;
    var segs = [];
    for (var gI = 0; gI < dts.length; gI++) {
      var st = dts[gI].i, en = (gI + 1 < dts.length) ? dts[gI + 1].i : raw.length;
      segs.push({ d: dts[gI].d, txt: raw.slice(st, en) });
    }
    for (var sI = 0; sI < segs.length; sI++) {
      var seg = segs[sI].txt.replace(/\t/g, ' ').trim(), am = seg.match(AMTR);
      var pm = segs[sI].d.match(/(\d{2})-([A-Z]{3})-(\d{4})/);
      var dtx = new Date(Number(pm[3]), MO[pm[2]] - 1, Number(pm[1]));
      var pairs = [];
      var dsc = seg.replace(/\d{2}-[A-Z]{3}-\d{4}/g, ' ');
      var segBal = (sI === 0 && leadBal !== null) ? leadBal : null;
      if (segBal !== null) {
        // balance date-க்கு முன்; amount narration பின் (அதே வரி அல்லது அடுத்த 1-3 வரிகளில்)
        if (am && am.length) {
          var aL = parseFloat(am[am.length - 1].replace(/,/g, ''));
          pairs.push([aL, segBal]);
          pairs.push([segBal, aL]);
        } else {
          var nxt = '', got2 = null, got2s = '';
          for (var fJ = 1; fJ <= 6; fJ++) { // v5.8: amount 4-5 வரி கீழே இருக்கலாம் (TO ONL/NACH/00060/AMT wrap)
            var ln = (i + fJ < lines.length) ? lines[i + fJ].replace(/\t/g, ' ').trim() : '';
            if (!ln || isDateStart(ln) || leadBalOf(ln) !== null) break;
            if (/Brought\s*Forward|Page \d+ of \d+|END OF REPORT|Total/i.test(ln)) break;
            var am2 = ln.match(AMTR);
            nxt += ' ' + ln;
            if (am2 && am2.length) { got2 = parseFloat(am2[am2.length - 1].replace(/,/g, '')); got2s = am2[am2.length - 1]; break; }
          }
          if (got2 === null) continue;
          pairs.push([got2, segBal]);
          pairs.push([segBal, got2]);
          dsc = dsc + ' ' + nxt;
          dsc = dsc.replace(got2s, ' ');
        }
        for (var xI2 = 0; am && xI2 < am.length; xI2++) dsc = dsc.replace(am[xI2], ' ');
      } else {
        if (!am || am.length < 2) continue;
        var a0 = parseFloat(am[0].replace(/,/g, '')), a1 = parseFloat(am[1].replace(/,/g, ''));
        var aL2 = parseFloat(am[am.length - 1].replace(/,/g, ''));
        var narrIdx = seg.search(/\b(TO|BY)\b/);
        var firstAmtIdx = seg.indexOf(am[0]);
        if (narrIdx < 0 || (firstAmtIdx >= 0 && firstAmtIdx < narrIdx)) {
          pairs.push([aL2, a0]); // balance முதலில் (date பின்), amount கடைசியில் — CUB interleaved TO-format
        } else {
          pairs.push([a0, a1]); // narration பின் (amt, bal) — BY-format
        }
        pairs.push([a1, a0]);
        if (am.length > 2) pairs.push([a0, aL2]);
        for (var xI = 0; xI < am.length; xI++) dsc = dsc.replace(am[xI], ' ');
        if (!hasTB) {
          var prevL = i > 0 ? lines[i - 1].replace(/\t/g, ' ').trim() : '';
          var nextL = i + 1 < lines.length ? lines[i + 1].replace(/\t/g, ' ').trim() : '';
          if (prevL && !/\d{2}-[A-Z]{3}-\d{4}/.test(prevL) && !AMTR.test(prevL) && /[A-Za-z]{3}/.test(prevL)) dsc = prevL + ' ' + dsc;
          if (nextL && !/\d{2}-[A-Z]{3}-\d{4}/.test(nextL) && !AMTR.test(nextL) && /[A-Za-z]{3}/.test(nextL)) dsc = (dsc + ' ' + nextL).trim();
          AMTR.lastIndex = 0;
        }
      }
      dsc = dsc.replace(/\s{2,}/g, ' ').trim();
      var chq = '';
      var mc = dsc.match(/\b(\d{3,6})\b\s*$/);
      if (mc && mc[1] !== '00060') { chq = mc[1]; dsc = dsc.replace(/\b\d{3,6}\b\s*$/, '').trim(); }
      if (!dsc) dsc = '(narration வரி மாறுபட்டது)';
      cands.push({ dt: dtx, dsc: dsc, chq: chq, pairs: pairs });
    }
  }
  return cands;
}

function arStmtParseText_(text) {
  var res = arStmtParseCUB_(text);
  // v5.8: legacy fallback (undefined arStmtParseLegacy_ crash) நீக்கம் — block=0 எனில் IL-only merge-walk தொடரும்
  // ---- INTEGRITY GATE: opening/closing/மொத்தக் கணக்கு சரிபார்ப்பு ----
  var mOpen = text.match(/Opening Balance as on \d{2}-[A-Z]{3}-\d{4}\s+([\d,]+\.\d{2})/);
  if (!mOpen) mOpen = text.match(/([\d,]+\.\d{2})\s*Opening\s+Balance\s+as on \d{2}-[A-Z]{3}-\d{4}/); // v5.8: balance-முன் form
  var opening = mOpen ? parseFloat(mOpen[1].replace(/,/g, '')) : 0;
  // merge-walk v5.8: block rows + IL candidates → date-sort → **per-date GREEDY BALANCE-CHAIN reorder**
  // (bank print order = running-balance chain order; Google conversion same-date வரிசையை குலைக்கும் — chain மூலம் மீட்கப்படும்)
  var cands = arStmtParseCUBIL_(text);
  var combined = [];
  for (var bI = 0; bI < res.rows.length; bI++) combined.push({ t: res.rows[bI][1].getTime(), blk: res.rows[bI], il: null });
  for (var cI = 0; cI < cands.length; cI++) combined.push({ t: cands[cI].dt.getTime(), blk: null, il: cands[cI] });
  combined.sort(function (a, b) { return a.t - b.t || (a.blk ? -1 : 1); });
  var out = [], prev = opening, kept = 0, dropped = 0, ordMis = 0;
  var numv = function (x) { var v = parseFloat(String(x).replace(/[^0-9.\-]/g, '')); return isNaN(v) ? NaN : v; };
  var gi = 0;
  while (gi < combined.length) {
    var gj = gi;
    while (gj < combined.length && combined[gj].t === combined[gi].t) gj++;
    var gN = gj - gi, used = new Array(gN);
    for (var uI = 0; uI < gN; uI++) used[uI] = false;
    var made = 0;
    while (made < gN) {
      var pick = -1, pickAmt = 0, pickBal = 0;
      for (var mI = gi; mI < gj; mI++) {
        if (used[mI - gi]) continue;
        var o = combined[mI];
        if (o.blk) {
          var hv = numv(o.blk[7]);
          if (isNaN(hv)) continue;
          var dv = numv(o.blk[5]) || 0, cv = numv(o.blk[6]) || 0;
          if (Math.abs(prev - dv + cv - hv) < 0.01) { pick = mI; pickBal = hv; break; }
        } else {
          var cc = o.il;
          for (var pI = 0; pI < cc.pairs.length; pI++) {
            var amt = cc.pairs[pI][0], bal = cc.pairs[pI][1];
            if (Math.abs(prev + amt - bal) < 0.01 || Math.abs(prev - amt - bal) < 0.01) { pick = mI; pickAmt = amt; pickBal = bal; break; }
          }
          if (pick >= 0) break;
        }
      }
      if (pick < 0) break; // இந்த date-ல் chain தொடரவில்லை — மீதி original வரிசையில்
      var og = combined[pick];
      if (og.blk) {
        out.push(og.blk);
      } else {
        var credit = pickBal > prev;
        out.push([null, og.il.dt, og.il.dsc, og.il.chq, '', credit ? '' : pickAmt, credit ? pickAmt : '', String(pickBal)]);
        kept++;
      }
      used[pick - gi] = true; made++;
      prev = pickBal;
    }
    for (var rI = gi; rI < gj; rI++) {
      if (used[rI - gi]) continue;
      var oo = combined[rI];
      if (oo.blk) {
        out.push(oo.blk); ordMis++;
        var hv2 = numv(oo.blk[7]);
        if (!isNaN(hv2)) prev = hv2; // fallback-லும் balance chain தொடரும்
        Logger.log('ORDER-MIS: ' + String(oo.blk[1]) + ' | ' + String(oo.blk[2]).slice(0, 45) + ' | prev=' + prev);
      } else {
        dropped++;
        Logger.log('IL drop: prev=' + prev + ' pairs0=' + JSON.stringify(oo.il.pairs[0]) + ' | ' + oo.il.dsc.slice(0, 50));
      }
    }
    gi = gj;
  }
  Logger.log('CUB merge-walk: block=' + res.rows.length + ' IL-kept=' + kept + ' IL-dropped=' + dropped + ' order-mis=' + ordMis + ' total=' + out.length);
  var sorted = out.slice().sort(function (a, b) { return a[1] - b[1]; });
  var closing = NaN, sumC = 0, sumD = 0;
  for (var z = 0; z < sorted.length; z++) {
    var zv = parseFloat(String(sorted[z][7]).replace(/[^0-9.\-]/g, ''));
    if (!isNaN(zv)) closing = zv;
    sumD += parseFloat(sorted[z][5]) || 0;
    sumC += parseFloat(sorted[z][6]) || 0;
  }
  sumD = Math.round(sumD * 100) / 100; sumC = Math.round(sumC * 100) / 100;
  // v5.8: bank-ன் printed Total line cross-check (statement-ல் இருந்தால் கட்டாயம் பொருந்த வேண்டும்)
  var tD = null, tC = null, tLines = String(text).split(/\r?\n/);
  for (var ti = tLines.length - 1; ti >= 0 && tD === null; ti--) {
    var mT = tLines[ti].match(/([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*Total\b/) || tLines[ti].match(/\bTotal\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/);
    if (mT) { tD = parseFloat(mT[1].replace(/,/g, '')); tC = parseFloat(mT[2].replace(/,/g, '')); }
  }
  var totOk = true, totNote = 'no-total-line';
  if (tD !== null) {
    var oFwd = Math.abs(sumD - tD) <= 1 && Math.abs(sumC - tC) <= 1;
    var oRev = Math.abs(sumD - tC) <= 1 && Math.abs(sumC - tD) <= 1;
    totOk = oFwd || oRev;
    totNote = 'printed Total: D=' + tD + ' C=' + tC + ' -> ' + (totOk ? (oFwd ? 'MATCH(D,C)' : 'MATCH(C,D)') : 'MISMATCH');
  }
  var pass = (!isNaN(closing)) && Math.abs(sumC - sumD - (closing - opening)) <= 1 && ordMis === 0; // v5.8: order-mis=0 கட்டாயம் (ஒவ்வொரு row-ம் chain-ல் verify); printed-Total MISMATCH soft மட்டும் (PDF2 bank Total line rows-உடன் பொருந்தாது)
  var stats = {
    pages: (res.pages || []).length,
    pgAnchored: (res.pages || []).filter(function (x) { return x.mode === 'anchored'; }).length,
    pgBlind: (res.pages || []).filter(function (x) { return x.mode === 'blind'; }).length,
    pgSkipped: (res.pages || []).filter(function (x) { return String(x.mode).indexOf('SKIP') === 0; }).length,
    pgInterleaved: (res.pages || []).filter(function (x) { return x.mode === 'interleaved'; }).length,
    blockRows: res.rows.length, ilKept: kept, ilDropped: dropped, ordMis: ordMis,
    rows: out.length, credits: sumC, debits: sumD, opening: opening, closing: closing, totals: totNote, pass: pass
  };
  Logger.log('INTEGRITY ' + (pass ? 'PASS' : 'FAIL') + ': rows=' + out.length + ' C=' + sumC + ' D=' + sumD + ' open=' + opening + ' close=' + closing + ' | pages=' + stats.pages + ' anchored=' + stats.pgAnchored + ' blind=' + stats.pgBlind + ' interleaved=' + stats.pgInterleaved + ' skipped=' + stats.pgSkipped + ' ordMis=' + stats.ordMis + ' | ' + totNote);
  return { rows: out, unparsed: res.unparsed, stats: stats };
}

function arStmtAppendRows_(sh, newRows) {
  if (!newRows.length) return 0;
  var tz = Session.getScriptTimeZone();
  var lastRow = sh.getLastRow();
  var keys = {};
  if (lastRow > 5) {
    var ex = sh.getRange(1, 2, lastRow, 7).getValues();
    for (var r = 0; r < ex.length; r++) {
      var d = ex[r][0], dsc = String(ex[r][1] || '').replace(/\s+/g, ' ').trim();
      if (!dsc) continue;
      var bS = String(ex[r][6]).replace(/[^0-9.\-]/g, '');
      var dk = (d instanceof Date) ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : String(d).slice(0, 10);
      keys[dk + '|' + dsc + '|' + bS] = 1;
    }
  }
  var out = [];
  for (var i = 0; i < newRows.length; i++) {
    var nr = newRows[i];
    var nd = (nr[1] instanceof Date) ? Utilities.formatDate(nr[1], tz, 'yyyy-MM-dd') : String(nr[1]).slice(0, 10);
    var ndsc = String(nr[2] || '').replace(/\s+/g, ' ').trim();
    var nbS = String(nr[7] === undefined || nr[7] === null ? '' : nr[7]).replace(/[^0-9.\-]/g, '');
    if (keys[nd + '|' + ndsc + '|' + nbS]) continue;
    keys[nd + '|' + ndsc + '|' + nbS] = 1;
    out.push(nr);
  }
  if (out.length) {
    var need = sh.getLastRow() + out.length;
    if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 50);
    sh.getRange(sh.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
  }
  return out.length;
}

// v4.9: date ஏற்றம் + trailing garbage cleanup + CHAIN REPAIR (F/G = balance வேறுபாடு) + S.No
function arStmtFinalize_(sh) {
  var data = sh.getDataRange().getValues();
  var lastHeader = 0;
  for (var r = 0; r < Math.min(data.length, 25); r++) {
    if (String(data[r][2]).indexOf('Description') >= 0) lastHeader = r;
  }
  if (data.length > lastHeader + 2) {
    // STABLE in-memory sort: date ஏற்றம்; ஒரே தேதியில் statement-ன் அசல் வரிசை பாதுகாக்கப்படும்
    // (Google Sheet sort ties-ஐ கலக்கும் → balance chain உடையும் → debit/credit detection தவறும்)
    var nR = data.length - lastHeader - 1;
    var dA = sh.getRange(lastHeader + 2, 1, nR, 10).getValues();
    var ix = [];
    for (var ii = 0; ii < nR; ii++) ix.push(ii);
    ix.sort(function (a, b) {
      var da = (dA[a][1] instanceof Date) ? dA[a][1].getTime() : 0;
      var db = (dA[b][1] instanceof Date) ? dA[b][1].getTime() : 0;
      return da - db || a - b;
    });
    var sA = [];
    for (var i2 = 0; i2 < nR; i2++) sA.push(dA[ix[i2]]);
    sh.getRange(lastHeader + 2, 1, nR, 10).setValues(sA);
    SpreadsheetApp.flush();
  }
  // trailing empty-description garbage rows நீக்கு (parse junk)
  var dropped = 0;
  while (sh.getLastRow() > lastHeader + 2) {
    var lr = sh.getLastRow();
    var dsc = String(sh.getRange(lr, 3).getValue() || '').trim();
    if (!dsc) { sh.deleteRow(lr); dropped++; } else break;
  }
  // CHAIN REPAIR: F/G ஐ H வேறுபாட்டிலிருந்து மறுகணித்தல் (தொடக்க 0.00)
  var rng = sh.getRange(lastHeader + 2, 6, sh.getLastRow() - lastHeader - 1, 3);
  var vals = rng.getValues();
  var fixed = 0, prev = 0;
  for (var i = 0; i < vals.length; i++) {
    var h = parseFloat(String(vals[i][2]).replace(/[^0-9.\-]/g, ''));
    if (isNaN(h)) continue;
    var diff = Math.round((h - prev) * 100) / 100;
    var hasAmt = String(vals[i][0]).trim() !== '' || String(vals[i][1]).trim() !== '';
    if (!hasAmt && diff !== 0) {
      vals[i][0] = diff < 0 ? Math.abs(diff) : '';
      vals[i][1] = diff > 0 ? diff : '';
      fixed++;
    }
    prev = h;
  }
  rng.setValues(vals);
  if (vals.length) sh.getRange(lastHeader + 2, 6, vals.length, 3).setNumberFormat('#,##,##0.00');
  Logger.log('finalize: dropped=' + dropped + ' chainFixed=' + fixed);
  var data2 = sh.getDataRange().getValues();
  var num = [];
  for (var r2 = lastHeader + 1; r2 < data2.length; r2++) num.push([r2 - lastHeader]);
  if (num.length) sh.getRange(lastHeader + 2, 1, num.length, 1).setValues(num);
}

// ஒரே முறை: date ஏற்றம் + S.No மீட்டமை (கைமுறையாக run செய்யவும்)
function arStmtRenumber() {
  var sh = arStmtSheet_(SpreadsheetApp.openById(WORKBOOK_ID), STMT_TAB);
  if (!sh) return 'Tab missing';
  arStmtFinalize_(sh);
  Logger.log('Sorted by date + renumbered');
  return 'Sorted by date + rows numbered';
}

// v4.5: பழைய rows நீக்கி → 3 statement PDF-களிலிருந்து முழு வரலாறு rebuild (07-03-2022 → 30-09-2026)
function arStmtRebuild() {
  var IDS = [
    '1nsLjSP9CY0A84j7B7Tdub6gRXEP3h16C', // Statement 07-03-2022 → 05-09-2025 (v5.8 fresh netbanking copy — பழைய PDF Google conversion-ல் 20-Aug→04-Sep pages இழப்பு)
    '1u4fgwPeIdkg27BNvulACTylEiIY3CDT8', // Statement 06-09-2025 → 31-08-2026
    '1SG5nhG608EWkl0Z53fAqHVAujENz6eb6'  // Statement 01-09-2026 → 30-09-2026
  ];
  // கூடுதல் PDF-கள் (விடுபட்ட range mini-statement): ScriptProperties → arStmtExtraPdf = 'id1,id2'
  var EXTRA = String(PropertiesService.getScriptProperties().getProperty('arStmtExtraPdf') || '').split(',');
  for (var ei = 0; ei < EXTRA.length; ei++) {
    var ex = EXTRA[ei].replace(/[^a-zA-Z0-9_\-]/g, '');
    if (ex) { IDS.push(ex); Logger.log('extra PDF added: ' + ex); }
  }
  // v5.8: முழு IDS override — ScriptProperties arStmtRebuildIds = 'id1,id2' (PDF list-ஐ code மாற்றாமல் மாற்ற)
  var OVS = String(PropertiesService.getScriptProperties().getProperty('arStmtRebuildIds') || '').replace(/\s/g, '');
  if (OVS) {
    var OVL = OVS.split(',');
    var OVA = [];
    for (var oi = 0; oi < OVL.length; oi++) { var ox = OVL[oi].replace(/[^a-zA-Z0-9_\-]/g, ''); if (ox) OVA.push(ox); }
    if (OVA.length) { IDS = OVA; Logger.log('IDS overridden via arStmtRebuildIds: ' + IDS.join(',')); }
  }
  var ss = SpreadsheetApp.openById(WORKBOOK_ID);
  var sh = arStmtSheet_(ss, STMT_TAB);
  if (!sh) { Logger.log('FATAL: stmt tab missing'); return 'Tab missing'; }
  var log = ss.getSheetByName('StmtLog');
  if (!log) { log = ss.insertSheet('StmtLog'); log.appendRow(['Time', 'MailID', 'Status', 'Detail']); }
  var raw = ss.getSheetByName('StmtRaw');
  if (!raw) { raw = ss.insertSheet('StmtRaw'); raw.appendRow(['MailID', 'PDF Name', 'Text (first 5000)']); }
  // StmtRaw-ல் பழைய file: rows நீக்கு
  var rdata = raw.getDataRange().getValues();
  for (var rr = rdata.length - 1; rr >= 1; rr--) {
    if (String(rdata[rr][0]).indexOf('file:') === 0) raw.deleteRow(rr + 1);
  }
  // ===== படி 1: எல்லா PDF-ஐயும் parse + INTEGRITY GATE (clear செய்யாமல்!) =====
  var parsed = [], allPass = true, notes = [];
  for (var k = 0; k < IDS.length; k++) {
    var fid = IDS[k];
    try {
      var blob = DriveApp.getFileById(fid).getBlob();
      var docFile = Drive.Files.insert({ title: 'STMT_RB_' + fid, mimeType: 'application/vnd.google-apps.document' }, blob, { convert: true });
      var text = arStmtDocText_(docFile.id);
      try { Drive.Files.remove(docFile.id); } catch (e2) {}
      raw.appendRow(['file:' + fid, 'statement ' + (k + 1) + ' (FULL ' + String(text).length + ' chars)', String(text).slice(0, 300000)]);
      var res = arStmtParseText_(text);
      parsed.push({ fid: fid, k: k, res: res });
      var st = res.stats || {};
      if (res.stats && !res.stats.pass) {
        allPass = false;
        notes.push('PDF' + (k + 1) + ': ❌INTEGRITY FAIL (rows=' + st.rows + ' C=' + st.credits + ' D=' + st.debits + ' open=' + st.opening + ' close=' + st.closing + ')');
        log.appendRow([new Date(), 'file:' + fid, 'INTEGRITY FAIL', 'rows=' + st.rows + ' C=' + st.credits + ' D=' + st.debits + ' open=' + st.opening + ' close=' + st.closing + ' pages=' + st.pages + ' anchored=' + st.pgAnchored + ' blind=' + st.pgBlind + ' interleaved=' + st.pgInterleaved + ' skipped=' + st.pgSkipped + ' totals=[' + (st.totals || '') + '] — பழைய data பாதுகாக்கப்பட்டது']);
      } else {
        notes.push('PDF' + (k + 1) + ': ✅PASS (' + st.rows + ' rows, C=' + st.credits + ', D=' + st.debits + ', ' + st.opening + '→' + st.closing + ')');
        log.appendRow([new Date(), 'file:' + fid, 'INTEGRITY PASS', 'rows=' + st.rows + ' C=' + st.credits + ' D=' + st.debits + ' open=' + st.opening + ' → close=' + st.closing + ' pages=' + st.pages + ' anchored=' + st.pgAnchored + ' blind=' + st.pgBlind + ' interleaved=' + st.pgInterleaved + ' skipped=' + st.pgSkipped + ' totals=[' + (st.totals || '') + ']']);
      }
    } catch (err) {
      allPass = false;
      notes.push('PDF' + (k + 1) + ': ERROR ' + String(err).slice(0, 90));
      log.appendRow([new Date(), 'file:' + fid, 'ERROR', String(err).slice(0, 200)]);
    }
  }
  // ===== படி 2: எல்லாம் PASS என்றால் மட்டுமே clear + import =====
  if (!allPass) {
    var msg = '❌ REBUILD நிறுத்தப்பட்டது — சில PDF integrity fail. பழைய data அப்படியே பாதுகாக்கப்பட்டது. ' + notes.join(' | ');
    Logger.log(msg);
    return msg;
  }
  sh.getRange(5, 1, 2, 26).clearContent();
  sh.getRange(1, 10, 6, 1).clearContent();
  var mr = sh.getMaxRows();
  if (mr > 6) sh.deleteRows(7, mr - 6);
  SpreadsheetApp.flush();
  sh.getRange(7, 1, 1, 10).setValues([['S.No', 'Date', 'Description', 'Ref / Cheque No', 'Value Date', 'Debit', 'Credit', 'Balance', 'Notes', 'Description Details']]);
  sh.getRange(7, 1, 1, 10).setFontWeight('bold');
  SpreadsheetApp.flush();
  Logger.log('ALL PASS — old rows deleted structurally, fresh header at row 7, importing...');
  var total = 0, seen = {};
  var numvI = function (x) { var v = parseFloat(String(x).replace(/[^0-9.\-]/g, '')); return isNaN(v) ? 0 : v; };
  for (var k2 = 0; k2 < parsed.length; k2++) {
    var P = parsed[k2];
    try {
      var rowsF = [], dupes = 0;
      for (var ri = 0; ri < P.res.rows.length; ri++) {
        var rw = P.res.rows[ri];
        // v5.8 overlap dedupe: date+D+C+balance ஒன்றாக இருந்தால் அதே txn (running balance தனித்தது) — இரு முறை எழுதாது
        var dkey = (rw[1] && rw[1].getTime ? rw[1].getTime() : String(rw[1])) + '|' + numvI(rw[5]).toFixed(2) + '|' + numvI(rw[6]).toFixed(2) + '|' + numvI(rw[7]).toFixed(2);
        if (seen[dkey]) { dupes++; continue; }
        seen[dkey] = 1;
        rowsF.push(rw);
      }
      if (dupes) Logger.log('file ' + P.fid + ': ' + dupes + ' overlap rows skipped (dupe-safe)');
      var nAdd = arStmtAppendRows_(sh, rowsF);
      total += nAdd;
    } catch (err2) {
      notes.push('PDF' + (P.k + 1) + ' import ERROR: ' + String(err2).slice(0, 80));
    }
  }
  try { arStmtFinalize_(sh); } catch (eS) { Logger.log('finalize: ' + String(eS)); }
  var msg2 = '✅ REBUILD முடிந்தது: ' + total + ' rows (integrity-verified) — ' + notes.join(' | ');
  Logger.log(msg2);
  return msg2;
}

// v4.4: net-banking download செய்த PDF-ஐ import (gap 04-09-2025 → இன்று நிரப்ப)
// பயன்பாடு: statement PDF-ஐ Google Drive-ல் upload → arStmtImportPdf() run
function arStmtImportPdf() {
  var ss = SpreadsheetApp.openById(WORKBOOK_ID);
  var sh = arStmtSheet_(ss, STMT_TAB);
  if (!sh) return 'Tab missing';
  var log = ss.getSheetByName('StmtLog');
  if (!log) { log = ss.insertSheet('StmtLog'); log.appendRow(['Time', 'MailID', 'Status', 'Detail']); }
  var files = [];
  try { files = Drive.Files.list({ q: "mimeType='application/pdf' and trashed=false", orderBy: 'modifiedDate desc', maxResults: 30 }).items || []; } catch (e) { return 'Drive list fail: ' + e; }
  var added = 0, filesOk = 0, notes = [];
  for (var i = 0; i < files.length; i++) {
    var fname = files[i].title || '';
    try {
      var blob = DriveApp.getFileById(files[i].id).getBlob();
      var docFile = Drive.Files.insert({ title: 'STMT_DRV_' + files[i].id, mimeType: 'application/vnd.google-apps.document' }, blob, { convert: true });
      var text = arStmtDocText_(docFile.id);
      try { Drive.Files.remove(docFile.id); } catch (e2) {}
      var res = arStmtParseText_(text);
      if (res.stats && !res.stats.pass) {
        var st = res.stats;
        notes.push(fname + ': ❌INTEGRITY FAIL (C=' + st.credits + ' D=' + st.debits + ' close=' + st.closing + ') — SKIP');
        log.appendRow([new Date(), 'drive:' + fname, 'INTEGRITY FAIL', 'rows=' + st.rows + ' C=' + st.credits + ' D=' + st.debits + ' open=' + st.opening + ' close=' + st.closing]);
        var rawG = ss.getSheetByName('StmtRaw');
        if (!rawG) { rawG = ss.insertSheet('StmtRaw'); rawG.appendRow(['MailID', 'PDF Name', 'Text (first 5000)']); }
        rawG.appendRow(['drive:' + fname, fname, String(text).slice(0, 300000)]);
        continue;
      }
      if (!res.rows.length) {
        notes.push(fname + ': 0 rows');
        log.appendRow([new Date(), 'drive:' + fname, 'NOPARSE', 'StmtRaw-ல் text பார்க்கவும்']);
        var raw = ss.getSheetByName('StmtRaw');
        if (!raw) { raw = ss.insertSheet('StmtRaw'); raw.appendRow(['MailID', 'PDF Name', 'Text (first 5000)']); }
        raw.appendRow(['drive:' + fname, fname, String(text).slice(0, 5000)]);
        continue;
      }
      var n = arStmtAppendRows_(sh, res.rows);
      added += n; filesOk++;
      notes.push(fname + ': ' + n + ' new rows');
      log.appendRow([new Date(), 'drive:' + fname, 'OK', n + ' new rows']);
    } catch (err) {
      notes.push(fname + ': ERROR ' + String(err).slice(0, 100));
      log.appendRow([new Date(), 'drive:' + fname, 'ERROR', String(err).slice(0, 200)]);
    }
  }
  try { arStmtFinalize_(sh); } catch (eS) {}
  var msg = filesOk + ' files parsed, ' + added + ' NEW rows appended — ' + notes.join(' | ');
  Logger.log(msg);
  return msg;
}

// மணிக்கு ஒரு முறை புதிய PDF statement mails-ஐ தானாக parse (ஒரே முறை run செய்யவும்)
function arStmtInstallTrigger() {
  var props = PropertiesService.getScriptProperties();
  // பழைய trigger இருந்தால் நீக்கி புதிதாக install
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'arStmtParseMails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('arStmtParseMails').timeBased().everyHours(1).create();
  props.setProperty('arStmtTrigger', 'hourly');
  return 'HOURLY trigger installed — மணிக்கு ஒருமுறை புதிய statement mails தானாக parse ஆகும்';
}
