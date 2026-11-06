/* Bank Statement page — month-wise credit summary test
   Run: NODE_PATH=/tmp/node_modules node stmtmonth.tmp.cjs */
const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const bundle=fs.readFileSync('v4/public/assets/index-CHTAzd11.js','utf8');
let fails=0;const ok=(c,m)=>{console.log((c?'✓':'✗ FAIL')+' '+m);if(!c)fails++};
const USER={username:'admin',name:'Admin',role:'super_admin'};
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
w.EyV3Api={stub:true,call:function(act,pr,cb){return cb(null,{ok:true,rows:[]})}};
w.fetch=function(u){u=String(u);
  if(u.indexOf('/api/gsheet')>=0)return Promise.resolve({ok:false,status:404,text:()=>Promise.resolve('x')});
  if(u.indexOf('docs.google.com')>=0)return Promise.resolve({ok:true,text:()=>Promise.resolve('/*O_o*/\ngoogle.visualization.Query.setResponse('+JSON.stringify(STMT)+');')});
  if(u.indexOf('auth.me')>=0)return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve(JSON.stringify({ok:true,data:{user:USER}}))});
  return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve(JSON.stringify({ok:true,data:{rows:[]}}))})};
w.open=function(){return{document:{write(){},close(){}},focus(){},print(){}}};
w.eval(bundle);
setTimeout(function(){w.location.hash='#/auditor-stmt';w.dispatchEvent(new w.Event('hashchange'))},1800);
setTimeout(function(){
  const T=w.document.body.textContent.replace(/\s+/g,' ');
  ok(/Month-wise credit total|மாத வாரியாக வரவு/.test(T),'month-wise credit card rendered');
  ok(T.includes('₹3,00,000'),'Dec 2025 credit total ₹3,00,000');
  ok(T.includes('₹50,000'),'Jan 2026 credit total ₹50,000');
  ok(T.includes('₹3,50,000'),'all-months credit total ₹3,50,000');
  ok(/Credit entries|கிரெடிட் entries/.test(T),'credit entries column present');
  w.close();
  console.log(fails===0?'STMT MONTH ALL PASS':'STMT MONTH FAILURES: '+fails);
  process.exit(fails===0?0:1);
},5200);
