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
var STMT_TAB = 'Polinchi BS 1712';
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
    var sh = SpreadsheetApp.openById(WORKBOOK_ID).getSheetByName(tab);
    if (!sh) return out.setContent(JSON.stringify({ ok: false, error: 'tab missing' }));
    var colNum = 0, letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', cl = String(b.col || 'J').toUpperCase();
    for (var i = 0; i < cl.length; i++) colNum = colNum * 26 + (letters.indexOf(cl[i]) + 1);
    var row = parseInt(b.row, 10);
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
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'AR Mail Sync v3' })).setMimeType(ContentService.MimeType.JSON);
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
// v4.1 — கண்டறிதல்: arStmtParseMails ஏன் வேலை செய்யவில்லை என காட்டும்
// Run செய்து Execution log-ல் வருவதை முழுவதும் copy செய்யவும்
// ==================================================================
function arStmtDiag() {
  var out = [];
  out.push('1) STMT_TAB = "' + STMT_TAB + '"');
  var ss = SpreadsheetApp.openById(WORKBOOK_ID);
  var sh = ss.getSheetByName(STMT_TAB);
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
  var sh = ss.getSheetByName(STMT_TAB);
  if (!sh) return 'Tab missing: ' + STMT_TAB;
  var log = ss.getSheetByName('StmtLog');
  if (!log) { log = ss.insertSheet('StmtLog'); log.appendRow(['Time', 'MailID', 'Status', 'Detail']); }
  var raw = ss.getSheetByName('StmtRaw');
  if (!raw) { raw = ss.insertSheet('StmtRaw'); raw.appendRow(['MailID', 'PDF Name', 'Text (first 5000)']); }

  var threads = GmailApp.search('from:cityunionbank.in (statement OR statementofaccount OR "statement of account")', 0, 50);
  Logger.log('search threads found: ' + threads.length);
  var added = 0, skipped = 0, failed = 0;

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
        var text = DocumentApp.openById(docFile.id).getBody().getText();
        var res = arStmtParseText_(text);
        if (res.rows.length) {
          sh.getRange(sh.getLastRow() + 1, 1, res.rows.length, res.rows[0].length).setValues(res.rows);
          added += res.rows.length;
          log.appendRow([new Date(), mid, 'OK', res.rows.length + ' rows | ' + pdfName + ' | unparsed:' + res.unparsed]);
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
  props.setProperty('arStmtProcessed', Object.keys(processed).join(','));
  var msg2 = added + ' rows added, ' + skipped + ' skipped, ' + failed + ' failed — விவரம் StmtLog tab';
  Logger.log(msg2);
  return msg2;
}

// PDF text → transaction rows (BS 1712 layout: A SNo | B Date | C Desc | F Amount | H Balance)
function arStmtParseText_(text) {
  var rows = [], unparsed = 0;
  var lines = String(text || '').split(/[\r\n]+/);
  for (var i = 0; i < lines.length; i++) {
    var L = lines[i].replace(/\s+/g, ' ').trim();
    var m = L.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\s+(.+)$/);
    if (!m) continue;
    var dd = m[1], mo = m[2], yy = m[3];
    if (String(yy).length === 2) yy = '20' + yy;
    var rest = m[4];
    var nums = [], re2 = /((?:\d{1,3}(?:,\d{2,3})*|\d+)(?:\.\d{1,2})?)(?:\s*(?:Cr|Dr|CR|DR))?/g, mm;
    while ((mm = re2.exec(rest)) !== null) {
      if (mm[1].length <= 2 && nums.length === 0) continue;
      nums.push({ v: mm[1], idx: mm.index });
    }
    if (!nums.length) continue;
    var desc = rest.slice(0, nums[0].idx).replace(/[\|\-·]+\s*$/, '').trim();
    if (!desc || desc.length < 2) { desc = rest.replace(/[\d,.\s CrDr]+$/, '').trim(); }
    var amtRaw = nums[nums.length - 1].v.replace(/,/g, '');
    var balRaw = nums.length >= 2 ? nums[nums.length - 2].v.replace(/,/g, '') : '';
    var amt = parseFloat(amtRaw), bal = balRaw !== '' ? parseFloat(balRaw) : '';
    if (isNaN(amt)) { unparsed++; continue; }
    var dt = new Date(Number(yy), Number(mo) - 1, Number(dd));
    rows.push([null, dt, desc, '', '', amt, '', bal === '' ? '' : String(bal)]);
  }
  return { rows: rows, unparsed: unparsed };
}

// ஒரே முறை: S.No ஐ மீட்டமை (A column empty rows-க்கு எண் இடும்)
function arStmtRenumber() {
  var sh = SpreadsheetApp.openById(WORKBOOK_ID).getSheetByName(STMT_TAB);
  if (!sh) return 'Tab missing';
  var data = sh.getDataRange().getValues();
  var lastHeader = 0;
  for (var r = 0; r < Math.min(data.length, 10); r++) {
    if (String(data[r][2]).indexOf('Description') >= 0) lastHeader = r;
  }
  var n = 0;
  for (var r2 = lastHeader + 1; r2 < data.length; r2++) {
    n++;
    if (data[r2][0] === '' || data[r2][0] === null) sh.getRange(r2 + 1, 1).setValue(n);
  }
  Logger.log('Renumbered ' + n + ' rows');
  return n + ' rows numbered';
}
