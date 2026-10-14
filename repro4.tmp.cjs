const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const bundle=fs.readFileSync('v4/public/assets/index-CHTAzd11.js','utf8');
const vc=new VirtualConsole();
const dom=new JSDOM('<body><div id=root></div></body>',{url:'https://x.test/',runScripts:'outside-only',pretendToBeVisual:!0,virtualConsole:vc});
const w=dom.window;
w.sessionStorage.setItem('ar4.token','t');w.sessionStorage.setItem('ar4.user',JSON.stringify({username:'a',role:'super_admin'}));
const USER={username:'a',role:'super_admin'};
const G2B={table:{rows:[
 {c:[{v:''},{v:''},{v:'Sri Polinchi & Co'},{v:''},{v:''},{v:''},{v:''}]},
 {c:[{v:'Month'},{v:'GSTIN of supplier'},{v:'Trade/Legal name'},{v:'Invoice number'},{v:'Invoice Date'},{v:'Invoice Value(₹)'},{v:'Taxable Value (₹)'}]},
 {c:[{v:'Date(2024,11,1)'},{v:'33ADXPB8031G1ZL'},{v:'NAGA AND CO'},{v:'101'},{v:'Date(2024,11,5)'},{v:440000},{v:400000}]},
 {c:[{v:'Date(2024,11,1)'},{v:'33ADXPB8031G1ZL'},{v:'NAGA AND CO'},{v:'102'},{v:'Date(2024,11,8)'},{v:118000},{v:100000}]},
 {c:[{v:'Date(2024,12,1)'},{v:'33ACBFM4817G1ZH'},{v:'MS BLUE METAL'},{v:'55'},{v:45635},{v:82209},{v:69669}]}]}};
const IMS={table:{rows:[
 {c:[{v:'GSTIN of supplier'},{v:'Trade/Legal name'},{v:'Invoice number'},{v:'Invoice Date'},{v:'Invoice Value(₹)'},{v:'Taxable Value (₹)'}]},
 {c:[{v:'33ADXPB8031G1ZL'},{v:'NAGA AND CO'},{v:'IM9'},{v:'Date(2025,0,12)'},{v:8746117},{v:8000000}]}]}};
const CW=(n,r,i)=>({table:{rows:[
 {c:[{v:'Work Name'},{v:'Receipt Amount'},{v:'Work Place'},{v:'Work Type'},{v:'Invoice Value'}]},
 {c:[{v:'Drilling of Tubewell'},{v:r},{v:'Kulamangalam'},{v:'Tubewell'},{v:i}]}]}});
const EXP={table:{rows:[
 {c:[{v:'Item'},{v:'Amount (₹)'},{v:'Date'},{v:'Category'}]},
 {c:[{v:'உணவுக்கூடம் அமைத்தல்'},{v:'10,00,000'},{v:45292},{v:'உணவுக்கூடம்'}]}]}};
const GSTP={table:{rows:[{c:[{v:'Month'},{v:'Cash'}]},{c:[{v:'Date(2025,3,24)'},{v:615618}]}]}};
const TNEB={table:{rows:[{c:[{v:'Payment'},{v:'Bill Paid'},{v:'Receipt No'}]},{c:[{v:'Date'},{v:''},{v:''}]},{c:[{v:'Date(2025,5,2)'},{v:19465},{v:'PGX'}]}]}};
const V3VEN={table:{rows:[{c:[{v:'vendorCode'},{v:'vendorName'},{v:'districtName'},{v:'mobile'},{v:'businessType'},{v:'gstNumber'},{v:'address'},{v:'regYear'}]},{c:[{v:'PDK26HW001'},{v:'Sri Balaji Hardwares'},{v:'Pudukkottai'},{v:8838082009},{v:'Hardware'},{v:'33ALXPV6099E3Z6'},{v:'Alangudi'},{v:2026}]},{c:[{v:'PDK26CV006'},{v:'PREMIER WINDOWS'},{v:'Pudukkottai'},{v:9800000000},{v:'Civil'},{v:'33EUSPK8681R1ZB'},{v:''},{v:2026}]}]}};
const V3TXN={table:{rows:[{c:[{v:'txnId'},{v:'districtName'},{v:'vendorCode'},{v:'vendorName'},{v:'financialYear'},{v:'month'},{v:''},{v:''},{v:''},{v:''},{v:''},{v:''},{v:''},{v:'status'}]},{c:[{v:'TXN-Y9WAQEQ'},{v:'Pudukkottai'},{v:'PDK26HW001'},{v:'Sri Balaji Hardwares'},{v:'2024-25'},{v:'December'},{v:300950},{v:5000},{v:4},{v:12038},{v:255043},{v:0},{v:7038},{v:'Closed'}]}]}};
const V3BIL={table:{rows:[{c:[{v:'billId'},{v:'txnId'},{v:'vendorCode'},{v:'vendorName'},{v:''},{v:'billDate'},{v:''},{v:''},{v:''},null]},{c:[{v:'BN5ILN39'},{v:'TXN-Y9WAQEQ'},{v:'PDK26HW001'},{v:'Sri Balaji Hardwares'},{v:1},{v:'2025-12-09T18:30:00.000Z'},{v:76664},{v:4},{v:3066.56},{v:90463.52}]},{c:[{v:'BK2SNIHO'},{v:'TXN-Y9WAQEQ'},{v:'PDK26HW001'},{v:'Sri Balaji Hardwares'},{v:2},{v:'2025-12-14T18:30:00.000Z'},{v:34325},{v:4},{v:1373},{v:40503.5}]},{c:[{v:'BXYZ0009'},{v:'TXN-ORPHAN1'},{v:'PDK26CV006'},{v:'PREMIER WINDOWS'},{v:9},{v:'2026-01-11T18:30:00.000Z'},{v:100000},{v:4},{v:4000},{v:104000}]}]}};
const V3G2={table:{rows:[{c:[{v:'FY'},{v:'Period'},{v:''},{v:'Trade Name'},{v:''},{v:'SavedAt'}]},{c:[{v:'2024-25'},{v:'Dec'},{v:'33ALXPV6099E3Z6'},{v:255043},{v:300950},{v:5}]}]}};
const FIX={'Vendors':V3VEN,'Transactions':V3TXN,'Bills':V3BIL,'GSTR2B_Summary':V3G2,'GSTR2B':G2B,'IMS':IMS,'Contract Work FY 23 to 24':CW(1014678,1073829),'Contract work FY 24-25':CW(684751,749443),'Contract work FY 25-26':CW(0,6306897),'2024-25 Expense Journal':EXP,'GST Tax Payment':GSTP,'TNEB':TNEB};
let printHTML='';
w.open=(u,t)=>({document:{write:h=>{printHTML+=h},close:()=>{}},focus(){},print(){}});
w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
let csvBlob=null;
const BlobO=w.Blob;
w.Blob=function(parts,o){csvBlob=(parts||['']).join('');return new BlobO(parts,o)};
w.fetch=(u)=>{u=String(u);
 if(u.indexOf('auth.me')>=0)return Promise.resolve({ok:!0,status:200,text:()=>Promise.resolve(JSON.stringify({ok:!0,data:{user:USER}}))});
 if(u.indexOf('/api/gsheet?')>=0){
  const m=u.match(/sheet=([^&]+)/);const name=m?decodeURIComponent(m[1]):'';
  const f=FIX[name];
  if(f)return Promise.resolve({ok:!0,status:200,text:()=>Promise.resolve('cb('+JSON.stringify(f)+')')});
  return Promise.resolve({ok:!1,status:404,text:()=>Promise.resolve('nf')});
 }
 return Promise.resolve({ok:!0,status:200,text:()=>Promise.resolve(JSON.stringify({ok:!0,data:{}}))})};
const errs=[];w.addEventListener('error',e=>errs.push(e.message));
w.localStorage.setItem("ar4.v3url","https://script.google.com/macros/s/TEST/exec");
w.EyV3Api={call:function(a,p,cb){cb("offline-stub")}};
w.eval(bundle);
function nav(h){w.location.hash=h;w.dispatchEvent(new w.Event('hashchange'))}
const T=()=>w.document.body.textContent.replace(/\s+/g,' ');
let fails=0;const ok=(c,m)=>{console.log((c?'✓':'✗ FAIL')+' '+m);if(!c)fails++};
const step=(fn,ms)=>new Promise(r=>setTimeout(()=>{fn();r()},ms));
(async()=>{
 await step(()=>nav('#/vendors'),2000);
 await step(()=>{},2500);
 ok(T().includes('வணிகர்கள்'),'Vendors page title');
 ok(T().includes('V3 வணிகர் பதிவேடு'),'V3 vendor master card on Vendors page');
 ok(!T().includes('NAGA AND CO'),'93-supplier list removed from Vendors page');
 // (93-supplier table moved off Vendors page — GSTIN/total checks covered on Bills & txn pages)
 // detail
 await step(()=>nav('#/vendors/33ADXPB8031G1ZL'),800);
 await step(()=>{},1500);
 ok(T().includes('NAGA AND CO')&&T().includes('IM9'),'vendor detail bills incl IMS inv');
 ok(T().includes('2025-01-12'),'IMS date formatted: '+((T().match(/20\d\d-\d\d-\d\d/)||[])[0]));
 // bills
 await step(()=>nav('#/bills'),800);
 await step(()=>{},1500);
 ok(T().includes('கொள்முதல் பில்கள்')||T().includes('Bills'),'Bills page title');
 ok(T().includes('எல்லா சப்ளையர்')||T().includes('All suppliers'),'supplier dropdown');
 ok(T().includes('4 / 4')||/1–4 \/ 4/.test(T()),'bills count 4 paged: '+/[\d]+–[\d]+ \/ \d+/.test(T()));
 // bills prefiltered
 await step(()=>nav('#/bills/33ACBFM4817G1ZH'),800);
 await step(()=>{},1200);
 ok(/1–1 \/ 1/.test(T()),'prefiltered bills 1–1 / 1');
 // transactions
 await step(()=>nav('#/transactions'),800);
 await step(()=>{},2500);
 ok(T().includes('பரிவர்த்தனைகள்'),'Txn page title');
 ok(T().includes('Sri Balaji Hardwares')&&T().includes('PREMIER WINDOWS'),'V3 vendor rows');
 ok(T().includes('TXN-Y9WAQEQ'),'txn id col');
 ok(T().includes('3,00,950'),'expected ₹3,00,950');
 ok(T().includes('எதிர்பார்ப்பு'),'expected chip');
 ok(T().includes('2,34,967'),'bills Σ grand 2,34,967');
 ok(T().includes('வடிகட்டிய மொத்தம்')&&T().includes('மொத்த கூட்டுத்தொகை (வடிகட்டாத)'),'txn both totals');
 ok(!T().includes('Drilling of Tubewell'),'no contract-work rows');
 ok(T().includes('பில் மட்டும்')||T().includes('bills only'),'orphan bills-only badge');
 // txn detail
 await step(()=>nav('#/transactions/TXN-Y9WAQEQ'),800);
 await step(()=>{},1800);
 ok(T().includes('மாத அறிவிப்பு')||T().includes('Month declaration'),'detail: month declaration card');
 ok(T().includes('90,463')||T().includes('76664')||T().includes('76,664'),'detail: bill rows');
 ok(T().includes('2B ஒப்பீடு')||T().includes('2B comparison'),'detail: 2B compare card');
 await step(()=>nav('#/transactions'),800);
 await step(()=>{},1200);
 // print test
 printHTML='';
 const pb=[...w.document.querySelectorAll('button')].find(b=>/A4 அச்சு/.test(b.textContent));
 if(pb){pb.click();await step(()=>{},300)}
 ok(printHTML.length>0&&printHTML.indexOf('AR ENTERPRISES')>=0,'print window html');
 ok(printHTML.indexOf('மொத்த கூட்டுத்தொகை (வடிகட்டாத)')>=0&&printHTML.indexOf('வடிகட்டிய மொத்தம்')>=0,'print filtered+grand total lines');
 ok(printHTML.indexOf('Sri Balaji Hardwares')>=0,'print txn rows');
 // CSV test
 csvBlob=null;
 const cb2=[...w.document.querySelectorAll('button')].find(b=>b.textContent.indexOf('CSV')>=0);
 if(cb2){cb2.click();await step(()=>{},300)}
 ok(csvBlob&&(csvBlob.indexOf('Sri Balaji Hardwares')>=0||csvBlob.indexOf('TxnID')>=0),'CSV txn content');
 ok(errs.length===0,'window errors 0 ('+errs.slice(0,2).join('; ')+')');
 console.log(fails?('FAILURES: '+fails):'ALL PASS');
 process.exit(fails?1:0);
})();
