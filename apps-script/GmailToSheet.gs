/********************************************************************
 * AR ENTERPRISES ERP — Gmail → Google Sheet Auto-Sync (Apps Script)
 * நிறுவன Gmail மெயில்களை தானாக படித்து "MailInbox" tab-ல் எழுதும்.
 *
 * SETUP (ஒரே ஒரு முறை, ~10 நிமிடம்):
 *  1) script.google.com → New project
 *  2) கீழே உள்ள முழு code-ஐயும் paste செய்து Save
 *  3) Function: "arMailSetup" தேர்ந்தெடுத்து Run → Authorize (Allow)
 *  4) முடிந்தது! ஒவ்வொரு 10 நிமிடத்திலும் புதிய மெயில்கள் தானே Sheet-ல்.
 *     (~1 நிமிடத்தில் website-ன் Mail page-ல் தெரியும்)
 ********************************************************************/

// ---- CONFIG ----
var WORKBOOK_ID = '1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw'; // நம்ம workbook
var TAB_NAME = 'MailInbox';     // மெயில்கள் எழுதப்படும் tab
var INITIAL_DAYS = 7;           // முதல் run-ல் எத்தனை நாள் மெயில் வரை எடுக்க
var MAX_PER_RUN = 50;           // ஒரு run-ல் அதிகபட்ச மெயில்கள்
var SAVE_ATTACHMENTS = true;    // attachment-களை Drive-ல் save செய்யவா?

function arMailSync() {
  var ss = SpreadsheetApp.openById(WORKBOOK_ID);
  var sh = ss.getSheetByName(TAB_NAME);
  if (!sh) {
    sh = ss.insertSheet(TAB_NAME);
    sh.appendRow(['Date', 'From', 'Subject', 'Category', 'Invoice No', 'Amount', 'Attachment', 'Gmail Link', 'MsgID']);
    sh.getRange(1, 1, 1, 9).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  var props = PropertiesService.getScriptProperties();
  var lastEpoch = Number(props.getProperty('arMailLast') || 0);
  if (!lastEpoch) lastEpoch = Math.floor(Date.now() / 1000) - INITIAL_DAYS * 86400;

  // ஏற்கனவே எழுதிய MsgID-கள் (duplicate தவிர்க்க)
  var seen = {};
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) seen[String(data[r][8])] = true;

  var threads = GmailApp.search('after:' + Math.floor(lastEpoch), 0, 40);
  var rows = [], newest = lastEpoch;

  for (var t = 0; t < threads.length && rows.length < MAX_PER_RUN; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length && rows.length < MAX_PER_RUN; m++) {
      var msg = msgs[m];
      var id = msg.getId();
      if (seen[id]) continue;
      var dt = msg.getDate();
      var epoch = Math.floor(dt.getTime() / 1000);
      if (epoch <= lastEpoch) continue;
      if (epoch > newest) newest = epoch;

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
        if (SAVE_ATTACHMENTS) {
          atts.forEach(function (a) {
            try {
              var fl = DriveApp.createFile(a.copyBlob());
              fl.setName(arMailToday() + '_' + a.getName());
              attLinks += (attLinks ? ' | ' : '') + fl.getUrl();
            } catch (e2) {}
          });
        }
      } catch (e3) {}

      rows.push([dt, from, subj, cat, inv, amt, attLinks || attNames, threads[t].getPermalink(), id]);
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

// ---- Content-ஐ பொறுத்து வகைப்படுத்துதல் ----
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

// ---- ஒரே முறை இதை Run செய்யவும் (trigger அமைக்கும்) ----
function arMailSetup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'arMailSync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('arMailSync').timeBased().everyMinutes(10).create();
  var n = arMailSync();
  Logger.log('Setup OK — trigger ஒவ்வொரு 10 நிமிடத்திலும் run ஆகும். முதல் sync: ' + n);
}
