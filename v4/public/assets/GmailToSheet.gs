/********************************************************************
 * AR ENTERPRISES ERP — Gmail → Google Sheet Auto-Sync v2 (Apps Script)
 *
 * v2 மாற்றங்கள்:
 *   • arMailBackfillAll() — பழைய மெயில்கள் முழுவதும் (ஒரு வருடம்/அதற்கு மேல்)
 *     ஒரே முறை இழுத்து MailInbox-ல் எழுதும் (பல முறை run செய்தால் தொடரும்)
 *   • தினமும் வரும் sync-க்கு இயல்பாகவே 366 நாள் பின்னோக்கி பார்க்கும்
 *   • முந்தைய v1-ஐ முழுவதும் நீக்கி இதை paste செய்து, Save செய்துவிட்டு,
 *     function list-ல் "arMailBackfillAll" தேர்ந்தெடுத்து Run அழுத்தவும்.
 ********************************************************************/

// ---- CONFIG ----
var WORKBOOK_ID = '1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw';
var TAB_NAME = 'MailInbox';
var INITIAL_DAYS = 366;         // முதல் sync: கடந்த 1 வருடம்
var MAX_PER_RUN = 200;          // trigger sync-ல் ஒரு run-ல் அதிகபட்சம்
var SAVE_ATTACHMENTS = true;    // attachment Drive-ல் save (trigger sync மட்டும்)

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

// ---- தினசரி trigger sync (ஒவ்வொரு 10 நிமிடமும்) ----
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

// ---- பழைய மெயில்கள் முழுவதும் இழுக்க — ஒரு முறை இதை Run செய்யவும் ----
// (~4.5 நிமிடம் ஒரு run; mail அளவு அதிகமானால் log சொல்லும் — மீண்டும் run செய்யவும்)
function arMailBackfillAll() {
  var sh = arMailSheet_();
  var props = PropertiesService.getScriptProperties();
  var seen = arMailSeen_(sh);
  var start = Number(props.getProperty('arBackfillStart') || 0);
  var deadline = Date.now() + 270000; // 4.5 நிமிடம் (6-min limit-க்கு உள்ளே)
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
        batch.push(arMailRow_(msgs[m], threads[t], false)); // backfill-ல் attachment Drive copy வேண்டாம் (வேகம்)
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
  return totalNew + ' mails backfilled' + (cont ? ' — இன்னும் மீதம் உள்ளது; arMailBackfillAll-ஐ மீண்டும் run செய்யவும்' : ' — முழுவதும் முடிந்தது!');
}

// ---- உள்ளடக்க வகைப்பாடு ----
function arMailClassify(from, subj, body) {
  var s = (subj + ' ' + from + ' ' + body.slice(0, 600));
  if (/income\s?tax|incometax|\bpan\b|\btds\b|26as|traces|efiling|\bitr[\s\-]?\d|form\s?16/i.test(s)) return 'Income Tax';
  if (/gst|gstr|goods\s?and\s?services|gstn|e-?way\s?bill|e-?invoice/i.test(s)) return 'GST';
  if (/\bbank\b|neft|rtgs|\bimps\b|\bupi\b|credited|debited|\bemi\b|loan statement/i.test(s)) return 'Bank';
  if (/invoice|purchase\s?order|quotation|delivery\s?challan|payment\s?due|proforma/i.test(s)) return 'Vendor';
  if (/municipality|panchayat|twad|jelc|electricity|\btneb\b|property\s?tax|\b Court\b|taluk|registrar/i.test(s)) return 'Government';
  return 'Other';
}

function arMailToday() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ---- ஒரே முறை இதை Run (trigger அமைக்கும்) ----
function arMailSetup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'arMailSync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('arMailSync').timeBased().everyMinutes(10).create();
  Logger.log('Setup OK — trigger ஒவ்வொரு 10 நிமிடத்திலும் run ஆகும். Backfill-க்கு arMailBackfillAll-ஐ run செய்யவும்.');
}
