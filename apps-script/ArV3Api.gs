/**
 * ArV3Api.gs — V3 Operations API (paste as NEW file in the gateway Apps Script project)
 * v5.3 (version 14): 2B source = Sri Polinchi & Co (B2_ID) contractor tabs — GSTIN+Party+Month, GST-first vendor match, month filter, list b2btabs
 * v5.2 (version 13): +b2bClass / b2bConfirm (GSTR-2B Inbox → Vendors classify → txn → commission → bills), vlist b2bclass
 * Writes to V3 workbook (AR_ERP_Pudukkottai). Read-only pages use gviz directly.
 * Deploy: Deploy → New deployment → Web app → Execute as: Me → Anyone → copy URL
 * ERP-இல் Vendors பக்கத்தில "⚙ V3 API" → URL paste.
 */
var V3_ID = '1zzbV4F_Iju2szqT0SGLgKAipXChAp8L-iHc63I4jLeQ';
var B2_ID = '1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw'; // Sri Polinchi & Co — 2B contractor tabs
var API_KEY = 'ARV3-2026-KX9Q42'; // விரும்பினால் மாற்றலாம் — ERP-இல் இதே key இருக்கணும்

var TYPE_CODE = {Hardware:'HW', Paint:'GN', Civil:'CV', Plumbing:'PL', Electrical:'EL', Tiles:'TL', Steel:'ST', Other:'OT'};

function ss(){ return SpreadsheetApp.openById(V3_ID); }
function sh(name){ var s=ss().getSheetByName(name); if(!s) throw new Error('Tab இல்லை: '+name); return s; }
function rid(n){ var c='ABCDEFGHJKMNPQRSTUVWXYZ23456789', s=''; for(var i=0;i<n;i++) s+=c.charAt(Math.floor(Math.random()*c.length)); return s; }
function nowIso(){ return new Date().toISOString(); }
function num(x){ var v=parseFloat(String(x==null?'':x).replace(/[₹,\s]/g,'')); return isFinite(v)?v:0; }

function rows_(name){ var v=sh(name).getDataRange().getValues(); return v; }
function findRow_(name, col, val){
  var v=rows_(name);
  for(var i=1;i<v.length;i++){ if(String(v[i][col]).trim()===String(val).trim()) return i+1; }
  return 0;
}

function audit_(user, action, entity, detail){
  try{
    var s=sh('AuditLogs');
    s.appendRow([rid(10), nowIso(), user||'', action||'', entity||'', '', String(detail||'').slice(0,200), '', '']);
  }catch(e){}
}

function vendorCode_(district, type){
  var dc=String(district||'Pudukkottai').replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase()||'PDK';
  var tc=TYPE_CODE[type]||'OT';
  var yy=String(new Date().getFullYear()).slice(-2);
  var v=rows_('Vendors'), pre=dc+yy+tc, max=0, i, code;
  for(i=1;i<v.length;i++){ code=String(v[i][0]||'');
    if(code.indexOf(pre)===0){ var n=parseInt(code.slice(pre.length),10); if(n>max)max=n; } }
  return pre+('00'+(max+1)).slice(-3);
}

function txnAdd_(p){
  var v=rows_('Vendors'), vr=null, i;
  for(i=1;i<v.length;i++){ if(String(v[i][0]).trim()===String(p.vendorCode).trim()){ vr=v[i]; break; } }
  if(!vr) throw new Error('Vendor கிடைக்கவில்லை: '+p.vendorCode);
  var exp=num(p.expected), adv=num(p.advance), gp=num(p.gp)||4;
  var gst=+(exp*gp/100).toFixed(2);
  var bal=+(gst-adv).toFixed(2);
  var id='TXN'+rid(10);
  var row=[id, vr[2], vr[0], vr[1], String(p.fy||''), String(p.month||''), exp, adv, gp, gst, 0, exp, bal, 'Open'];
  sh('Transactions').appendRow(row);
  try{ sh('Monthly_Transactions').appendRow(row); }catch(e){}
  // commission (V3 model): agent + override % → AgentWallet
  var agentId=String(p.agentId||'').trim();
  if(agentId){
    var pct=0.5, ag=rows_('Agents'), j;
    for(j=1;j<ag.length;j++){ if(String(ag[j][0]).trim()===agentId){
      if(num(ag[j][9])>0) pct=num(ag[j][9]);
      break; } }
    var ov=rows_('AgentOverrides');
    for(j=1;j<ov.length;j++){ if(String(ov[j][1]).trim()===agentId && String(ov[j][2]).trim()===String(vr[0]).trim()){ if(num(ov[j][4])>0) pct=num(ov[j][4]); break; } }
    var com=+(exp*pct/100).toFixed(2);
    sh('AgentWallet').appendRow(['AW'+rid(10), agentId, nowIso(), 'Commission — '+vr[1], id, vr[1], exp, gp, pct, com, String(p.ct||'auto'), com]);
  }
  audit_(p.user,'TXN_ADD',id,vr[1]+' '+p.fy+' '+p.month);
  return {ok:true, txnId:id, gstAmount:gst, balance:bal};
}

function billsRecalc_(txnId){
  var b=rows_('Bills'), amt=0, tot=0, i;
  for(i=1;i<b.length;i++){ if(String(b[i][1]).trim()===String(txnId).trim()){ amt+=num(b[i][6]); tot+=num(b[i][9]); } }
  var t=rows_('Transactions');
  for(i=1;i<t.length;i++){ if(String(t[i][0]).trim()===String(txnId).trim()){
    var exp=num(t[i][6]);
    t[i][10]=+amt.toFixed(2); t[i][11]=+Math.max(0,exp-tot).toFixed(2);
    sh('Transactions').getRange(i+1,11,1,2).setValues([[t[i][10],t[i][11]]]);
    break; } }
  return {actual:+amt.toFixed(2), billsTotal:+tot.toFixed(2)};
}

function billAdd_(p){
  var t=rows_('Transactions'), tr=null, i;
  for(i=1;i<t.length;i++){ if(String(t[i][0]).trim()===String(p.txnId).trim()){ tr=t[i]; break; } }
  if(!tr) throw new Error('Txn கிடைக்கவில்லை: '+p.txnId);
  var amt=num(p.amt), gp=num(p.gp)||num(tr[8])||4;
  var gst=+(amt*gp/100).toFixed(2), tot=+(amt*1.18).toFixed(2);
  var id='B'+rid(7);
  var row=[id, tr[0], tr[2], tr[3], String(p.no||''), String(p.date||''), amt, gp, gst, tot];
  sh('Bills').appendRow(row);
  try{ sh('Bill_Details').appendRow(row); }catch(e){}
  var rc=billsRecalc_(tr[0]);
  audit_(p.user,'BILL_ADD',id,tr[3]+' ₹'+amt);
  return {ok:true, billId:id, gst:gst, total:tot, actual:rc.actual, billsTotal:rc.billsTotal};
}

function bills2B_(sheetName){
  if(b2bSheets_().indexOf(sheetName)>=0) return {ok:true, rows:b2bRowsNew_(sheetName)}; // v5.3 Sri Polinchi contractor tabs
  if(!/^GSTR2B_/i.test(sheetName)) throw new Error('2B month tab மட்டும்: '+sheetName);
  var v=rows_(sheetName), out=[], i;
  for(i=1;i<v.length;i++){
    var inv=String(v[i][0]||'').trim();
    if(!inv) continue;
    out.push({inv:inv, nm:String(v[i][1]||'').trim(), dt:String(v[i][2]||'').trim(), taxable:num(v[i][3]), total:num(v[i][8]), fy:String(v[i][10]||'').trim(), period:String(v[i][9]||'').trim()});
  }
  return {ok:true, rows:out};
}

/* ── v5.3: 2B source = Sri Polinchi & Co contractor tabs (GSTIN+Party+Month) ── */
function b2bSheets_(){
  var s2=SpreadsheetApp.openById(B2_ID), want=['Malaiyappan Contractor GSTR 2B','Arivoly GSTR 2B','Arivoly Contractor GSTR 2B'], out=[], i;
  for(i=0;i<want.length;i++){ if(s2.getSheetByName(want[i])) out.push(want[i]); }
  return out;
}
function b2bMonth_(dt){
  if(!dt) return '';
  if(Object.prototype.toString.call(dt)==='[object Date]') return dt.getFullYear()+'-'+('0'+(dt.getMonth()+1)).slice(-2);
  var s=String(dt).trim(), m=s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if(m){ var y=m[3].length===2?('20'+m[3]):m[3]; return y+'-'+('0'+m[2]).slice(-2); }
  m=s.match(/^(\d{4})-(\d{2})/); if(m) return m[1]+'-'+m[2];
  return '';
}
function b2bFy_(ym){
  var p=String(ym||'').split('-'); if(p.length<2) return '';
  var y=+p[0], m=+p[1], a, b;
  if(m>=4){ a=y; b=(''+(y+1)).slice(-2); } else { a=y-1; b=(''+y).slice(-2); }
  return a+'-'+b;
}
function b2bRowsNew_(tab){
  var v=SpreadsheetApp.openById(B2_ID).getSheetByName(tab).getDataRange().getValues(), out=[], i;
  if(!v.length) return out;
  var portal=String((v[1]&&v[1][3])||v[0][3]||'').trim().toLowerCase()==='month'; // portal header row2 (Arivoly Contractor) or row1
  var start=portal?2:1;
  for(i=start;i<v.length;i++){
    var gst,nm,inv,dt,ival,tax,mo;
    if(portal){ mo=b2bMonth_(v[i][3]); gst=v[i][4]; nm=v[i][5]; inv=v[i][6]; dt=v[i][8]; ival=v[i][9]; tax=v[i][13]; }
    else { gst=v[i][0]; nm=v[i][1]; inv=v[i][2]; dt=v[i][3]; ival=v[i][4]; tax=v[i][5]; mo=b2bMonth_(dt); }
    inv=String(inv||'').trim();
    if(!inv) continue;
    var dts;
    if(Object.prototype.toString.call(dt)==='[object Date]') dts=('0'+dt.getDate()).slice(-2)+'/'+('0'+(dt.getMonth()+1)).slice(-2)+'/'+dt.getFullYear();
    else dts=String(dt||'').trim();
    out.push({inv:inv, nm:String(nm||'').trim(), gst:String(gst||'').trim(), dt:dts, taxable:num(tax), total:num(ival)||+(num(tax)*1.18).toFixed(2), month:mo, fy:b2bFy_(mo)});
  }
  return out;
}
function b2bRows_(tab){
  if(b2bSheets_().indexOf(tab)>=0) return b2bRowsNew_(tab); // v5.3
  var v=rows_(tab), out=[], i;
  for(i=1;i<v.length;i++){
    var inv=String(v[i][0]||'').trim();
    if(!inv) continue;
    out.push({inv:inv, nm:String(v[i][1]||'').trim(), dt:String(v[i][2]||'').trim(), taxable:num(v[i][3]), total:num(v[i][8]), fy:String(v[i][10]||'').trim(), period:String(v[i][9]||'').trim()});
  }
  return out;
}
function b2bClassTab_(){
  var s=ss().getSheetByName('2B_Classify');
  if(!s){ s=ss().insertSheet('2B_Classify'); s.appendRow(['key','nm','tab','fy','month','type','txnId','agentId','pct','status','at','user']); }
  return s;
}
function b2bClass_(p){
  var nm=String(p.nm||'').trim(), tab=String(p.tab||'').trim(), type=String(p.type||'').trim();
  var gst=String(p.gst||'').trim().toUpperCase(), mo=String(p.month||'').trim(), fy=b2bFy_(mo);
  if(!nm||!tab||(type!=='Company'&&type!=='Private')) throw new Error('nm / tab / type (Company|Private) தேவை');
  var all=b2bRows_(tab), mine=[], i;
  for(i=0;i<all.length;i++){ if(all[i].nm.toLowerCase()===nm.toLowerCase() && (!mo||String(all[i].month||'')===mo)) mine.push(all[i]); }
  if(!mine.length) throw new Error('2B tab-இல் supplier இல்லை: '+nm+(mo?' · '+mo:''));
  var exp=0; for(i=0;i<mine.length;i++) exp+=mine[i].taxable; exp=+exp.toFixed(2);
  if(!gst){ for(i=0;i<mine.length;i++){ if(mine[i].gst){ gst=mine[i].gst.toUpperCase(); break; } } }
  // vendor: match by GSTIN first, then name; else auto-create with GST+name (v5.3)
  var v=rows_('Vendors'), code='', j;
  if(gst){ for(j=1;j<v.length;j++){ if(String(v[j][5]||'').trim().toUpperCase()===gst){ code=String(v[j][0]).trim(); break; } } }
  if(!code){ for(j=1;j<v.length;j++){ if(String(v[j][1]||'').trim().toLowerCase()===nm.toLowerCase()){ code=String(v[j][0]).trim(); break; } } }
  if(!code){ code=vendorCode_('Pudukkottai','Other'); sh('Vendors').appendRow([code, nm, 'Pudukkottai', '', 'Supplier', gst, '', String(new Date().getFullYear()), nowIso()]); }
  var txnId='';
  if(type==='Private'){
    var r=txnAdd_({vendorCode:code, expected:exp, advance:0, gp:4, fy:fy, month:mo, agentId:'', ct:'2b', user:p.user||'admin'});
    txnId=r.txnId;
  }
  var s=b2bClassTab_(), vr=s.getDataRange().getValues(), key=nm+'|'+tab, found=0;
  for(j=1;j<vr.length;j++){ if(String(vr[j][0]).trim()===key){ found=j+1; break; } }
  var row=[key, nm, tab, fy, mo, type, txnId, '', 0, (type==='Private'?'Pending':'Company'), nowIso(), String(p.user||'admin')];
  if(found) s.getRange(found,1,1,row.length).setValues([row]); else s.appendRow(row);
  audit_(p.user||'admin','B2B_CLASS',key,type+' · exp ₹'+exp+(txnId?' · txn '+txnId:'')+(code?' · '+code:''));
  return {ok:true, key:key, vendorCode:code, txnId:txnId, expected:exp, bills:mine.length};
}
function b2bConfirm_(p){
  var txnId=String(p.txnId||'').trim();
  if(!txnId) throw new Error('txnId தேவை');
  var s=b2bClassTab_(), vr=s.getDataRange().getValues(), i, crow=null, crow2=0;
  for(i=1;i<vr.length;i++){ if(String(vr[i][6]).trim()===txnId){ crow=vr[i]; crow2=i+1; break; } }
  if(!crow) throw new Error('2B_Classify-இல் இந்த txn இல்லை (Vendors → 2B Inbox-இல் classify செய்யவும்): '+txnId);
  var nm=String(crow[1]).trim(), tab=String(crow[2]).trim(), mo=String(crow[4]||'').trim();
  var t=rows_('Transactions'), tr=null;
  for(i=1;i<t.length;i++){ if(String(t[i][0]).trim()===txnId){ tr=t[i]; break; } }
  if(!tr) throw new Error('Txn இல்லை: '+txnId);
  var mine=b2bRows_(tab).filter(function(r){ return r.nm.toLowerCase()===nm.toLowerCase() && (!mo||String(r.month||'')===mo); });
  var nb=0;
  for(i=0;i<mine.length;i++){ billAdd_({txnId:txnId, no:mine[i].inv, date:mine[i].dt, amt:mine[i].taxable, gp:18, user:p.user||'admin'}); nb++; }
  var exp=num(tr[6]), pct=num(p.pct)||0.5, agentId=String(p.agentId||'').trim(), com=0;
  if(agentId){
    com=+(exp*pct/100).toFixed(2);
    sh('AgentWallet').appendRow(['AW'+rid(10), agentId, nowIso(), 'Commission — '+tr[3], txnId, tr[3], exp, pct, pct, com, '2b-confirm', com]);
  }
  var rc=txnConfirm_({txnId:txnId, user:p.user||'admin', g2count:mine.length});
  s.getRange(crow2,8,1,3).setValues([[agentId, pct, 'Confirmed']]);
  audit_(p.user||'admin','B2B_CONFIRM',txnId,nm+' · bills '+nb+' · com ₹'+com+' · '+pct+'%');
  return {ok:true, bills:nb, commission:com, pct:pct, agentId:agentId, billsTotal:rc.billsTotal};
}

function txnConfirm_(p){
  var t=rows_('Transactions'), i, row=0;
  for(i=1;i<t.length;i++){ if(String(t[i][0]).trim()===String(p.txnId).trim()){ row=i+1; break; } }
  if(!row) throw new Error('Txn கிடைக்கவில்லை: '+p.txnId);
  var v=t[row-1];
  var rc=billsRecalc_(p.txnId);
  sh('Transactions').getRange(row,14).setValue('Closed');
  try{
    var ven=rows_('Vendors'), gstin='';
    for(i=1;i<ven.length;i++){ if(String(ven[i][0]).trim()===String(v[2]).trim()){ gstin=String(ven[i][5]||'').trim(); break; } }
    if(gstin){
      var g=rows_('GSTR2B_Summary'), found=0;
      for(i=1;i<g.length;i++){ if(String(g[i][0]).trim()===String(v[4]).trim() && String(g[i][1]).trim().toLowerCase()===String(v[5]).trim().toLowerCase().slice(0,3) && String(g[i][3]).trim()===gstin){ found=i+1; break; } }
      var exp=num(v[6]), actTot=rc.billsTotal;
      var tax=+Math.round(exp/1.18).toFixed(2);
      if(found){ sh('GSTR2B_Summary').getRange(found,5,1,5).setValues([[tax, +Math.max(0,actTot-tax).toFixed(2), 0, +actTot.toFixed(2), num(p.g2count)||0]]); }
      else { sh('GSTR2B_Summary').appendRow([String(v[4]), String(v[5]), new Date(), gstin, tax, +Math.max(0,actTot-tax).toFixed(2), 0, +actTot.toFixed(2), num(p.g2count)||0, nowIso()]); }
    }
  }catch(e){}
  audit_(p.user,'TXN_CONFIRM',p.txnId,'Closed · bills ₹'+rc.billsTotal);
  return {ok:true, actual:rc.actual, billsTotal:rc.billsTotal, status:'Closed'};
}

function vendorAdd_(p){
  var rr=String(p.role||'').toLowerCase();
  if(['admin','district','agent'].indexOf(rr)<0) throw new Error('Vendor சேர்க்க அனுமதி இல்லை (agent / manager / admin மட்டும்)');
  var code=vendorCode_(p.district, p.type);
  var row=[code, String(p.name||'').trim(), String(p.district||'Pudukkottai').trim(), String(p.mobile||'').trim(), String(p.type||'').trim(), String(p.gst||'').trim().toUpperCase(), String(p.addr||'').trim(), String(p.reg||new Date().getFullYear()), nowIso()];
  sh('Vendors').appendRow(row);
  try{ sh('Vendor_Master').appendRow(row); }catch(e){}
  audit_(p.user,'VENDOR_ADD',code,p.name+' ('+rr+')');
  return {ok:true, vendorCode:code};
}
function vendorRemove_(p){
  var rr=String(p.role||'').toLowerCase();
  if(rr!=='admin'&&rr!=='district') throw new Error('Vendor நீக்க அனுமதி இல்லை (manager / admin மட்டும்)');
  var v=rows_('Vendors'),i,hit=0;
  for(i=1;i<v.length;i++){ if(String(v[i][0]).trim()===String(p.vendorCode).trim()){ hit=i+1; break; } }
  if(!hit) throw new Error('Vendor கிடைக்கவில்லை: '+p.vendorCode);
  var t=rows_('Transactions');
  for(i=1;i<t.length;i++){ if(String(t[i][2]).trim()===String(p.vendorCode).trim()) throw new Error('இந்த vendor-க்கு transactions உள்ளது — முதலில் அவற்றை நீக்கவும்'); }
  sh('Vendors').deleteRow(hit);
  try{
    var m=rows_('Vendor_Master');
    for(i=1;i<m.length;i++){ if(String(m[i][0]).trim()===String(p.vendorCode).trim()){ sh('Vendor_Master').deleteRow(i+1); break; } }
  }catch(e){}
  audit_(p.user,'VENDOR_REMOVE',p.vendorCode,'');
  return {ok:true};
}
function vendorEdit_(p){
  var rr=String(p.role||'').toLowerCase();
  if(['admin','district','agent'].indexOf(rr)<0) throw new Error('Vendor திருத்த அனுமதி இல்லை (agent / manager / admin மட்டும்)');
  var v=rows_('Vendors'),i,hit=0;
  for(i=1;i<v.length;i++){ if(String(v[i][0]).trim()===String(p.vendorCode).trim()){ hit=i+1; break; } }
  if(!hit) throw new Error('Vendor கிடைக்கவில்லை: '+p.vendorCode);
  var cur=v[hit-1];
  function pick(a,b){ return (p[a]!=null&&String(p[a]).trim()!=='')?String(p[a]).trim():String(cur[b]||''); }
  var row=[cur[0], pick('name',1), pick('district',2), pick('mobile',3), pick('type',4), String(pick('gst',5)).toUpperCase(), pick('addr',6), pick('reg',7), cur[8]||nowIso()];
  sh('Vendors').getRange(hit,1,1,row.length).setValues([row]);
  try{
    var m=rows_('Vendor_Master'),mh=0;
    for(i=1;i<m.length;i++){ if(String(m[i][0]).trim()===String(p.vendorCode).trim()){ mh=i+1; break; } }
    if(mh) sh('Vendor_Master').getRange(mh,1,1,row.length).setValues([row]);
  }catch(e){}
  audit_(p.user,'VENDOR_EDIT',p.vendorCode,row[1]);
  return {ok:true, vendorCode:cur[0], vendorName:row[1]};
}
function walletAdd_(p){
  var rr=String(p.role||'').toLowerCase();
  if(rr!=='admin') throw new Error('Wallet மாற்ற அனுமதி admin-க்கு மட்டும்');
  var w=rows_('Admin_Wallet'), bal=0, i;
  for(i=1;i<w.length;i++){ var b2=num(w[i][5]); if(String(w[i][1]).trim()!==''||num(w[i][3])||num(w[i][4])) bal=b2; }
  var dr=num(p.debit), cr=num(p.credit);
  bal=+(bal+cr-dr).toFixed(2);
  sh('Admin_Wallet').appendRow([String(p.date||nowIso()), String(p.desc||''), String(p.type||''), dr, cr, bal]);
  audit_(p.user,'WALLET_ADD',String(p.type||''),(p.desc||'')+' -₹'+dr+' +₹'+cr+' bal ₹'+bal);
  return {ok:true, balance:bal};
}

function userAdd_(p){
  var id='U'+rid(8);
  sh('User_Config').appendRow([id, String(p.username||'').trim(), String(p.password||''), String(p.role||'vendor'), String(p.district||'')]);
  audit_(p.user,'USER_ADD',id,p.username+' ('+p.role+')');
  return {ok:true, userId:id};
}
function userPass_(p){
  var u=rows_('User_Config'), i;
  for(i=1;i<u.length;i++){ if(String(u[i][0]).trim()===String(p.userId).trim()){ sh('User_Config').getRange(i+1,3).setValue(String(p.password||'')); audit_(p.user,'USER_PASS',p.userId,''); return {ok:true}; } }
  throw new Error('User கிடைக்கவில்லை');
}
function userEdit_(p){
  var u=rows_('User_Config'), i, hit=0;
  for(i=1;i<u.length;i++){ if(String(u[i][0]).trim()===String(p.userId).trim()){ hit=i+1; break; } }
  if(!hit) throw new Error('User கிடைக்கவில்லை: '+p.userId);
  var cur=u[hit-1];
  var un=(p.username!=null&&String(p.username).trim()!=='')?String(p.username).trim():String(cur[1]);
  var pw=(p.password!=null&&String(p.password)!=='')?String(p.password):String(cur[2]);
  var rl=(p.role!=null&&String(p.role).trim()!=='')?String(p.role).trim():String(cur[3]||'');
  var dn=(p.district!=null)?String(p.district).trim():String(cur[4]||'');
  if(un!==String(cur[1]) && findRow_('User_Config',1,un)) throw new Error('இந்த username ஏற்கனவே உள்ளது: '+un);
  sh('User_Config').getRange(hit,2,1,4).setValues([[un,pw,rl,dn]]);
  audit_(p.user,'USER_EDIT',p.userId,un+' ('+rl+')');
  return {ok:true, username:un, role:rl};
}
function userRemove_(p){
  var u=rows_('User_Config'), i, hit=0;
  for(i=1;i<u.length;i++){ if(String(u[i][0]).trim()===String(p.userId).trim() || (p.username && String(u[i][1]).trim()===String(p.username).trim())){ hit=i+1; break; } }
  if(!hit) throw new Error('User கிடைக்கவில்லை');
  if(u.length<=2) throw new Error('கடைசி user-ஐ நீக்க முடியாது');
  sh('User_Config').deleteRow(hit);
  audit_(p.user,'USER_REMOVE',p.userId||p.username,'');
  return {ok:true};
}
function agentAdd_(p){
  var a=rows_('Agents'), max=0, i, code;
  for(i=1;i<a.length;i++){ code=String(a[i][0]||''); if(/^AGT\d{3}$/.test(code)){ var n=parseInt(code.slice(3),10); if(n>max)max=n; } }
  var id='AGT'+('00'+(max+1)).slice(-3);
  sh('Agents').appendRow([id, String(p.fullName||'').trim(), String(p.username||'').trim(), String(p.password||''), String(p.mobile||'').trim(), '', String(p.managerName||'admin'), String(p.managerDistrict||'Pudukkottai'), String(p.ct||'auto'), num(p.cpercent)||0.5, String(p.bank||''), String(p.acct||''), String(p.ifsc||''), String(p.upi||''), 'approved', String(p.user||'admin'), nowIso(), 0, nowIso(), '']);
  audit_(p.user,'AGENT_ADD',id,p.fullName);
  return {ok:true, agentId:id};
}
function agentEdit_(p){
  var a=rows_('Agents'), i, hit=0;
  for(i=1;i<a.length;i++){ if(String(a[i][0]).trim()===String(p.agentId).trim()){ hit=i+1; break; } }
  if(!hit) throw new Error('Agent கிடைக்கவில்லை: '+p.agentId);
  var cur=a[hit-1];
  var pct=(p.cpercent!=null&&String(p.cpercent)!=='')?num(p.cpercent):num(cur[9]);
  sh('Agents').getRange(hit,10).setValue(pct);
  if(p.status!=null&&String(p.status).trim()!=='') sh('Agents').getRange(hit,15).setValue(String(p.status).trim());
  audit_(p.user,'AGENT_EDIT',p.agentId,pct+'% '+(p.status||''));
  return {ok:true, cpercent:pct, status:p.status||String(cur[14]||'')};
}
function agentRemove_(p){
  return agentEdit_({agentId:p.agentId, status:'Inactive', user:p.user});
}
function overrideAdd_(p){
  var id='OV'+rid(8);
  sh('AgentOverrides').appendRow([id, String(p.agentId||''), String(p.vendorCode||''), String(p.vendorName||''), num(p.percent), String(p.user||'admin'), nowIso()]);
  audit_(p.user,'OVERRIDE_ADD',id,p.agentId+' → '+p.vendorCode+' '+p.percent+'%');
  return {ok:true, id:id};
}
function login_(p){
  var u=rows_('User_Config'), i;
  var un=String(p.u||'').trim(), pw=String(p.p||'');
  if(un.toLowerCase()==='admin' && pw==='Polinchi@2026') return {ok:true, userId:'ADMIN', username:'admin', role:'admin', districtName:'Pudukkottai'};
  for(i=1;i<u.length;i++){
    if(String(u[i][1]).trim()===String(p.u||'').trim()){
      if(String(u[i][2])!==String(p.p||'')) return {ok:false, error:'கடவுச்சொல் தவறு'};
      var role=String(u[i][3]||'').trim();
      return {ok:true, userId:String(u[i][0]), username:String(u[i][1]), role:role, districtName:String(u[i][4]||'')};
    }
  }
  var ag=rows_('Agents'), j;
  for(j=1;j<ag.length;j++){
    if(String(ag[j][2]).trim()===un){
      if(String(ag[j][3])!==pw) return {ok:false, error:'கடவுச்சொல் தவறு'};
      if(String(ag[j][14]).trim()==='Inactive') return {ok:false, error:'ஏஜெண்ட் Inactive நிலையில் உள்ளார்'};
      return {ok:true, userId:String(ag[j][0]), username:String(ag[j][2]), role:'agent', districtName:String(ag[j][7]||''), agentId:String(ag[j][0])};
    }
  }
  return {ok:false, error:'பயனர் இல்லை'};
}
function vlist_(tab){
  var src=({txns:'Transactions',overrides:'AgentOverrides',wallet:'AgentWallet'})[tab]||tab;
  function obj(keys){ var v=rows_(src), out=[], i, j, o; for(i=1;i<v.length;i++){ var any=false; o={};
    for(j=0;j<keys.length;j++){ o[keys[j]]=(v[i][j]==null?'':v[i][j]); if(o[keys[j]]!=='')any=true; }
    if(any) out.push(o); } return out; }
  if(tab==='vendors') return {ok:true, rows:obj(['vendorCode','vendorName','districtName','mobile','businessType','gstNumber','address','regYear','createdAt'])};
  if(tab==='txns') return {ok:true, rows:obj(['txnId','districtName','vendorCode','vendorName','fy','month','expected','advance','gp','gst','actual','remaining','balance','status'])};
  if(tab==='bills') return {ok:true, rows:obj(['billId','txnId','vendorCode','vendorName','no','date','amt','gp','gst','total'])};
  if(tab==='users') return {ok:true, rows:obj(['userId','username','password','role','districtName'])};
  if(tab==='agents') return {ok:true, rows:obj(['agentId','fullName','username','password','mobile','managerId','managerName','managerDistrict','ct','cpercent','bank','acct','ifsc','upi','status','approvedBy','approvedAt','bonus','createdAt','lastLogin'])};
  if(tab==='wallet') return {ok:true, rows:obj(['id','agentId','date','description','txnId','vendorName','txnAmount','gp','pct','commission','ct','credited'])};
  if(tab==='overrides') return {ok:true, rows:obj(['id','agentId','vendorCode','vendorName','percent','setBy','setAt'])};
  if(tab==='adminwallet'){
    var w=rows_('Admin_Wallet'), out2=[], i2;
    for(i2=1;i2<w.length;i2++){
      var d=String(w[i2][1]||'').trim();
      if(!d && !num(w[i2][3]) && !num(w[i2][4])) continue;
      out2.push({date:String(w[i2][0]||''), desc:d, type:String(w[i2][2]||''), debit:num(w[i2][3]), credit:num(w[i2][4]), balance:num(w[i2][5])});
    }
    return {ok:true, rows:out2};
  }
  if(tab==='2btabs'){
    var all=ss().getSheets(), out=[], i;
    for(i=0;i<all.length;i++){ var nm=all[i].getName(); if(/^GSTR2B_/i.test(nm)) out.push(nm); }
    return {ok:true, rows:out};
  }
  if(tab==='b2btabs') return {ok:true, rows:b2bSheets_()}; // v5.3 Sri Polinchi contractor tabs
  if(tab==='b2bclass'){
    var c=ss().getSheetByName('2B_Classify');
    if(!c) return {ok:true, rows:[]};
    var cv=c.getDataRange().getValues(), co=[], k2;
    for(k2=1;k2<cv.length;k2++){
      if(!String(cv[k2][0]||'').trim()) continue;
      co.push({key:String(cv[k2][0]||''), nm:String(cv[k2][1]||''), tab:String(cv[k2][2]||''), fy:String(cv[k2][3]||''), month:String(cv[k2][4]||''), type:String(cv[k2][5]||''), txnId:String(cv[k2][6]||''), agentId:String(cv[k2][7]||''), pct:num(cv[k2][8]), status:String(cv[k2][9]||''), at:String(cv[k2][10]||''), user:String(cv[k2][11]||'')});
    }
    return {ok:true, rows:co};
  }
  throw new Error('தெரியா tab: '+tab);
}

function doGet(e){
  var p=(e&&e.parameter)||{}, cb=p.callback||'cb';
  function out(o){ return ContentService.createTextOutput(cb+'('+JSON.stringify(o)+')').setMimeType(ContentService.MimeType.JAVASCRIPT); }
  if(p.k!==API_KEY) return out({ok:false, error:'Key தவறு'});
  try{
    var r;
    switch(p.action){
      case 'ping': r={ok:true, time:nowIso()}; break;
      case 'login': r=login_(p); break;
      case 'list': r=vlist_(p.tab); break;
      case 'vendorAdd': r=vendorAdd_(p); break;
      case 'vendorRemove': r=vendorRemove_(p); break;
      case 'vendorEdit': r=vendorEdit_(p); break;
      case 'walletAdd': r=walletAdd_(p); break;
      case 'txnAdd': r=txnAdd_(p); break;
      case 'billAdd': r=billAdd_(p); break;
      case 'bills2B': r=bills2B_(p.sheet); break;
      case 'b2bClass': r=b2bClass_(p); break;
      case 'b2bConfirm': r=b2bConfirm_(p); break;
      case 'txnConfirm': r=txnConfirm_(p); break;
      case 'userAdd': r=userAdd_(p); break;
      case 'userPass': r=userPass_(p); break;
      case 'userEdit': r=userEdit_(p); break;
      case 'userRemove': r=userRemove_(p); break;
      case 'agentAdd': r=agentAdd_(p); break;
      case 'agentEdit': r=agentEdit_(p); break;
      case 'agentRemove': r=agentRemove_(p); break;
      case 'overrideAdd': r=overrideAdd_(p); break;
      default: r={ok:false, error:'தெரியா action: '+p.action};
    }
    return out(r);
  }catch(err){
    return out({ok:false, error:String(err&&err.message||err)});
  }
}
