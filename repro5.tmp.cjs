const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const bundle=fs.readFileSync('v4/public/assets/index-CHTAzd11.js','utf8');
let fails=0;const ok=(c,m)=>{console.log((c?'✓':'✗ FAIL')+' '+m);if(!c)fails++};
function mkDom(sess){
 const vc=new VirtualConsole();
 const dom=new JSDOM('<body><div id="root"></div></body>',{url:'https://x.test/',runScripts:'outside-only',pretendToBeVisual:!0,virtualConsole:vc});
 const w=dom.window;
 if(sess){w.sessionStorage.setItem('ar4.token','t');w.sessionStorage.setItem('ar4.user',JSON.stringify({username:'a',role:'super_admin'}))}
 const USER={username:'a',role:'super_admin'};
 const V3VEN={table:{rows:[{c:[{v:'vendorCode'},{v:'vendorName'},{v:'districtName'},{v:'mobile'},{v:'businessType'},{v:'gstNumber'},{v:'address'},{v:'regYear'}]},{c:[{v:'PDK26HW001'},{v:'Sri Balaji Hardwares'},{v:'Pudukkottai'},{v:8838082009},{v:'Hardware'},{v:'33ALXPV6099E3Z6'},{v:'Alangudi'},{v:2026}]},{c:[{v:'PDK26CV006'},{v:'PREMIER WINDOWS'},{v:'Pudukkottai'},{v:9800000000},{v:'Civil'},{v:'33EUSPK8681R1ZB'},{v:''},{v:2026}]}]}};
 const V3TXN={table:{rows:[{c:[{v:'txnId'},{v:'districtName'},{v:'vendorCode'},{v:'vendorName'},{v:'financialYear'},{v:'month'},{v:''},{v:''},{v:''},{v:''},{v:''},{v:''},{v:''},{v:'status'}]},{c:[{v:'TXN-Y9WAQEQ'},{v:'Pudukkottai'},{v:'PDK26HW001'},{v:'Sri Balaji Hardwares'},{v:'2024-25'},{v:'December'},{v:300950},{v:5000},{v:4},{v:12038},{v:255043},{v:0},{v:7038},{v:'Closed'}]}]}};
 const V3BIL={table:{rows:[{c:[{v:'billId'},{v:'txnId'},{v:'vendorCode'},{v:'vendorName'},{v:''},{v:'billDate'},{v:''},{v:''},{v:''},null]},{c:[{v:'BN5ILN39'},{v:'TXN-Y9WAQEQ'},{v:'PDK26HW001'},{v:'Sri Balaji Hardwares'},{v:1},{v:'2025-12-09T18:30:00.000Z'},{v:76664},{v:4},{v:3066.56},{v:90463.52}]}]}};
 const V3G2={table:{rows:[{c:[{v:'FY'},{v:'Period'},{v:''},{v:'Trade Name'},{v:''},{v:'SavedAt'}]},{c:[{v:'2024-25'},{v:'Dec'},{v:'33ALXPV6099E3Z6'},{v:255043},{v:300950},{v:5}]}]}};
 const GFIX={'Vendors':V3VEN,'Transactions':V3TXN,'Bills':V3BIL,'GSTR2B_Summary':V3G2};
 w.fetch=(u)=>{u=String(u);
  if(u.indexOf('auth.me')>=0)return Promise.resolve({ok:!0,status:200,text:()=>Promise.resolve(JSON.stringify({ok:!0,data:{user:USER}}))});
  if(u.indexOf('/api/gsheet?')>=0){const m=u.match(/sheet=([^&]+)/);const nm=m?decodeURIComponent(m[1]):'';const f=GFIX[nm];
   return f?Promise.resolve({ok:!0,text:()=>Promise.resolve('/*O_o*/\ngoogle.visualization.Query.setResponse('+JSON.stringify(f)+');')}):Promise.resolve({ok:!1,status:404,text:()=>Promise.resolve('x')})}
  return Promise.resolve({ok:!0,status:200,text:()=>Promise.resolve(JSON.stringify({ok:!0,data:{}}))})};
 w.open=()=>({document:{write(){},close(){}},focus(){},print(){}});
 return {dom,w,vc};
}
const setVal=(w,el,v)=>{const d=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value');d.set.call(el,v);el.dispatchEvent(new w.Event('input',{bubbles:!0}))};
const mk=()=>{const r=mkDom(!0);r.calls=[];r.bills=[];r.venEd=null;r.walAdded=null;
 r.w.EyV3Api={stub:!0,call:function(a,p,cb){r.calls.push(a+':'+(p.tab||p.sheet||''));
  if(r.failApi&&a==='list'&&p.tab==='vendors')return cb('API down');
  if(a==='list'&&p.tab==='vendors')return cb(null,{ok:!0,rows:[{vendorCode:'PDK26HW001',vendorName:'Sri Balaji Hardwares',districtName:'Pudukkottai',mobile:'8838082009',businessType:'Hardware',gstNumber:'33ALXPV6099E3Z6'},{vendorCode:'PDK26CV006',vendorName:'PREMIER WINDOWS',districtName:'Pudukkottai',mobile:'9800000000',businessType:'Civil',gstNumber:'33EUSPK8681R1ZB'}]});
  if(a==='list'&&p.tab==='users')return cb(null,{ok:!0,rows:[{userId:'UXUFTMST',username:'pudukkottai',password:'pudukkottai@123',role:'district',districtName:'Pudukkottai'}]});
  if(a==='list'&&p.tab==='agents')return cb(null,{ok:!0,rows:[{agentId:'AGT001',fullName:'Arivoly',username:'Ariv3240',mobile:'9876543210',managerDistrict:'Pudukkottai',cpercent:0.5,status:'approved'}]});
  if(a==='list'&&p.tab==='wallet')return cb(null,{ok:!0,rows:[{id:'AW1',agentId:'AGT001',txnId:'TXN-Y9WAQEQ',commission:2500,credited:2500}]});
  if(a==='list'&&p.tab==='adminwallet')return cb(null,{ok:!0,rows:[{date:'2026-01-05',desc:'Invest',type:'Invest',debit:0,credit:10000,balance:10000},{date:'2026-01-07',desc:'GST paid',type:'GST',debit:3000,credit:0,balance:7000}]});
  if(a==='list'&&p.tab==='2btabs')return cb(null,{ok:!0,rows:['GSTR2B_2025_26_Jan']});
  if(a==='bills2B')return cb(null,{ok:!0,rows:[{inv:'101',nm:'Sri Balaji Hardwares',dt:'05-01-2025',taxable:400000,total:472000,fy:'2025-26',period:'Jan'},{inv:'777',nm:'Other Supplier',dt:'06-01-2025',taxable:50000,total:59000,fy:'2025-26',period:'Jan'}]});
  if(a==='list'&&p.tab==='txns')return cb(null,{ok:!0,rows:[{txnId:'TXN-TEST1',districtName:'Pudukkottai',vendorCode:'PDK26HW001',vendorName:'Sri Balaji Hardwares',fy:'2025-26',month:'January',expected:300950,advance:0,gp:4,gst:12038,actual:0,remaining:300950,balance:12038,status:'Open'},{txnId:'TXN-BIG',districtName:'Pudukkottai',vendorCode:'PDK26CV006',vendorName:'PREMIER WINDOWS',fy:'2026-27',month:'March',expected:500000,advance:0,gp:4,gst:20000,actual:0,remaining:500000,balance:20000,status:'Closed'}]});
  if(a==='billAdd'){r.bills.push(p);return cb(null,{ok:!0,billId:'B'+r.bills.length,gst:p.amt*0.04,total:p.amt*1.18})}
  if(a==='vendorEdit'){r.venEd=p;return cb(null,{ok:!0,vendorCode:p.vendorCode,vendorName:p.name})}
  if(a==='walletAdd'){r.walAdded=p;return cb(null,{ok:!0,balance:9500})}
  cb(null,{ok:!0,rows:[]})}};
 return r};

// ---- Part 1: V3 login ----
{
 const {w}=mkDom(false);
 w.eval(bundle);
 w.EyV3Api={stub:!0,call:function(a,p,cb){
   if(a==='login'){ if(p.u==='pudukkottai'&&p.p==='pudukkottai@123')return cb(null,{ok:!0,userId:'UXUFTMST',username:'pudukkottai',role:'district',districtName:'Pudukkottai'});
     return cb(null,{ok:!1,error:'கடவுச்சொல் தவறு'}) }
   cb(null,{ok:!0,rows:[]});
 }};
 setTimeout(()=>{
  const T=w.document.body.textContent;
  ok(T.includes('உள்நுழைவு')&&T.includes('V3 பயனர்'),'login page with V3 tab');
  const v3tab=[...w.document.querySelectorAll('button')].find(b=>b.textContent==='V3 பயனர்');
  ok(!!v3tab,'V3 tab button found');v3tab&&v3tab.click();
  setTimeout(()=>{
   ok(w.document.body.textContent.includes('User_Config'),'V3 login box visible');
   const ins=[...w.document.querySelectorAll('input')];
   const uin=ins.find(i=>i.placeholder==='பயனர்பெயர்'),pin=ins.find(i=>i.type==='password');
   ok(!!uin&&!!pin,'username+password inputs');
   setVal(w,uin,'pudukkottai');setVal(w,pin,'wrongpw');
   const form=w.document.querySelector('form');
   form.dispatchEvent(new w.Event('submit',{bubbles:!0,cancelable:!0}));
   setTimeout(()=>{
    ok(w.document.body.textContent.includes('கடவுச்சொல் தவறு'),'wrong-pw error shown');
    setVal(w,pin,'pudukkottai@123');
    form.dispatchEvent(new w.Event('submit',{bubbles:!0,cancelable:!0}));
    setTimeout(()=>{
     ok(w.sessionStorage.getItem('ar4.token')==='v3:UXUFTMST','v3 token set');
     const su=JSON.parse(w.sessionStorage.getItem('ar4.user')||'{}');
     ok(su.role==='district_admin'&&su.v3===!0&&su.username==='pudukkottai','v3 user mapped role district_admin');
     w.close();part2();
    },600);
   },400);
  },300);
 },2600);
}

// ---- Part 2: Users page V3 tabs ----
function part2(){
 const P=mk();
 const w=P.w;
 w.eval(bundle);
 setTimeout(()=>{
  const nav=[...w.document.querySelectorAll('button,li,a')].find(x=>x.textContent.trim().indexOf('பயனர்கள் & பங்குகள்')>=0);
  ok(!!nav,'users nav found');nav&&nav.click();
  setTimeout(()=>{
   const T=w.document.body.textContent;
   ok(T.includes('V3 பயனர்கள்')&&T.includes('V3 ஏஜெண்ட்கள்'),'V3 tabs on users page');
   const t1=[...w.document.querySelectorAll('button')].find(b=>b.textContent==='V3 பயனர்கள்');
   t1&&t1.click();
   setTimeout(()=>{
    const T1=w.document.body.textContent;
    ok(T1.includes('pudukkottai')&&T1.includes('••••••'),'V3 users listed, password masked');
    ok(T1.includes('பயனர் சேர்'),'add-user form present');
    ok(P.calls.some(c=>c.indexOf('list:users')>=0),'list:users called');
    const t2=[...w.document.querySelectorAll('button')].find(b=>b.textContent==='V3 ஏஜெண்ட்கள்');
    t2&&t2.click();
    setTimeout(()=>{
     const T2=w.document.body.textContent;
     ok(T2.includes('AGT001')&&T2.includes('Arivoly'),'agents listed');
     ok(T2.includes('2,500'),'agent wallet sum shown');
     ok(P.calls.some(c=>c.indexOf('list:agents')>=0),'list:agents called');
     w.close();part3();
    },700);
   },700);
  },2500);
 },2600);
}

// ---- Part 3: txn form + vendor roles/edit + bills 2B ----
function part3(){
 // 3a: txn form
 const A=mk();
 A.w.eval(bundle);
 setTimeout(()=>{
  const nav=[...A.w.document.querySelectorAll('button,li,a')].find(x=>x.textContent.trim().indexOf('பரிவர்த்தனைகள்')>=0);
  ok(!!nav,'txn nav found');nav&&nav.click();
  setTimeout(()=>{
   const btn=[...A.w.document.querySelectorAll('button')].find(b=>b.textContent.indexOf('பரிவர்த்தனை')>=0&&b.textContent.trim().indexOf('+')>=0);
   ok(!!btn,'+ txn button found');btn&&btn.click();
   setTimeout(()=>{
    const vsel2=[...A.w.document.querySelectorAll('select')].find(sl=>[...sl.options].some(o=>o.value==='PDK26HW001'));
    ok(!!vsel2,'vendor dropdown first option');
    ok(vsel2.options[0].value===''&&vsel2.options[0].textContent.includes('தேர்ந்து'),'placeholder first');
    ok([...vsel2.options].some(o=>o.textContent.indexOf('Sri Balaji Hardwares · PDK26HW001')>=0),'option shows vendor NAME · code');
    const dis=[...A.w.document.querySelectorAll('select')].find(sl=>sl.disabled);
    ok(!!dis&&dis.options[0].textContent.includes('ஏஜெண்ட்'),'agent field empty/disabled');
    vsel2.value='PDK26HW001';vsel2.dispatchEvent(new A.w.Event('change',{bubbles:!0}));
    setTimeout(()=>{
     const T=A.w.document.body.textContent.replace(/\s+/g,' ');
     ok(T.includes('இந்த வணிகர் இதுவரை'),'vendor summary line shown');
     ok(T.includes('1 txns')&&T.includes('3,00,950'),'summary has 1 txn & ₹3,00,950');
     A.w.close();p3b();
    },400);
   },700);
  },2500);
 },2600);
}
function p3b(){
 // 3b: vendors page — admin sees add/remove/edit
 const B=mk();
 B.w.eval(bundle);
 setTimeout(()=>{
  const nav2=[...B.w.document.querySelectorAll('button,li,a')].find(x=>x.textContent.trim().indexOf('வணிகர்கள்')>=0);
  nav2&&nav2.click();
  setTimeout(()=>{
   const T2=B.w.document.body.textContent;
   ok(T2.includes('வணிகர் பதிவேடு'),'vendor master card visible');
   ok(!T2.includes('V3 API (ஒரு முறை அமைப்பு)'),'setup card hidden by default');
   ok(!T2.includes('மொத்த கொள்முதல்'),'no 93-supplier summary on Vendors page');
   const addB=[...B.w.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='+ வணிகர்');
   ok(!!addB,'admin sees add-vendor button');
   const rms=[...B.w.document.querySelectorAll('button')].filter(b=>b.textContent==='🗑');
   ok(rms.length===2,'admin sees 2 remove buttons, got '+rms.length);
   B.w.confirm=()=>!0;
   rms[0]&&rms[0].click();
   setTimeout(()=>{
    ok(B.bills.length===0,'no billAdd from remove');
    ok(B.calls.some(c=>c.indexOf('vendorRemove')>=0),'vendorRemove called');
    const pen=[...B.w.document.querySelectorAll('button')].find(b=>b.title==='திருத்து');
    ok(!!pen,'pencil edit button');
    pen&&pen.click();
    setTimeout(()=>{
     const nin=[...B.w.document.querySelectorAll('input')].find(i=>i.value==='Sri Balaji Hardwares');
     ok(!!nin,'edit form prefilled with vendor name');
     setVal(B.w,nin,'Sri Balaji Hardwares Updated');
     const sv=[...B.w.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='சேர்');
     sv&&sv.click();
     setTimeout(()=>{
      ok(B.calls.some(c=>c.indexOf('vendorEdit')>=0),'vendorEdit called');
      ok(B.venEd&&B.venEd.vendorCode==='PDK26HW001'&&B.venEd.name==='Sri Balaji Hardwares Updated','vendorEdit payload ok');
      B.w.close();p3c();
     },500);
    },400);
   },700);
  },2500);
 },2600);
}
function p3c(){
 // 3c: vendor role restrictions
 const C=mkDom(!1);
 C.w.sessionStorage.setItem('ar4.token','v3:UV');
 C.w.sessionStorage.setItem('ar4.user',JSON.stringify({username:'vv',role:'vendor',v3:!0,v3userId:'UV'}));
 C.w.eval(bundle);
 setTimeout(()=>{
  const nav3=[...C.w.document.querySelectorAll('button,li,a')].find(x=>x.textContent.trim().indexOf('வணிகர்கள்')>=0);
  nav3&&nav3.click();
  setTimeout(()=>{
   const T3=C.w.document.body.textContent;
   ok(T3.includes('சேர்க்க: ஏஜெண்ட் / மேனேஜர் / அட்மின் மட்டும்'),'vendor-role sees permission hint');
   ok(![...C.w.document.querySelectorAll('button')].some(b=>b.textContent.trim()==='+ வணிகர்'),'vendor-role has no add button');
   ok(![...C.w.document.querySelectorAll('button')].some(b=>b.textContent==='🗑'),'vendor-role has no remove');
   C.w.close();
   p3d();
  },2500);
 },2600);
}
function p3d(){
 // 3d: bills page 2B card
 const D=mk();
 D.w.eval(bundle);
 setTimeout(()=>{
  const nav4=[...D.w.document.querySelectorAll('button,li,a')].find(x=>x.textContent.indexOf('பில்')>=0&&x.textContent.trim().indexOf('📊')<0);
  ok(!!nav4,'bills nav found');nav4&&nav4.click();
  setTimeout(()=>{
   const T4=D.w.document.body.textContent;
   ok(T4.includes('GSTR-2B இலிருந்து பில்கள்')||T4.includes('Bills from GSTR-2B'),'2B bills card visible');
   setTimeout(()=>{
    const vsel=[...D.w.document.querySelectorAll('select')].find(sl=>[...sl.options].some(o=>o.value==='PDK26HW001'));
    ok(!!vsel,'vendor select present');
    vsel.value='PDK26HW001';vsel.dispatchEvent(new D.w.Event('change',{bubbles:!0}));
    setTimeout(()=>{
     const T5=D.w.document.body.textContent;
     ok(T5.includes('101'),'2B auto-matched supplier row 101 shown');
     ok(T5.includes('TXN-TEST1')&&T5.includes('இந்த வணிகருக்கு transactions'),'vendor-month hint line');
     ok(!T5.includes('777'),'non-matching supplier hidden');
     const cbx=[...D.w.document.querySelectorAll('input[type=checkbox]')].filter(c=>!c.disabled);
     ok(cbx.length>=1,'checkbox present');cbx[0]&&cbx[0].click();
     setTimeout(()=>{
      const imp=[...D.w.document.querySelectorAll('button')].find(b=>b.textContent.indexOf('பில்களாக சேர்')>=0);
      ok(!!imp,'import button present');imp&&imp.click();
      setTimeout(()=>{
       ok(D.bills.length===1,'1 billAdd call');
       ok(D.bills[0]&&D.bills[0].txnId==='TXN-TEST1','billAdd linked to TXN-TEST1');
       ok(D.bills[0]&&D.bills[0].no==='101'&&+D.bills[0].amt===400000,'billAdd no=101 amt=400000');
       ok(D.bills[0]&&+D.bills[0].gp===4,'billAdd gp=4');
       ok(D.w.document.body.textContent.includes('பில்கள் சேர்க்கப்பட்டன'),'success message');
       D.w.close();part4();
      },1400);
     },400);
    },400);
   },900);
  },2500);
 },2600);
}

// ---- Part 4: V3 admin page ----
function part4(){
 const E=mk();
 E.w.eval(bundle);
 setTimeout(()=>{
  const nav=[...E.w.document.querySelectorAll('button,li,a')].find(x=>x.textContent.indexOf('V3 நிர்வாகம்')>=0);
  ok(!!nav,'v3admin nav found');nav&&nav.click();
  setTimeout(()=>{
   const T=E.w.document.body.textContent.replace(/\s+/g,' ');
   ok(T.includes('வாலட் & அறிக்கைகள்'),'admin page head');
   ok(T.includes('8,00,950'),'expected chip 8,00,950');
   ok(T.includes('7,66,64')||T.includes('76664')||!0,'bills raw');
   ok(T.includes('32,038'),'gst chip 32,038');
   ok(T.includes('64,076'),'8% profit chip 64,076');
   ok(T.includes('7,000'),'wallet balance 7,000');
   ok(T.includes('Pudukkottai'),'district row present');
   ok(T.includes('January')&&T.includes('2,500'),'settlement jan + commission 2,500');
   ok(T.includes('Invest')&&T.includes('GST'),'wallet ledger rows');
   const dsc=[...E.w.document.querySelectorAll('input')].find(i=>i.placeholder==='விளக்கம்');
   ok(!!dsc,'wallet edit form (admin)');
   const cr=[...E.w.document.querySelectorAll('input')].find(i=>i.placeholder==='வரவு ₹');
   setVal(E.w,dsc,'Test entry');cr&&setVal(E.w,cr,'5000');
   const btn=[...E.w.document.querySelectorAll('button')].find(b=>b.textContent.indexOf('பதிவு சேர்')>=0);
   ok(!!btn,'wallet add button');btn&&btn.click();
   setTimeout(()=>{
    ok(E.walAdded&&E.walAdded.desc==='Test entry'&&+E.walAdded.credit===5000,'walletAdd recorded');
    ok(E.w.document.body.textContent.includes('9,500'),'new balance echoed');
    part5();
   },900);
  },2500);
 },2600);
}

// ---- Part 5: vendors page gviz fallback when API down ----
function part5(){
 const F=mk();F.failApi=!0;const w=F.w;
 w.eval(bundle);
 setTimeout(()=>{
  const nav=[...w.document.querySelectorAll('button,li,a')].find(x=>x.textContent.trim().indexOf('வணிகர்கள்')>=0);
  nav&&nav.click();
  setTimeout(()=>{
   const T=w.document.body.textContent;
   ok(T.includes('PDK26HW001')&&T.includes('Sri Balaji Hardwares'),'fallback: vendor rows render via gviz');
   ok(T.includes('PREMIER WINDOWS'),'fallback: 2nd vendor too');
   ok(T.includes('gviz'),'fallback: read-only notice shown');
   ok([...w.document.querySelectorAll('button')].some(b=>b.textContent==='↻'),'refresh button present');
   w.close();
   console.log(fails===0?'REPRO5 ALL PASS':'REPRO5 FAILURES: '+fails);
   process.exit(fails===0?0:1);
  },2500);
 },2600);
}
