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
  var qDate = Utilities.formatDate(new Date(lastEpoch * 1000), 'GMT', 'yyyy/MM/dd'); // Gmail after: needs yyyy/MM/dd — epoch number gives 0 results!
  var threads = GmailApp.search('after:' + qDate, 0, 80);
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
  return rows.length + ' mail(s) synced (after:' + qDate + ')';
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

// v6.3: rebuild-க்கு முன் Description Details (col J) காப்பு — balKey(H)+snoKey(A) keyed; rebuild-க்குப் பின் திரும்ப எழுது
function arStmtCaptureJ_(sh) {
  try {
    var vr = sh.getDataRange().getValues(), out = {}, hdr = 0;
    for (var h = 0; h < Math.min(vr.length, 25); h++) if (String(vr[h][2]).indexOf('Description') >= 0) hdr = h;
    for (var i = hdr + 1; i < vr.length; i++) {
      var jv = String(vr[i][9] || '').trim();
      if (!jv) continue;
      var bv = parseFloat(String(vr[i][7]).replace(/[^0-9.\-]/g, ''));
      if (isNaN(bv)) continue;
      var sv = String(vr[i][0]).replace(/[^0-9.\-]/g, '');
      out[bv.toFixed(2) + '|' + sv] = jv;
    }
    return out;
  } catch (e) { return {}; }
}
function arStmtRestoreJ_(sh, cap) {
  try {
    if (!cap) return 0;
    var n = 0, lr = sh.getLastRow();
    if (lr <= 7) return 0;
    var vr = sh.getRange(7, 1, lr - 6, 10).getValues();
    for (var i = 0; i < vr.length; i++) {
      var bv = parseFloat(String(vr[i][7]).replace(/[^0-9.\-]/g, ''));
      if (isNaN(bv)) continue;
      var k = bv.toFixed(2) + '|' + String(vr[i][0]).replace(/[^0-9.\-]/g, '');
      if (cap[k]) { sh.getRange(7 + i, 10).setValue(cap[k]); n++; }
    }
    return n;
  } catch (e) { return 0; }
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

function arMailStatus() {
  var out = [], props = PropertiesService.getScriptProperties();
  var trs = ScriptApp.getProjectTriggers();
  out.push('1) Triggers: ' + (trs.length ? trs.map(function (t) { return t.getHandlerFunction(); }).join(', ') : '*** இல்லை! arMailSetup run பண்ணுங்க ***'));
  var le = props.getProperty('arMailLast');
  out.push('2) arMailLast = ' + (le ? new Date(Number(le) * 1000).toISOString() : '(empty)'));
  var sh = arMailSheet_();
  var lr = sh.getLastRow();
  out.push('3) Inbox tab rows = ' + (lr - 1));
  if (lr > 1) out.push('4) கடைசி row தேதி = ' + sh.getRange(lr, 1).getValue());
  out.push('5) Gmail கடந்த 9 நாள் threads = ' + GmailApp.search('newer_than:9d', 0, 5).length);
  out.push('6) Live sync → ' + arMailSync());
  out.push('7) sync பிறகு கடைசி row தேதி = ' + sh.getRange(sh.getLastRow(), 1).getValue());
  var msg = out.join('\n');
  Logger.log('\n' + msg);
  return msg;
}

// ==================================================================
// v4 — பேங்க் ஸ்டேட்மெண்ட் PDF mails-ஐ தானாக parse செய்து BS tab-ல் சேர்த்தல்
// முன்நிபந்தனை: Editor → Services (+) → Drive API (v2) → Add
// ==================================================================

// ==================================================================
// v6.4 — செக் நம்பர் website-ல் தெரிய: col D '@' TEXT format (gviz header label காக்க); v6.3 — IL chq capture 1-6 இலக்கம் (குட்டைய chq 5/6/7/11) + rebuild-ல் Description Details (col J) balKey+snoKey keyed காப்பு/மீட்டல்; v6.2 — PDF extractor + சொந்த JS zlib inflate (arStmtZlibInflate_, Utilities.inflate தோற்றாலும் direct extraction வேலை செய்யும்) + stream diagnostics; v6.1 — Google conversion bypass; v6.0 — arStmtRebuildMails MailInbox-driven rebuild; v5.9b — வேற-account guard + arStmtMailToDrive; v5.8 — netbanking balance-first PDF ஆதரவு: IL parser glue-split + next-line amount pairing + printed-Total gate + legacy-crash fix; v5.7 — queue-based D/C from bank's own columns + per-page chain-mis counters; extra PDF ids via ScriptProperties arStmtExtraPdf
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
        var text = arStmtPdfToText_(blob, 'mail:' + mid); // v6.1: direct extraction → convert fallback
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
// ==================================================================
// v6.1 — நம்ம சொந்த PDF text extractor (plain-ASCII content streams — CUB statements)
// Google PDF→Doc conversion bypass: pages loss + Bad Request இரண்டும் இல்லாம
// ==================================================================
function arStmtBytesToStr_(bytes) {
  var out = [];
  for (var i = 0; i < bytes.length; i += 32768) {
    out.push(String.fromCharCode.apply(null, bytes.slice(i, Math.min(i + 32768, bytes.length))));
  }
  return out.join('');
}
function arStmtStrToBytes_(str) {
  var b = new Array(str.length);
  for (var i = 0; i < str.length; i++) b[i] = str.charCodeAt(i) & 0xff;
  return b;
}

// v6.2 — pure-JS zlib/DEFLATE inflater (puff-style, RFC 1950/1951): Utilities.inflate தோற்றால் இது தான் நம்பிக்கத்தக்க வழி
function arStmtZlibInflate_(data) {
  var lbase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var lext = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var dbase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var dext = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  var out = [], pos = 0, bitbuf = 0, bitcnt = 0;
  if (data.length < 2) throw new Error('inflate: input < 2 bytes');
  var cmf = data[0], flg = data[1];
  if (((cmf & 0x0f) === 8) && ((((cmf << 8) + flg) % 31) === 0)) pos = 2; // zlib wrapper இருந்தால் skip; இல்லை raw deflate
  function bits(need) {
    while (bitcnt < need) {
      if (pos >= data.length) throw new Error('inflate: out of input @' + pos);
      bitbuf |= (data[pos++] & 0xff) << bitcnt;
      bitcnt += 8;
    }
    var v = bitbuf & ((1 << need) - 1);
    bitbuf >>>= need; bitcnt -= need;
    return v;
  }
  function buildHuff(lengths) {
    var count = [], i;
    for (i = 0; i <= 15; i++) count[i] = 0;
    for (i = 0; i < lengths.length; i++) count[lengths[i]]++;
    count[0] = 0;
    var offs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 1; i <= 15; i++) offs[i + 1] = offs[i] + count[i];
    var symbol = new Array(lengths.length);
    for (i = 0; i < lengths.length; i++) if (lengths[i]) { symbol[offs[lengths[i]]] = i; offs[lengths[i]]++; }
    return { count: count, symbol: symbol };
  }
  function decodeSym(h) {
    var code = 0, first = 0, index = 0, len;
    for (len = 1; len <= 15; len++) {
      code |= bits(1);
      var cnt = h.count[len];
      if (code - first < cnt) return h.symbol[index + (code - first)];
      index += cnt; first = (first + cnt) << 1; code <<= 1;
    }
    throw new Error('inflate: bad huffman code');
  }
  var FL = new Array(288), i;
  for (i = 0; i < 144; i++) FL[i] = 8;
  for (i = 144; i < 256; i++) FL[i] = 9;
  for (i = 256; i < 280; i++) FL[i] = 7;
  for (i = 280; i < 288; i++) FL[i] = 8;
  var FD = new Array(30);
  for (i = 0; i < 30; i++) FD[i] = 5;
  var FIXEDL = buildHuff(FL), FIXEDD = buildHuff(FD);
  var last;
  do {
    last = bits(1);
    var btype = bits(2);
    if (btype === 0) {
      bitbuf = 0; bitcnt = 0; // byte-align
      if (pos + 4 > data.length) throw new Error('inflate: stored hdr oob');
      var sl = data[pos] | (data[pos + 1] << 8);
      var sn = data[pos + 2] | (data[pos + 3] << 8);
      if (((sl ^ 0xffff) & 0xffff) !== sn) throw new Error('inflate: stored len mismatch');
      pos += 4;
      if (pos + sl > data.length) throw new Error('inflate: stored oob');
      for (var q = 0; q < sl; q++) out.push(data[pos++]);
    } else if (btype === 1 || btype === 2) {
      var lh, dh;
      if (btype === 1) { lh = FIXEDL; dh = FIXEDD; }
      else {
        var hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
        var clens = [];
        for (i = 0; i < 19; i++) clens[i] = 0;
        for (i = 0; i < hclen; i++) clens[order[i]] = bits(3);
        var ch = buildHuff(clens);
        var lens = [], n = 0;
        while (n < hlit + hdist) {
          var sym = decodeSym(ch);
          if (sym < 16) { lens[n++] = sym; }
          else if (sym === 16) { var pv = lens[n - 1]; var rep = 3 + bits(2); while (rep-- > 0) lens[n++] = pv; }
          else if (sym === 17) { var z = 3 + bits(3); while (z-- > 0) lens[n++] = 0; }
          else { var z2 = 11 + bits(7); while (z2-- > 0) lens[n++] = 0; }
        }
        lh = buildHuff(lens.slice(0, hlit));
        dh = buildHuff(lens.slice(hlit));
      }
      while (true) {
        var s2 = decodeSym(lh);
        if (s2 < 256) out.push(s2);
        else if (s2 === 256) break;
        else {
          s2 -= 257;
          if (s2 >= 29) throw new Error('inflate: bad len sym ' + (s2 + 257));
          var L = lbase[s2] + (lext[s2] ? bits(lext[s2]) : 0);
          var d1 = decodeSym(dh);
          if (d1 >= 30) throw new Error('inflate: bad dist sym ' + d1);
          var D = dbase[d1] + (dext[d1] ? bits(dext[d1]) : 0);
          var from = out.length - D;
          if (from < 0) throw new Error('inflate: dist too far');
          for (var r = 0; r < L; r++) out.push(out[from++]);
        }
      }
    } else throw new Error('inflate: bad btype ' + btype);
  } while (!last);
  return out;
}
function arStmtContentText_(s) {
  var items = [], stack = [];
  var tx = 0, ty = 0, lmx = 0, lmy = 0;
  var i = 0, n = s.length;
  while (i < n) {
    var c = s.charAt(i);
    if (c === '(') {
      var depth = 1, j = i + 1, str = '';
      while (j < n && depth > 0) {
        var ch = s.charAt(j);
        if (ch === '\\') {
          var nx = s.charAt(j + 1);
          if (nx === 'n') str += '\n'; else if (nx === 'r') str += '\r'; else if (nx === 't') str += '\t';
          else if (nx >= '0' && nx <= '7') { var oct = s.substr(j + 1, 3).match(/^[0-7]{1,3}/); if (oct) { str += String.fromCharCode(parseInt(oct[0], 8)); j += oct[0].length; } else j++; }
          else str += nx;
          j += 2;
        } else if (ch === '(') { depth++; str += ch; j++; }
        else if (ch === ')') { depth--; if (depth > 0) str += ch; j++; }
        else { str += ch; j++; }
      }
      stack.push({ s: str }); i = j; continue;
    }
    if (c === '<' && s.charAt(i + 1) !== '<') {
      var j2 = s.indexOf('>', i);
      if (j2 < 0) { i++; continue; }
      var hex = s.substring(i + 1, j2).replace(/[^0-9A-Fa-f]/g, '');
      var st2 = '';
      for (var h = 0; h + 1 < hex.length; h += 2) st2 += String.fromCharCode(parseInt(hex.substr(h, 2), 16));
      stack.push({ s: st2 }); i = j2 + 1; continue;
    }
    if (' \t\r\n[]<>/'.indexOf(c) >= 0) { i++; continue; }
    var nm = /^[-+]?[0-9]*\.?[0-9]+/.exec(s.slice(i, i + 24));
    if (nm && /^[.0-9+-]$/.test(nm[0].charAt(0))) { stack.push({ n: parseFloat(nm[0]) }); i += nm[0].length; continue; }
    var om = /^[A-Za-z'"*][A-Za-z0-9'"*]*/.exec(s.slice(i, i + 12));
    if (!om) { i++; continue; }
    var op = om[0]; i += op.length;
    if (op === 'Tm' && stack.length >= 6) { var e6 = stack.splice(stack.length - 6, 6); lmx = e6[4].n || 0; lmy = e6[5].n || 0; tx = lmx; ty = lmy; }
    else if (op === 'Td' && stack.length >= 2) { var e2 = stack.splice(stack.length - 2, 2); lmx += e2[0].n || 0; lmy += e2[1].n || 0; tx = lmx; ty = lmy; }
    else if (op === 'TD' && stack.length >= 2) { var e2b = stack.splice(stack.length - 2, 2); lmy -= e2b[1].n || 0; tx = lmx; ty = lmy; }
    else if (op === 'T*' || op === "'" || op === '"') { tx = lmx; ty = lmy; if (op !== 'T*' && stack.length) { var so = stack[stack.length - 1]; if (so.s !== undefined && so.s !== '') items.push({ x: tx, y: ty, s: so.s }); stack = []; } }
    else if (op === 'Tj') { if (stack.length) { var so2 = stack[stack.length - 1]; if (so2.s !== undefined && so2.s !== '') items.push({ x: tx, y: ty, s: so2.s }); } }
    else if (op === 'TJ') { var parts = ''; for (var si = stack.length - 1; si >= 0; si--) { if (stack[si].s !== undefined) parts = stack[si].s + parts; else break; } if (parts) items.push({ x: tx, y: ty, s: parts }); }
    if (op !== 'Tm' && op !== 'Td' && op !== 'TD' && op !== 'TJ') stack = [];
  }
  items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
  // v6.1 pass-1 chain-rule grouping (narration 1.4-6.6pt மேலே, continuation 3.7pt; அடுத்த txn ~10.3pt)
  var lastY = null;
  var groups = [], cur = [];
  for (var ii = 0; ii < items.length; ii++) {
    if (lastY === null || Math.abs(items[ii].y - lastY) > 7) { if (cur.length) groups.push(cur); cur = []; }
    cur.push(items[ii]); lastY = items[ii].y;
  }
  if (cur.length) groups.push(cur);
  // v6.1 pass-2: pure-numbers group (tall narration txns-ன் amount வேற y) → அருகில் உள்ள text group (≤20pt) உடன் இணை
  var gInfo = groups.map(function (g) {
    var ys = g.map(function (o) { return o.y; });
    var txt = g.slice().sort(function (a, b) { return a.x - b.x; }).map(function (o) { return o.s; }).join(' ');
    return { g: g, y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys), txt: txt, pure: /[0-9]/.test(txt) && !/[A-Za-z]/.test(txt), dead: false };
  });
  for (var pi = 0; pi < gInfo.length; pi++) {
    if (!gInfo[pi].pure || gInfo[pi].dead) continue;
    var best = -1, bestGap = 21;
    for (var qi = 0; qi < gInfo.length; qi++) {
      if (qi === pi || gInfo[qi].dead || gInfo[qi].pure) continue;
      var gap = Math.max(gInfo[pi].y0 - gInfo[qi].y1, gInfo[qi].y0 - gInfo[pi].y1, 0);
      if (gap < bestGap) { bestGap = gap; best = qi; }
    }
    if (best >= 0) {
      gInfo[best].g = gInfo[best].g.concat(gInfo[pi].g);
      gInfo[best].y0 = Math.min(gInfo[best].y0, gInfo[pi].y0);
      gInfo[best].y1 = Math.max(gInfo[best].y1, gInfo[pi].y1);
      gInfo[pi].dead = true;
    }
  }
  return gInfo.filter(function (G) { return !G.dead; }).map(function (G) { return G.g.slice().sort(function (a, b) { return a.x - b.x; }).map(function (o) { return o.s; }).join(' ').replace(/\s{2,}/g, ' ').trim(); })
    .filter(function (l) { return l && !/[\u0000-\u0008\u000b-\u001f]/.test(l); }).join('\n');
}
function arStmtPdfText_(bytes) {
  var bin = arStmtBytesToStr_(bytes);
  var pages = [], pos = 0;
  var diag = { streams: 0, uOk: 0, jsOk: 0, err: 0, lastErr: '' };
  while (true) {
    var si = bin.indexOf('stream', pos);
    if (si < 0) break;
    if (bin.substr(si - 3, 3) === 'end') { pos = si + 6; continue; }
    var ds = si + 6;
    if (bin.charAt(ds) === '\r') ds++;
    if (bin.charAt(ds) === '\n') ds++;
    var e = bin.indexOf('endstream', ds);
    if (e < 0) break;
    var seg = bin.substring(ds, e);
    var raw = arStmtStrToBytes_(seg);
    while (raw.length && (raw[raw.length - 1] === 10 || raw[raw.length - 1] === 13 || raw[raw.length - 1] === 32 || raw[raw.length - 1] === 9)) raw.pop(); // endstream-க்கு முன் EOL strip
    diag.streams++;
    var inf = null;
    try { inf = Utilities.inflate(raw); } catch (eU) { inf = null; }
    if (inf && inf.length) { diag.uOk++; }
    else {
      try { inf = arStmtZlibInflate_(raw); diag.jsOk++; } catch (eJ) { diag.err++; if (!diag.lastErr) diag.lastErr = String(eJ).slice(0, 110); inf = null; }
    }
    if (inf && inf.length) {
      var t = arStmtContentText_(arStmtBytesToStr_(inf));
      if (t) pages.push(t);
    }
    pos = e + 9;
  }
  arStmtPdfText_.diag = diag;
  return pages.join('\n');
}
// PDF blob → text: நேரடி extraction (loss-இல்லை) → தோற்றால் மட்டும் Google convert fallback
function arStmtPdfToText_(blob, tag) {
  var txt = '';
  try {
    var pb = blob.getBytes();
    txt = arStmtPdfText_(pb);
    var dg = arStmtPdfText_.diag || {};
    var hdr = (pb.length >= 4 && pb[0] === 37 && pb[1] === 80 && pb[2] === 68 && pb[3] === 70) ? '%PDF' : 'BAD[' + pb.slice(0, 4).join(',') + ']';
    Logger.log(tag + ' direct-extract: ' + txt.length + ' chars (bytes=' + pb.length + ' hdr=' + hdr + ' streams=' + (dg.streams || 0) + ' uOk=' + (dg.uOk || 0) + ' jsOk=' + (dg.jsOk || 0) + ' err=' + (dg.err || 0) + (dg.lastErr ? ' lastErr=' + dg.lastErr : '') + ')');
  } catch (eD) { Logger.log(tag + ' direct-extract FAIL: ' + String(eD).slice(0, 90)); }
  if (String(txt).length < 2000) {
    var docFile = Drive.Files.insert({ title: 'STMT_CONV_' + tag.replace(/[^A-Za-z0-9]/g, '').slice(0, 40), mimeType: 'application/vnd.google-apps.document' }, blob, { convert: true });
    txt = arStmtDocText_(docFile.id);
    try { Drive.Files.remove(docFile.id); } catch (e2) { }
    Logger.log(tag + ' convert-fallback: ' + String(txt).length + ' chars');
  }
  return txt;
}

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
          // v6.1: எழுத்து amounts-க்கு முன் இருந்தால் (NACH/TRF: "date NACH_DR... 50,540.00 1,85,39,954.18") = (date, AMOUNT, balance) → [a0,a1] முதலில்;
          // pure-numbers / amounts-பின்-எழுத்து (PDF3 interleaved bal-first) → [aL2,a0] முதலில். எதிர் order fallback (chain தான் தீர்வு).
          var segNd2 = seg.replace(/\d{2}-[A-Z]{3}-\d{4}/g, ' '); // date-ல "SEP" எழுத்து letIdx-ஐ கெடுக்கும் — date strip பண்ணி மட்டும் பார்
          var letIdx = segNd2.search(/[A-Za-z]/); var faNd = segNd2.indexOf(am[0]);
          var letFirst = (letIdx >= 0 && (faNd < 0 || letIdx < faNd));
          if (letFirst) { pairs.push([a0, a1]); pairs.push([aL2, a0]); }
          else { pairs.push([aL2, a0]); pairs.push([a0, a1]); }
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
      // v6.3 chq capture: 1-6 இலக்க cheque no (5, 6, 7, 11 மாதிரி குட்டையவையும்) — எழுத்து/எண் + SPACE-க்குப் பின் வந்தால் மட்டும்
      // (":99999" glue = narration பகுதி; "- 00" skip; '00060' = branch code; all-zero skip; பிடிபடாட்டால் பழைய 3-6 boundary rule)
      var chq = '', chqV = null;
      var mc = dsc.match(/[A-Za-z0-9.,)]\s+(\d{1,6})\s*$/); // v6.3: space-க்குப் பின் 1-6 இலக்க = chq (5, 6, 7, 11, 739, 1865)
      // colon-glue (":99999", ":00121", ":0012") = narration code — chq இல்லை (x-coord verify: 99999 Particulars column-ல் தான்)
      chqV = mc ? mc[1] : null;
      if (chqV && chqV !== '00060' && !/^0+$/.test(chqV)) { chq = chqV; dsc = dsc.replace(/\s+\d{1,6}\s*$/, '').trim(); }
      if (!dsc) dsc = '(narration வரி மாறுபட்டது)';
      cands.push({ dt: dtx, dsc: dsc, chq: chq, pairs: pairs });
    }
  }
  return cands;
}

function arStmtParseText_(text) {
  // v5.9b: வேற account-ன் statement எனில் கட்டாய நிராகரிப்பு (எ.க. Deposit_Statement acct ...4750 — பிரதான tab-ஐ pollute செய்யக்கூடாது)
  var mA0 = String(text || '').match(/Account No[^\d\n]{0,20}(\d{9,18})/);
  if (mA0 && mA0[1] !== '510909010201712') {
    Logger.log('OTHER ACCOUNT ' + mA0[1] + ' — skip (main 510909010201712 மட்டும்)');
    return { rows: [], unparsed: [], stats: { rows: 0, credits: 0, debits: 0, opening: 0, closing: NaN, pass: false, pages: 0, pgAnchored: 0, pgBlind: 0, pgInterleaved: 0, pgSkipped: 0, ordMis: 0, blockRows: 0, ilKept: 0, ilDropped: 0, totals: 'OTHER-ACCOUNT ' + mA0[1] } };
  }
  var res = arStmtParseCUB_(text);
  // v5.8: legacy fallback (undefined arStmtParseLegacy_ crash) நீக்கம் — block=0 எனில் IL-only merge-walk தொடரும்
  // ---- INTEGRITY GATE: opening/closing/மொத்தக் கணக்கு சரிபார்ப்பு ----
  var mOpen = text.match(/Opening Balance as on \d{2}-[A-Z]{3}-\d{4}[ \t]+([\d,]+\.\d{2})/); // v6.0: \s+ → [ \t]+ (newline தாண்டி அடுத்த line balance விழுங்க கூடாது)
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

function arStmtAppendRows_(sh, newRows, skipDedupe) {
  // v6.0: skipDedupe=true → union multiplicity-merge முடிந்த rows (உண்மையான identical DD ஜோடிகள் உட்பட) அப்படியே எழுது
  if (!newRows.length) return 0;
  var tz = Session.getScriptTimeZone();
  var lastRow = sh.getLastRow();
  var keys = {};
  if (!skipDedupe && lastRow > 5) {
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
    if (skipDedupe) { out.push(nr); continue; } // v6.0: union முடிந்த rows — ஒத்த ஜோடிகள் (DD presented twice) கூட கட்டாயம் எழுத வேண்டும்
    if (keys[nd + '|' + ndsc + '|' + nbS]) continue;
    keys[nd + '|' + ndsc + '|' + nbS] = 1;
    out.push(nr);
  }
  if (out.length) {
    var need = sh.getLastRow() + out.length;
    if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 50);
    // v6.4: col D (Ref / Cheque No) TEXT format '@' முதலில் — இல்லைனா Sheets "5"-ஐ number ஆக மாத்தி, gviz header label-ஐ null பண்ணி website column-ஐ மறைக்கும்
    sh.getRange(sh.getLastRow() + 1, 4, out.length, 1).setNumberFormat('@');
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
    if (String(rdata[rr][0]).indexOf('file:') === 0 || String(rdata[rr][0]).indexOf('txt:') === 0) raw.deleteRow(rr + 1);
  }
  // ===== படி 1: எல்லா PDF-ஐயும் parse + INTEGRITY GATE (clear செய்யாமல்!) =====
  // v5.9: Google PDF→Doc conversion-ல் tail/middle pages இழப்பு உறுதி செய்யப்பட்டது (எந்த PDF copy-லும் அதே loss) →
  // arStmtTextFiles = 'txtFileId1,txtFileId2' (Drive-ல் .txt ஆக upload செய்த statement text) → நேரடியாக blob படிப்பு, conversion இல்லை
  var TXTF = String(PropertiesService.getScriptProperties().getProperty('arStmtTextFiles') || '').replace(/\s/g, '');
  var SRCS = [];
  if (TXTF) {
    var TL = TXTF.split(',');
    for (var ti2 = 0; ti2 < TL.length; ti2++) {
      var tx = TL[ti2].replace(/[^a-zA-Z0-9_\-]/g, '');
      if (tx) { SRCS.push({ id: tx, isText: true }); Logger.log('text source added: ' + tx); }
    }
  }
  if (OVS === 'none') {
    Logger.log('arStmtRebuildIds=none → Drive PDF sources skip (text-only rebuild)');
  } else {
    for (var tsJ = 0; tsJ < IDS.length; tsJ++) SRCS.push({ id: IDS[tsJ], isText: false });
  }
  var parsed = [], allPass = true, notes = [];
  for (var k = 0; k < SRCS.length; k++) {
    var fid = SRCS[k].id;
    try {
      var text;
      if (SRCS[k].isText) {
        text = DriveApp.getFileById(fid).getBlob().getDataAsString('UTF-8');
        Logger.log('text source ' + fid + ': ' + String(text).length + ' chars (conversion bypass)');
      } else {
        text = arStmtPdfToText_(DriveApp.getFileById(fid).getBlob(), 'file:' + fid); // v6.1
      }
      raw.appendRow([(SRCS[k].isText ? 'txt:' : 'file:') + fid, 'statement ' + (k + 1) + ' (FULL ' + String(text).length + ' chars)', String(text).slice(0, 300000)]);
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
  var capJ = arStmtCaptureJ_(sh); // v6.3: Description Details காப்பு
  sh.getRange(5, 1, 2, 26).clearContent();
  sh.getRange(1, 10, 6, 1).clearContent();
  var mr = sh.getMaxRows();
  if (mr > 6) sh.deleteRows(7, mr - 6);
  SpreadsheetApp.flush();
  sh.getRange(7, 1, 1, 10).setValues([['S.No', 'Date', 'Description', 'Ref / Cheque No', 'Value Date', 'Debit', 'Credit', 'Balance', 'Notes', 'Description Details']]);
  sh.getRange(7, 1, 1, 10).setFontWeight('bold');
  SpreadsheetApp.flush();
  Logger.log('ALL PASS — old rows deleted structurally, fresh header at row 7, importing... (J-saved: ' + Object.keys(capJ).length + ')');
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
      var nAdd = arStmtAppendRows_(sh, rowsF, true);
      total += nAdd;
    } catch (err2) {
      notes.push('PDF' + (P.k + 1) + ' import ERROR: ' + String(err2).slice(0, 80));
    }
  }
  try { arStmtFinalize_(sh); } catch (eS) { Logger.log('finalize: ' + String(eS)); }
  var rJ = arStmtRestoreJ_(sh, capJ); // v6.3: Description Details மீட்டல்
  Logger.log('Description Details restored: ' + rJ + '/' + Object.keys(capJ).length);
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
      var text = arStmtPdfToText_(DriveApp.getFileById(files[i].id).getBlob(), 'drive:' + files[i].id); // v6.1
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

// v5.9b: mail PDF attachments → Drive (anyone-with-link) — run ஒருமுறை, Execution log-ல் fileId lines copy செய்யவும்
function arStmtMailToDrive(ids) {
  if (!ids || !ids.length) ids = ['1a100a2e5e4b1342', '1a0f65d1fc9994a2', '1a0e79e6d868aa6b'];
  var out = [];
  for (var i = 0; i < ids.length; i++) {
    var mid = ids[i];
    try {
      var msg = GmailApp.getMessageById(mid);
      var atts = msg.getAttachments();
      var got = 0;
      for (var a = 0; a < atts.length; a++) {
        var ab = atts[a];
        var nm = ab.getName() || ('attach_' + a);
        var data = ab.getData();
        if (ab.getContentType() !== 'application/pdf' && !/\.pdf$/i.test(nm)) continue;
        var file = DriveApp.createFile(Utilities.newBlob(data, 'application/pdf', mid + '_' + nm));
        try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (eS) {}
        var line = mid + ' | ' + nm + ' (' + Math.round(data.length / 1024) + ' KB) → fileId=' + file.getId();
        out.push(line);
        Logger.log(line);
        got++;
      }
      if (!got) Logger.log(mid + ' | PDF attachment இல்லை | ' + msg.getSubject() + ' | ' + msg.getDate());
    } catch (e) {
      Logger.log(mid + ' | ERROR ' + String(e).slice(0, 120));
    }
  }
  if (!out.length) Logger.log('எந்த PDF-உம் கிடைக்கவில்லை');
  return out.join('\n');
}

// ==================================================================
// v6.0 — Mail-Page-ல் இருக்கும் statement mails-இலிருந்தே முழு rebuild
//  • StmtText1.txt (07-03-2022→05-09-2025, lossless, ஏற்கனவே Drive-ல் உள்ளது) +
//    MailInbox sheet-ல் drive.google.com/file/d/<id> attachment links உள்ள எல்லா mail PDF-களும்
//  • ஒவ்வொன்றும்: வேற-account guard → parse → INTEGRITY GATE (chain + printed totals)
//  • PASS ஆன sources ஒன்றாக இணைக்கப்பட்டு ONE global balance-chain walk (dupe-safe)
//  • chain முழுதும் ஒரே பிடியாக + கடைசி தேதி இன்றுக்கு 45 நாளுக்குள் இருந்தால் மட்டுமே import
//  • எதுவும் சந்தேகம் எனில் → STOP, பழைய data பாதுகாப்பு
// ==================================================================
function arStmtRebuildMails() {
  var ss = SpreadsheetApp.openById(WORKBOOK_ID);
  var sh = arStmtSheet_(ss, STMT_TAB);
  if (!sh) { Logger.log('FATAL: stmt tab missing'); return 'Tab missing'; }
  var log = ss.getSheetByName('StmtLog');
  if (!log) { log = ss.insertSheet('StmtLog'); log.appendRow(['Time', 'MailID', 'Status', 'Detail']); }
  var raw = ss.getSheetByName('StmtRaw');
  if (!raw) { raw = ss.insertSheet('StmtRaw'); raw.appendRow(['MailID', 'PDF Name', 'Text (first 5000)']); }
  var rdata = raw.getDataRange().getValues();
  for (var rr = rdata.length - 1; rr >= 1; rr--) {
    var tg = String(rdata[rr][0]);
    if (tg.indexOf('file:') === 0 || tg.indexOf('txt:') === 0 || tg.indexOf('mail:') === 0) raw.deleteRow(rr + 1);
  }
  var numv = function (x) { var v = parseFloat(String(x).replace(/[^0-9.\-]/g, '')); return isNaN(v) ? NaN : v; };
  var sources = [];
  // ---- Source A: StmtText1.txt (lossless netbanking text — 07-03-2022→05-09-2025) ----
  var TEXT_SRC = '18xKeiNxQ1iMwqVeVlFWakR3B6iTU-8vl';
  try {
    var t1 = DriveApp.getFileById(TEXT_SRC).getBlob().getDataAsString('UTF-8');
    raw.appendRow(['txt:' + TEXT_SRC, 'StmtText1 (FULL ' + t1.length + ' chars)', String(t1).slice(0, 300000)]);
    sources.push({ tag: 'txt:StmtText1', text: t1 });
    Logger.log('StmtText1: ' + t1.length + ' chars');
  } catch (eT) { Logger.log('StmtText1 read FAIL: ' + eT); }
  // ---- Source B: MailInbox sheet-ல் attachment drive links (வெப்சைட் Mail page data) ----
  var mb = ss.getSheetByName('MailInbox');
  var ids = [], seenId = {};
  if (mb) {
    var mv = mb.getDataRange().getValues();
    var URGR = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_\-]{20,})/;
    for (var i = 0; i < mv.length; i++) {
      var subj = String(mv[i][2] || '');
      for (var j = 0; j < mv[i].length; j++) {
        var cell = String(mv[i][j]);
        if (cell.indexOf('drive.google.com/file/d/') < 0) continue;
        var mm = cell.match(URGR);
        if (mm && !seenId[mm[1]]) { seenId[mm[1]] = 1; ids.push({ id: mm[1], subj: subj }); }
        break;
      }
    }
  }
  Logger.log('MailInbox attachment files: ' + ids.length + ' unique');
  var converted = 0, convSeen = {};
  for (var f = 0; f < ids.length && converted < 60; f++) {
    var F = ids[f];
    try {
      var text = arStmtPdfToText_(DriveApp.getFileById(F.id).getBlob(), 'mail:' + F.id); // v6.1: conversion bypass
      converted++;
      var hkey = String(text).length + ':' + String(text).slice(0, 150);
      if (convSeen[hkey]) { Logger.log('dupe text skip: ' + F.subj.slice(0, 40)); continue; }
      convSeen[hkey] = 1;
      raw.appendRow(['mail:' + F.id, F.subj + ' | FULL ' + String(text).length, String(text).slice(0, 300000)]);
      sources.push({ tag: 'mail:' + F.subj.slice(0, 38), text: text });
    } catch (e) {
      Logger.log('conv skip [' + F.subj.slice(0, 34) + ']: ' + String(e).slice(0, 70));
    }
  }
  Logger.log('converted: ' + converted + ' PDFs → ' + sources.length + ' sources');
  if (!sources.length) { log.appendRow([new Date(), 'rebuildMails', 'STOP', 'sources கிடைக்கவில்லை']); return 'No sources'; }
  // ---- parse + gate ஒவ்வொன்றும் ----
  var parsed = [];
  for (var k = 0; k < sources.length; k++) {
    var S = sources[k];
    try {
      var res = arStmtParseText_(S.text);
      var st = res.stats || {};
      if (String(st.totals || '').indexOf('OTHER-ACCOUNT') === 0) {
        log.appendRow([new Date(), S.tag, 'SKIP', 'வேற account — ' + st.totals]);
        continue;
      }
      if (!st.rows) {
        log.appendRow([new Date(), S.tag, 'SKIP', 'txn rows 0 (statement அல்லாத file)']);
        continue;
      }
      var dts = res.rows.map(function (r) { return r[1].getTime(); });
      var info = { tag: S.tag, rows: res.rows, st: st, t0: Math.min.apply(null, dts), t1: Math.max.apply(null, dts) };
      if (st.pass) {
        parsed.push(info);
        log.appendRow([new Date(), S.tag, 'PASS', 'rows=' + st.rows + ' C=' + st.credits + ' D=' + st.debits + ' open=' + st.opening + ' → close=' + st.closing + ' ordMis=' + st.ordMis + ' totals=[' + (st.totals || '') + ']']);
      } else {
        log.appendRow([new Date(), S.tag, 'EXCLUDE', 'gate fail — rows=' + st.rows + ' C=' + st.credits + ' D=' + st.debits + ' open=' + st.opening + ' close=' + st.closing + ' totals=[' + (st.totals || '') + '] (conversion loss? — இந்த file விலக்கப்பட்டது)']);
      }
    } catch (eP) {
      log.appendRow([new Date(), S.tag, 'ERROR', String(eP).slice(0, 140)]);
    }
  }
  if (!parsed.length) {
    var m0 = '❌ REBUILD நிறுத்தப்பட்டது — ஒரு source-உம் PASS ஆகவில்லை. பழைய data பாதுகாக்கப்பட்டது.';
    log.appendRow([new Date(), 'rebuildMails', 'STOP', m0]);
    Logger.log(m0);
    return m0;
  }
  // ---- UNION (multiplicity dedupe) + ONE global balance-chain walk ----
  // v6.0 fix: ஒரே file-ல் உண்மையாக இரண்டு முறை வரும் txns (DD presented-return-presented: அதே தேதி/தொகை/balance)
  // key-ன் count-ஐ file-வாரிக் கணக்கிட்டு, files-களின் overlap-ஐ மட்டும் dedupe செய்யும் (max-count merge)
  var maxCnt = {}, perSrcCnt = [];
  var openOfMin = null, tMin = Infinity, openTag = '';
  for (var p1 = 0; p1 < parsed.length; p1++) {
    var P1 = parsed[p1];
    if (P1.t0 < tMin) { tMin = P1.t0; openOfMin = P1.st.opening; openTag = P1.tag; }
    var cnt1 = {};
    for (var q1 = 0; q1 < P1.rows.length; q1++) {
      var rw1 = P1.rows[q1];
      var k1 = rw1[1].getTime() + '|' + (numv(rw1[5]) || 0).toFixed(2) + '|' + (numv(rw1[6]) || 0).toFixed(2) + '|' + numv(rw1[7]).toFixed(2);
      cnt1[k1] = (cnt1[k1] || 0) + 1;
      if (cnt1[k1] > (maxCnt[k1] || 0)) maxCnt[k1] = cnt1[k1];
    }
    perSrcCnt.push(cnt1);
  }
  var union = [], emittedU = {};
  for (var p2 = 0; p2 < parsed.length; p2++) {
    var P2 = parsed[p2], cnt2 = perSrcCnt[p2], got2 = {};
    for (var q2 = 0; q2 < P2.rows.length; q2++) {
      var rw2 = P2.rows[q2];
      var tU = rw2[1].getTime();
      var k2 = tU + '|' + (numv(rw2[5]) || 0).toFixed(2) + '|' + (numv(rw2[6]) || 0).toFixed(2) + '|' + numv(rw2[7]).toFixed(2);
      got2[k2] = (got2[k2] || 0) + 1;
      if (got2[k2] > cnt2[k2]) continue; // இந்த file-ல் மீதி இல்லை (impossible, safety)
      if ((emittedU[k2] || 0) >= maxCnt[k2]) continue; // மற்ற file-ல் இருந்தது — overlap dedupe
      emittedU[k2] = (emittedU[k2] || 0) + 1;
      union.push({ t: tU, D: numv(rw2[5]) || 0, C: numv(rw2[6]) || 0, B: numv(rw2[7]), row: rw2, tag: P2.tag });
    }
  }
  union.sort(function (a, b) { return a.t - b.t; });
  var prevU = openOfMin, orphans = 0, orphanLog = [], lastT = 0, chained = 0, ui = 0;
  while (ui < union.length) {
    var uj = ui;
    while (uj < union.length && union[uj].t === union[ui].t) uj++;
    var uN = uj - ui, usedU = new Array(uN), madeU = 0;
    while (madeU < uN) {
      var pickU = -1, pickB = 0;
      for (var w = ui; w < uj; w++) {
        if (usedU[w - ui]) continue;
        var oU = union[w];
        if (!isNaN(oU.B) && (Math.abs(prevU - oU.D + oU.C - oU.B) < 0.01)) { pickU = w; pickB = oU.B; break; }
      }
      if (pickU < 0) break;
      usedU[pickU - ui] = true; madeU++;
      prevU = pickB; chained++;
      if (union[pickU].t > lastT) lastT = union[pickU].t;
    }
    for (var w2 = ui; w2 < uj; w2++) {
      if (usedU[w2 - ui]) continue;
      orphans++;
      if (orphanLog.length < 10) orphanLog.push(new Date(union[w2].t).toISOString().slice(0, 10) + ' ' + union[w2].tag + ' | ' + String(union[w2].row[2]).slice(0, 40) + ' | prev=' + prevU + ' B=' + union[w2].B);
    }
    ui = uj;
  }
  var lastD = new Date(lastT);
  var days45 = 45 * 24 * 60 * 60 * 1000;
  var coverageOk = lastT > 0 && (Date.now() - lastT) <= days45;
  Logger.log('GLOBAL CHAIN: start=' + openOfMin + ' (' + openTag + ') chained=' + chained + ' orphans=' + orphans + ' last=' + lastD.toISOString().slice(0, 10) + ' endBal=' + prevU);
  if (orphanLog.length) orphanLog.forEach(function (l) { Logger.log('ORPHAN: ' + l); });
  var passAll = (orphans === 0) && coverageOk;
  if (!passAll) {
    var why = [];
    if (orphans > 0) why.push('chain இடறியது (orphans=' + orphans + ' — ' + (orphanLog[0] || '') + ')');
    if (!coverageOk) why.push('data இன்று வரை வரவில்லை (last=' + lastD.toISOString().slice(0, 10) + ' — மாத statement mails விடுபாடு)');
    var m1 = '❌ REBUILD நிறுத்தப்பட்டது — ' + why.join(' | ') + '. பழைய data பாதுகாக்கப்பட்டது.';
    log.appendRow([new Date(), 'rebuildMails', 'STOP', m1 + ' sources=' + parsed.map(function (x) { return x.tag.slice(0, 22) + ':' + x.st.rows; }).join(', ')]);
    Logger.log(m1);
    return m1;
  }
  // ---- ALL PASS → clear + import (பழைய rebuild அதே முறை) ----
  var capJ = arStmtCaptureJ_(sh); // v6.3: Description Details காப்பு
  sh.getRange(5, 1, 2, 26).clearContent();
  sh.getRange(1, 10, 6, 1).clearContent();
  var mr = sh.getMaxRows();
  if (mr > 6) sh.deleteRows(7, mr - 6);
  SpreadsheetApp.flush();
  sh.getRange(7, 1, 1, 10).setValues([['S.No', 'Date', 'Description', 'Ref / Cheque No', 'Value Date', 'Debit', 'Credit', 'Balance', 'Notes', 'Description Details']]);
  sh.getRange(7, 1, 1, 10).setFontWeight('bold');
  SpreadsheetApp.flush();
  Logger.log('ALL PASS — fresh header row 7, importing ' + union.length + ' rows...');
  var rowsOut = union.map(function (u) { return u.row; });
  var totalN = 0;
  try { totalN = arStmtAppendRows_(sh, rowsOut, true); } catch (eI) { Logger.log('import ERROR: ' + eI); }
  try { arStmtFinalize_(sh); } catch (eF) { Logger.log('finalize: ' + eF); }
  var rJ = arStmtRestoreJ_(sh, capJ); // v6.3: Description Details மீட்டல்
  Logger.log('Description Details restored: ' + rJ + '/' + Object.keys(capJ).length);
  var m2 = '✅ REBUILD முடிந்தது: ' + totalN + ' rows | sources=' + parsed.length + ' | chain start=' + openOfMin + ' → end=' + prevU + ' | last=' + lastD.toISOString().slice(0, 10) + ' | orphans=0 (integrity-verified)';
  log.appendRow([new Date(), 'rebuildMails', 'REBUILD OK', m2]);
  Logger.log(m2);
  return m2;
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
