/* ITC Input — monthly reconciliation card test (GST Centre → ITC tab)
   Run: NODE_PATH=/tmp/node_modules node itcinput.tmp.cjs */
const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const bundle=fs.readFileSync('v4/public/assets/index-CHTAzd11.js','utf8');
let fails=0;const ok=(c,m)=>{console.log((c?'✓':'✗ FAIL')+' '+m);if(!c)fails++};
const USER={username:'admin',name:'Admin',role:'super_admin'};

const SUM={ok:true,months:['2026-01','2025-12'],rows:[
 {nm:'Supp A',gst:'33AAAAA1111A1Z1',month:'2025-12',n:2,tax:100000,tot:118000},
 {nm:'Supp B',gst:'33BBBBB2222B1Z2',month:'2025-12',n:1,tax:50000,tot:59000},
 {nm:'Supp C',gst:'33CCCCC3333C1Z3',month:'2025-12',n:1,tax:20000,tot:23600},
 {nm:'Supp A',gst:'33AAAAA1111A1Z1',month:'2026-01',n:1,tax:7000,tot:8260}]};
const CLS={ok:true,rows:[
 {nm:'Supp A',month:'2025-12',tab:'GSTR2B',type:'Company',status:'Company'},
 {nm:'Supp B',month:'2025-12',tab:'GSTR2B',type:'Private',status:'Pending',txnId:'TXN1'}]};
const COMP={ok:true,rows:[
 {inv:'INV-1',nm:'Supp A',gst:'33AAAAA1111A1Z1',dt:'01-12-2025',taxable:60000,total:70800,month:'2025-12'},
 {inv:'INV-2',nm:'Supp A',gst:'33AAAAA1111A1Z1',dt:'18-12-2025',taxable:40000,total:47200,month:'2025-12'},
 {inv:'INV-3',nm:'Supp A',gst:'33AAAAA1111A1Z1',dt:'05-01-2026',taxable:7000,total:8260,month:'2026-01'}]};
const STMT={table:{cols:[{type:'string'},{type:'string'},{type:'number'},{type:'number'},{type:'number'}],rows:[
 {c:[{v:'Polinchi B/S 1712'}]},
 {c:[{v:'Date'},{v:'Description'},{v:'Credit'},{v:'Debit'},{v:'Running Balance'}]},
 {c:[{v:'05/12/2025'},{v:'BY NEFT ABC'},{v:200000},{v:null},{v:200000}]},
 {c:[{v:'20/12/2025'},{v:'BY NEFT XYZ'},{v:100000},{v:null},{v:300000}]},
 {c:[{v:'22/12/2025'},{v:'TO RTGS PAY'},{v:null},{v:40000},{v:260000}]},
 {c:[{v:'10/01/2026'},{v:'BY NEFT JAN'},{v:50000},{v:null},{v:310000}]}
]}};

const vc=new VirtualConsole();vc.on('error',(...a)=>console.log('CONSOLE-ERR:',String(a[0]).slice(0,300)));
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://x.test/',runScripts:'outside-only',pretendToBeVisual:!0,virtualConsole:vc});
const w=dom.window;
w.sessionStorage.setItem('ar4.token','t');
w.sessionStorage.setItem('ar4.user',JSON.stringify(USER));
w.EyV3Api={stub:true,call:function(act,pr,cb){
  if(act==='b2bSummary')return cb(null,SUM);
  if(act==='b2bCompanyBills')return cb(null,COMP);
  if(act==='list'&&pr&&pr.tab==='b2bclass')return cb(null,CLS);
  return cb(null,{ok:true,rows:[]});
}};
w.fetch=function(u){u=String(u);
  if(u.indexOf('/api/gsheet')>=0)return Promise.resolve({ok:false,status:404,text:()=>Promise.resolve('x')});
  if(u.indexOf('docs.google.com')>=0)return Promise.resolve({ok:true,text:()=>Promise.resolve('/*O_o*/\ngoogle.visualization.Query.setResponse('+JSON.stringify(STMT)+');')});
  if(u.indexOf('auth.me')>=0)return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve(JSON.stringify({ok:true,data:{user:USER}}))});
  return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve(JSON.stringify({ok:true,data:{rows:[]}}))})};
w.open=function(){return{document:{write(){},close(){}},focus(){},print(){}}};
w.addEventListener('error',e=>console.log('WIN-ERR:',String(e.message).slice(0,200)));
w.eval(bundle);

function txt(){return w.document.body.textContent.replace(/\s+/g,' ')}
setTimeout(function(){w.location.hash='#/gst';w.dispatchEvent(new w.Event('hashchange'))},1800);
setTimeout(function(){
  const tabBtn=[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='ITC');
  ok(!!tabBtn,'GST Centre ITC tab button found');
  tabBtn&&tabBtn.click();
},2600);
setTimeout(function(){
  const T=txt();
  ok(T.includes('ITC Input — மாதாந்திர கணக்கு')||T.includes('ITC Input — Monthly account'),'card title rendered');
  ok(T.includes('Company bills')||T.includes('கம்பெனி பில்'),'company table heading');
  ok(T.includes('Private bills')||T.includes('பிரைவேட் பில்'),'private table heading');
  ok(T.includes('ITC Input account')||T.includes('ITC Input கணக்கு'),'ITC Input calc table heading');
  ok(!T.includes('Supp C'),'unclassified supplier excluded');
  // pick December 2025 explicitly
  const sel=w.document.querySelector('select.ui-input');
  ok(!!sel,'month select present');
  ok([...sel.options].some(o=>o.value==='2025-12'),'2025-12 month option present');
  sel.value='2025-12';sel.dispatchEvent(new w.Event('change',{bubbles:true}));
  setTimeout(function(){
   const T1=txt();
   ok(T1.includes('₹1,18,000'),'company bills total ₹1,18,000');
   ok(T1.includes('₹59,000'),'private bills total ₹59,000');
   ok(T1.includes('₹1,77,000'),'combined total ₹1,77,000');
   ok(T1.includes('₹1,50,000'),'taxable total ₹1,50,000');
   ok(T1.includes('₹27,000'),'18% GST / ITC Input ₹27,000');
   ok(T1.includes('₹31,860'),'18% on total (reference) ₹31,860');
   ok(T1.includes('₹3,00,000'),'bank credit Dec ₹3,00,000');
   ok(T1.includes('₹1,23,000'),'balance bank − bills ₹1,23,000');
   ok(/மீதம் உள்ளது|Balance available/.test(T1),'balance labelled as remaining');
   // switch to 2026-01
   const sel2=w.document.querySelector('select.ui-input');
   const opt=[...sel2.options].find(o=>o.value==='2026-01');
   ok(!!opt,'2026-01 month option present');
   sel2.value='2026-01';sel2.dispatchEvent(new w.Event('change',{bubbles:true}));
   setTimeout(function(){
    const T2=txt();
    ok(T2.includes('₹8,260'),'Jan company bills ₹8,260');
    ok(T2.includes('₹50,000'),'Jan bank credit ₹50,000');
    ok(T2.includes('₹1,260'),'Jan ITC input 18% of 7,000 = ₹1,260');
    ok(T2.includes('₹41,740'),'Jan balance 50,000 − 8,260 = ₹41,740');
    w.close();
    console.log(fails===0?'ITC INPUT ALL PASS':'ITC INPUT FAILURES: '+fails);
    process.exit(fails===0?0:1);
   },900);
  },900);
},4200);
