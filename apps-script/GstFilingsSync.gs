/********************************************************************
 * AR ENTERPRISES ERP — GST Portal filing mails → "GstFilingsAuto" tab  (v2)
 *
 * v2 (முக்கியம்): workbook-ல் பழைய "GstFilings" tab = GST follow-up tracker
 *   (பயனரின் சொந்த data). அதை தொடாது — இப்போுது தனி tab "GstFilingsAuto".
 *   cleanupGstFilingsTracker() — tracker-ல் தவறாகச் சேர்ந்த filing rows-ஐ
 *   GstFilingsAuto-வுக்கு நகர்த்தும் (v1 run செய்திருந்தால் ஒரே முறை இதை run).
 *
 * setup (ஒரே தடவை):
 *   1. Apps Script project-ல் பழைய GstFilingsSync.gs-ஐ முழுவதும் நீக்கி
 *      இதை paste → Save
 *   2. (v1-ஐ run செய்திருந்தால் மட்டும்) Run cleanupGstFilingsTracker
 *   3. Run installGstTrigger → Authorize
 *   4. Run syncGstFilings (பழைய mails backfill)
 * இதற்குப் பிறகு மணிக்கு ஒருமுறை தானா sync.
 ********************************************************************/

var GST_WB = '1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw';
var GST_TAB = 'GstFilingsAuto';
var GST_OLD_TAB = 'GstFilings'; // பயனரின் GST follow-up tracker — தொடக்கூடாது
var GST_GSTIN = '33AEQFS3938D1ZU';
var GST_MAX_THREADS = 60;
var GST_HEADER = ['Filing Type', 'FY', 'Period', 'ARN', 'Filing Date', 'GSTIN', 'Status', 'Subject', 'Synced'];

function gstFilerSheet_() {
  var ss = SpreadsheetApp.openById(GST_WB);
  var sh = ss.getSheetByName(GST_TAB);
  if (sh) {
    var a1 = '';
    try { a1 = String(sh.getRange(1, 1).getValue()); } catch (e) {}
    if (a1 !== GST_HEADER[0]) {
      throw new Error('"' + GST_TAB + '" tab-ல் வேற data இருக்கு (A1="' + a1 + '"). அந்த tab-க்கு வேற பெயர் கொடுங்க அல்லது நீக்குங்க, அப்புறம் மீண்டும் syncGstFilings run பண்ணவும்.');
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
  var q = 'from:(email.gst.gov.in OR gst.gov.in OR info@gst.gov.in OR noreply@gst.gov.in)';
  q += since ? ' after:' + since : ' newer_than:400d';

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
    rows.sort(function(a, b) { return String(a[4]) < String(b[4]) ? -1 : 1; });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, GST_HEADER.length).setValues(rows);
  }

  if (lastEpoch) {
    var nd = new Date(lastEpoch - 3600 * 1000);
    props.setProperty('gstF_last', Utilities.formatDate(nd, 'GMT', 'yyyy/MM/dd'));
  }

  Logger.log('GST filings sync → "' + GST_TAB + '": scanned=' + scanned + ' new=' + rows.length);
  return rows.length;
}

/* v1-ல் தவறாக பழைய "GstFilings" tracker tab-ல் சேர்ந்த filing rows-ஐ
   GstFilingsAuto-வுக்கு நகர்த்தும். Tracker-ன் சொந்த rows தொடப்படாது.
   அடையாளம்: col D = ARN pattern (10-20 எழுத்து எண்/எழுத்து, "Added by" போன்ற பெயர்கள் இல்லை)
   மற்றும் col A = GSTR* / GST*. ஒரே முறை run பண்ணவும். */
function cleanupGstFilingsTracker() {
  var ss = SpreadsheetApp.openById(GST_WB);
  var old = ss.getSheetByName(GST_OLD_TAB);
  if (!old) { Logger.log('"' + GST_OLD_TAB + '" tab-லேயே இல்லை — சுத்தம், எதுவும் செய்ய வேண்டாம்'); return 0; }
  var data = old.getDataRange().getValues();
  var arnRe = /^[A-Z0-9]{10,20}$/;
  var move = [];
  for (var r = 1; r < data.length; r++) {
    var a = String(data[r][0] || '').trim();
    var d = String(data[r][3] || '').trim();
    if (/^GSTR/i.test(a) && arnRe.test(d.replace(/\s/g, ''))) move.push(r);
  }
  if (!move.length) { Logger.log('Tracker சுத்தமா இருக்கு — filing rows சேரவில்லை. எதுவும் மாற்றவில்லை.'); return 0; }
  var fresh = gstFilerSheet_();
  var rows = move.map(function(r2) { return data[r2].slice(0, GST_HEADER.length); });
  fresh.getRange(fresh.getLastRow() + 1, 1, rows.length, GST_HEADER.length).setValues(rows);
  // கீழிருந்து நீக்கு (row indices shift-ஐ தவிர்க்க)
  for (var i = move.length - 1; i >= 0; i--) old.deleteRow(move[i] + 1);
  Logger.log('சுத்தம்: ' + rows.length + ' filing rows tracker-லிருந்து "' + GST_TAB + '"-க்கு நகர்த்தப்பட்டது. Tracker இப்போ பழையபடி.');
  return rows.length;
}

function installGstTrigger() {
  var all = ScriptApp.getProjectTriggers(), i;
  for (i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === 'syncGstFilings') ScriptApp.deleteTrigger(all[i]);
  }
  ScriptApp.newTrigger('syncGstFilings').timeBased().everyHours(1).create();
  Logger.log('GST filings hourly trigger installed → syncGstFilings ஒவ்வொரு மணியும் "' + GST_TAB + '"-ஐ புதுப்பிக்கும்');
}

// ==================================================================
// v2.1 — arGstFixTabs (2026-10-10):
// நிலைமை: tracker tab-க்கு தவறா 'GstFilingsAuto' பெயர் போச்சு;
// 'GstFilings' பெயரில் காலி v1 auto tab இருக்கு.
// இது: காலி v1 tab → 'GstFilingsOldEmpty' ; tracker → அசல் 'GstFilings'.
// பிறகு syncGstFilings சரியான காலி 'GstFilingsAuto'-வை உருவாக்கும்.
// Guards: v1 tab-இல் data இருந்தா தானா எதுவும் செய்யாது.
// ==================================================================
function arGstFixTabs() {
  var ss = SpreadsheetApp.openById(WORKBOOK_ID);
  var out = ['Before: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(' | ')];
  var auto = ss.getSheetByName(GST_TAB);      // 'GstFilingsAuto'
  var old = ss.getSheetByName(GST_OLD_TAB);   // 'GstFilings'
  if (!auto) { out.push('GstFilingsAuto இல்லை — syncGstFilings run பண்ணுங்க, அது உருவாக்கும்.'); }
  else if (String(auto.getRange(1, 1).getValue()) === 'Filing Type') {
    out.push('GstFilingsAuto ஏற்கனவே சரியான auto tab — tab மாற்றம் வேண்டாம்.');
  } else if (old && String(old.getRange(1, 1).getValue()) === 'Filing Type' && old.getLastRow() <= 1) {
    old.setName('GstFilingsOldEmpty');
    auto.setName(GST_OLD_TAB);
    out.push('DONE: tracker → GstFilings (அசல் பெயர்); காலி v1 tab → GstFilingsOldEmpty');
  } else {
    out.push('*** பழைய GstFilings-இல் data இருக்கு (rows=' + (old ? old.getLastRow() : '?') + ') — தானா தொடவில்லை. screenshot அனுப்புங்க ***');
  }
  out.push('After: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(' | '));
  var msg = out.join('\n');
  Logger.log('\n' + msg);
  return msg;
}
