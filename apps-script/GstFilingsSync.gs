/********************************************************************
 * AR ENTERPRISES ERP — GST Portal filing mails → "GstFilingsAuto" tab (v2.3, 2026-10-10)
 *
 * நிலைமை (உறுதி செய்யப்பட்டது):
 *   - உங்க GST follow-up tracker இப்போ "Reminder" tab-இல் — இந்த script அதை
 *     எப்போதும் தொடாது.
 *   - "GstFilingsAuto" tab இல்லை → syncGstFilings அதை புதுசா உருவாக்கும்
 *     (headers: Filing Type, FY, Period, ARN, Filing Date, GSTIN, Status, Subject, Synced).
 *
 * setup (ஒரே தடவை):
 *   1. Apps Script-இல் பழைய GstFilingsSync.gs உள்ளடக்கத்தை முழுவதும் நீக்கி
 *      இதை paste → Save 💾
 *   2. gstStatus → Run ▶  (ஒரே run-இல்: sync + tab நிலை + count log)
 *   3. installGstTrigger → Run ▶  (மணிக்கு ஒருமுறை தானா)
 ********************************************************************/

var GST_WB = '1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw';
var GST_TAB = 'GstFilingsAuto';
var GST_GSTIN = '33AEQFS3938D1ZU';
var GST_MAX_THREADS = 200;
var GST_HEADER = ['Filing Type', 'FY', 'Period', 'ARN', 'Filing Date', 'GSTIN', 'Status', 'Subject', 'Synced'];

function gstFilerSheet_() {
  var ss = SpreadsheetApp.openById(GST_WB);
  var sh = ss.getSheetByName(GST_TAB);
  if (sh) {
    var a1 = '';
    try { a1 = String(sh.getRange(1, 1).getValue()); } catch (e) {}
    if (a1 !== GST_HEADER[0]) {
      throw new Error('"' + GST_TAB + '" tab-ல் வேற data இருக்கு (A1="' + a1 + '"). அந்த tab-க்கு வேற பெயர் கொடுங்க அல்லது நீக்குங்க, அப்புறம் syncGstFilings மீண்டும் run பண்ணவும்.');
    }
    return sh;
  }
  sh = ss.insertSheet(GST_TAB);
  sh.appendRow(GST_HEADER);
  sh.getRange(1, 1, 1, GST_HEADER.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

function gstPad2_(n) { return (n < 10 ? '0' : '') + n; }

function gstFyFromDate_(d) {
  var y = d.getFullYear(), m = d.getMonth() + 1;
  var a = (m >= 4) ? y : y - 1;
  return a + '-' + gstPad2_((a + 1) % 100);
}

function gstNormType_(t) {
  t = String(t || '').toUpperCase().replace(/[^A-Z0-9\/]/g, '');
  if (t.indexOf('IFF') >= 0) return 'GSTR-1/IFF';
  if (t.indexOf('3B') >= 0 || t.indexOf('GSTR3') >= 0) return 'GSTR-3B';
  if (t.indexOf('GSTR1') >= 0) return 'GSTR-1';
  if (t.indexOf('TDS') >= 0) return 'TDS CREDIT';
  return t || '';
}

function gstParseMail_(subj, body) {
  var text = String(subj || '') + '\n' + String(body || '').slice(0, 3000);
  var out = { arn: '', type: '', fy: '', period: '', gstin: '' };
  var mA = text.match(/ARN\s*[:#\-\s]*([A-Z0-9]{12,20})/i);
  if (mA) out.arn = mA[1].toUpperCase();
  var mT = String(subj || '').match(/GSTR-?\d[A-B]?(?:\s*\/\s*IFF)?|IFF/i);
  out.type = gstNormType_(mT ? mT[0] : '');
  var mFY = text.match(/FY\s*[:\s]*(\d{4})\s*-\s*(\d{2,4})/i);
  if (mFY) out.fy = mFY[1] + '-' + String(mFY[2]).slice(-2);
  var mP = text.match(/Period\s*[:\s]*([A-Za-z]{3,9})/i);
  if (mP) out.period = mP[1].charAt(0).toUpperCase() + mP[1].slice(1).toLowerCase();
  var mG = text.match(/33[A-Z0-9]{13}/);
  if (mG) out.gstin = mG[0];
  return out;
}

function syncGstFilings() {
  var sh = gstFilerSheet_();
  var data = sh.getDataRange().getValues();
  var seen = {};
  for (var r = 1; r < data.length; r++) if (data[r][3]) seen[String(data[r][3])] = true;

  var props = PropertiesService.getScriptProperties();
  var since = props.getProperty('gstF_last') || '';
  var q = 'from:gst.gov.in newer_than:400d in:anywhere'; // donotreply@/email@ எல்லாம் ஒரே substring match + spam-ல விழுந்த mails-ம்

  var threads = GmailApp.search(q, 0, GST_MAX_THREADS);
  var rows = [], scanned = 0;
  var lastEpoch = 0;

  for (var t = 0; t < threads.length; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var msg = msgs[m], dt = msg.getDate();
      scanned++;
      if (dt.getTime() > lastEpoch) lastEpoch = dt.getTime();
      var subj = msg.getSubject() || '', body = '';
      try { body = msg.getPlainBody() || ''; } catch (e) { body = ''; }
      var probe = (subj + ' ' + body.slice(0, 600));
      if (!/filed successfully|return\s+[a-z0-9\/\-]+\s+filed|\bARN\b/i.test(probe)) continue;
      var p = gstParseMail_(subj, body);
      if (!p.arn || seen[p.arn]) continue;
      var fdate = Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      rows.push([
        p.type || 'GST',
        p.fy || gstFyFromDate_(dt),
        p.period || '',
        p.arn,
        fdate,
        p.gstin || GST_GSTIN,
        'Filed',
        String(subj).slice(0, 140),
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
      ]);
    }
  }

  if (rows.length) {
    rows.sort(function (a, b) { return String(a[4]) < String(b[4]) ? -1 : 1; });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, GST_HEADER.length).setValues(rows);
  }

  if (lastEpoch) {
    var nd = new Date(lastEpoch - 3600 * 1000);
    props.setProperty('gstF_last', Utilities.formatDate(nd, 'GMT', 'yyyy/MM/dd'));
  }

  Logger.log('GST filings sync → "' + GST_TAB + '": scanned=' + scanned + ' new=' + rows.length);
  return rows.length;
}

function installGstTrigger() {
  var all = ScriptApp.getProjectTriggers(), i;
  for (i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === 'syncGstFilings') ScriptApp.deleteTrigger(all[i]);
  }
  ScriptApp.newTrigger('syncGstFilings').timeBased().everyHours(1).create();
  Logger.log('GST hourly trigger OK → syncGstFilings ஒவ்வொரு மணியும் "' + GST_TAB + '"-ஐ புதுப்பிக்கும்');
}

/* ஒரே run-இல் எல்லா நிலை: tabs list + GstFilingsAuto rows + live sync + கடைசி row.
   பிரச்சனை இருந்தா இந்த log-ஐ screenshot எடுத்து அனுப்புங்க. */
function gstStatus() {
  var out = [];
  var ss = SpreadsheetApp.openById(GST_WB);
  out.push('1) tabs = ' + ss.getSheets().map(function (s) { return s.getName(); }).join(' | '));
  var n = syncGstFilings();
  var sh = ss.getSheetByName(GST_TAB);
  var lr = sh.getLastRow();
  out.push('2) sync போட்ட புது filings = ' + n);
  out.push('3) "' + GST_TAB + '" rows = ' + (lr - 1));
  if (lr > 1) out.push('4) கடைசி row = ' + sh.getRange(lr, 1, 1, 5).getValues()[0].join(' | '));
  var trs = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  out.push('5) triggers = ' + (trs.length ? trs.join(', ') : 'இல்லை — installGstTrigger run பண்ணுங்க'));
  var msg = out.join('\n');
  Logger.log('\n' + msg);
  return msg;
}
