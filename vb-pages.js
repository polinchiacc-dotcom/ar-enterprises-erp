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
var EyV3WB="1zzbV4F_Iju2szqT0SGLgKAipXChAp8L-iHc63I4jLeQ";
var EyV3Mo={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function EyV3M3(s){return String(s||"").trim().toLowerCase().slice(0,3)}
function EyV3YM(fy,mo){var m=EyV3Mo[EyV3M3(mo)]||0,y=+String(fy).slice(0,4);if(!m||!y)return"";return (m>=4?y:y+1)+"-"+("0"+m).slice(-2)}
var EyV3=null;
function EyV3Fetch(k){
 if(EyV3&&EyV3.done)return k(EyV3);
 var got={},fin=false;
 function part(key){return function(e,d){if(fin||got[key+"$"])return;got[key+"$"]=1;got[key]=e?null:EyRawRows(d);
  if(got.ven$&&got.txn$&&got.bil$&&got.g2$){fin=true;
   var o={done:true,err:!got.ven&&!got.txn,ven:{},txn:[],bil:[],g2:{}},i,r;
   (got.ven||[]).forEach(function(r){var c=String(r[0]||"").trim();if(!c||c==="vendorCode")return;
    o.ven[c]={code:c,nm:String(r[1]||"").trim(),dist:String(r[2]||"").trim(),mob:String(r[3]||"").trim(),ty:String(r[4]||"").trim(),gstin:String(r[5]||"").trim(),addr:String(r[6]||"").trim(),reg:String(r[7]||"").trim()}});
   (got.txn||[]).forEach(function(r){var id=String(r[0]||"").trim();if(!id||id==="txnId")return;
    o.txn.push({id:id,dist:String(r[1]||"").trim(),vc:String(r[2]||"").trim(),nm:String(r[3]||"").trim(),fy:String(r[4]||"").trim(),mo:String(r[5]||"").trim(),exp:EyVbN(r[6]),adv:EyVbN(r[7]),gp:EyVbN(r[8]),ga:EyVbN(r[9]),act:EyVbN(r[10]),rem:EyVbN(r[11]),bal:EyVbN(r[12]),st:String(r[13]||"").trim()})});
   (got.bil||[]).forEach(function(r){var id=String(r[1]||"").trim();if(!id||id==="txnId")return;
    o.bil.push({id:String(r[0]||"").trim(),txn:id,vc:String(r[2]||"").trim(),nm:String(r[3]||"").trim(),no:String(r[4]||"").trim(),dt:EyVbD(r[5]),amt:EyVbN(r[6]),gp:EyVbN(r[7]),ga:EyVbN(r[8]),tot:EyVbN(r[9])})});
   (got.g2||[]).forEach(function(r){if(String(r[0]||"").trim()==="FY")return;
    var fy=String(r[0]||"").trim(),m3=EyV3M3(r[1]),g=String(r[2]||"").trim();
    if(!fy||!m3||!EyVbIsG(g))return;
    o.g2[fy+"|"+m3+"|"+g]={tax:EyVbN(r[3]),tot:EyVbN(r[4]),n:EyVbN(r[5])}});
   EyV3=o;k(EyV3)}}}
 gvizFetch(EyV3WB,"Vendors",part("ven"));
 gvizFetch(EyV3WB,"Transactions",part("txn"));
 gvizFetch(EyV3WB,"Bills",part("bil"));
 gvizFetch(EyV3WB,"GSTR2B_Summary",part("g2"),"select A,B,D,E,H,I");
}
function EyV3Groups(){
 var grp={},i,b;for(i=0;i<EyV3.bil.length;i++){b=EyV3.bil[i];var g=grp[b.txn]||(grp[b.txn]={id:b.txn,n:0,amt:0,tot:0,vc:b.vc,nm:b.nm});g.n++;g.amt+=b.amt;g.tot+=b.tot;if(b.nm&&!/^\s*$/.test(b.nm))g.nm=b.nm}
 return grp}
function EyTxnPage(o){
 var txnId=o&&o.txnId;
 const{t:u,lang:f}=xe(),r=Ue();
 var[rd,Srd]=E.useState(0),[fy,Sfy]=E.useState(""),[q,Sq]=E.useState("");
 var L=function(a,b){return f==="ta"?b:a};
 E.useEffect(function(){EyV3Fetch(function(){Srd(function(x){return x+1})})},[]);
 if(!EyV3||!EyV3.done)return EyVbLoad("l",L("Transactions loading…","பரிவர்த்தனைகள் ஏற்றப்படுகிறது…"));
 if(EyV3.err)return n.jsx(EyVbLoad,{f:"e"});
 if(txnId)return EyTxnDetail({txnId:txnId,L:L,nav:r});
 var grp=EyV3Groups(),i,x,g;
 var MoN={1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec"};
 var items=EyV3.txn.map(function(x){return{h:x,g:grp[x.id]||{n:0,amt:0,tot:0}}});
 var orph=Object.keys(grp).filter(function(id){return !items.some(function(it){return it.h.id===id})}).map(function(id){return{h:null,g:grp[id]}});
 orph.sort(function(a,b){return a.g.id.localeCompare(b.g.id)});
 function gstinOf(it){var v=it.h?(EyV3.ven[it.h.vc]||null):null;return v?v.gstin:""}
 function g2Of(it){if(!it.h)return null;var v=EyV3.ven[it.h.vc];if(!v||!v.gstin)return null;
  return EyV3.g2[it.h.fy+"|"+EyV3M3(it.h.mo)+"|"+v.gstin]||null}
 var all=items.concat(orph);
 var fys={};items.forEach(function(it){fys[it.h.fy]=1});
 var fyL=Object.keys(fys).sort();
 var qq=q.trim().toLowerCase();
 var list=all.filter(function(it){
  if(it.h&&fy&&it.h.fy!==fy)return false;
  if(!qq)return true;
  var nm=(it.h?it.h.nm:it.g.nm)||"";
  return nm.toLowerCase().indexOf(qq)>=0||it.g.id.toLowerCase().indexOf(qq)>=0||(it.h&&it.h.mo.toLowerCase().indexOf(qq)>=0)});
 var fExp=0,fAct=0,fAdv=0,fBil=0,fG2=0;
 list.forEach(function(it){if(it.h){fExp+=it.h.exp;fAct+=it.h.act;fAdv+=it.h.adv}fBil+=it.g.tot;var q2=g2Of(it);if(q2)fG2+=q2.tot});
 var gExp=0,gAct=0,gAdv=0,gBil=0,gG2=0;
 all.forEach(function(it){if(it.h){gExp+=it.h.exp;gAct+=it.h.act;gAdv+=it.h.adv}gBil+=it.g.tot;var q2=g2Of(it);if(q2)gG2+=q2.tot});
 function pr(){
  var rows=[];
  list.forEach(function(it){var h=it.h,gst=gstinOf(it),q2=g2Of(it);
   rows.push([it.h?it.h.fy:"—",it.h?it.h.mo:"—",it.g.id,(it.h?it.h.nm:it.g.nm)||"—",gst||"—",
    h?("₹"+EyVbInr(h.exp)):"—",h?("₹"+EyVbInr(h.adv)):"—",h?(h.gp+"%"):"—",h?("₹"+EyVbInr(h.act)):"—",
    "₹"+EyVbInr(it.g.tot)+" ("+it.g.n+")",q2?("₹"+EyVbInr(q2.tot)+" ("+q2.n+")"):"—",h?h.st:"—"])});
  EyVbPrint(L("Vendor Monthly Transactions","வணிகர் மாத பரிவர்த்தனைகள்"),fy||L("All FY","எல்லா FY"),
   ["FY","Month","Txn ID","Vendor","GSTIN","Expected ₹","Advance ₹","GST%","Actual ₹","Bills Σ","2B Σ","Status"],
   rows,
   [[L("Filtered total","வடிகட்டிய மொத்தம்")+" ("+list.length+")","Expected ₹"+EyVbInr(fExp),"Advance ₹"+EyVbInr(fAdv),"Actual ₹"+EyVbInr(fAct),"Bills ₹"+EyVbInr(fBil),"2B ₹"+EyVbInr(fG2)],
    [L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")+" ("+all.length+")","Expected ₹"+EyVbInr(gExp),"Advance ₹"+EyVbInr(gAdv),"Actual ₹"+EyVbInr(gAct),"Bills ₹"+EyVbInr(gBil),"2B ₹"+EyVbInr(gG2)]],true)}
 function csv(){
  var rows=list.map(function(it){var h=it.h,gst=gstinOf(it),q2=g2Of(it);
   return [it.h?it.h.fy:"",it.h?it.h.mo:"",it.g.id,(it.h?it.h.nm:it.g.nm)||"",gst||"",
    h?h.exp:"",h?h.adv:"",h?h.gp:"",h?h.act:"",it.g.n,it.g.amt.toFixed(2),it.g.tot.toFixed(2),q2?q2.n:0,q2?q2.tot.toFixed(2):"",h?h.st:""]});
  EyVbCsv("transactions.csv",["FY","Month","TxnID","Vendor","GSTIN","Expected","Advance","GST%","Actual","Bills","BillsAmt","BillsTotal","2BCount","2BTotal","Status"],rows,
   [["Filtered",list.length,"","","",fExp,fAdv,"",fAct,"","","","","",fG2],["Grand",all.length,"","","",gExp,gAdv,"",gAct,"","","","","",gG2]])}
 return n.jsxs("div",{children:[
  EyVbHead(L("Transactions — Vendor Monthly","பரிவர்த்தனைகள் — வணிகர் மாத"),null,L("Vendor → month expected → bills → 2B compare (V3 model)","வணிகர் → மாத எதிர்பார்ப்பு → பில்கள் → 2B ஒப்பீடு (V3 மாதிரி)")),
  EyVbChips([[L("Transactions","பரிவர்த்தனைகள்"),String(all.length)],[L("Expected (all)","எதிர்பார்ப்பு (எல்லாம்)"),"₹"+EyVbInr(gExp)],[L("Bills Σ (all)","பில் மொத்தம் (எல்லாம்)"),"₹"+EyVbInr(gBil)],[L("Actual goods (all)","உண்மை பொருள் (எல்லாம்)"),"₹"+EyVbInr(gAct)]]),
  n.jsxs("div",{className:"ui-card",style:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"},children:[
   n.jsxs("select",{className:"ui-input",style:{maxWidth:170},value:fy,onChange:function(e){Sfy(e.target.value)},children:[
    n.jsx("option",{value:"",children:L("All FY","எல்லா FY")}),
    fyL.map(function(x){return n.jsx("option",{value:x,children:x},x)})]}),
   n.jsx("input",{className:"ui-input",style:{maxWidth:240},placeholder:L("Vendor / Txn ID…","வணிகர் / Txn ID…"),value:q,onChange:function(e){Sq(e.target.value)}}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:csv,children:"📊 CSV"}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  n.jsx(EyTblX,{head:["FY",L("Month","மாதம்"),"Txn ID",L("Vendor","வணிகர்"),"GSTIN",L("Expected ₹","எதிர்பார்ப்பு ₹"),L("Advance ₹","முன்பணம் ₹"),"GST%",L("Actual ₹","உண்மை ₹"),L("Bills Σ","பில்கள் Σ"),"2B Σ","⚖",L("Status","நிலை")],children:
   list.map(function(it){var h=it.h,gst=gstinOf(it),q2=g2Of(it),d2=h?it.g.tot-h.exp:0;
    return n.jsxs("tr",{style:{cursor:"pointer"},onClick:function(){r("/transactions/"+encodeURIComponent(it.g.id))},children:[
     n.jsx("td",{className:"mono",children:h?h.fy:"—"}),
     n.jsx("td",{children:h?h.mo:"—"}),
     n.jsx("td",{className:"mono",style:{fontSize:10},children:it.g.id}),
     n.jsx("td",{style:{fontWeight:600},children:(h?h.nm:it.g.nm)||"—"}),
     n.jsx("td",{className:"mono",style:{fontSize:10},children:gst||"—"}),
     n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.exp):"—"}),
     n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.adv):"—"}),
     n.jsx("td",{className:"mono",children:h?h.gp+"%":"—"}),
     n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.act):"—"}),
     n.jsx("td",{className:"mono",children:"₹"+EyVbInr(it.g.tot)+" ("+it.g.n+")"}),
     n.jsx("td",{className:"mono",style:{color:q2?"#0a7d43":undefined},children:q2?"₹"+EyVbInr(q2.tot)+" ("+q2.n+")":"—"}),
     n.jsx("td",{children:h?(Math.abs(d2)<=1?n.jsx("span",{style:{color:"#0a7d43",fontWeight:800},children:"✓"}):n.jsx("span",{style:{color:"#b3261e",fontWeight:800},title:String(d2),children:"⚠"})):""}),
     n.jsx("td",{children:h?n.jsx("span",{style:{fontWeight:700},children:h.st}):n.jsx("span",{style:{color:"#8a6d00",fontSize:11},children:L("bills only","பில் மட்டும்")})})]},it.g.id)})}),
  n.jsx("div",{style:{fontSize:12,color:"var(--tx-3)",margin:"8px 2px"},children:L("⚠ = bills Σ differs from expected · — = vendor-month not in 2B summary","⚠ = பில் Σ ≠ எதிர்பார்ப்பு · — = அந்த வணிகர்-மாதம் 2B சுருக்கத்தில் இல்லை")}),
  n.jsx("table",{className:"gtbl",style:{marginTop:8},children:n.jsx("tbody",{children:[
   n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Filtered total","வடிகட்டிய மொத்தம்")}),n.jsx("td",{className:"mono",children:list.length+" "+L("txns","பரிவர்த்தனை")}),n.jsx("td",{className:"mono",children:"எதிர்பார்ப்பு ₹"+EyVbInr(fExp)}),n.jsx("td",{className:"mono",children:"முன்பணம் ₹"+EyVbInr(fAdv)}),n.jsx("td",{className:"mono",children:"உண்மை ₹"+EyVbInr(fAct)}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"பில்கள் ₹"+EyVbInr(fBil)}),n.jsx("td",{className:"mono",children:"2B ₹"+EyVbInr(fG2)})]},"f1"),
   n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")}),n.jsx("td",{className:"mono",children:all.length+" "+L("txns","பரிவர்த்தனை")}),n.jsx("td",{className:"mono",children:"எதிர்பார்ப்பு ₹"+EyVbInr(gExp)}),n.jsx("td",{className:"mono",children:"முன்பணம் ₹"+EyVbInr(gAdv)}),n.jsx("td",{className:"mono",children:"உண்மை ₹"+EyVbInr(gAct)}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"பில்கள் ₹"+EyVbInr(gBil)}),n.jsx("td",{className:"mono",children:"2B ₹"+EyVbInr(gG2)})]},"f2")]})})]})}
function EyTxnDetail(p){
 var id=p.txnId,L=p.L,nav=p.nav;
 var h=null,i;for(i=0;i<EyV3.txn.length;i++)if(EyV3.txn[i].id===id)h=EyV3.txn[i];
 var bills=EyV3.bil.filter(function(b){return b.txn===id}).sort(function(a,b){return (a.dt||"").localeCompare(b.dt||"")});
 var v=h?(EyV3.ven[h.vc]||null):null;
 var sAmt=0,sGa=0,sTot=0;bills.forEach(function(b){sAmt+=b.amt;sGa+=b.ga;sTot+=b.tot});
 var q2=null;
 if(h){var vv=EyV3.ven[h.vc];if(vv&&vv.gstin)q2=EyV3.g2[h.fy+"|"+EyV3M3(h.mo)+"|"+vv.gstin]||null}
 if(!h&&!bills.length)return n.jsxs("div",{children:[n.jsx("div",{className:"ui-empty",children:L("Transaction not found","பரிவர்த்தனை கிடைக்கவில்லை")}),n.jsx("button",{className:"ui-btn ui-btn-sm",style:{marginTop:10},onClick:function(){nav("/transactions")},children:"← "+L("Back","பின்செல்")})]});
 var nm=(h?h.nm:(bills[0]?bills[0].nm:""))||"—";
 var vc=h?h.vc:(bills[0]?bills[0].vc:"");
 function pr(){
  var rows=bills.map(function(b,i2){return [i2+1,b.no||"—",b.dt||"—","₹"+EyVbInr(b.amt),b.gp+"%","₹"+EyVbInr(b.ga),"₹"+EyVbInr(b.tot)]});
  EyVbPrint(nm+" — "+id,h?("FY "+h.fy+" · "+h.mo+(v?" · "+v.gstin:"")):"",
   ["#","Bill No","Date","Amount ₹","GST%","GST ₹","Total ₹"],rows,
   [[L("Bills total","பில்கள் மொத்தம்")+" ("+bills.length+")","₹"+EyVbInr(sAmt),"₹"+EyVbInr(sGa),"₹"+EyVbInr(sTot)],
    [L("Expected (unfiltered)","எதிர்பார்ப்பு (வடிகட்டாத)"),h?"₹"+EyVbInr(h.exp):"—",h?h.gp+"%":"—",h?"₹"+EyVbInr(h.ga):"—"]],true)}
 return n.jsxs("div",{children:[
  n.jsxs("div",{style:{display:"flex",gap:10,alignItems:"center",marginBottom:12},children:[
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:function(){nav("/transactions")},children:"← "+L("Transactions","பரிவர்த்தனைகள்")}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  EyVbChips([[L("Vendor","வணிகர்"),nm],["GSTIN",(v&&v.gstin)||"—"],[h?("FY "+h.fy+" · "+h.mo):"Txn",id],[L("Expected","எதிர்பார்ப்பு"),h?"₹"+EyVbInr(h.exp):"—"],[L("Status","நிலை"),h?h.st:L("bills only","பில் மட்டும்")]]),
  n.jsxs("div",{className:"ui-card",children:[
   n.jsx("div",{style:{fontWeight:800,marginBottom:6},children:L("Month declaration (vendor pre-committed)","மாத அறிவிப்பு (வணிகர் முன்கூட்டிய தொகை)")}),
   n.jsxs("table",{className:"gtbl",children:[n.jsx("tbody",{children:[
    n.jsxs("tr",{children:[n.jsx("td",{children:L("Expected amount","எதிர்பார்த்த தொகை")}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.exp):"—"})]},"r1"),
    n.jsxs("tr",{children:[n.jsx("td",{children:L("Advance paid","முன்பணம்")}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.adv):"—"})]},"r2"),
    n.jsxs("tr",{children:[n.jsx("td",{children:L("GST % → GST amount","GST % → GST தொகை")}),n.jsx("td",{className:"mono",children:h?(h.gp+"% → ₹"+EyVbInr(h.ga)):"—"})]},"r3"),
    n.jsxs("tr",{children:[n.jsx("td",{children:L("Actual goods value (Σ bills)","உண்மை பொருள் மதிப்பு (Σ பில்)")}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.act):"₹"+EyVbInr(sAmt)})]},"r4"),
    n.jsxs("tr",{children:[n.jsx("td",{children:L("Remaining","மீதி")}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.rem):"—"})]},"r5"),
    n.jsxs("tr",{children:[n.jsx("td",{children:L("GST balance (after advance)","GST மீதி (முன்பணத்திற்குப் பின்)")}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.bal):"—"})]},"r6")]})]})]}),
  n.jsxs("div",{className:"ui-card",children:[
   n.jsx("div",{style:{fontWeight:800,marginBottom:6},children:L("2B comparison (vendor + month)","2B ஒப்பீடு (வணிகர் + மாதம்)")}),
   q2?n.jsxs("table",{className:"gtbl",children:[n.jsx("tbody",{children:[
    n.jsxs("tr",{children:[n.jsx("td",{children:"2B "+(h?h.fy+" · "+h.mo:"")}),n.jsx("td",{className:"mono",children:q2.n+" "+L("bills","பில்கள்")}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(q2.tot)})]},"b1"),
    n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:700},children:L("V3 bills Σ vs 2B Σ","V3 பில் Σ vs 2B Σ")}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(sTot)+" vs ₹"+EyVbInr(q2.tot)}),n.jsx("td",{className:"mono",style:{color:Math.abs(sTot-q2.tot)<=1?"#0a7d43":"#b3261e",fontWeight:800},children:(sTot-q2.tot>=0?"+":"")+"₹"+EyVbInr(sTot-q2.tot)})]},"b2")]})]}):
   n.jsx("div",{style:{color:"var(--tx-3)",fontSize:13},children:L("This vendor-month is not in the GSTR2B_Summary (2B) yet","இந்த வணிகர்-மாதம் GSTR2B_Summary (2B)-இல் இன்னும் இல்லை")})]}),
  n.jsx(EyTblX,{head:["#",L("Bill No","பில் எண்"),L("Date","தேதி"),L("Amount ₹","தொகை ₹"),"GST%",L("GST ₹","GST ₹"),L("Total ₹","மொத்த ₹")],children:
   bills.map(function(b,i){return n.jsxs("tr",{children:[
    n.jsx("td",{children:i+1}),
    n.jsx("td",{className:"mono",children:b.no||"—"}),
    n.jsx("td",{className:"mono",children:b.dt||"—"}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.amt)}),
    n.jsx("td",{className:"mono",children:b.gp+"%"}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.ga)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.tot)})]},i)})}),
  n.jsx("table",{className:"gtbl",style:{marginTop:8},children:n.jsx("tbody",{children:[
   n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Bills total (filtered)","பில் மொத்தம் (வடிகட்டிய)")}),n.jsx("td",{className:"mono",children:bills.length+" "+L("bills","பில்கள்")}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(sAmt)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(sGa)}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(sTot)})]},"f1"),
   n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Expected (unfiltered)","எதிர்பார்ப்பு (வடிகட்டாத)")}),n.jsx("td",{className:"mono",children:h?h.fy+" · "+h.mo:"—"}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.exp):"—"}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.ga):"—"}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.act):"—"})]},"f2")]})})]})}
