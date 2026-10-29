(() => {
"use strict";
const $ = id => document.getElementById(id);
const STORE_KEY = "rafiq_digital_survey_cad_v1";
const SQM_PER_DECIMAL = 40.468564224;
const SQFT_PER_SQM = 10.7639104167;
const state = { points: [], closed: false, showGrid: true, showLabels: true, gpsOrigin: null, deferredInstall: null };
const svgNS = "http://www.w3.org/2000/svg";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = n => Number.isFinite(n) ? n : 0;
const fmt = (n,d=2) => num(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
function say(message){$("status").textContent=message;}
function projectMeta(){return {name:$("projectName").value.trim()||"নতুন জমির নকশা",mouza:$("mouza").value.trim(),dag:$("dag").value.trim(),khatian:$("khatian").value.trim(),date:$("surveyDate").value||new Date().toISOString().slice(0,10)};}
function distance(a,b){return Math.hypot(b.x-a.x,b.y-a.y);}
function perimeter(){let p=0;for(let i=1;i<state.points.length;i++)p+=distance(state.points[i-1],state.points[i]);if(state.closed&&state.points.length>2)p+=distance(state.points.at(-1),state.points[0]);return p;}
function area(){if(!state.closed||state.points.length<3)return 0;let s=0;for(let i=0;i<state.points.length;i++){const a=state.points[i],b=state.points[(i+1)%state.points.length];s+=a.x*b.y-b.x*a.y;}return Math.abs(s)/2;}
function svgEl(tag,attrs={},text){const e=document.createElementNS(svgNS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!==undefined)e.textContent=text;return e;}
function transformPoints(){
 const pts=state.points;if(!pts.length)return [];
 const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const w=Math.max(maxX-minX,1),h=Math.max(maxY-minY,1),scale=Math.min(780/w,470/h);
 const ox=500-(minX+maxX)/2*scale,oy=325+(minY+maxY)/2*scale;
 return pts.map(p=>({...p,sx:ox+p.x*scale,sy:oy-p.y*scale,scale}));
}
function render(){
 const layer=$("drawingLayer");layer.replaceChildren();
 $("gridBackground").style.display=state.showGrid?"":"none";
 const pts=transformPoints();
 if(pts.length){
   const pathPts=pts.map(p=>`${p.sx},${p.sy}`).join(" ");
   layer.appendChild(svgEl(state.closed&&pts.length>=3?"polygon":"polyline",{points:pathPts,class:state.closed&&pts.length>=3?"plot-line":"plot-open"}));
   if(state.closed&&pts.length>=3)layer.appendChild(svgEl("polygon",{points:pathPts,fill:"#14a39a",opacity:"0.07"}));
   pts.forEach((p,i)=>{
     layer.appendChild(svgEl("circle",{cx:p.sx,cy:p.sy,r:5.5,class:"point-dot"}));
     if(state.showLabels)layer.appendChild(svgEl("text",{x:p.sx+9,y:p.sy-10,class:"point-label"},p.label||String.fromCharCode(65+i)));
     const next=pts[i+1]||(state.closed?pts[0]:null);
     if(next){const mx=(p.sx+next.sx)/2,my=(p.sy+next.sy)/2;layer.appendChild(svgEl("text",{x:mx,y:my-6,class:"dim-label","text-anchor":"middle"},fmt(distance(p, next),2)+" m"));}
   });
 }
 const a=area(),p=perimeter();
 $("areaM2").textContent=fmt(a,2)+" m²";
 $("areaSqft").textContent=fmt(a*SQFT_PER_SQM,2)+" বর্গফুট";
 $("areaDecimal").textContent=fmt(a/SQM_PER_DECIMAL,3);
 $("perimeter").textContent=fmt(p,2)+" m";
 $("sideCount").textContent=state.points.length;
 $("pointCount").textContent=state.points.length+" পয়েন্ট";
 $("closureStatus").textContent=state.closed&&state.points.length>=3?"সীমানা বন্ধ":"সীমানা খোলা";
 $("closureStatus").className="pill"+(state.closed&&state.points.length>=3?" closed":"");
 $("drawingSub").textContent=`${projectMeta().mouza||"মৌজা উল্লেখ নেই"} • ${projectMeta().dag||"দাগ উল্লেখ নেই"} • স্থানীয় মিটার কোঅর্ডিনেট`;
 const body=$("pointsBody");body.replaceChildren();
 if(!state.points.length){body.innerHTML='<tr><td colspan="8" class="empty">এখনো কোনো পয়েন্ট নেই। বাম পাশ থেকে পয়েন্ট যোগ করুন।</td></tr>';return;}
 state.points.forEach((pt,i)=>{
   const next=state.points[i+1]||(state.closed?state.points[0]:null),d=next?distance(pt,next):null;
   const tr=document.createElement("tr");
   tr.innerHTML=`<td>${i+1}</td><td>${esc(pt.label||("P"+(i+1)))}</td><td>${fmt(pt.x,3)}</td><td>${fmt(pt.y,3)}</td><td>${pt.lat==null?"—":fmt(pt.lat,6)}</td><td>${pt.lon==null?"—":fmt(pt.lon,6)}</td><td>${d==null?"—":fmt(d,2)+" m"}</td><td><button class="small-delete" data-remove="${i}" aria-label="পয়েন্ট মুছুন">মুছুন</button></td>`;
   body.appendChild(tr);
 });
}
function addPoint(x,y,label,lat=null,lon=null){
 if(!Number.isFinite(x)||!Number.isFinite(y)){say("X ও Y কোঅর্ডিনেট সঠিকভাবে দিন।");return;}
 if(state.closed){state.closed=false;say("নতুন পয়েন্ট যোগ করার জন্য সীমানা আবার খোলা হয়েছে।");}
 state.points.push({x,y,label:label||("P"+(state.points.length+1)),lat,lon});
 render();say("পয়েন্ট যোগ হয়েছে।");
}
function localFromGPS(lat,lon){
 if(!state.gpsOrigin)state.gpsOrigin={lat,lon};
 const origin=state.gpsOrigin,rad=Math.PI/180;
 const y=(lat-origin.lat)*111132.92;
 const x=(lon-origin.lon)*111412.84*Math.cos(origin.lat*rad);
 return {x,y};
}
function getGPS(){
 if(!("geolocation" in navigator)){say("এই ব্রাউজারে GPS সুবিধা নেই।");return;}
 say("GPS অবস্থান নেওয়া হচ্ছে—অনুমতি দিন এবং খোলা জায়গায় থাকুন।");
 navigator.geolocation.getCurrentPosition(pos=>{
   const {latitude:lat,longitude:lon,accuracy}=pos.coords,xy=localFromGPS(lat,lon);
   addPoint(xy.x,xy.y,$("pointLabel").value.trim()||("GPS-"+(state.points.length+1)),lat,lon);
   $("pointX").value=xy.x.toFixed(2);$("pointY").value=xy.y.toFixed(2);
   say(`GPS পয়েন্ট যোগ হয়েছে। আনুমানিক নির্ভুলতা ±${Math.round(accuracy)} মিটার।`);
 },err=>say("GPS পাওয়া যায়নি: "+({1:"লোকেশন অনুমতি দিন",2:"GPS অবস্থান পাওয়া যাচ্ছে না",3:"GPS সময় শেষ"}[err.code]||err.message)),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
}
function download(name,content,type){
 const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function filename(ext){return (projectMeta().name||"survey").replace(/[^\p{L}\p{N}_-]+/gu,"_")+"."+ext;}
function saveProject(){
 const data={format:"RafiqDigitalSurveyCAD",version:1,meta:projectMeta(),points:state.points,closed:state.closed,gpsOrigin:state.gpsOrigin,savedAt:new Date().toISOString()};
 localStorage.setItem(STORE_KEY,JSON.stringify(data));say("প্রজেক্ট এই ডিভাইসে সেভ হয়েছে।");
}
function loadProject(data){
 if(!data||!Array.isArray(data.points))throw new Error("ভুল বা অসমর্থিত প্রজেক্ট ফাইল");
 const meta=data.meta||{};
 $("projectName").value=meta.name||"নতুন জমির নকশা";$("mouza").value=meta.mouza||"";$("dag").value=meta.dag||"";$("khatian").value=meta.khatian||"";$("surveyDate").value=meta.date||"";
 state.points=data.points.filter(p=>Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))).map(p=>({x:Number(p.x),y:Number(p.y),label:String(p.label||""),lat:p.lat==null?null:Number(p.lat),lon:p.lon==null?null:Number(p.lon)}));
 state.closed=Boolean(data.closed)&&state.points.length>=3;state.gpsOrigin=data.gpsOrigin||null;render();
}
function exportDXF(){
 const pts=state.points;if(pts.length<2){say("DXF রপ্তানির জন্য অন্তত ২টি পয়েন্ট যোগ করুন।");return;}
 let d="0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
 // DXF R12 POLYLINE coordinates use local metres; CAD readers may treat unit scale according to their settings.
 d+=`0\nPOLYLINE\n8\nBOUNDARY\n66\n1\n70\n${state.closed?1:0}\n`;
 pts.forEach((p,i)=>{d+=`0\nVERTEX\n8\nBOUNDARY\n10\n${p.x}\n20\n${p.y}\n30\n0\n`});
 d+="0\nSEQEND\n";
 pts.forEach(p=>{d+=`0\nPOINT\n8\nSURVEY_POINTS\n10\n${p.x}\n20\n${p.y}\n30\n0\n`;});
 d+=`0\nTEXT\n8\nANNOTATION\n10\n0\n20\n-2\n30\n0\n40\n0.5\n1\nAREA ${fmt(area(),3)} SQM | ${fmt(area()/SQM_PER_DECIMAL,3)} DECIMAL\n`;
 d+="0\nENDSEC\n0\nEOF\n";download(filename("dxf"),d,"application/dxf");say("DXF ফাইল তৈরি হয়েছে। CAD সফটওয়্যারে খুলে স্কেল/ইউনিট যাচাই করুন।");
}
function exportCSV(){
 const rows=[["Point","Name","X_m","Y_m","Latitude","Longitude"],...state.points.map((p,i)=>[i+1,p.label,p.x,p.y,p.lat??"",p.lon??""])];
 const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
 download(filename("csv"),csv,"text/csv;charset=utf-8");
}
function exportJSON(){const data={format:"RafiqDigitalSurveyCAD",version:1,meta:projectMeta(),points:state.points,closed:state.closed,gpsOrigin:state.gpsOrigin,savedAt:new Date().toISOString()};download(filename("json"),JSON.stringify(data,null,2),"application/json");}
$("addPointBtn").addEventListener("click",()=>addPoint(Number($("pointX").value),Number($("pointY").value),$("pointLabel").value.trim()));
$("gpsBtn").addEventListener("click",getGPS);
$("undoBtn").addEventListener("click",()=>{if(state.points.length){state.points.pop();if(state.points.length<3)state.closed=false;render();say("শেষ পয়েন্ট বাদ দেওয়া হয়েছে।");}});
$("closeBtn").addEventListener("click",()=>{if(state.points.length<3){say("সীমানা বন্ধ করতে অন্তত ৩টি পয়েন্ট দরকার।");return;}state.closed=!state.closed;render();say(state.closed?"সীমানা বন্ধ করা হয়েছে।":"সীমানা আবার খোলা হয়েছে।");});
$("gridBtn").addEventListener("click",()=>{state.showGrid=!state.showGrid;$("gridBtn").classList.toggle("active",state.showGrid);render();});
$("labelsBtn").addEventListener("click",()=>{state.showLabels=!state.showLabels;$("labelsBtn").classList.toggle("active",state.showLabels);render();});
$("fitBtn").addEventListener("click",()=>{render();say("নকশা ফিট ভিউতে রিফ্রেশ হয়েছে।");});
$("clearBtn").addEventListener("click",()=>{if(confirm("এই প্রজেক্টের সব পয়েন্ট মুছে ফেলবেন?")){state.points=[];state.closed=false;state.gpsOrigin=null;render();say("পয়েন্ট মুছে ফেলা হয়েছে।");}});
$("saveBtn").addEventListener("click",saveProject);
$("exportDxfBtn").addEventListener("click",exportDXF);$("exportCsvBtn").addEventListener("click",exportCSV);$("exportJsonBtn").addEventListener("click",exportJSON);
$("importJson").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{loadProject(JSON.parse(await f.text()));say("ব্যাকআপ থেকে প্রজেক্ট খোলা হয়েছে।");}catch(err){say("ফাইল খোলা যায়নি: "+err.message);}e.target.value="";});
$("printBtn").addEventListener("click",()=>window.print());
$("pointsBody").addEventListener("click",e=>{const b=e.target.closest("[data-remove]");if(!b)return;const i=Number(b.dataset.remove);state.points.splice(i,1);if(state.points.length<3)state.closed=false;render();say("নির্বাচিত পয়েন্ট মুছে ফেলা হয়েছে।");});
["projectName","mouza","dag","khatian","surveyDate"].forEach(id=>$(id).addEventListener("input",()=>{render();}));
window.addEventListener("beforeunload",()=>{try{localStorage.setItem(STORE_KEY,JSON.stringify({format:"RafiqDigitalSurveyCAD",version:1,meta:projectMeta(),points:state.points,closed:state.closed,gpsOrigin:state.gpsOrigin}));}catch{}});
try{const raw=localStorage.getItem(STORE_KEY);if(raw)loadProject(JSON.parse(raw));else $("surveyDate").value=new Date().toISOString().slice(0,10);}catch{say("আগের সেভ করা ডেটা খোলা যায়নি।");}
if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.deferredInstall=e;$("installBtn").hidden=false;});
$("installBtn").addEventListener("click",async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$("installBtn").hidden=true;});
})();