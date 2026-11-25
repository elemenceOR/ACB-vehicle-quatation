const CAT={
"Body kits":[["Front lip / splitter","Fitted and finished",45000],["Side skirts","Pair",60000],["Rear diffuser","Fitted",55000],["Spoiler / wing","Fitted and finished",40000],["Fender flares","Set of four",120000],["Full body kit","Front, sides, rear",350000]],
"Paint":[["Full respray","Single colour",450000],["Panel respray","Per panel",45000],["Two-tone roof","Roof only",80000],["Caliper painting","Set of four",25000],["Satin or matte finish","Upgrade on any paint",60000]],
"Wrapping":[["Full colour-change wrap","Gloss, satin or matte",380000],["Roof wrap","Gloss black or carbon",30000],["Bonnet wrap","",35000],["Chrome delete","Trim and badges",40000],["Paint protection film","Front end",150000]],
"Lifting":[["Suspension lift 2 in","Kit and fitting",180000],["Suspension lift 3 in","Kit and fitting",260000],["Levelling kit","Front only",65000],["All-terrain tyres","Set of four",320000],["Bull bar / snorkel","Fitted",110000]],
"Interior":[["Seat upholstery","Full set, leather",280000],["Dashboard trim","Wrap or leather",90000],["Ambient lighting","Cabin kit",35000],["Steering wheel retrim","Leather or Alcantara",40000],["Headliner retrim","",120000],["Sound system upgrade","Head unit and speakers",150000]]
};
const LOGO="resources/logo1.avif";
const BIZ="Avant Customs (Private) Limited";
const BIZ_ADDRESS="613, Bangalawa Junction, Kotte Road, Pitakotte, Colombo";
const BIZ_PHONE="+94 777 513 351";
const SHEETS_URL="https://script.google.com/macros/s/AKfycbyGXrhSlI9rNbBuDA_CDLNqrvqTC_gEdKCkbTfJyYRWG9Lp0OHOIwvX2RXnP5wYlnpN/exec";

const $=id=>document.getElementById(id);
const fmt=n=>"LKR "+Math.round(n).toLocaleString("en-LK");
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const quoteNumber=n=>`QT-${String(n).padStart(4,"0")}`;
let cur=Object.keys(CAT)[0],lines=[],seq=0,shown=0,shownDate="",sheetSubmissionAttempted=false,reservingQuote=false;

function reserveQuoteNumber(){
return new Promise((resolve,reject)=>{
if(!SHEETS_URL.startsWith("https://script.google.com/macros/s/")||!SHEETS_URL.endsWith("/exec")){
reject(new Error("Set SHEETS_URL to the deployed Apps Script web-app URL."));
return
}
const callbackName="quoteNumberCallback_"+Date.now()+"_"+Math.floor(Math.random()*1000000);
const script=document.createElement("script");
let timer;
const cleanup=()=>{clearTimeout(timer);delete window[callbackName];script.remove()};
window[callbackName]=result=>{
cleanup();
if(!result||!result.ok||!Number.isInteger(result.quoteNumber)){
reject(new Error(result&&result.message||"The server could not reserve a quotation number."));
return
}
resolve(result.quoteNumber);
};
script.onerror=()=>{cleanup();reject(new Error("Could not reach the quotation-number service."))};
timer=setTimeout(()=>{cleanup();reject(new Error("The quotation-number request timed out."))},15000);
script.src=SHEETS_URL+"?action=reserve&callback="+encodeURIComponent(callbackName);
document.head.appendChild(script);
});
}

function tabs(){
$("tabs").innerHTML=Object.keys(CAT).map(c=>`<button class="tab" role="tab" aria-selected="${c===cur}" data-c="${c}">${c}</button>`).join("");
$("items").innerHTML=CAT[cur].map((it,i)=>{
const on=lines.some(l=>l.key===cur+i);
return `<button class="item${on?" on":""}" data-i="${i}"><b>${esc(it[0])}</b><small>${esc(it[1])}</small><span class="p">${on?"Added – tap to remove":"Tap to add"}</span></button>`}).join("");
}
function dot(c){const h=(c.match(/#[0-9a-f]{6}/i)||[])[0],v=h||c.trim();return window.CSS&&CSS.supports("color",v)?`<span class="dot" style="background:${esc(v)}"></span>`:""}
function addLine(name,price,key,category){
const f=key&&lines.find(l=>l.key===key);
if(f){f.qty++}else lines.push({id:++seq,key,name,category,qty:1,price,col:"",needs:!!key&&/^(Paint|Wrapping|Interior|Body kits)/.test(key)&&!/Sound/.test(name)});
draw();
}
function draw(){
$("lines").innerHTML=lines.length?lines.map(l=>`<div class="line" data-id="${l.id}"><span class="n">${esc(l.name)}</span><input class="q" type="number" min="1" value="${l.qty}" aria-label="Quantity"><button class="x" aria-label="Remove">×</button><div class="cr${l.needs&&!l.col?" need":""}"><input class="col" list="cols" value="${esc(l.col)}" placeholder="${l.needs?"Colour needed – e.g. Satin black":"Colour or finish (optional)"}" aria-label="Colour for ${esc(l.name)}"><input class="pick" type="color" value="${(l.col.match(/#[0-9a-f]{6}/i)||["#888888"])[0]}" aria-label="Pick a colour"></div></div>`).join(""):'<p class="empty">Nothing added yet. Tap an item on the left.</p>';
totals();tabs();
}
function totals(){
$("tots").innerHTML=lines.length?`<div class="tot big"><span>Items</span><span>${lines.length}</span></div>`:"";
}
$("tabs").onclick=e=>{const b=e.target.closest(".tab");if(b){cur=b.dataset.c;tabs()}};
$("items").onclick=e=>{const b=e.target.closest(".item");if(!b)return;const i=+b.dataset.i,it=CAT[cur][i];
const key=cur+i,ex=lines.find(l=>l.key===key);
if(ex){lines=lines.filter(l=>l.key!==key);draw()}else addLine(it[0],it[2],key,cur)};
$("addc").onclick=()=>{const n=$("cu").value.trim();if(!n)return;addLine(n,0,"","Custom");$("cu").value=""};
$("lines").oninput=e=>{const r=e.target.closest(".line");if(!r)return;const l=lines.find(x=>x.id==r.dataset.id);
if(e.target.classList.contains("q"))l.qty=Math.max(1,+e.target.value||1);
if(e.target.classList.contains("col")){l.col=e.target.value;r.querySelector(".cr").classList.toggle("need",l.needs&&!l.col)}
if(e.target.classList.contains("pick")){const b=l.col.replace(/\s*\(#[0-9a-f]{6}\)/i,"");l.col=(b+" ("+e.target.value+")").trim();r.querySelector(".col").value=l.col;r.querySelector(".cr").classList.remove("need")}
totals()};
$("lines").onclick=e=>{if(e.target.classList.contains("x")){const id=e.target.closest(".line").dataset.id;lines=lines.filter(l=>l.id!=id);draw()}};

async function build(){
if(!lines.length){alert("Add at least one item before generating the quotation.");return false}
if(lines.some(l=>l.needs&&!l.col)&&!confirm("Some items still need a colour. Generate the quotation anyway?"))return false;
if(reservingQuote)return false;
reservingQuote=true;$("gen").disabled=true;$("dlq").disabled=true;
try{shown=await reserveQuoteNumber()}
catch(error){console.error("Could not reserve a quotation number.",error);alert("Could not get a shared quotation number: "+error.message+" Check your connection and Apps Script deployment, then try again.");return false}
finally{reservingQuote=false;$("gen").disabled=false;$("dlq").disabled=false}
const d=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
shownDate=d;sheetSubmissionAttempted=false;$("sheets").disabled=false;
$("sheet").innerHTML=`<div class="lh"><img src="${LOGO}" alt="${esc(BIZ)} logo"><div><b>${BIZ}</b><div>${BIZ_ADDRESS}</div><div>Phone: ${BIZ_PHONE}</div></div></div><div class="meta"><div><h2>Quotation</h2><div>No. ${quoteNumber(shown)}</div><div>${d}</div></div>
<div style="text-align:right"><b>Prepared for</b><div>${esc($("cn").value||"Customer")}</div><div>${esc($("cp").value)}</div><div>${esc($("vm").value)} ${esc($("vp").value)}</div></div></div>
<div class="wide"><table><thead><tr><th>Requested work</th><th>Qty</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${esc(l.name)}${l.col?`<div style="font-size:14px;color:#444">Colour: ${dot(l.col)}${esc(l.col)}</div>`:""}</td><td>${l.qty}</td></tr>`).join("")}</tbody></table></div>
${$("ideas").value.trim()?`<p style="margin-top:20px"><b>Customer requirements</b><br>${esc($("ideas").value).replace(/\n/g,"<br>")}</p>`:""}
${photos.length?`<div class="pics">${photos.map(p=>`<img src="${p}" alt="Reference photo">`).join("")}</div>`:""}
<p style="margin-top:24px;color:#555;font-size:14px">This is an initial quotation listing the requested work. Pricing will be confirmed separately. Thank you for choosing ${BIZ}.</p>`;
document.querySelector("main").style.display="none";document.querySelector("header").style.display="none";
$("inv").classList.add("show");scrollTo(0,0);return true;
}
$("gen").onclick=()=>build();
$("back").onclick=()=>{$("inv").classList.remove("show");document.querySelector("main").style.display="";document.querySelector("header").style.display=""};
$("prt").onclick=()=>window.print();
function csvCell(value){
const text=String(value==null?"":value),safe=/^[\t\r\n ]*[=+\-@]/.test(text)?"'"+text:text;
return '"'+safe.replace(/"/g,'""')+'"';
}
function saveCsv(){
if(!shown){alert("Generate the quotation before saving quote data.");return}
const rows=[["Quotation number","Date","Customer name","Phone","Vehicle make/model","Plate number","Customer requirements","Work category","Requested work","Quantity","Colour/finish","Estimated unit price (LKR)","Estimated line total (LKR)","Reference photo count"]];
for(const l of lines)rows.push([quoteNumber(shown),shownDate,$("cn").value,$("cp").value,$("vm").value,$("vp").value,$("ideas").value,l.category,l.name,l.qty,l.col,l.price,l.price*l.qty,photos.length]);
const csv="\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
const a=document.createElement("a");a.href=url;a.download=pdfName().replace(/\.pdf$/i,".csv");
document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("csv").onclick=saveCsv;
async function saveToGoogleSheet(){
if(!shown){alert("Generate the quotation before saving it to Google Sheets.");return}
if(!SHEETS_URL.startsWith("https://script.google.com/macros/s/")||!SHEETS_URL.endsWith("/exec")){
alert("Set SHEETS_URL in script.js to your deployed Google Apps Script web-app URL first.");return
}
if(sheetSubmissionAttempted){alert("A save request was already sent for this quotation. Check the Google Sheet before trying again.");return}
const data={
quoteNumber:quoteNumber(shown),date:shownDate,customerName:$("cn").value,phone:$("cp").value,
vehicle:$("vm").value,plate:$("vp").value,requirements:$("ideas").value,
lines:lines.map(l=>({category:l.category,name:l.name,quantity:l.qty,colour:l.col,unitPrice:l.price,lineTotal:l.price*l.qty})),
photos
};
sheetSubmissionAttempted=true;$("sheets").disabled=true;
try{
await fetch(SHEETS_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(data)});
alert("The request was sent, but the browser cannot confirm the Apps Script result. Check the Quotes sheet for the record and its Photo upload status. If Drive access is needed, run authorizeDriveAccess once in the Apps Script editor.");
}catch(error){
sheetSubmissionAttempted=false;$("sheets").disabled=false;console.error("Google Sheets submission failed.",error);alert("Could not send the request. Check your connection and Apps Script deployment, then try again or save the CSV as a backup.");
}
}
$("sheets").onclick=saveToGoogleSheet;
let photos=[];
function resetQuote(){
if(!confirm("Reset all customer, vehicle, item, note, and photo data? Download the CSV first if you want to keep a copy. The quotation number sequence will not be reset."))return;
["cn","cp","vm","vp","ideas","cu","ph"].forEach(id=>$(id).value="");
lines=[];photos=[];seq=0;cur=Object.keys(CAT)[0];shown=0;shownDate="";sheetSubmissionAttempted=false;$("sheets").disabled=false;
$("sheet").innerHTML="";$("inv").classList.remove("show");
document.querySelector("main").style.display="";document.querySelector("header").style.display="";
gal();draw();scrollTo(0,0);
}
$("reset").onclick=resetQuote;
$("resetPreview").onclick=resetQuote;
function shrink(f){return new Promise((ok,no)=>{const r=new FileReader();r.onerror=no;r.onload=()=>{const im=new Image();im.onerror=no;im.onload=()=>{const s=Math.min(1,1000/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext("2d").drawImage(im,0,0,c.width,c.height);ok(c.toDataURL("image/jpeg",.78))};im.src=r.result};r.readAsDataURL(f)})}
function gal(){$("gal").innerHTML=photos.map((p,i)=>`<div class="th"><img src="${p}" alt="Photo ${i+1}"><button data-i="${i}" aria-label="Remove photo ${i+1}">×</button></div>`).join("")}
$("ph").onchange=async e=>{for(const f of e.target.files){try{photos.push(await shrink(f))}catch(x){}}e.target.value="";gal()};
$("gal").onclick=e=>{const b=e.target.closest("button");if(b){photos.splice(+b.dataset.i,1);gal()}};
function pdfName(){const n=($("cn").value||"").replace(/[\\\/:*?"<>|\u0000-\u001f]/g,"").replace(/\s+/g," ").trim().replace(/[. ]+$/,"");return (n||"Customer")+".pdf"}
async function dl(rebuild){
if(rebuild&&!(await build()))return;
if(!window.html2pdf){alert("The PDF library could not load. Check your internet connection, or use Print.");return}
const s=$("sheet"),bs=document.querySelectorAll("#dlq,#dlp");
bs.forEach(b=>b.disabled=true);s.classList.add("pdf");
html2pdf().set({margin:10,filename:pdfName(),image:{type:"jpeg",quality:.95},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",scrollY:0},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"],avoid:["tr",".pics img",".lh"]}}).from(s).save().catch(()=>alert("Could not create the PDF. Try Print instead.")).finally(()=>{s.classList.remove("pdf");bs.forEach(b=>b.disabled=false)});
}
$("dlq").onclick=()=>dl(true);
$("dlp").onclick=()=>dl(false);
$("hl").src=LOGO;
draw();
