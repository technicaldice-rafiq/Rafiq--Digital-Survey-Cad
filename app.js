(() => {
"use strict";

const $ = id => document.getElementById(id);
const STORE_KEY = "rafiq_digital_survey_cad_v1";

const SQM_PER_DECIMAL = 40.468564224;
const SQFT_PER_SQM = 10.7639104167;

const state = {
  points: [],
  closed: false,
  showGrid: true,
  showLabels: true,
  gpsOrigin: null
};

let lastTransform = null;
let activeDrag = null;
let pointerStart = null;
let interactionTransform = null;

const svgNS = "http://www.w3.org/2000/svg";

function say(message) {
  $("status").textContent = message;
}

function fmt(n,d=2) {
  return Number(n || 0).toFixed(d);
}

function distance(a,b) {
  return Math.hypot(b.x-a.x,b.y-a.y);
}

function area() {
  if (!state.closed || state.points.length < 3) return 0;

  let s = 0;

  for (let i=0; i<state.points.length; i++) {
    const a = state.points[i];
    const b = state.points[(i+1)%state.points.length];
    s += a.x*b.y-b.x*a.y;
  }

  return Math.abs(s)/2;
}

function perimeter() {
  let p=0;

  for(let i=1;i<state.points.length;i++) {
    p+=distance(state.points[i-1],state.points[i]);
  }

  if(state.closed && state.points.length>2) {
    p+=distance(state.points.at(-1),state.points[0]);
  }

  return p;
}

function svgEl(tag,attrs={},text) {
  const el=document.createElementNS(svgNS,tag);

  Object.entries(attrs).forEach(([k,v])=>{
    el.setAttribute(k,String(v));
  });

  if(text!==undefined) el.textContent=text;

  return el;
}

function transformPoints() {
  const pts=state.points;
  if(!pts.length) return [];

  const xs=pts.map(p=>p.x);
  const ys=pts.map(p=>p.y);

  const minX=Math.min(...xs);
  const maxX=Math.max(...xs);
  const minY=Math.min(...ys);
  const maxY=Math.max(...ys);

  const w=Math.max(maxX-minX,1);
  const h=Math.max(maxY-minY,1);

  const scale=Math.min(780/w,470/h);

  const t=interactionTransform || {
    scale,
    ox:500-(minX+maxX)/2*scale,
    oy:325+(minY+maxY)/2*scale
  };

  lastTransform=t;

  return pts.map(p=>({
    ...p,
    sx:t.ox+p.x*t.scale,
    sy:t.oy-p.y*t.scale
  }));
}

function render() {
  const layer=$("drawingLayer");
  layer.replaceChildren();

  $("gridBackground").style.display=
    state.showGrid ? "" : "none";

  const pts=transformPoints();

  if(pts.length) {

    const path=pts.map(p=>`${p.sx},${p.sy}`).join(" ");

    if(state.closed && pts.length>=3) {
      layer.appendChild(svgEl("polygon",{
        points:path,
        fill:"#14a39a",
        opacity:"0.08"
      }));
    }

    layer.appendChild(svgEl(
      state.closed && pts.length>=3 ? "polygon":"polyline",
      {
        points:path,
        class:state.closed ? "plot-line":"plot-open"
      }
    ));

    pts.forEach((p,i)=>{

      layer.appendChild(svgEl("circle",{
        cx:p.sx,
        cy:p.sy,
        r:10,
        class:"point-dot",
        "data-point-index":i
      }));

      if(state.showLabels) {
        layer.appendChild(svgEl("text",{
          x:p.sx+12,
          y:p.sy-12,
          class:"point-label",
          "pointer-events":"none"
        },p.label || `P${i+1}`));
      }
    });
  }

  const a=area();

  $("areaM2").textContent=fmt(a)+" m²";
  $("areaSqft").textContent=fmt(a*SQFT_PER_SQM)+" বর্গফুট";
  $("areaDecimal").textContent=fmt(a/SQM_PER_DECIMAL,3);
  $("perimeter").textContent=fmt(perimeter())+" m";

  $("sideCount").textContent=state.points.length;
  $("pointCount").textContent=state.points.length+" পয়েন্ট";

  $("closureStatus").textContent=
    state.closed ? "সীমানা বন্ধ":"সীমানা খোলা";

  $("closureStatus").className=
    "pill"+(state.closed?" closed":"");

  const body=$("pointsBody");
  body.replaceChildren();

  state.points.forEach((p,i)=>{
    const tr=document.createElement("tr");

    tr.innerHTML=`
      <td>${i+1}</td>
      <td>${p.label || "P"+(i+1)}</td>
      <td>${fmt(p.x,3)}</td>
      <td>${fmt(p.y,3)}</td>
      <td>${p.lat ?? "—"}</td>
      <td>${p.lon ?? "—"}</td>
      <td>—</td>
      <td><button data-remove="${i}">মুছুন</button></td>
    `;

    body.appendChild(tr);
  });
}

function addPoint(x,y,label,lat=null,lon=null) {

  if(!Number.isFinite(x)||!Number.isFinite(y)) {
    say("সঠিক X এবং Y দিন।");
    return;
  }

  state.closed=false;

  state.points.push({
    x,y,
    label:label || "P"+(state.points.length+1),
    lat,lon
  });

  render();
  say("নতুন পয়েন্ট যোগ হয়েছে।");
}

function svgPosition(e) {
  const svg=$("cadCanvas");
  const pt=svg.createSVGPoint();

  pt.x=e.clientX;
  pt.y=e.clientY;

  return pt.matrixTransform(
    svg.getScreenCTM().inverse()
  );
}

function modelPosition(pos,t=lastTransform) {
  if(!t) return {x:0,y:0};

  return {
    x:(pos.x-t.ox)/t.scale,
    y:(t.oy-pos.y)/t.scale
  };
}

function nearestPoint(pos) {

  const pts=transformPoints();

  let best=-1;
  let bestDistance=35;

  pts.forEach((p,i)=>{
    const d=Math.hypot(
      p.sx-pos.x,
      p.sy-pos.y
    );

    if(d<bestDistance) {
      best=i;
      bestDistance=d;
    }
  });

  return best;
}

/* MOBILE TOUCH SUPPORT */

const cad=$("cadCanvas");

cad.style.touchAction="none";

cad.addEventListener("pointerdown",e=>{

  if(e.pointerType==="mouse" && e.button!==0) return;

  const pos=svgPosition(e);
  const index=nearestPoint(pos);

  pointerStart={
    x:pos.x,
    y:pos.y,
    index,
    moved:false
  };

  if(index>=0) {
    activeDrag=index;

    interactionTransform=lastTransform
      ? {...lastTransform}
      : null;

    try {
      cad.setPointerCapture(e.pointerId);
    } catch {}

    e.preventDefault();
  }
});

cad.addEventListener("pointermove",e=>{

  if(activeDrag===null || !pointerStart) return;

  const pos=svgPosition(e);

  if(Math.hypot(
    pos.x-pointerStart.x,
    pos.y-pointerStart.y
  )>3) {
    pointerStart.moved=true;
  }

  const xy=modelPosition(pos,interactionTransform);

  state.points[activeDrag].x=xy.x;
  state.points[activeDrag].y=xy.y;

  render();

  e.preventDefault();
});

cad.addEventListener("pointerup",e=>{

  if(!pointerStart) return;

  const start=pointerStart;

  if(activeDrag!==null && start.moved) {

    const pt=state.points[activeDrag];
    const first=state.points[0];

    if(
      activeDrag===state.points.length-1 &&
      state.points.length>=3 &&
      distance(pt,first)<0.75
    ) {
      pt.x=first.x;
      pt.y=first.y;
      state.closed=true;

      say("Auto Snap: সীমানা বন্ধ হয়েছে।");
    } else {
      say("পয়েন্ট সরানো হয়েছে।");
    }

  } else if(start.index>=0) {

    if(start.index===0 && state.points.length>=3) {
      state.closed=true;
      say("সীমানা বন্ধ হয়েছে।");
    }

  } else {

    const xy=modelPosition(svgPosition(e));

    addPoint(
      xy.x,
      xy.y,
      "P"+(state.points.length+1)
    );
  }

  activeDrag=null;
  pointerStart=null;
  interactionTransform=null;

  render();

  try {
    cad.releasePointerCapture(e.pointerId);
  } catch {}
});

cad.addEventListener("pointercancel",()=>{
  activeDrag=null;
  pointerStart=null;
  interactionTransform=null;
  render();
});

/* BUTTONS */

$("addPointBtn").addEventListener("click",()=>{
  addPoint(
    Number($("pointX").value),
    Number($("pointY").value),
    $("pointLabel").value
  );
});

$("undoBtn").addEventListener("click",()=>{
  state.points.pop();

  if(state.points.length<3) {
    state.closed=false;
  }

  render();
  say("Undo সম্পন্ন।");
});

$("closeBtn").addEventListener("click",()=>{
  if(state.points.length<3) {
    say("কমপক্ষে ৩টি পয়েন্ট প্রয়োজন।");
    return;
  }

  state.closed=!state.closed;

  render();

  say(state.closed?"সীমানা বন্ধ":"সীমানা খোলা");
});

$("clearBtn").addEventListener("click",()=>{
  if(!confirm("সব পয়েন্ট মুছে ফেলবেন?")) return;

  state.points=[];
  state.closed=false;

  render();
});

$("gridBtn").addEventListener("click",()=>{
  state.showGrid=!state.showGrid;
  render();
});

$("labelsBtn").addEventListener("click",()=>{
  state.showLabels=!state.showLabels;
  render();
});

$("fitBtn").addEventListener("click",()=>{
  interactionTransform=null;
  render();
});

$("pointsBody").addEventListener("click",e=>{
  const btn=e.target.closest("[data-remove]");
  if(!btn) return;

  state.points.splice(Number(btn.dataset.remove),1);

  if(state.points.length<3) state.closed=false;

  render();
});

/* GPS */

function gpsToLocal(lat,lon) {

  if(!state.gpsOrigin) {
    state.gpsOrigin={lat,lon};
  }

  const o=state.gpsOrigin;
  const rad=Math.PI/180;

  return {
    x:(lon-o.lon)*111412.84*Math.cos(o.lat*rad),
    y:(lat-o.lat)*111132.92
  };
}

$("gpsBtn").addEventListener("click",()=>{

  if(!navigator.geolocation) {
    say("GPS পাওয়া যাচ্ছে না।");
    return;
  }

  navigator.geolocation.getCurrentPosition(pos=>{

    const lat=pos.coords.latitude;
    const lon=pos.coords.longitude;

    const xy=gpsToLocal(lat,lon);

    addPoint(
      xy.x,
      xy.y,
      "GPS-"+(state.points.length+1),
      lat,
      lon
    );

    say("GPS পয়েন্ট যোগ হয়েছে। নির্ভুলতা ±"+Math.round(pos.coords.accuracy)+" মিটার।");

  },err=>{
    say("GPS Error: "+err.message);
  },{
    enableHighAccuracy:true,
    timeout:20000
  });

});

/* SAVE / LOAD */

function projectData() {
  return {
    format:"RafiqDigitalSurveyCAD",
    version:1,
    points:state.points,
    closed:state.closed,
    gpsOrigin:state.gpsOrigin,
    meta:{
      name:$("projectName").value,
      mouza:$("mouza").value,
      dag:$("dag").value,
      khatian:$("khatian").value
    }
  };
}

$("saveBtn").addEventListener("click",()=>{
  localStorage.setItem(STORE_KEY,JSON.stringify(projectData()));
  say("প্রজেক্ট সেভ হয়েছে।");
});

$("exportJsonBtn").addEventListener("click",()=>{
  const blob=new Blob(
    [JSON.stringify(projectData(),null,2)],
    {type:"application/json"}
  );

  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="survey-backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("exportCsvBtn").addEventListener("click",()=>{
  const rows=[
    ["Point","Name","X","Y","Latitude","Longitude"],
    ...state.points.map((p,i)=>[
      i+1,p.label,p.x,p.y,p.lat??"",p.lon??""
    ])
  ];

  const csv="\uFEFF"+rows.map(r=>r.join(",")).join("\n");

  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="survey-points.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("exportDxfBtn").addEventListener("click",()=>{

  if(state.points.length<2) {
    say("DXF করতে অন্তত ২টি পয়েন্ট দিন।");
    return;
  }

  let d="0\nSECTION\n2\nENTITIES\n";

  d+=`0\nPOLYLINE\n8\nBOUNDARY\n66\n1\n70\n${state.closed?1:0}\n`;

  state.points.forEach(p=>{
    d+=`0\nVERTEX\n8\nBOUNDARY\n10\n${p.x}\n20\n${p.y}\n30\n0\n`;
  });

  d+="0\nSEQEND\n0\nENDSEC\n0\nEOF\n";

  const blob=new Blob([d],{type:"application/dxf"});
  const a=document.createElement("a");

  a.href=URL.createObjectURL(blob);
  a.download="survey.dxf";
  a.click();

  URL.revokeObjectURL(a.href);

  say("DXF ফাইল তৈরি হয়েছে।");
});

$("importJson").addEventListener("change",async e=>{

  const file=e.target.files[0];
  if(!file) return;

  try {
    const data=JSON.parse(await file.text());

    if(!Array.isArray(data.points)) {
      throw new Error("ভুল JSON ফাইল");
    }

    state.points=data.points;
    state.closed=Boolean(data.closed);
    state.gpsOrigin=data.gpsOrigin||null;

    render();
    say("প্রজেক্ট লোড হয়েছে।");

  } catch(err) {
    say("ফাইল খোলা যায়নি: "+err.message);
  }

  e.target.value="";
});

$("printBtn").addEventListener("click",()=>{
  window.print();
});

window.addEventListener("beforeunload",()=>{
  try {
    localStorage.setItem(STORE_KEY,JSON.stringify(projectData()));
  } catch {}
});

try {
  const saved=localStorage.getItem(STORE_KEY);

  if(saved) {
    const data=JSON.parse(saved);
    if(Array.isArray(data.points)) {
      state.points=data.points;
      state.closed=Boolean(data.closed);
      state.gpsOrigin=data.gpsOrigin||null;
    }
  }
} catch {}

render();

})();
