/********************************************************************
 * AR ENTERPRISES ERP — GST Portal filing mails → "GstFilings" tab
 *
 * என்ன செய்யும்:
 *   GST portal (gst.gov.in) அனுப்பும் "filed successfully" மெயில்களை
 *   (GSTR-1 / GSTR-3B — ARN உடன்) Gmail-ல் தேடி, parse பண்ணி,
 *   workbook-ல் புது "GstFilings" tab-ல் சேர்க்கும்.
 *   Website GST Centre → Filings tab இந்த tab-ஐ தானாகக் காட்டும்.
 *
 * setup (ஒரே தடவை):
 *   1. script.google.com → இருக்கும் ERP project → ➕ New file → Script
 *      → இந்த file-ன் முழு உள்ளடக்கம் paste → Save
 *   2. Run installGstTrigger → Authorize (Gmail + Sheets அனுமதி)
 *   3. Run syncGstFilings (ஒரே முறை — பழைய mails backfill)
 *   4. (விருப்பம்) மணிக்கு ஒருமுறை தானா ஓடும் (trigger ஏற்கனவே install)
 *
 * குறிப்பு: ARN இல்லாத mails சேராது (சுத்தமான data மட்டும்).
 * Duplicate தவிர்ப்பு: ARN key. Mail timeout window 1h overlap-ஓட safe.
 ********************************************************************/

var GST_WB = '1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw';
var GST_TAB = 'GstFilings';
var GST_GSTIN = '33AEQFS3938D1ZU'; // body-ல GSTIN கிடைக்காட்டி fallback
var GST_MAX_THREADS = 60;

function gstFilerSheet_() {
  var ss = SpreadsheetApp.openById(GST_WB);
  var sh = ss.getSheetByName(GST_TAB);
  if (!sh) {
    sh = ss.insertSheet(GST_TAB);
    sh.appendRow(['Filing Type', 'FY', 'Period', 'ARN', 'Filing Date', 'GSTIN', 'Status', 'Subject', 'Synced']);
    sh.getRange(1, 1, 1, 9).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
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
  var q = 'from:(email.gst.gov.in OR gst.gov.in OR info@gst.gov.in OR noreply@gst.gov.in)';
  q += since ? ' after:' + since : ' newer_than:400d';

  var threads = GmailApp.search(q, 0, GST_MAX_THREADS);
  var rows = [], scanned = 0;
  var lastEpoch = 0;
  var MN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
    rows.sort(function(a, b) { return String(a[4]) < String(b[4]) ? -1 : 1; });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
  }

  if (lastEpoch) {
    var nd = new Date(lastEpoch - 3600 * 1000); // 1h overlap (ARN dedupe safe)
    props.setProperty('gstF_last', Utilities.formatDate(nd, 'GMT', 'yyyy/MM/dd'));
  }

  Logger.log('GST filings sync: scanned=' + scanned + ' new=' + rows.length);
  return rows.length;
}

function installGstTrigger() {
  var all = ScriptApp.getProjectTriggers(), i;
  for (i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === 'syncGstFilings') ScriptApp.deleteTrigger(all[i]);
  }
  ScriptApp.newTrigger('syncGstFilings').timeBased().everyHours(1).create();
  Logger.log('GST filings hourly trigger installed — syncGstFilings ஒவ்வொரு மணியும் ஓடும்');
}
