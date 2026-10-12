var EyVbId="1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw";
function EyVbInr(x){x=+x||0;try{return Math.round(x).toLocaleString("en-IN")}catch(e){return String(Math.round(x))}}
function EyVbN(x){var s=String(x==null?"":x).replace(/[₹,\s]/g,"");var v=parseFloat(s);return isFinite(v)?v:0}
function EyVbD(v){var s=String(v==null?"":v),m;
 if(m=s.match(/^Date\((\d+),(\d+),(\d+)\)/))return m[1]+"-"+("0"+(+m[2]+1)).slice(-2)+"-"+("0"+(+m[3])).slice(-2);
 if(m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))return m[1]+"-"+("0"+(+m[2])).slice(-2)+"-"+("0"+(+m[3])).slice(-2);
 if(m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))return m[3]+"-"+("0"+(+m[2])).slice(-2)+"-"+("0"+(+m[1])).slice(-2);
 if(/^\d{5}(\.\d+)?$/.test(s)){var d=new Date(Date.UTC(1899,11,30)+Math.round(parseFloat(s))*864e5);return d.getUTCFullYear()+"-"+("0"+(d.getUTCMonth()+1)).slice(-2)+"-"+("0"+d.getUTCDate()).slice(-2)}
 return ""}
function EyVbEsc(x){return String(x==null?"":x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function EyVbIsG(g){return /^[0-9A-Z]{15}$/.test(String(g||"").trim())}
var EyVbSup=null;
function EyVbFetch(k){
 if(EyVbSup&&EyVbSup.done)return k(EyVbSup);
 var got={},fin=false;
 function part(key){return function(e,d){if(fin||got[key+"$"])return;got[key+"$"]=1;got[key]=e?null:EyRawRows(d);
  if(got.b2$&&got.ims$){fin=true;
   if(!got.b2&&!got.ims){EyVbSup={done:true,err:true};return k(EyVbSup)}
   var bills=[],sup={},g,i,b;
   function eat(rows,src,gi){var start=-1,j,r;
    for(j=0;j<rows.length;j++){if(String(rows[j][gi]).indexOf("GSTIN of supplier")>=0){start=j+1;break}}
    if(start<0)start=0;
    for(j=start;j<rows.length;j++){r=rows[j];g=String(r[gi]||"").trim();
     if(!EyVbIsG(g))continue;
     b={src:src,g:g,nm:String(r[gi+1]||"").trim(),inv:String(r[gi+2]||"").trim(),dt:EyVbD(r[gi+3]),vl:EyVbN(r[gi+4]),tx:EyVbN(r[gi+5]),mo:""};
     b.mo=b.dt?b.dt.slice(0,7):"";
     bills.push(b);
     var s2=sup[g]||(sup[g]={g:g,nm:"",n:0,vl:0,tx:0,last:"",b2:0,ims:0});
     if(b.nm&&(!s2.nm||(src==="2B"&&b.nm.length>s2.nm.length)))s2.nm=b.nm;
     s2.n++;s2.vl+=b.vl;s2.tx+=b.tx;if(b.dt>s2.last)s2.last=b.dt;s2[src==="2B"? "b2":"ims"]++}}
   if(got.b2)eat(got.b2,"2B",1);
   if(got.ims)eat(got.ims,"IMS",0);
   EyVbSup={done:true,err:false,bills:bills,sup:sup};k(EyVbSup)}}}
 gvizFetch(EyVbId,"GSTR2B",part("b2"),"select D,E,F,G,I,J,N");
 gvizFetch(EyVbId,"IMS",part("ims"),"select A,B,C,D,E,F");
}
var EyTxCache=null;
function EyTxFetch(k){
 if(EyTxCache&&EyTxCache.done)return k(EyTxCache);
 var T=[],pend=4,fin=false;
 function mk(sigCol,sig,skip,parse){return function(e,d){if(fin)return;
  if(!e){var rows=EyRawRows(d),j,st=-1,r,x;
   for(j=0;j<rows.length;j++){if(String(rows[j][sigCol])===sig){st=j+1+skip;break}}
   if(st<0)st=0;
   for(j=st;j<rows.length;j++){r=rows[j];x=parse(r);if(x)T.push(x)}}
  if(--pend===0){fin=true;EyTxCache={done:true,err:false,rows:T};k(EyTxCache)}}}
 function Cn(fy){return mk(1,"Receipt Amount",0,function(r){var rc=EyVbN(r[1]),iv=EyVbN(r[4]);
  if(!(rc>0))return null;
  return{ty:"in",fy:fy,d:"",de:String(r[0]||"").trim()||"(பெயரிடப்படாத வேலை)",cat:String(r[3]||"").trim()||"வேலை",pl:String(r[2]||"").trim(),amt:rc,inv:iv,src:fy}})}
 gvizFetch(EyVbId,"Contract Work FY 23 to 24",Cn("FY 23-24"),"select C,E,F,G,L");
 gvizFetch(EyVbId,"Contract work FY 24-25",Cn("FY 24-25"),"select C,E,F,G,L");
 gvizFetch(EyVbId,"Contract work FY 25-26",Cn("FY 25-26"),"select C,E,F,G,L");
 gvizFetch(EyVbId,"2024-25 Expense Journal",mk(0,"Item",0,function(r){var a=EyVbN(r[1]);if(!a)return null;
  return{ty:"out",fy:"FY 24-25",d:EyVbD(r[2]),de:String(r[0]||"").trim()||"(செலவு)",cat:String(r[3]||"").trim()||"செலவு",pl:"",amt:a,inv:0,src:"Expense Journal"}}),"select B,C,F,G");
 }
function EyVbPrint(title,sub,head,rows,foots,land){
 var w=window.open("","_blank");if(!w)return;
 function esc(x){return EyVbEsc(x)}
 var rh="";head.forEach(function(h){rh+="<th>"+esc(h)+"</th>"});
 var rb="";rows.forEach(function(r){rb+='<tr>'+r.map(function(c,i){return '<td'+(i>0&&/^[-−+±₹0-9,.\s]+$/.test(String(c))?' class="mono"':'')+'>'+esc(c)+"</td>"}).join("")+"</tr>"});
 var fb="";foots.forEach(function(f){fb+='<tr class="ft"><td colspan="'+(head.length-1)+'">'+esc(f[0])+"</td><td>"+esc(f[1])+"</td></tr>"});
 var h="<html><head><meta charset='utf-8'><title>"+esc(title)+"</title><style>"+
  "@page{size:A4 "+(land?"landscape":"portrait")+";margin:8mm 6mm}"+
  "body{font-family:Calibri,'Segoe UI',Arial,sans-serif;color:#111;margin:0;font-size:11px}"+
  ".ban{background:#0d1b2a;color:#fff;padding:10px 12px}.ban .t1{font-size:16px;font-weight:800;letter-spacing:.5px}.ban .t2{font-size:11px;opacity:.85;margin-top:2px}"+
  "table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#1f3864;color:#fff;padding:5px 6px;text-align:left;font-size:10px;border:1px solid #16294a}td{padding:4px 6px;border:1px solid #d5dce8;font-size:10.5px}tr:nth-child(even) td{background:#f4f7fc}.mono{font-family:Consolas,Menlo,monospace}"+
  "tr.ft td{background:#e8edf5;font-weight:800;border-top:2px solid #1f3864}"+
  ".sig{display:flex;justify-content:space-between;margin-top:38px;padding:0 8px}.sig div{border-top:1px solid #333;padding-top:4px;font-size:10px;min-width:150px;text-align:center}"+
  ".noprint{margin-top:12px}.noprint button{padding:8px 14px;background:#1f3864;color:#fff;border:0;border-radius:6px;font-size:13px;cursor:pointer}"+
  "</style></head><body>"+
  "<div class='ban'><div class='t1'>AR ENTERPRISES</div><div class='t1' style='font-size:13px'>"+esc(title)+"</div><div class='t2'>"+esc(sub)+" · தயாரிக்கப்பட்ட தேதி: "+new Date().toISOString().slice(0,10)+"</div></div>"+
  "<table><thead><tr>"+rh+"</tr></thead><tbody>"+rb+fb+"</tbody></table>"+
  "<div class='sig'><div>தயாரித்தவர்</div><div>சரிபார்த்தவர்</div><div>அங்கீகாரம்</div></div>"+
  "<div class='noprint'><button onclick='window.print()'>🖨️ Print / Save PDF</button></div>"+
  "<script>window.onload=function(){setTimeout(function(){window.print()},300)}</scr"+"ipt></body></html>";
 w.document.write(h);w.document.close()}
function EyVbCsv(name,head,rows,foots){
 function q(x){x=String(x==null?"":x);return /[",\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x}
 var L=[head.map(q).join(",")].concat(rows.map(function(r){return r.map(q).join(",")}));
 (foots||[]).forEach(function(f){L.push(f.map(q).join(","))});
 var b=new Blob(["﻿"+L.join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
 a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();
 setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(a.href)},800)}
function EyVbHead(t,sub,en,ta){return n.jsxs("div",{style:{margin:"2px 0 14px"},children:[
 n.jsx("h2",{style:{margin:0,fontSize:22},children:t}),
 n.jsx("div",{style:{color:"var(--tx-3)",fontSize:13,marginTop:2},children:en})]})}
function EyVbLoad(f,en,ta){return n.jsx("div",{className:"ui-empty",style:{padding:34,textAlign:"center"},children:f==="l"?(en||"தரவு ஏற்றப்படுகிறது…"):"⚠ "+(ta||"தரவு ஏற்ற முடியவில்லை — மீண்டும் முயற்சிக்கவும்")})}
function EyVbChips(items){return n.jsx("div",{className:"ui-stats",children:items.map(function(c,i){
 return n.jsxs("div",{className:"ui-card",style:{padding:"10px 14px"},children:[
  n.jsx("div",{style:{fontSize:11,color:"var(--tx-3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"},children:c[0]}),
  n.jsx("div",{style:{fontSize:20,fontWeight:800,marginTop:3,color:c[2]||"var(--tx-1)"},children:c[1]})]},i)})})}
function EyVendPage({user:c}){
 const{t:u,lang:f}=xe(),r=Ue();
 var[rd,Srd]=E.useState(0),[q,Sq]=E.useState(""),[srt,Ssrt]=E.useState("vl");
 var L=function(a,b){return f==="ta"?b:a};
 E.useEffect(function(){EyVbFetch(function(){Srd(function(x){return x+1})})},[]);
 if(!EyVbSup||!EyVbSup.done)return EyVbLoad("l",L("Vendor data loading…","வணிகர் தரவு ஏற்றப்படுகிறது…"));
 if(EyVbSup.err)return n.jsx(EyVbLoad,{f:"e"});
 var all=Object.keys(EyVbSup.sup).map(function(g){return EyVbSup.sup[g]});
 var qq=q.trim().toLowerCase();
 var list=all.filter(function(s){return !qq||s.nm.toLowerCase().indexOf(qq)>=0||s.g.toLowerCase().indexOf(qq)>=0});
 list.sort(function(a,b){return srt==="n"?b.n-a.n:srt==="nm"?a.nm.localeCompare(b.nm):b.vl-a.vl});
 var tN=all.reduce(function(a,s){return a+s.n},0),tV=all.reduce(function(a,s){return a+s.vl},0);
 var fN=list.reduce(function(a,s){return a+s.n},0),fV=list.reduce(function(a,s){return a+s.vl},0);
 function pr(){EyVbPrint(L("Vendors — Purchase Summary","வணிகர்கள் — கொள்முதல் சுருக்கம்"),L("From GSTR-2B + IMS","GSTR-2B + IMS இலிருந்து"),
  ["#","Name","GSTIN","Bills","Total ₹","Taxable ₹","Last bill"],
  list.map(function(s,i){return [i+1,s.nm||"—",s.g,s.n,"₹"+EyVbInr(s.vl),"₹"+EyVbInr(s.tx),s.last||"—"]}),
  [[L("Filtered total","வடிகட்டிய மொத்தம்")+" ("+list.length+" "+L("vendors","வணிகர்கள்")+")","₹"+EyVbInr(fV)+" · "+fN+" "+L("bills","பில்கள்")],
   [L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")+" ("+all.length+")","₹"+EyVbInr(tV)+" · "+tN+" "+L("bills","பில்கள்")]],false)}
 function csv(){EyVbCsv("vendors.csv",["#","Name","GSTIN","Bills","Total","Taxable","Last bill"],
  list.map(function(s,i){return [i+1,s.nm,s.g,s.n,s.vl,s.tx,s.last]}),
  [["Filtered total",list.length,"","",fV,fN],["Grand total",all.length,"","",tV,tN]])}
 return n.jsxs("div",{children:[
  EyVbHead(L("Vendors","வணிகர்கள்"),null,L("Suppliers from GSTR-2B + IMS — click a vendor for their bills","GSTR-2B + IMS சப்ளையர்கள் — பில்களுக்கு வணிகரை click பண்ணுங்க")),
  EyVbChips([[L("Vendors","வணிகர்கள்"),String(all.length)],["பில்கள்",String(tN)],["₹ "+L("Total purchases","மொத்த கொள்முதல்"),"₹"+EyVbInr(tV)]]),
  n.jsxs("div",{className:"ui-card",style:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"},children:[
   n.jsx("input",{className:"ui-input",style:{maxWidth:280},placeholder:L("Search name / GSTIN…","பெயர் / GSTIN தேடு…"),value:q,onChange:function(e){Sq(e.target.value)}}),
   n.jsxs("select",{className:"ui-input",style:{maxWidth:200},value:srt,onChange:function(e){Ssrt(e.target.value)},children:[
    n.jsx("option",{value:"vl",children:L("Sort: Value ↓","வரிசை: தொகை ↓")}),
    n.jsx("option",{value:"n",children:L("Sort: Bills ↓","வரிசை: பில்கள் ↓")}),
    n.jsx("option",{value:"nm",children:L("Sort: Name","வரிசை: பெயர்")})]}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:csv,children:"📊 CSV"}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  n.jsx(EyTblX,{head:["#",L("Name","பெயர்"),"GSTIN",L("Bills","பில்கள்"),L("Total ₹","மொத்தம் ₹"),L("Taxable ₹","வரி மதிப்பு ₹"),L("Last bill","கடைசி பில்"),"ⓘ"],children:
   list.map(function(s,i){return n.jsxs("tr",{style:{cursor:"pointer"},onClick:function(){r("/vendors/"+encodeURIComponent(s.g))},children:[
    n.jsx("td",{children:i+1}),
    n.jsx("td",{style:{fontWeight:700},children:s.nm||"—"}),
    n.jsx("td",{className:"mono",children:s.g}),
    n.jsx("td",{className:"mono",children:s.n}),
    n.jsx("td",{className:"mono",style:{fontWeight:700},children:"₹"+EyVbInr(s.vl)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(s.tx)}),
    n.jsx("td",{className:"mono",children:s.last||"—"}),
    n.jsx("td",{children:(s.b2?"2B":"")+(s.b2&&s.ims?" + ":"")+(s.ims?"IMS":"")})]},s.g)})}),
  n.jsxs("table",{className:"gtbl",style:{marginTop:8},children:[n.jsx("tbody",{children:[n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Filtered total","வடிகட்டிய மொத்தம்")}),n.jsx("td",{children:list.length+" "+L("vendors","வணிகர்கள்")}),n.jsx("td",{children:fN+" "+L("bills","பில்கள்")}),n.jsx("td",{style:{fontWeight:800},children:"₹"+EyVbInr(fV)})]},"ft1"),n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")}),n.jsx("td",{children:all.length+" "+L("vendors","வணிகர்கள்")}),n.jsx("td",{children:tN+" "+L("bills","பில்கள்")}),n.jsx("td",{style:{fontWeight:800},children:"₹"+EyVbInr(tV)})]},"ft2")]})]})]})
}
function EyVendDetail({user:c,gin:g0}){
 const{t:u,lang:f}=xe(),r=Ue();
 var[rd,Srd]=E.useState(0);
 var L=function(a,b){return f==="ta"?b:a};
 E.useEffect(function(){EyVbFetch(function(){Srd(function(x){return x+1})})},[]);
 if(!EyVbSup||!EyVbSup.done)return EyVbLoad("l");
 if(EyVbSup.err)return n.jsx(EyVbLoad,{f:"e"});
 var s=EyVbSup.sup[g0];
 var bills=EyVbSup.bills.filter(function(b){return b.g===g0}).sort(function(a,b){return (b.dt||"").localeCompare(a.dt||"")});
 var fV=bills.reduce(function(a,b){return a+b.vl},0),fT=bills.reduce(function(a,b){return a+b.tx},0);
 if(!s)return n.jsxs("div",{children:[n.jsx("div",{className:"ui-empty",children:L("Vendor not found","வணிகர் கிடைக்கவில்லை")}),n.jsx("button",{className:"ui-btn ui-btn-sm",style:{marginTop:10},onClick:function(){r("/vendors")},children:"← "+L("Back","பின்செல்")})]});
 function pr(){EyVbPrint((s.nm||s.g)+" — "+L("bills","பில்கள்"),"GSTIN "+s.g,
  ["Source","Month","Invoice","Date","Value ₹","Taxable ₹"],
  bills.map(function(b){return [b.src,b.mo||"—",b.inv||"—",b.dt||"—","₹"+EyVbInr(b.vl),"₹"+EyVbInr(b.tx)]}),
  [[L("Total","மொத்தம்")+" ("+bills.length+" "+L("bills","பில்கள்")+")","₹"+EyVbInr(fV)]],true)}
 return n.jsxs("div",{children:[
  n.jsxs("div",{style:{display:"flex",gap:10,alignItems:"center",marginBottom:12},children:[
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:function(){r("/vendors")},children:"← "+L("Vendors","வணிகர்கள்")}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  EyVbChips([[L("Vendor","வணிகர்"),s.nm||"—"],["GSTIN",s.g],["பில்கள்",String(s.n)],["₹ "+L("Total","மொத்தம்"),"₹"+EyVbInr(s.vl)]]),
  n.jsx(EyTblX,{head:["ⓘ",L("Month","மாதம்"),L("Invoice","Invoice"),L("Date","தேதி"),L("Value ₹","மதிப்பு ₹"),L("Taxable ₹","வரி மதிப்பு ₹")],children:
   bills.map(function(b,i){return n.jsxs("tr",{children:[
    n.jsx("td",{children:b.src}),
    n.jsx("td",{className:"mono",children:b.mo||"—"}),
    n.jsx("td",{className:"mono",children:b.inv||"—"}),
    n.jsx("td",{className:"mono",children:b.dt||"—"}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.vl)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.tx)})]},i)})}),
  n.jsx("table",{className:"gtbl",style:{marginTop:8},children:n.jsx("tbody",{children:n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Total","மொத்தம்")}),n.jsx("td",{children:bills.length+" "+L("bills","பில்கள்")}),n.jsx("td",{children:"₹"+EyVbInr(fV)}),n.jsx("td",{children:"₹"+EyVbInr(fT)})]})})})]})
}
function EyBillsPage({user:c,gin:g0}){
 const{t:u,lang:f}=xe(),r=Ue();
 var[rd,Srd]=E.useState(0),[gs,Sgs]=E.useState(g0||""),[mo,Smo]=E.useState(""),[q,Sq]=E.useState(""),[pg,Spg]=E.useState(0);
 var L=function(a,b){return f==="ta"?b:a};
 E.useEffect(function(){EyVbFetch(function(){Srd(function(x){return x+1})})},[]);
 E.useEffect(function(){Sgs(g0||"")},[g0]);
 if(!EyVbSup||!EyVbSup.done)return EyVbLoad("l",L("Bill data loading…","பில் தரவு ஏற்றப்படுகிறது…"));
 if(EyVbSup.err)return n.jsx(EyVbLoad,{f:"e"});
 var all=EyVbSup.bills;
 var months={};all.forEach(function(b){if(b.mo)months[b.mo]=1});
 var moL=Object.keys(months).sort().reverse();
 var sups=Object.keys(EyVbSup.sup).map(function(g){return EyVbSup.sup[g]}).sort(function(a,b){return (a.nm||"").localeCompare(b.nm||"")});
 var qq=q.trim().toLowerCase();
 var list=all.filter(function(b){return (!gs||b.g===gs)&&(!mo||b.mo===mo)&&(!qq||b.nm.toLowerCase().indexOf(qq)>=0||String(b.inv).toLowerCase().indexOf(qq)>=0)});
 list.sort(function(a,b){return (b.dt||"").localeCompare(a.dt||"")});
 var PS=150,pgs=Math.max(1,Math.ceil(list.length/PS));if(pg>=pgs)Spg(0);
 var view=list.slice(pg*PS,(pg+1)*PS);
 var fV=list.reduce(function(a,b){return a+b.vl},0),fT=list.reduce(function(a,b){return a+b.tx},0);
 var tV=all.reduce(function(a,b){return a+b.vl},0),tT=all.reduce(function(a,b){return a+b.tx},0);
 function pr(){EyVbPrint(L("Purchase Bill Register","கொள்முதல் பில் பதிவேடு"),gs?(EyVbSup.sup[gs]?(EyVbSup.sup[gs].nm||"")+" · ":"")+gs:(mo?"Month "+mo:L("All months","எல்லா மாதம்")),
  ["Source","Supplier","GSTIN","Invoice","Date","Value ₹","Taxable ₹"],
  list.map(function(b){return [b.src,b.nm||"—",b.g,b.inv||"—",b.dt||"—","₹"+EyVbInr(b.vl),"₹"+EyVbInr(b.tx)]}),
  [[L("Filtered total","வடிகட்டிய மொத்தம்")+" ("+list.length+" "+L("bills","பில்கள்")+")","₹"+EyVbInr(fV)],
   [L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")+" ("+all.length+")","₹"+EyVbInr(tV)]],true)}
 function csv(){EyVbCsv("bills.csv",["Source","Supplier","GSTIN","Invoice","Date","Value","Taxable"],
  list.map(function(b){return [b.src,b.nm,b.g,b.inv,b.dt,b.vl,b.tx]}),
  [["Filtered total",list.length,"","","",fV,fT],["Grand total",all.length,"","","",tV,tT]])}
 return n.jsxs("div",{children:[
  EyVbHead(L("Bills","பில்கள்"),null,L("Purchase bills — GSTR-2B + IMS","கொள்முதல் பில்கள் — GSTR-2B + IMS")),
  EyVbChips([["பில்கள்",String(all.length)],["₹ "+L("Billed (all)","பில் மொத்தம் (எல்லாம்)"),"₹"+EyVbInr(tV)],["₹ "+L("Filtered","வடிகட்டிய"),"₹"+EyVbInr(fV)]]),
  n.jsxs("div",{className:"ui-card",style:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"},children:[
   n.jsxs("select",{className:"ui-input",style:{maxWidth:260},value:gs,onChange:function(e){Sgs(e.target.value);Spg(0)},children:[
    n.jsx("option",{value:"",children:L("All suppliers","எல்லா சப்ளையர்")}),
    sups.map(function(s){return n.jsx("option",{value:s.g,children:(s.nm||s.g)},s.g)})]}),
   n.jsxs("select",{className:"ui-input",style:{maxWidth:150},value:mo,onChange:function(e){Smo(e.target.value);Spg(0)},children:[
    n.jsx("option",{value:"",children:L("All months","எல்லா மாதம்")}),
    moL.map(function(m){return n.jsx("option",{value:m,children:m},m)})]}),
   n.jsx("input",{className:"ui-input",style:{maxWidth:200},placeholder:L("Search…","தேடு…"),value:q,onChange:function(e){Sq(e.target.value);Spg(0)}}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:csv,children:"📊 CSV"}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  n.jsx(EyTblX,{head:["ⓘ",L("Supplier","சப்ளையர்"),"GSTIN",L("Invoice","Invoice"),L("Date","தேதி"),L("Value ₹","மதிப்பு ₹"),L("Taxable ₹","வரி மதிப்பு ₹")],children:
   view.map(function(b,i){return n.jsxs("tr",{style:{cursor:"pointer"},onClick:function(){r("/vendors/"+encodeURIComponent(b.g))},children:[
    n.jsx("td",{children:b.src}),
    n.jsx("td",{style:{fontWeight:600},children:b.nm||"—"}),
    n.jsx("td",{className:"mono",children:b.g}),
    n.jsx("td",{className:"mono",children:b.inv||"—"}),
    n.jsx("td",{className:"mono",children:b.dt||"—"}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.vl)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.tx)})]},pg+"-"+i)})}),
  n.jsxs("div",{style:{display:"flex",gap:10,alignItems:"center",marginTop:10},children:[
   n.jsx("button",{className:"ui-btn ui-btn-sm",disabled:pg===0,onClick:function(){Spg(pg-1)},children:"←"}),
   n.jsx("span",{style:{fontSize:13,color:"var(--tx-3)"},children:(pg*PS+1)+"–"+Math.min((pg+1)*PS,list.length)+" / "+list.length}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",disabled:pg+1>=pgs,onClick:function(){Spg(pg+1)},children:"→"})]}),
  n.jsxs("table",{className:"gtbl",style:{marginTop:8},children:[n.jsx("tbody",{children:[n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Filtered total","வடிகட்டிய மொத்தம்")}),n.jsx("td",{children:list.length+" "+L("bills","பில்கள்")}),n.jsx("td",{style:{fontWeight:800},children:"₹"+EyVbInr(fV)}),n.jsx("td",{children:"₹"+EyVbInr(fT)})]},"f1"),n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")}),n.jsx("td",{children:all.length+" "+L("bills","பில்கள்")}),n.jsx("td",{style:{fontWeight:800},children:"₹"+EyVbInr(tV)}),n.jsx("td",{children:"₹"+EyVbInr(tT)})]},"f2")]})]})]})
}
function EyTxnPage({user:c}){
 const{t:u,lang:f}=xe();
 var[rd,Srd]=E.useState(0),[ty,Sty]=E.useState("all"),[fy,Sfy]=E.useState(""),[q,Sq]=E.useState("");
 var L=function(a,b){return f==="ta"?b:a};
 E.useEffect(function(){EyTxFetch(function(){Srd(function(x){return x+1})})},[]);
 if(!EyTxCache||!EyTxCache.done)return EyVbLoad("l",L("Transactions loading…","பரிவர்த்தனைகள் ஏற்றப்படுகிறது…"));
 if(EyTxCache.err)return n.jsx(EyVbLoad,{f:"e"});
 var all=EyTxCache.rows;
 var fys={};all.forEach(function(x){if(x.fy)fys[x.fy]=1});
 var fyL=Object.keys(fys).sort().reverse();
 var qq=q.trim().toLowerCase();
 var list=all.filter(function(x){return (ty==="all"||x.ty===ty)&&(!fy||x.fy===fy)&&(!qq||x.de.toLowerCase().indexOf(qq)>=0||x.cat.toLowerCase().indexOf(qq)>=0)});
 list.sort(function(a,b){var da=a.d||"0000",db=b.d||"0000";return db.localeCompare(da)});
 var fi=list.filter(function(x){return x.ty==="in"}),fo=list.filter(function(x){return x.ty==="out"});
 var fI=fi.reduce(function(a,x){return a+x.amt},0),fO=fo.reduce(function(a,x){return a+x.amt},0);
 var aI=all.filter(function(x){return x.ty==="in"}),aO=all.filter(function(x){return x.ty==="out"});
 var gI=aI.reduce(function(a,x){return a+x.amt},0),gO=aO.reduce(function(a,x){return a+x.amt},0);
 function pr(){EyVbPrint(L("Transactions — Receipts & Payments","பரிவர்த்தனைகள் — வரவு & செலவு"),fy||L("All periods","எல்லா காலம்"),
  ["Date/Period","Type","Description","Category","Receipt ₹","Payment ₹","Source"],
  list.map(function(x){var rr=[x.d||x.fy||"—",x.ty==="in"?L("IN","வரவு"):L("OUT","செலவு"),x.de,x.cat||"—",x.ty==="in"?"₹"+EyVbInr(x.amt):"",x.ty==="out"?"₹"+EyVbInr(x.amt):""];rr.push(x.src);return rr}),
  [[L("Filtered total — receipts","வடிகட்டிய மொத்தம் — வரவு"),"₹"+EyVbInr(fI)],[L("Filtered total — payments","வடிகட்டிய மொத்தம் — செலவு"),"₹"+EyVbInr(fO)],
   [L("Grand (unfiltered) — receipts","மொத்த கூட்டுத்தொகை (வடிகட்டாத) — வரவு"),"₹"+EyVbInr(gI)],[L("Grand (unfiltered) — payments","மொத்த கூட்டுத்தொகை (வடிகட்டாத) — செலவு"),"₹"+EyVbInr(gO)]],true)}
 function csv(){EyVbCsv("transactions.csv",["Date","Period","Type","Description","Category","Amount","Source"],
  list.map(function(x){return [x.d,"",x.ty==="in"?"IN":"OUT",x.de,x.cat,x.amt,x.src]}),
  [["Receipts (filtered)","","","","",fI],["Payments (filtered)","","","","",fO],["Grand Receipts","","","","",gI],["Grand Payments","","","","",gO]])}
 return n.jsxs("div",{children:[
  EyVbHead(L("Transactions","பரிவர்த்தனைகள்"),null,L("Work receipts + office expenses","வேலை ரசீதுகள் + அலுவலக செலவுகள்")),
  n.jsx("div",{style:{fontSize:12,color:"var(--tx-3)",marginTop:-8,marginBottom:12},children:L("GST tax payments & TNEB (bank-linked) are in GST Centre / Bank pages","GST வரி செலுத்தல் & TNEB (வங்கி சம்பந்தப்பட்ட) பதிவுகள் GST Centre / Bank பக்கங்களில் உண்டு")}),
  EyVbChips([["₹ "+L("Receipts (all)","வரவு (எல்லாம்)"),"₹"+EyVbInr(gI),"#0a7d43"],["₹ "+L("Payments (all)","செலவு (எல்லாம்)"),"₹"+EyVbInr(gO),"#b3261e"],["₹ "+L("Net (all)","நிகர (எல்லாம்)"),"₹"+EyVbInr(gI-gO)]]),
  n.jsxs("div",{className:"ui-card",style:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"},children:[
   n.jsxs("select",{className:"ui-input",style:{maxWidth:170},value:ty,onChange:function(e){Sty(e.target.value)},children:[
    n.jsx("option",{value:"all",children:L("All types","எல்லா வகை")}),
    n.jsx("option",{value:"in",children:L("Receipts (IN)","வரவு")}),
    n.jsx("option",{value:"out",children:L("Payments (OUT)","செலவு")})]}),
   n.jsxs("select",{className:"ui-input",style:{maxWidth:170},value:fy,onChange:function(e){Sfy(e.target.value)},children:[
    n.jsx("option",{value:"",children:L("All periods","எல்லா காலம்")}),
    fyL.map(function(x){return n.jsx("option",{value:x,children:x},x)})]}),
   n.jsx("input",{className:"ui-input",style:{maxWidth:220},placeholder:L("Search…","தேடு…"),value:q,onChange:function(e){Sq(e.target.value)}}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:csv,children:"📊 CSV"}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  n.jsx(EyTblX,{head:[L("Date/Period","தேதி/காலம்"),"⇅",L("Description","விவரம்"),L("Category","பிரிவு"),L("Receipt ₹","வரவு ₹"),L("Payment ₹","செலவு ₹"),"ⓘ"],children:
   list.map(function(x,i){return n.jsxs("tr",{children:[
    n.jsx("td",{className:"mono",children:x.d||x.fy||"—"}),
    n.jsx("td",{children:x.ty==="in"?n.jsx("span",{style:{color:"#0a7d43",fontWeight:800},children:L("IN","வரவு")}):n.jsx("span",{style:{color:"#b3261e",fontWeight:800},children:L("OUT","செலவு")})}),
    n.jsx("td",{style:{fontWeight:600},children:x.de}),
    n.jsx("td",{children:x.cat||"—"}),
    n.jsx("td",{className:"mono",style:{color:x.ty==="in"?"#0a7d43":undefined,fontWeight:x.ty==="in"?800:undefined},children:x.ty==="in"?"₹"+EyVbInr(x.amt):""}),
    n.jsx("td",{className:"mono",style:{color:x.ty==="out"?"#b3261e":undefined,fontWeight:x.ty==="out"?800:undefined},children:x.ty==="out"?"₹"+EyVbInr(x.amt):""}),
    n.jsx("td",{style:{fontSize:11,color:"var(--tx-3)"},children:x.src})]},i)})}),
  n.jsxs("table",{className:"gtbl",style:{marginTop:8},children:[n.jsx("tbody",{children:[n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Filtered totals","வடிகட்டிய மொத்தம்")}),n.jsx("td",{children:list.length}),n.jsx("td",{style:{color:"#0a7d43",fontWeight:800},children:"₹"+EyVbInr(fI)}),n.jsx("td",{style:{color:"#b3261e",fontWeight:800},children:"₹"+EyVbInr(fO)}),n.jsx("td",{children:"₹"+EyVbInr(fI-fO)})]},"f1"),n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Grand totals (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")}),n.jsx("td",{children:all.length}),n.jsx("td",{style:{color:"#0a7d43",fontWeight:800},children:"₹"+EyVbInr(gI)}),n.jsx("td",{style:{color:"#b3261e",fontWeight:800},children:"₹"+EyVbInr(gO)}),n.jsx("td",{children:"₹"+EyVbInr(gI-gO)})]},"f2")]})]})]})
}
