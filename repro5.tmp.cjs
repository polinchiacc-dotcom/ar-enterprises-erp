const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const bundle=fs.readFileSync('v4/public/assets/index-CHTAzd11.js','utf8');
let fails=0;const ok=(c,m)=>{console.log((c?'✓':'✗ FAIL')+' '+m);if(!c)fails++};
function mkDom(sess){
 const vc=new VirtualConsole();
 const dom=new JSDOM('<body><div id="root"></div></body>',{url:'https://x.test/',runScripts:'outside-only',pretendToBeVisual:!0,virtualConsole:vc});
 const w=dom.window;
 if(sess){w.sessionStorage.setItem('ar4.token','t');w.sessionStorage.setItem('ar4.user',JSON.stringify({username:'a',role:'super_admin'}))}
 const USER={username:'a',role:'super_admin'};
 w.fetch=(u)=>{u=String(u);
  if(u.indexOf('auth.me')>=0)return Promise.resolve({ok:!0,status:200,text:()=>Promise.resolve(JSON.stringify({ok:!0,data:{user:USER}}))});
  return Promise.resolve({ok:!0,status:200,text:()=>Promise.resolve(JSON.stringify({ok:!0,data:{}}))})};
 w.open=()=>({document:{write(){},close(){}},focus(){},print(){}});
 return {dom,w,vc};
}
const setVal=(w,el,v)=>{const d=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value');d.set.call(el,v);el.dispatchEvent(new w.Event('input',{bubbles:!0}))};

// ---- Part 1: V3 login flow ----
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
 const {w}=mkDom(!0);
 const calls=[];
 w.eval(bundle);
 w.EyV3Api={stub:!0,call:function(a,p,cb){calls.push(a+':'+(p.tab||''));
   if(a==='list'&&p.tab==='users')return cb(null,{ok:!0,rows:[{userId:'UXUFTMST',username:'pudukkottai',password:'pudukkottai@123',role:'district',districtName:'Pudukkottai'},{userId:'UAAA0001',username:'cuddalore1',password:'pw123456',role:'district',districtName:'Cuddalore'}]});
   if(a==='list'&&p.tab==='agents')return cb(null,{ok:!0,rows:[{agentId:'AGT001',fullName:'Arivoly',username:'Ariv3240',mobile:'9876543210',managerDistrict:'Pudukkottai',cpercent:0.5,status:'approved'}]});
   cb(null,{ok:!0,rows:[]});
 }};
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
    ok(T1.includes('cuddalore1')&&T1.includes('பயனர் சேர்'),'add-user form present');
    ok(calls.some(c=>c.indexOf('list:users')>=0),'list:users called');
    const t2=[...w.document.querySelectorAll('button')].find(b=>b.textContent==='V3 ஏஜெண்ட்கள்');
    t2&&t2.click();
    setTimeout(()=>{
     const T2=w.document.body.textContent;
     ok(T2.includes('AGT001')&&T2.includes('Arivoly'),'agents listed');
     ok(T2.includes('0.5%')&&T2.includes('ஏஜெண்ட் சேர்'),'agent % + add form');
     ok(calls.some(c=>c.indexOf('list:agents')>=0),'list:agents called');
     console.log(fails===0?'REPRO5 ALL PASS':'REPRO5 FAILURES: '+fails);
     process.exit(fails===0?0:1);
    },700);
   },700);
  },2500);
 },2600);
}
