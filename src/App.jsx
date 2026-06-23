import { useState, useEffect, useRef } from "react";

var SUPABASE_URL = "https://cejntyfhzpyauajtazhd.supabase.co";
var SUPABASE_KEY = "sb_publishable_kqmDASNEn4gPvKEpod70IA_wCJpb6AJ";
var FORMSPREE_ID = "mnjygwlq";

async function sbFetch(path, opts) {
  opts = opts || {};
  var res = await fetch(SUPABASE_URL + "/rest/v1/" + path, Object.assign({}, opts, {
    headers: Object.assign({
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "return=representation"
    }, opts.headers || {})
  }));
  if (!res.ok) throw new Error("Supabase " + res.status);
  var t = await res.text();
  return t ? JSON.parse(t) : null;
}

async function ladeAnbieter() {
  var anbieter = await sbFetch("anbieter?freigegeben=eq.true&select=*");
  var ereignisse = await sbFetch("ereignisse?select=*,anmeldungen(count)");
  return (anbieter || []).map(function(a) {
    return Object.assign({}, a, {
      kalender: (ereignisse || [])
        .filter(function(e) { return e.anbieter_id === a.id && !e.abgesagt; })
        .map(function(e) {
          return Object.assign({}, e, {
            stornoFristTage: e.storno_frist_tage,
            stornoGebuehr: e.storno_gebuehr,
            mindestAnmeldungen: e.mindest_anmeldungen,
            anmeldungen: (e.anmeldungen && e.anmeldungen[0]) ? e.anmeldungen[0].count : 0
          });
        })
    });
  });
}

async function sendeAnbieterVorschlag(form) {
  return sbFetch("anbieter", {
    method: "POST", prefer: "return=minimal",
    body: JSON.stringify({
      name: form.name, typ: form.typ, ort: form.ort, adresse: form.adresse,
      angebot: form.angebot, tage: form.tage, von: form.von, bis: form.bis,
      telefon: form.telefon, email: form.email, beschreibung: form.beschreibung,
      freigegeben: false
    })
  });
}

async function sendeAnmeldung(ereignisId, form) {
  return sbFetch("anmeldungen", {
    method: "POST", prefer: "return=minimal",
    body: JSON.stringify({
      ereignis_id: ereignisId, name: form.name, email: form.email,
      telefon: form.telefon || null, personen: parseInt(form.personen) || 1,
      nachricht: form.nachricht || null
    })
  });
}

async function sendeStornierung(ereignisId, email) {
  var rows = await sbFetch("anmeldungen?ereignis_id=eq." + ereignisId + "&email=eq." + encodeURIComponent(email) + "&storniert=eq.false");
  if (!rows || !rows.length) throw new Error("Keine Anmeldung");
  return sbFetch("anmeldungen?id=eq." + rows[0].id, {
    method: "PATCH", prefer: "return=minimal",
    body: JSON.stringify({ storniert: true, storno_datum: new Date().toISOString() })
  });
}

async function sendeEreignisAbsage(ereignisId) {
  return sbFetch("ereignisse?id=eq." + ereignisId, {
    method: "PATCH", prefer: "return=minimal",
    body: JSON.stringify({ abgesagt: true })
  });
}

async function ladeBewertungen(anbieterId) {
  return sbFetch("bewertungen?anbieter_id=eq." + anbieterId + "&select=*&order=erstellt_am.desc");
}

async function sendeBewertung(anbieterId, sterne, text) {
  return sbFetch("bewertungen", {
    method: "POST", prefer: "return=minimal",
    body: JSON.stringify({ anbieter_id: anbieterId, sterne: sterne, text: text })
  });
}

var TYPEN = [
  { id: "wochenmarkt", label: "Wochenmarktstand", icon: "🏪" },
  { id: "hofladen", label: "Hofladen / Bauernhof", icon: "🚜" },
  { id: "selbsternte", label: "Selbsternte", icon: "🧺" },
  { id: "automat", label: "Hof-Automat", icon: "🤖" },
  { id: "gaertnerei", label: "Gaertnerei / Blumen", icon: "🌸" },
  { id: "direktvermarkter", label: "Direktvermarkter", icon: "🍯" }
];

var TAGE = ["Mo","Di","Mi","Do","Fr","Sa","So"];

var FARBEN = {
  wochenmarkt: "#e63946", hofladen: "#e76f51", selbsternte: "#457b9d",
  automat: "#6d4c41", gaertnerei: "#b5838d", direktvermarkter: "#e9a820"
};

var PRODUKTE = [
  { id: "", label: "Alle", icon: "🌿", kw: [] },
  { id: "eier", label: "Eier", icon: "🥚", kw: ["ei","eier"] },
  { id: "gemuese", label: "Gemuese", icon: "🥦", kw: ["gemuese","kartoffel","moehre","tomate","zucchini","kuerbis"] },
  { id: "obst", label: "Obst", icon: "🍎", kw: ["obst","apfel","erdbeere","kirsche","beere"] },
  { id: "milch", label: "Milch & Kaese", icon: "🧀", kw: ["milch","kaese","butter","joghurt"] },
  { id: "fleisch", label: "Fleisch", icon: "🥩", kw: ["fleisch","wurst","schwein","rind","lamm"] },
  { id: "honig", label: "Honig", icon: "🍯", kw: ["honig","pollen","imker"] },
  { id: "brot", label: "Brot", icon: "🍞", kw: ["brot","broetchen","kuchen","back"] },
  { id: "blumen", label: "Blumen", icon: "💐", kw: ["blume","pflanze","gaertnerei"] }
];

var SAISON = [
  { m:1, p:["Lagergemuese","Kohl","Aepfel","Kartoffeln"] },
  { m:2, p:["Lagergemuese","Kohl","Feldsalat"] },
  { m:3, p:["Spinat","Rhabarber","Radieschen","Spargel"] },
  { m:4, p:["Spargel","Rhabarber","Spinat","Radieschen"] },
  { m:5, p:["Spargel","Erdbeeren","Salat","Kohlrabi"] },
  { m:6, p:["Erdbeeren","Kirschen","Erbsen","Zucchini","Blumenkohl"] },
  { m:7, p:["Tomaten","Zucchini","Gurken","Himbeeren","Heidelbeeren"] },
  { m:8, p:["Tomaten","Mais","Pflaume","Paprika","Sonnenblumen","Kuerbis"] },
  { m:9, p:["Aepfel","Birnen","Kuerbis","Kartoffeln","Trauben"] },
  { m:10, p:["Aepfel","Kuerbis","Kartoffeln","Rote Bete","Nuesse"] },
  { m:11, p:["Kohl","Lagergemuese","Feldsalat","Aepfel"] },
  { m:12, p:["Kohl","Feldsalat","Lagergemuese","Kartoffeln"] }
];

var MONATE = ["Januar","Februar","Maerz","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

var ORTE = [
  { name:"Bergisch Gladbach", al:["bergisch gladbach","gladbach"], plz:["51427","51429","51465","51467","51469"], lat:51.002, lng:7.130 },
  { name:"Overath", al:["overath"], plz:["51491"], lat:50.988, lng:7.271 },
  { name:"Roesrath", al:["rösrath","roesrath"], plz:["51503"], lat:50.905, lng:7.185 },
  { name:"Kuerten", al:["kürten","kuerten"], plz:["51515"], lat:51.050, lng:7.248 },
  { name:"Odenthal", al:["odenthal"], plz:["51519"], lat:51.033, lng:7.117 },
  { name:"Wermelskirchen", al:["wermelskirchen"], plz:["42929"], lat:51.145, lng:7.213 },
  { name:"Leverkusen", al:["leverkusen"], plz:["51373","51375","51377","51379","51381"], lat:51.045, lng:7.003 },
  { name:"Koeln", al:["köln","koeln","cologne"], plz:["50667","50668","50670","50672","50674"], lat:50.938, lng:6.960 },
  { name:"Bonn", al:["bonn"], plz:["53111","53113","53115"], lat:50.733, lng:7.100 },
  { name:"Solingen", al:["solingen"], plz:["42651","42653","42655"], lat:51.178, lng:7.084 },
  { name:"Remscheid", al:["remscheid"], plz:["42853","42855"], lat:51.179, lng:7.189 },
  { name:"Wuppertal", al:["wuppertal"], plz:["42103","42105","42107"], lat:51.257, lng:7.150 }
];

var BEISPIEL = [
  { id:1, name:"Hof Mueller", typ:"hofladen", ort:"Bergisch Gladbach", adresse:"Hauptstr. 12",
    angebot:"Gemuese, Kartoffeln, Eier", produkte:["gemuese","eier"], tage:["Di","Do","Sa"],
    von:"08:00", bis:"18:00", beschreibung:"Frisches Gemuese aus eigenem Anbau seit 1978.",
    lat:51.002, lng:7.132, telefon:"02202 123456", email:"hof@example.de",
    story:"Familie Mueller bewirtschaftet den Hof seit drei Generationen. Was 1953 als kleiner Gemuese-Garten begann, ist heute ein 12-Hektar-Betrieb.",
    wiederholend:false,
    kalender:[
      { id:1, typ:"ernte", titel:"Kartoffelernte", datum:"2026-08-15",
        beschreibung:"Kartoffeln selbst ernten!", plaetze:20, anmeldungen:7,
        stornoFristTage:5, stornoGebuehr:8, mindestAnmeldungen:10 }
    ]
  },
  { id:2, name:"Familie Schreiber", typ:"selbsternte", ort:"Overath", adresse:"Feldweg 3",
    angebot:"Erdbeeren, Kuerbisse", produkte:["obst","gemuese"], tage:["Sa","So"],
    von:"09:00", bis:"17:00", beschreibung:"Selbstpfluecken fuer die ganze Familie!",
    lat:50.988, lng:7.271, telefon:"02204 987654", email:"schreiber@example.de",
    story:"Seit 2008 oeffnen wir unsere Felder fuer Menschen die wissen moechten woher ihr Essen kommt.",
    wiederholend:true, wiederholungsMonate:[5,6,8,10], wiederholungsTitel:"Saisonale Selbsternte",
    kalender:[
      { id:3, typ:"pflück", titel:"Erdbeer-Saison", datum:"2026-06-20",
        beschreibung:"Erdbeeren selbstpfluecken!", plaetze:null, anmeldungen:12,
        stornoFristTage:2, stornoGebuehr:0, mindestAnmeldungen:null }
    ]
  },
  { id:3, name:"Wochenmarkt Bensberg", typ:"wochenmarkt", ort:"Bergisch Gladbach", adresse:"Marktplatz",
    angebot:"Kaese, Obst, Gemuese, Brot", produkte:["milch","obst","gemuese","brot"],
    tage:["Mi","Sa"], von:"07:00", bis:"13:00", beschreibung:"Traditioneller Wochenmarkt.",
    lat:51.013, lng:7.155, telefon:"", email:"", story:"", wiederholend:false, kalender:[] },
  { id:4, name:"Imkerei Waldbluete", typ:"direktvermarkter", ort:"Roesrath", adresse:"Waldstrasse 7",
    angebot:"Honig, Wachsprodukte, Pollen", produkte:["honig"], tage:["Sa"],
    von:"10:00", bis:"16:00", beschreibung:"Natuerlicher Honig aus dem Bergischen Land.",
    lat:50.905, lng:7.185, telefon:"02205 456789", email:"waldbluete@example.de",
    story:"Unsere 40 Voelker fliegen durch die Waelder und Wiesen des Bergischen Landes.",
    wiederholend:false,
    kalender:[
      { id:5, typ:"ernte", titel:"Honigschleuder-Tag", datum:"2026-07-12",
        beschreibung:"Zuschau beim Honig schleudern.", plaetze:10, anmeldungen:4,
        stornoFristTage:7, stornoGebuehr:10, mindestAnmeldungen:6 }
    ]
  },
  { id:5, name:"Milchautomat Gut Steinberg", typ:"automat", ort:"Bergisch Gladbach", adresse:"Steinbergweg 2",
    angebot:"Frischmilch, Joghurt, Butter", produkte:["milch"],
    tage:["Mo","Di","Mi","Do","Fr","Sa","So"], von:"00:00", bis:"23:59",
    beschreibung:"24h Milchautomat direkt am Hof.",
    lat:51.026, lng:7.098, telefon:"", email:"", story:"", wiederholend:false, kalender:[] },
  { id:6, name:"Gaertnerei Rosenduft", typ:"gaertnerei", ort:"Kuerten", adresse:"Blumenweg 5",
    angebot:"Saisonblumen, Kraeuter, Gemuesepflanzen", produkte:["blumen","gemuese"],
    tage:["Di","Mi","Do","Fr","Sa"], von:"09:00", bis:"17:00", beschreibung:"Bunte Vielfalt.",
    lat:51.050, lng:7.248, telefon:"02207 333444", email:"rosenduft@example.de",
    story:"", wiederholend:true, wiederholungsMonate:[4,5,9,10], wiederholungsTitel:"Saisonale Pflanz-Aktionen",
    kalender:[
      { id:6, typ:"pflück", titel:"Tulpen-Pfluecksaison", datum:"2026-04-20",
        beschreibung:"Tulpen selbst pfluecken!", plaetze:null, anmeldungen:18,
        stornoFristTage:2, stornoGebuehr:0, mindestAnmeldungen:null }
    ]
  },
  { id:7, name:"Fleischerei Bergmann", typ:"direktvermarkter", ort:"Wermelskirchen", adresse:"Dorfstr. 22",
    angebot:"Rind, Schwein, Lamm, Wurst", produkte:["fleisch"],
    tage:["Di","Fr","Sa"], von:"08:00", bis:"17:00",
    beschreibung:"Direkt vom eigenen Hof, artgerecht gehalten.",
    lat:51.145, lng:7.213, telefon:"02196 111222", email:"bergmann@example.de",
    story:"Unsere Tiere wachsen auf der Weide auf. Wenn wir schlachten, dann mit Respekt.",
    wiederholend:false,
    kalender:[
      { id:7, typ:"schlacht", titel:"Lamm-Schlachtung", datum:"2026-09-05",
        beschreibung:"Vorbestellung fuer frisches Lammfleisch.", plaetze:8, anmeldungen:2,
        stornoFristTage:14, stornoGebuehr:25, mindestAnmeldungen:6 }
    ]
  }
];

function distKm(la1,ln1,la2,ln2) {
  var R=6371, dL=(la2-la1)*Math.PI/180, dN=(ln2-ln1)*Math.PI/180;
  var a=Math.sin(dL/2)*Math.sin(dL/2)+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dN/2)*Math.sin(dN/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function produktMatch(a, pid) {
  if (!pid) return true;
  var kat = PRODUKTE.find(function(k) { return k.id === pid; });
  if (!kat) return true;
  if (a.produkte && a.produkte.indexOf(pid) >= 0) return true;
  var txt = ((a.angebot||"") + " " + (a.beschreibung||"")).toLowerCase();
  return kat.kw.some(function(kw) { return txt.indexOf(kw) >= 0; });
}

function sucheOrt(q, anbieter) {
  var s = q.trim().toLowerCase().replace(/,?\s*(deutschland|germany|nrw|de)\s*/gi,"").trim();
  if (!s) return null;
  var pm = s.match(/\b(\d{5})\b/);
  if (pm) {
    for (var i=0;i<ORTE.length;i++) {
      if (ORTE[i].plz.indexOf(pm[1])>=0) return ORTE[i];
    }
  }
  for (var i=0;i<ORTE.length;i++) {
    var o=ORTE[i];
    if (o.al.some(function(al){return al===s||s.indexOf(al)>=0||al.indexOf(s)>=0;})) return o;
  }
  var ab = (anbieter||[]).find(function(a){return a.ort.toLowerCase().indexOf(s)>=0;});
  if (ab) return {name:ab.ort, lat:ab.lat, lng:ab.lng};
  return null;
}

function teileAnbieter(a) {
  var text = a.name + " in " + a.ort + " auf RegioMap!\n" + (a.angebot||"");
  if (navigator.share) {
    navigator.share({title:a.name, text:text}).catch(function(){});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function(){alert("Kopiert!");});
  }
}

/* ─── Karte ─── */
function Karte(props) {
  var anbieter=props.anbieter, onSelect=props.onSelect, zentrum=props.zentrum, radius=props.radius;
  var [pan,setPan]=useState({x:0,y:0});
  var [zoom,setZoom]=useState(1);
  var [ready,setReady]=useState(false);
  var dragging=useRef(false), dragStart=useRef(null), lastPinch=useRef(null);
  var W=400, H=320;

  useEffect(function(){
    var t=setTimeout(function(){setReady(true);},80);
    return function(){clearTimeout(t);};
  },[]);

  var all = anbieter.concat(zentrum?[{lat:zentrum.lat,lng:zentrum.lng}]:[]);
  var lats = all.length ? all.map(function(a){return a.lat;}) : [50.8,51.2];
  var lngs = all.length ? all.map(function(a){return a.lng;}) : [6.8,7.5];
  var pad=0.06;
  var minLat=Math.min.apply(null,lats)-pad, maxLat=Math.max.apply(null,lats)+pad;
  var minLng=Math.min.apply(null,lngs)-pad, maxLng=Math.max.apply(null,lngs)+pad;

  function toXY(lat,lng) {
    return {
      x:((lng-minLng)/(maxLng-minLng))*W*zoom+pan.x,
      y:(H-((lat-minLat)/(maxLat-minLat))*H)*zoom+pan.y
    };
  }

  function onTouchStart(e) {
    if(e.touches.length===1){dragging.current=true;dragStart.current={x:e.touches[0].clientX-pan.x,y:e.touches[0].clientY-pan.y};}
    else if(e.touches.length===2){var dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;lastPinch.current=Math.sqrt(dx*dx+dy*dy);}
  }
  function onTouchMove(e) {
    e.preventDefault();
    if(e.touches.length===1&&dragging.current){setPan({x:e.touches[0].clientX-dragStart.current.x,y:e.touches[0].clientY-dragStart.current.y});}
    else if(e.touches.length===2&&lastPinch.current){var dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY,d=Math.sqrt(dx*dx+dy*dy);setZoom(function(z){return Math.max(0.5,Math.min(5,z*d/lastPinch.current));});lastPinch.current=d;}
  }
  function onTouchEnd(){dragging.current=false;lastPinch.current=null;}

  var rc = null;
  if (zentrum && radius) {
    var cp = toXY(zentrum.lat,zentrum.lng);
    var pxKm = (H/(maxLat-minLat)/111)*zoom;
    rc = {cx:cp.x, cy:cp.y, r:radius*pxKm};
  }

  if (!ready) return (
    <div style={{height:H,display:"flex",alignItems:"center",justifyContent:"center",background:"#e8f0e0",flexDirection:"column",gap:8,color:"#5a8a5a"}}>
      <div style={{fontSize:28}}>{"🗺️"}</div>
      <div style={{fontSize:13}}>{"Karte wird aufgebaut..."}</div>
    </div>
  );

  return (
    <div style={{position:"relative",overflow:"hidden",background:"#dde8cc",touchAction:"none",height:H,width:"100%"}}
      onMouseDown={function(e){dragging.current=true;dragStart.current={x:e.clientX-pan.x,y:e.clientY-pan.y};}}
      onMouseMove={function(e){if(!dragging.current)return;setPan({x:e.clientX-dragStart.current.x,y:e.clientY-dragStart.current.y});}}
      onMouseUp={function(){dragging.current=false;}}
      onMouseLeave={function(){dragging.current=false;}}
      onWheel={function(e){e.preventDefault();setZoom(function(z){return Math.max(0.5,Math.min(5,z*(e.deltaY<0?1.15:0.87)));});}}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <svg width="100%" height={H} viewBox={"0 0 "+W+" "+H} style={{display:"block",width:"100%",height:"100%"}}>
        <rect x="0" y="0" width={W} height={H} fill="#dde8cc"/>
        <line x1={W*0.25} y1={0} x2={W*0.25} y2={H} stroke="#c0d4a0" strokeWidth="0.5"/>
        <line x1={W*0.5}  y1={0} x2={W*0.5}  y2={H} stroke="#c0d4a0" strokeWidth="0.5"/>
        <line x1={W*0.75} y1={0} x2={W*0.75} y2={H} stroke="#c0d4a0" strokeWidth="0.5"/>
        <line x1={0} y1={H*0.25} x2={W} y2={H*0.25} stroke="#c0d4a0" strokeWidth="0.5"/>
        <line x1={0} y1={H*0.5}  x2={W} y2={H*0.5}  stroke="#c0d4a0" strokeWidth="0.5"/>
        <line x1={0} y1={H*0.75} x2={W} y2={H*0.75} stroke="#c0d4a0" strokeWidth="0.5"/>
        {rc && <circle cx={rc.cx} cy={rc.cy} r={rc.r} fill="rgba(45,106,79,0.07)" stroke="#2d6a4f" strokeWidth="1.5" strokeDasharray="6,4"/>}
        {zentrum && (function(){var p=toXY(zentrum.lat,zentrum.lng);return(
          <g>
            <circle cx={p.x} cy={p.y} r={12} fill="#2d6a4f" stroke="white" strokeWidth="2.5"/>
            <text x={p.x} y={p.y+5} textAnchor="middle" fontSize="11" fill="white">{"+"}</text>
          </g>
        );}())}
        {anbieter.map(function(a) {
          var typ=TYPEN.find(function(t){return t.id===a.typ;});
          var farbe=FARBEN[a.typ]||"#2d6a4f";
          var p=toXY(a.lat,a.lng);
          var hasKal=a.kalender&&a.kalender.length>0;
          return (
            <g key={a.id} style={{cursor:"pointer"}} onClick={function(){onSelect(a);}}>
              <circle cx={p.x} cy={p.y} r={20} fill={farbe} stroke="white" strokeWidth="2.5" opacity="0.93"/>
              <text x={p.x} y={p.y+6} textAnchor="middle" fontSize="16">{typ?typ.icon:"📍"}</text>
              {hasKal && <circle cx={p.x+13} cy={p.y-13} r={7} fill="#e63946" stroke="white" strokeWidth="1.5"/>}
            </g>
          );
        })}
        {anbieter.length===0 && (
          <g>
            <text x={W/2} y={H/2-10} textAnchor="middle" fontSize="24">{"🌾"}</text>
            <text x={W/2} y={H/2+16} textAnchor="middle" fontSize="12" fill="#6a8a6a">{"Keine Anbieter"}</text>
          </g>
        )}
      </svg>
      <div style={{position:"absolute",bottom:8,right:8,display:"flex",flexDirection:"column",gap:4}}>
        <button onClick={function(){setZoom(function(z){return Math.min(5,z*1.3);});}} style={{width:36,height:36,borderRadius:8,border:"none",background:"white",fontSize:18,cursor:"pointer",fontWeight:700}}>{"+"}</button>
        <button onClick={function(){setZoom(function(z){return Math.max(0.5,z*0.77);});}} style={{width:36,height:36,borderRadius:8,border:"none",background:"white",fontSize:18,cursor:"pointer",fontWeight:700}}>{"-"}</button>
        <button onClick={function(){setZoom(1);setPan({x:0,y:0});}} style={{width:36,height:36,borderRadius:8,border:"none",background:"white",fontSize:13,cursor:"pointer"}}>{"o"}</button>
      </div>
    </div>
  );
}

/* ─── Sterne ─── */
function Sterne(props) {
  var wert=props.wert||0, onChange=props.onChange, readonly=props.readonly, gross=props.gross;
  var s=gross?28:18;
  return (
    <div style={{display:"flex",gap:2}}>
      {[1,2,3,4,5].map(function(i) {
        return (
          <span key={i}
            onClick={function(){if(!readonly&&onChange)onChange(i);}}
            style={{fontSize:s,cursor:readonly?"default":"pointer",color:i<=wert?"#f4a020":"#ddd",lineHeight:1}}>
            {"★"}
          </span>
        );
      })}
    </div>
  );
}

/* ─── Bewertungs-Sheet ─── */
function BewertungsSheet(props) {
  var anbieter=props.anbieter, onClose=props.onClose;
  var [sterne,setSterne]=useState(0);
  var [text,setText]=useState("");
  var [status,setStatus]=useState(null);
  var [liste,setListe]=useState([]);
  var [laden,setLaden]=useState(true);

  useEffect(function(){
    ladeBewertungen(anbieter.id)
      .then(function(d){setListe(d||[]);setLaden(false);})
      .catch(function(){setListe([]);setLaden(false);});
  },[anbieter.id]);

  function submit() {
    if(!sterne)return;
    setStatus("sending");
    sendeBewertung(anbieter.id,sterne,text)
      .then(function(){setStatus("ok");})
      .catch(function(){setStatus("error");});
  }

  var avg=liste.length?Math.round(liste.reduce(function(s,b){return s+b.sterne;},0)/liste.length*10)/10:0;

  return (
    <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"20px 20px 0 0",boxShadow:"0 -4px 30px rgba(0,0,0,.18)",maxHeight:"85vh",overflowY:"auto"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{padding:"12px 0 4px",display:"flex",justifyContent:"center"}}><div style={{width:40,height:4,borderRadius:2,background:"#ddd"}}/></div>
        <div style={{padding:"0 20px 40px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:18,fontWeight:700}}>{"Bewertungen"}</div>
            {avg>0 && (
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <Sterne wert={Math.round(avg)} readonly={true}/>
                <span style={{fontSize:14,fontWeight:700,color:"#f4a020"}}>{avg}</span>
                <span style={{fontSize:12,color:"#999"}}>{"("+liste.length+")"}</span>
              </div>
            )}
          </div>
          {status!=="ok" && (
            <div style={{background:"#f8f8f5",borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>{"Deine Bewertung"}</div>
              <Sterne wert={sterne} onChange={setSterne} gross={true}/>
              <textarea placeholder="Erfahrungsbericht (optional)..." value={text} onChange={function(e){setText(e.target.value);}}
                rows={3} style={{width:"100%",marginTop:12,padding:12,borderRadius:12,border:"1px solid #e0ddd4",fontSize:14,outline:"none",resize:"none",boxSizing:"border-box"}}/>
              {status==="error" && <div style={{fontSize:12,color:"#c62828",marginTop:6}}>{"Fehler beim Senden."}</div>}
              <button onClick={submit} disabled={!sterne||status==="sending"}
                style={{width:"100%",marginTop:10,padding:13,borderRadius:12,border:"none",background:sterne?"#2d6a4f":"#ccc",color:"white",fontWeight:700,fontSize:15,cursor:"pointer"}}>
                {status==="sending"?"Wird gesendet...":"Bewertung abschicken"}
              </button>
            </div>
          )}
          {status==="ok" && <div style={{background:"#e8f5e9",borderRadius:12,padding:14,marginBottom:16,textAlign:"center",color:"#2d6a4f",fontWeight:600}}>{"Danke fuer deine Bewertung!"}</div>}
          {laden ? <div style={{textAlign:"center",padding:20,color:"#999"}}>{"Laedt..."}</div>
            : liste.length===0 ? <div style={{textAlign:"center",padding:20,color:"#999",fontSize:13}}>{"Noch keine Bewertungen."}</div>
            : liste.map(function(b,i) {
              return (
                <div key={i} style={{background:"#f8f8f5",borderRadius:12,padding:"12px 14px",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <Sterne wert={b.sterne} readonly={true}/>
                    <span style={{fontSize:11,color:"#bbb"}}>{new Date(b.erstellt_am).toLocaleDateString("de-DE")}</span>
                  </div>
                  {b.text && <div style={{fontSize:13,color:"#444",lineHeight:1.5}}>{b.text}</div>}
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}

/* ─── Saison-Sheet ─── */
function SaisonSheet(props) {
  var onClose=props.onClose;
  var monat=new Date().getMonth()+1;
  var [sel,setSel]=useState(monat);
  var saison=SAISON.find(function(s){return s.m===sel;})||{p:[]};
  return (
    <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"20px 20px 0 0",boxShadow:"0 -4px 30px rgba(0,0,0,.18)",maxHeight:"85vh",overflowY:"auto"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{padding:"12px 0 4px",display:"flex",justifyContent:"center"}}><div style={{width:40,height:4,borderRadius:2,background:"#ddd"}}/></div>
        <div style={{padding:"0 20px 36px"}}>
          <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>{"🌱 Saisonkalender"}</div>
          <div style={{fontSize:13,color:"#888",marginBottom:16}}>{"Was hat gerade Saison?"}</div>
          <div style={{overflowX:"auto",display:"flex",gap:8,marginBottom:20,paddingBottom:4}}>
            {MONATE.map(function(name,i) {
              return (
                <button key={i} onClick={function(){setSel(i+1);}}
                  style={{flexShrink:0,padding:"8px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
                    background:sel===i+1?"#2d6a4f":"#f0efe8",color:sel===i+1?"white":"#555"}}>
                  {name.slice(0,3)}
                </button>
              );
            })}
          </div>
          <div style={{fontSize:16,fontWeight:700,color:"#2d6a4f",marginBottom:14}}>{MONATE[sel-1]}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {saison.p.map(function(p,i) {
              return (
                <div key={i} style={{background:"#f0f7f0",borderRadius:12,padding:"10px 16px",fontSize:14,color:"#2d4a1e",fontWeight:500}}>
                  {"🌿 "+p}
                </div>
              );
            })}
          </div>
          {sel===monat && (
            <div style={{marginTop:16,background:"#e8f5e9",borderRadius:12,padding:"10px 14px",fontSize:12,color:"#2d6a4f"}}>
              {"Aktueller Monat - jetzt frisch erhaeltlich!"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Storno-Info ─── */
function StornoInfo(props) {
  var ereignis=props.ereignis;
  var tageBis=Math.ceil((new Date(ereignis.datum)-new Date())/(1000*60*60*24));
  var frist=ereignis.stornoFristTage||0, gebuehr=ereignis.stornoGebuehr||0;
  if(!frist&&!gebuehr) return null;
  var kostenlos=tageBis>frist;
  return (
    <div style={{background:kostenlos?"#e8f5e9":"#fff3e0",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:kostenlos?"#2d6a4f":"#e65100",marginBottom:4}}>
        {kostenlos?"Kostenlose Stornierung moeglich":"Stornierungsfrist abgelaufen"}
      </div>
      <div style={{fontSize:12,color:"#555",lineHeight:1.5}}>
        {"Kostenlos bis "+frist+" Tage vorher (noch "+tageBis+" Tage)."+(gebuehr>0?" Danach: "+gebuehr+"EUR.":"")}
      </div>
    </div>
  );
}

/* ─── Erzeuger-Absage ─── */
function ErzeugerAbsageButton(props) {
  var ereignis=props.ereignis, anbieter=props.anbieter;
  var [status,setStatus]=useState(null);
  var [confirm,setConfirm]=useState(false);

  function sendAbsage() {
    setStatus("sending");
    sendeEreignisAbsage(ereignis.id)
      .then(function(){setStatus("ok");setConfirm(false);})
      .catch(function(){setStatus("error");});
  }

  if(status==="ok") return (
    <div style={{marginTop:8,background:"#e8f5e9",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#2d6a4f",textAlign:"center"}}>
      {"Absage versendet."}
    </div>
  );
  return (
    <div style={{marginTop:8}}>
      {!confirm
        ? <button onClick={function(){setConfirm(true);}} style={{width:"100%",padding:10,borderRadius:12,border:"1px solid #e63946",background:"#fdecea",color:"#c62828",fontWeight:600,fontSize:13,cursor:"pointer"}}>
            {"Termin absagen ("+ereignis.anmeldungen+"/"+(ereignis.mindestAnmeldungen||"?")+" Anmeldungen)"}
          </button>
        : <div style={{background:"#fdecea",borderRadius:12,padding:12,border:"1px solid #e63946"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#c62828",marginBottom:6}}>{"Wirklich absagen?"}</div>
            <div style={{fontSize:12,color:"#555",marginBottom:10}}>{"Alle "+ereignis.anmeldungen+" Teilnehmer werden informiert."}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={function(){setConfirm(false);}} style={{flex:1,padding:10,borderRadius:10,border:"none",background:"#f0efe8",color:"#666",fontWeight:600,fontSize:13,cursor:"pointer"}}>{"Abbrechen"}</button>
              <button onClick={sendAbsage} disabled={status==="sending"} style={{flex:1,padding:10,borderRadius:10,border:"none",background:"#e63946",color:"white",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                {status==="sending"?"Sendet...":"Ja, absagen"}
              </button>
            </div>
          </div>
      }
    </div>
  );
}

/* ─── Anmelde-Sheet ─── */
function AnmeldeSheet(props) {
  var ereignis=props.ereignis, anbieter=props.anbieter, onClose=props.onClose;
  var [form,setForm]=useState({name:"",email:"",telefon:"",nachricht:"",personen:"1"});
  var [status,setStatus]=useState(null);
  var [showStorno,setShowStorno]=useState(false);
  var [stornoEmail,setStornoEmail]=useState("");
  var [stornoStatus,setStornoStatus]=useState(null);

  var tageBis=Math.ceil((new Date(ereignis.datum)-new Date())/(1000*60*60*24));
  var frist=ereignis.stornoFristTage||0, gebuehr=ereignis.stornoGebuehr||0;
  var stornoKostenlos=tageBis>frist;
  var datum=new Date(ereignis.datum).toLocaleDateString("de-DE",{day:"numeric",month:"long",year:"numeric"});
  var typIcons={ernte:"🌾","pflück":"🌿",schlacht:"🥩"};

  function submit() {
    if(!form.name||!form.email)return;
    setStatus("sending");
    sendeAnmeldung(ereignis.id,form)
      .then(function(){setStatus("ok");})
      .catch(function(){setStatus("error");});
  }

  function submitStorno() {
    if(!stornoEmail)return;
    setStornoStatus("sending");
    sendeStornierung(ereignis.id,stornoEmail)
      .then(function(){setStornoStatus("ok");})
      .catch(function(){setStornoStatus("error");});
  }

  var iS={width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid #e0ddd4",fontSize:15,outline:"none",background:"#faf9f5",boxSizing:"border-box"};

  return (
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"20px 20px 0 0",boxShadow:"0 -4px 30px rgba(0,0,0,.2)",maxHeight:"92vh",overflowY:"auto"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{padding:"12px 0 4px",display:"flex",justifyContent:"center"}}><div style={{width:40,height:4,borderRadius:2,background:"#ddd"}}/></div>
        <div style={{padding:"0 20px 40px"}}>
          <div style={{display:"flex",gap:0,background:"#f0efe8",borderRadius:12,padding:4,marginBottom:18}}>
            <button onClick={function(){setShowStorno(false);}} style={{flex:1,padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:!showStorno?"white":"transparent",color:!showStorno?"#1a1a1a":"#888",boxShadow:!showStorno?"0 1px 4px rgba(0,0,0,.1)":"none"}}>{"Anmelden"}</button>
            <button onClick={function(){setShowStorno(true);}} style={{flex:1,padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:showStorno?"white":"transparent",color:showStorno?"#1a1a1a":"#888",boxShadow:showStorno?"0 1px 4px rgba(0,0,0,.1)":"none"}}>{"Abmelden"}</button>
          </div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>{(typIcons[ereignis.typ]||"📅")+" "+ereignis.titel}</div>
          <div style={{fontSize:13,color:"#666",marginBottom:4}}>{"📅 "+datum}</div>
          <div style={{fontSize:13,color:"#555",marginBottom:14}}>{"📍 "+anbieter.name+", "+anbieter.ort}</div>
          <StornoInfo ereignis={ereignis}/>
          {ereignis.mindestAnmeldungen && (
            <div style={{background:"#f3e8ff",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#6a0dad"}}>
              {"Mindestteilnahme: "+ereignis.mindestAnmeldungen+" Personen."}
            </div>
          )}
          {ereignis.typ==="schlacht"&&!showStorno&&status!=="ok" && (
            <div style={{background:"linear-gradient(135deg,#3d2b1f,#5a3e2b)",borderRadius:14,padding:16,marginBottom:16,color:"white"}}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>{"Ein Wort bevor du dich anmeldest"}</div>
              <div style={{fontSize:13,lineHeight:1.7,opacity:.92}}>{"Hinter diesem Termin steht ein echtes Tier, das eigens fuer diese Bestellung sein Leben gibt."}</div>
              <div style={{fontSize:13,lineHeight:1.7,marginTop:8,opacity:.92}}>{"Bitte melde dich nur an, wenn du sicher weisst, dass du erscheinst und das Fleisch abnimmst."}</div>
              <div style={{marginTop:12,padding:"10px 12px",background:"rgba(255,255,255,0.1)",borderRadius:10,fontSize:12,color:"#f5d08a",lineHeight:1.5}}>{"Direktvermarktung funktioniert nur wenn wir als Konsumenten zu unserem Wort stehen."}</div>
            </div>
          )}
          {!showStorno && (status==="ok"
            ? <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:44}}>{"✅"}</div>
                <div style={{fontSize:17,fontWeight:700,marginTop:10,color:"#2d6a4f"}}>{"Anmeldung gesendet!"}</div>
                <button onClick={onClose} style={{marginTop:16,padding:"12px 32px",borderRadius:24,border:"none",background:"#2d6a4f",color:"white",fontWeight:700,fontSize:15,cursor:"pointer"}}>{"Schliessen"}</button>
              </div>
            : <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {ereignis.plaetze && <div style={{background:"#fff8e8",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#e65100"}}>{"Noch "+(ereignis.plaetze-ereignis.anmeldungen)+" von "+ereignis.plaetze+" Plaetzen frei"}</div>}
                <input placeholder="Dein Name *" value={form.name} onChange={function(e){setForm(function(f){return Object.assign({},f,{name:e.target.value});});}} style={iS}/>
                <input placeholder="E-Mail *" type="email" value={form.email} onChange={function(e){setForm(function(f){return Object.assign({},f,{email:e.target.value});});}} style={iS}/>
                <input placeholder="Telefon (optional)" type="tel" value={form.telefon} onChange={function(e){setForm(function(f){return Object.assign({},f,{telefon:e.target.value});});}} style={iS}/>
                <div>
                  <div style={{fontSize:12,color:"#999",marginBottom:6,fontWeight:600}}>{"PERSONEN"}</div>
                  <div style={{display:"flex",gap:8}}>
                    {["1","2","3","4","5+"].map(function(n) {
                      return <button key={n} onClick={function(){setForm(function(f){return Object.assign({},f,{personen:n});});}} style={{flex:1,padding:"12px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:15,background:form.personen===n?"#2d6a4f":"#f0efe8",color:form.personen===n?"white":"#555"}}>{n}</button>;
                    })}
                  </div>
                </div>
                <textarea placeholder="Nachricht (optional)" value={form.nachricht} onChange={function(e){setForm(function(f){return Object.assign({},f,{nachricht:e.target.value});});}} rows={2} style={Object.assign({},iS,{resize:"none"})}/>
                {status==="error" && <div style={{background:"#fdecea",borderRadius:10,padding:"10px 12px",fontSize:13,color:"#c62828"}}>{"Senden fehlgeschlagen."}</div>}
                <button onClick={submit} disabled={!form.name||!form.email||status==="sending"} style={{padding:16,borderRadius:14,border:"none",background:(!form.name||!form.email)?"#ccc":"#2d6a4f",color:"white",fontWeight:700,fontSize:16,cursor:"pointer"}}>
                  {status==="sending"?"Wird gesendet...":"Verbindlich anmelden"}
                </button>
              </div>
          )}
          {showStorno && (stornoStatus==="ok"
            ? <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:44}}>{stornoKostenlos?"✅":"💸"}</div>
                <div style={{fontSize:17,fontWeight:700,marginTop:10,color:stornoKostenlos?"#2d6a4f":"#e65100"}}>{stornoKostenlos?"Stornierung erfolgreich":"Gebuehren fallen an"}</div>
                <button onClick={onClose} style={{marginTop:16,padding:"12px 32px",borderRadius:24,border:"none",background:"#2d6a4f",color:"white",fontWeight:700,fontSize:15,cursor:"pointer"}}>{"Schliessen"}</button>
              </div>
            : <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{background:stornoKostenlos?"#e8f5e9":"#fce4ec",borderRadius:12,padding:14,fontSize:13,lineHeight:1.6}}>
                  {stornoKostenlos
                    ? <span style={{color:"#2d6a4f"}}>{"Fristgerecht - Stornierung ist kostenlos."}</span>
                    : <span style={{color:"#c62828"}}>{"Nach Frist - "+gebuehr+" EUR Gebuehr faellig."}</span>
                  }
                </div>
                <input placeholder="Deine E-Mail *" type="email" value={stornoEmail} onChange={function(e){setStornoEmail(e.target.value);}} style={iS}/>
                {stornoStatus==="error" && <div style={{background:"#fdecea",borderRadius:10,padding:"10px 12px",fontSize:13,color:"#c62828"}}>{"Fehler. Anmeldung nicht gefunden."}</div>}
                <button onClick={submitStorno} disabled={!stornoEmail||stornoStatus==="sending"} style={{padding:16,borderRadius:14,border:"none",cursor:"pointer",fontWeight:700,fontSize:15,background:!stornoEmail?"#ccc":stornoKostenlos?"#2d6a4f":"#e63946",color:"white"}}>
                  {stornoStatus==="sending"?"Sendet...":stornoKostenlos?"Kostenlos abmelden":"Kostenpflichtig abmelden ("+gebuehr+" EUR)"}
                </button>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Anbieter-Sheet ─── */
function AnbieterSheet(props) {
  var a=props.a, onClose=props.onClose, userPos=props.userPos, favoriten=props.favoriten, toggleFavorit=props.toggleFavorit;
  var [tab,setTab]=useState("info");
  var [anmeldeEreignis,setAnmeldeEreignis]=useState(null);
  var [showBewertung,setShowBewertung]=useState(false);
  var typ=TYPEN.find(function(t){return t.id===a.typ;});
  var farbe=FARBEN[a.typ]||"#2d6a4f";
  var dist=userPos?distKm(userPos.lat,userPos.lng,a.lat,a.lng):null;
  var heute=["So","Mo","Di","Mi","Do","Fr","Sa"][new Date().getDay()];
  var istFavorit=favoriten.indexOf(a.id)>=0;
  var monat=new Date().getMonth()+1;
  var kalCount=a.kalender?a.kalender.length:0;
  var typIcons={ernte:"🌾","pflück":"🌿",schlacht:"🥩"};
  var typLabels={ernte:"Ernte","pflück":"Pfluecken",schlacht:"Schlachtung"};

  function openMaps() {
    var isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
    var url=isIOS?"maps://maps.apple.com/?daddr="+a.lat+","+a.lng+"&dirflg=w":"https://www.google.com/maps/dir/?api=1&destination="+a.lat+","+a.lng+"&travelmode=walking";
    window.open(url,"_blank");
  }

  var tabs=[{id:"info",label:"Info"},{id:"kalender",label:"Kalender"+(kalCount?" ("+kalCount+")":"")},{id:"kontakt",label:"Kontakt"}];
  if(a.story) tabs.splice(1,0,{id:"story",label:"Story"});

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"20px 20px 0 0",boxShadow:"0 -4px 30px rgba(0,0,0,.18)",maxHeight:"90vh",overflowY:"auto"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{padding:"12px 0 4px",display:"flex",justifyContent:"center"}}><div style={{width:40,height:4,borderRadius:2,background:"#ddd"}}/></div>
        <div style={{padding:"0 20px 36px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div style={{flex:1,marginRight:8}}>
              <div style={{fontSize:20,fontWeight:700,lineHeight:1.2}}>{a.name}</div>
              <span style={{background:farbe+"22",color:farbe,padding:"3px 10px",borderRadius:20,fontSize:12,display:"inline-block",marginTop:6}}>
                {(typ?typ.icon:"")+" "+(typ?typ.label:"")}
              </span>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={function(){toggleFavorit(a.id);}} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",padding:4}}>{istFavorit?"❤️":"🤍"}</button>
              <button onClick={function(){teileAnbieter(a);}} style={{background:"#f0f7f0",border:"none",borderRadius:20,padding:"6px 12px",color:"#2d6a4f",fontWeight:600,fontSize:13,cursor:"pointer"}}>{"Teilen"}</button>
              <button onClick={onClose} style={{background:"#f0f0f0",border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{"X"}</button>
            </div>
          </div>
          <div style={{display:"flex",borderBottom:"2px solid #f0efe8",marginBottom:16,overflowX:"auto"}}>
            {tabs.map(function(t) {
              return (
                <button key={t.id} onClick={function(){setTab(t.id);}}
                  style={{flexShrink:0,padding:"10px 14px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
                    background:"transparent",color:tab===t.id?farbe:"#aaa",
                    borderBottom:"2px solid "+(tab===t.id?farbe:"transparent"),marginBottom:-2}}>
                  {t.label}
                </button>
              );
            })}
          </div>
          {tab==="info" && (
            <div>
              <div style={{background:a.tage.indexOf(heute)>=0?"#e8f5e9":"#fff3e0",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{a.tage.indexOf(heute)>=0?"✅":"⏰"}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:a.tage.indexOf(heute)>=0?"#2d6a4f":"#e65100"}}>{a.tage.indexOf(heute)>=0?"Heute geöffnet":"Heute geschlossen"}</div>
                  <div style={{fontSize:12,color:"#666"}}>{a.von+" - "+a.bis+" Uhr"}</div>
                </div>
              </div>
              <div style={{fontSize:14,color:"#444",marginBottom:8}}>
                {"📍 "+a.adresse+", "+a.ort}
                {dist!==null && <span style={{color:"#2d6a4f",fontWeight:600,marginLeft:6}}>{dist.toFixed(1)+" km"}</span>}
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
                {TAGE.map(function(t) {
                  return <span key={t} style={{padding:"5px 10px",borderRadius:16,fontSize:13,fontWeight:600,background:a.tage.indexOf(t)>=0?farbe:"#f0efe8",color:a.tage.indexOf(t)>=0?"white":"#bbb"}}>{t}</span>;
                })}
              </div>
              <div style={{background:"#f8f8f5",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
                <div style={{fontSize:11,color:"#999",marginBottom:4,fontWeight:600}}>{"ANGEBOT"}</div>
                <div style={{fontSize:14,color:"#333"}}>{a.angebot}</div>
              </div>
              {a.wiederholend&&a.wiederholungsMonate&&a.wiederholungsMonate.indexOf(monat)>=0 && (
                <div style={{background:"#fff8e8",borderRadius:12,padding:"12px 14px",marginBottom:14,border:"1px solid #f4a020"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#e65100",marginBottom:4}}>{"Wiederkehrendes Angebot"}</div>
                  <div style={{fontSize:13,color:"#555"}}>{(a.wiederholungsTitel||"")+" - jetzt aktuell!"}</div>
                </div>
              )}
              <button onClick={function(){setShowBewertung(true);}}
                style={{width:"100%",padding:"12px 16px",borderRadius:12,border:"1px solid #e0ddd4",background:"#faf9f5",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Sterne wert={3} readonly={true}/>
                  <span style={{fontSize:13,color:"#888"}}>{"Bewertungen"}</span>
                </div>
                <span style={{color:"#2d6a4f",fontWeight:700}}>{">"}</span>
              </button>
              <button onClick={openMaps} style={{width:"100%",background:"#2d6a4f",color:"white",border:"none",padding:15,borderRadius:14,fontWeight:700,fontSize:15,cursor:"pointer"}}>{"Zu Fuss navigieren"}</button>
            </div>
          )}
          {tab==="story" && (
            <div>
              {a.story
                ? <div style={{fontSize:15,color:"#333",lineHeight:1.8,borderLeft:"3px solid "+farbe,paddingLeft:14}}>
                    {a.story}
                  </div>
                : <div style={{textAlign:"center",padding:"32px 0",color:"#999"}}>{"Noch keine Geschichte."}</div>
              }
            </div>
          )}
          {tab==="kalender" && (
            <div>
              {kalCount===0
                ? <div style={{textAlign:"center",padding:"32px 0",color:"#999"}}><div style={{fontSize:32,marginBottom:8}}>{"📅"}</div><div>{"Keine Termine"}</div></div>
                : <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {a.kalender.slice().sort(function(x,y){return x.datum.localeCompare(y.datum);}).map(function(ev) {
                      var ausgebucht=ev.plaetze&&ev.anmeldungen>=ev.plaetze;
                      var bgCol=ev.typ==="ernte"?"#e8f5e9":ev.typ==="pflück"?"#e3f2fd":"#fce4ec";
                      var badgeCol=ev.typ==="ernte"?"#2d6a4f":ev.typ==="pflück"?"#457b9d":"#c62828";
                      var evDatum=new Date(ev.datum).toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"});
                      var pct=ev.plaetze?Math.round((ev.anmeldungen/ev.plaetze)*100)+"%":"0%";
                      return (
                        <div key={ev.id} style={{border:"1px solid #e8e4da",borderRadius:14,overflow:"hidden"}}>
                          <div style={{background:bgCol,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:20}}>{typIcons[ev.typ]||"📅"}</span>
                            <div style={{flex:1}}>
                              <div style={{fontSize:14,fontWeight:700}}>{ev.titel}</div>
                              <div style={{fontSize:12,color:"#666"}}>{"📅 "+evDatum}</div>
                            </div>
                            <span style={{fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:8,background:badgeCol,color:"white"}}>{typLabels[ev.typ]||ev.typ}</span>
                          </div>
                          <div style={{padding:"10px 14px"}}>
                            <div style={{fontSize:13,color:"#555",marginBottom:10}}>{ev.beschreibung}</div>
                            {ev.plaetze && (
                              <div style={{marginBottom:10}}>
                                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#888",marginBottom:4}}>
                                  <span>{"Plaetze"}</span><span>{ev.anmeldungen+"/"+ev.plaetze}</span>
                                </div>
                                <div style={{height:6,background:"#f0efe8",borderRadius:3,overflow:"hidden"}}>
                                  <div style={{height:"100%",width:pct,background:farbe,borderRadius:3}}/>
                                </div>
                              </div>
                            )}
                            <button onClick={function(){if(!ausgebucht)setAnmeldeEreignis(ev);}}
                              style={{width:"100%",padding:11,borderRadius:12,border:"none",cursor:ausgebucht?"default":"pointer",fontWeight:700,fontSize:14,background:ausgebucht?"#f0efe8":"#2d6a4f",color:ausgebucht?"#aaa":"white"}}>
                              {ausgebucht?"Ausgebucht":"Jetzt anmelden"}
                            </button>
                            {ev.mindestAnmeldungen&&ev.anmeldungen<ev.mindestAnmeldungen && <ErzeugerAbsageButton ereignis={ev} anbieter={a}/>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>
          )}
          {tab==="kontakt" && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {a.telefon && (
                <a href={"tel:"+a.telefon} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#f8f8f5",borderRadius:14,textDecoration:"none",color:"#1a1a1a"}}>
                  <span style={{fontSize:24,width:44,height:44,background:"#e8f5e9",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center"}}>{"📞"}</span>
                  <div>
                    <div style={{fontSize:12,color:"#999",fontWeight:600}}>{"TELEFON"}</div>
                    <div style={{fontSize:15,fontWeight:600,color:"#2d6a4f"}}>{a.telefon}</div>
                  </div>
                </a>
              )}
              {a.email && (
                <a href={"mailto:"+a.email} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#f8f8f5",borderRadius:14,textDecoration:"none",color:"#1a1a1a"}}>
                  <span style={{fontSize:24,width:44,height:44,background:"#e8f5e9",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center"}}>{"✉️"}</span>
                  <div>
                    <div style={{fontSize:12,color:"#999",fontWeight:600}}>{"E-MAIL"}</div>
                    <div style={{fontSize:15,fontWeight:600,color:"#2d6a4f"}}>{a.email}</div>
                  </div>
                </a>
              )}
              {!a.telefon&&!a.email && <div style={{textAlign:"center",padding:"32px 0",color:"#999"}}><div style={{fontSize:32,marginBottom:8}}>{"📭"}</div><div>{"Keine Kontaktdaten"}</div></div>}
              <button onClick={openMaps} style={{width:"100%",background:"#2d6a4f",color:"white",border:"none",padding:15,borderRadius:14,fontWeight:700,fontSize:15,cursor:"pointer",marginTop:4}}>{"Zu Fuss navigieren"}</button>
            </div>
          )}
        </div>
      </div>
      {anmeldeEreignis && <AnmeldeSheet ereignis={anmeldeEreignis} anbieter={a} onClose={function(){setAnmeldeEreignis(null);}}/>}
      {showBewertung && <BewertungsSheet anbieter={a} onClose={function(){setShowBewertung(false);}}/>}
    </div>
  );
}

/* ─── Filter-Sheet ─── */
function FilterSheet(props) {
  var filter=props.filter, setFilter=props.setFilter;
  var zentrum=props.zentrum, setZentrum=props.setZentrum;
  var radius=props.radius, setRadius=props.setRadius;
  var onClose=props.onClose, anbieter=props.anbieter;
  var [localOrt,setLocalOrt]=useState("");
  var [sucheStatus,setSucheStatus]=useState(null);

  function applyOrt() {
    if(!localOrt.trim()){setZentrum(null);setSucheStatus(null);onClose();return;}
    setSucheStatus("searching");
    setTimeout(function(){
      var r=sucheOrt(localOrt,anbieter);
      if(r){setZentrum({lat:r.lat,lng:r.lng,label:r.name});setSucheStatus("ok");setTimeout(onClose,300);}
      else setSucheStatus("notfound");
    },350);
  }

  function useGPS() {
    setSucheStatus("gps");
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        function(p){setZentrum({lat:p.coords.latitude,lng:p.coords.longitude,label:"Mein Standort"});setSucheStatus("ok");setTimeout(onClose,400);},
        function(){setSucheStatus("gpserror");}
      );
    }
  }

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"20px 20px 0 0",boxShadow:"0 -4px 30px rgba(0,0,0,.18)",maxHeight:"90vh",overflowY:"auto"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{padding:"12px 0 4px",display:"flex",justifyContent:"center"}}><div style={{width:40,height:4,borderRadius:2,background:"#ddd"}}/></div>
        <div style={{padding:"0 20px 40px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{fontSize:18,fontWeight:700}}>{"Suche & Filter"}</div>
            <button onClick={function(){setFilter({typ:"",produkt:"",tag:"",text:""});setZentrum(null);onClose();}} style={{fontSize:13,color:"#e63946",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>{"Alles zuruecksetzen"}</button>
          </div>
          <div style={{fontSize:12,color:"#999",fontWeight:600,letterSpacing:.5,marginBottom:8}}>{"STANDORT & RADIUS"}</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input value={localOrt} onChange={function(e){setLocalOrt(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")applyOrt();}}
              placeholder="Ort oder PLZ..." style={{flex:1,padding:"12px 14px",borderRadius:12,border:"1px solid #e0ddd4",fontSize:15,outline:"none",background:"#faf9f5"}}/>
            <button onClick={applyOrt} style={{padding:"12px 16px",borderRadius:12,border:"none",background:"#2d6a4f",color:"white",fontWeight:700,fontSize:15,cursor:"pointer"}}>{"OK"}</button>
          </div>
          <button onClick={useGPS} style={{width:"100%",padding:12,borderRadius:12,border:"1px solid #2d6a4f",background:"transparent",color:"#2d6a4f",fontWeight:600,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:10}}>{"GPS Standort"}</button>
          {sucheStatus==="notfound" && (
            <div style={{fontSize:13,color:"#e65100",background:"#fff3e0",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
              {"Nicht erkannt. Versuche: "}
              {["Kuerten","51515","Koeln"].map(function(b){return <button key={b} onClick={function(){setLocalOrt(b);}} style={{marginLeft:6,padding:"3px 9px",borderRadius:10,border:"1px solid #e65100",background:"white",color:"#e65100",fontSize:12,cursor:"pointer"}}>{b}</button>;})}
            </div>
          )}
          {zentrum && (
            <div style={{background:"#e8f5e9",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:13,color:"#2d6a4f",fontWeight:600}}>{zentrum.label}</span>
                <button onClick={function(){setZentrum(null);setLocalOrt("");setSucheStatus(null);}} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:16}}>{"X"}</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <input type="range" min="1" max="100" value={radius} onChange={function(e){setRadius(Number(e.target.value));}} style={{flex:1,accentColor:"#2d6a4f"}}/>
                <span style={{fontSize:15,fontWeight:700,color:"#2d6a4f",minWidth:50}}>{radius+" km"}</span>
              </div>
            </div>
          )}
          <div style={{fontSize:12,color:"#999",fontWeight:600,letterSpacing:.5,marginBottom:10,marginTop:8}}>{"PRODUKT"}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
            {PRODUKTE.map(function(k) {
              return <button key={k.id} onClick={function(){setFilter(function(f){return Object.assign({},f,{produkt:k.id});});}} style={{padding:"9px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:filter.produkt===k.id?"#2d6a4f":"#f0efe8",color:filter.produkt===k.id?"white":"#555"}}>{k.icon+" "+k.label}</button>;
            })}
          </div>
          <div style={{fontSize:12,color:"#999",fontWeight:600,letterSpacing:.5,marginBottom:10}}>{"ANBIETER-TYP"}</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {[{id:"",label:"Alle Typen",icon:"🌿"}].concat(TYPEN).map(function(t) {
              return <button key={t.id} onClick={function(){setFilter(function(f){return Object.assign({},f,{typ:t.id});});}} style={{padding:"13px 16px",borderRadius:12,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:10,background:filter.typ===t.id?"#2d6a4f":"#f7f5f0",color:filter.typ===t.id?"white":"#333",fontWeight:filter.typ===t.id?700:400,fontSize:14}}><span style={{fontSize:20}}>{t.icon}</span>{t.label}</button>;
            })}
          </div>
          <div style={{fontSize:12,color:"#999",fontWeight:600,letterSpacing:.5,marginBottom:10}}>{"TAG"}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
            {[{id:"",label:"Alle"}].concat(TAGE.map(function(t){return{id:t,label:t};})).map(function(t) {
              return <button key={t.id} onClick={function(){setFilter(function(f){return Object.assign({},f,{tag:t.id});});}} style={{padding:"10px 14px",borderRadius:24,border:"none",cursor:"pointer",background:filter.tag===t.id?"#2d6a4f":"#f0efe8",color:filter.tag===t.id?"white":"#555",fontWeight:filter.tag===t.id?700:400,fontSize:14}}>{t.label}</button>;
            })}
          </div>
          <button onClick={onClose} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:"#2d6a4f",color:"white",fontWeight:700,fontSize:16,cursor:"pointer"}}>{"Ergebnisse anzeigen"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Eintragen-Sheet ─── */
function EintragenSheet(props) {
  var onClose=props.onClose;
  var [form,setForm]=useState({name:"",typ:"hofladen",ort:"",adresse:"",angebot:"",tage:[],von:"08:00",bis:"18:00",telefon:"",email:"",beschreibung:""});
  var [status,setStatus]=useState(null);

  function toggleTag(t) {
    setForm(function(f) {
      var tage=f.tage.indexOf(t)>=0?f.tage.filter(function(x){return x!==t;}):f.tage.concat([t]);
      return Object.assign({},f,{tage:tage});
    });
  }

  function submit() {
    if(!form.name||!form.ort)return;
    setStatus("sending");
    sendeAnbieterVorschlag(form)
      .then(function(){setStatus("ok");})
      .catch(function(){setStatus("error");});
  }

  var iS={width:"100%",padding:"13px 14px",borderRadius:12,border:"1px solid #e0ddd4",fontSize:15,outline:"none",background:"#faf9f5",boxSizing:"border-box"};
  return (
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"20px 20px 0 0",boxShadow:"0 -4px 30px rgba(0,0,0,.18)",maxHeight:"92vh",overflowY:"auto"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{padding:"12px 0 4px",display:"flex",justifyContent:"center"}}><div style={{width:40,height:4,borderRadius:2,background:"#ddd"}}/></div>
        <div style={{padding:"0 20px 40px"}}>
          <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>{"Anbieter vorschlagen"}</div>
          <div style={{fontSize:13,color:"#2d6a4f",background:"#e8f5e9",borderRadius:10,padding:"10px 12px",marginBottom:18,lineHeight:1.5}}>{"Wir pruefen deinen Vorschlag und schalten ihn frei - dauert 1-2 Tage."}</div>
          {status==="ok"
            ? <div style={{textAlign:"center",padding:"30px 0"}}>
                <div style={{fontSize:48}}>{"✅"}</div>
                <div style={{fontSize:18,fontWeight:700,marginTop:12,color:"#2d6a4f"}}>{"Danke!"}</div>
                <button onClick={onClose} style={{marginTop:20,padding:"12px 32px",borderRadius:24,border:"none",background:"#2d6a4f",color:"white",fontWeight:700,fontSize:15,cursor:"pointer"}}>{"Schliessen"}</button>
              </div>
            : <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <input placeholder="Name *" value={form.name} onChange={function(e){setForm(function(f){return Object.assign({},f,{name:e.target.value});});}} style={iS}/>
                <select value={form.typ} onChange={function(e){setForm(function(f){return Object.assign({},f,{typ:e.target.value});});}} style={Object.assign({},iS,{color:"#333"})}>
                  {TYPEN.map(function(t){return <option key={t.id} value={t.id}>{t.icon+" "+t.label}</option>;})}
                </select>
                <input placeholder="Ort *" value={form.ort} onChange={function(e){setForm(function(f){return Object.assign({},f,{ort:e.target.value});});}} style={iS}/>
                <input placeholder="Strasse & Hausnummer" value={form.adresse} onChange={function(e){setForm(function(f){return Object.assign({},f,{adresse:e.target.value});});}} style={iS}/>
                <input placeholder="Angebot" value={form.angebot} onChange={function(e){setForm(function(f){return Object.assign({},f,{angebot:e.target.value});});}} style={iS}/>
                <input placeholder="Telefon" value={form.telefon} onChange={function(e){setForm(function(f){return Object.assign({},f,{telefon:e.target.value});});}} style={iS}/>
                <input placeholder="E-Mail" value={form.email} onChange={function(e){setForm(function(f){return Object.assign({},f,{email:e.target.value});});}} style={iS}/>
                <div>
                  <div style={{fontSize:12,color:"#999",marginBottom:8,fontWeight:600}}>{"OEFFNUNGSTAGE"}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {TAGE.map(function(t){return <button key={t} onClick={function(){toggleTag(t);}} style={{padding:"10px 14px",borderRadius:20,border:"none",cursor:"pointer",background:form.tage.indexOf(t)>=0?"#2d6a4f":"#f0efe8",color:form.tage.indexOf(t)>=0?"white":"#888",fontSize:14,fontWeight:600}}>{t}</button>;} )}
                  </div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <div style={{flex:1}}><div style={{fontSize:12,color:"#999",marginBottom:4,fontWeight:600}}>{"VON"}</div><input type="time" value={form.von} onChange={function(e){setForm(function(f){return Object.assign({},f,{von:e.target.value});});}} style={iS}/></div>
                  <div style={{flex:1}}><div style={{fontSize:12,color:"#999",marginBottom:4,fontWeight:600}}>{"BIS"}</div><input type="time" value={form.bis} onChange={function(e){setForm(function(f){return Object.assign({},f,{bis:e.target.value});});}} style={iS}/></div>
                </div>
                <textarea placeholder="Kurze Beschreibung (optional)" value={form.beschreibung} onChange={function(e){setForm(function(f){return Object.assign({},f,{beschreibung:e.target.value});});}} rows={3} style={Object.assign({},iS,{resize:"none"})}/>
                {status==="error" && <div style={{background:"#fdecea",borderRadius:10,padding:"10px 12px",fontSize:13,color:"#c62828"}}>{"Senden fehlgeschlagen."}</div>}
                <button onClick={submit} disabled={!form.name||!form.ort||status==="sending"} style={{padding:16,borderRadius:14,border:"none",background:(!form.name||!form.ort)?"#ccc":"#2d6a4f",color:"white",fontWeight:700,fontSize:16,cursor:"pointer",marginTop:4}}>
                  {status==="sending"?"Wird gesendet...":"Vorschlag einsenden"}
                </button>
              </div>
          }
        </div>
      </div>
    </div>
  );
}

/* ─── Haupt-App ─── */
function HauptApp() {
  var [anbieter,setAnbieter]=useState([]);
  var [laden,setLaden]=useState(true);
  var [fehler,setFehler]=useState(null);
  var [ansicht,setAnsicht]=useState("liste");
  var [selected,setSelected]=useState(null);
  var [filterOffen,setFilterOffen]=useState(false);
  var [eintragenOffen,setEintragenOffen]=useState(false);
  var [saisonOffen,setSaisonOffen]=useState(false);
  var [userPos,setUserPos]=useState(null);
  var [filter,setFilter]=useState({typ:"",produkt:"",tag:"",text:""});
  var [zentrum,setZentrum]=useState(null);
  var [radius,setRadius]=useState(15);
  var [nurHeute,setNurHeute]=useState(false);
  var [favoriten,setFavoriten]=useState([]);
  var [nurFavoriten,setNurFavoriten]=useState(false);
  var heute=["So","Mo","Di","Mi","Do","Fr","Sa"][new Date().getDay()];

  useEffect(function(){
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(function(p){setUserPos({lat:p.coords.latitude,lng:p.coords.longitude});},function(){});
    }
    (async function(){
      try{var c=await window.storage.get("regiomap_fav");if(c)setFavoriten(JSON.parse(c.value));}catch{}
    })();
    ladeAnbieter()
      .then(function(d){setAnbieter(d);setLaden(false);try{window.storage.set("regiomap_anbieter",JSON.stringify(d));}catch{};})
      .catch(async function(){
        try{var c=await window.storage.get("regiomap_anbieter");if(c)setAnbieter(JSON.parse(c.value));setFehler("Offline - Cache geladen.");}
        catch{setAnbieter(BEISPIEL);setFehler("Keine Verbindung.");}
        setLaden(false);
      });
  },[]);

  async function toggleFavorit(id) {
    var neu=favoriten.indexOf(id)>=0?favoriten.filter(function(x){return x!==id;}):favoriten.concat([id]);
    setFavoriten(neu);
    try{await window.storage.set("regiomap_fav",JSON.stringify(neu));}catch{}
  }

  var monat=new Date().getMonth()+1;

  var gefiltert=anbieter.filter(function(a){
    var s=filter.text.toLowerCase();
    return(!s||a.name.toLowerCase().indexOf(s)>=0||a.angebot.toLowerCase().indexOf(s)>=0||a.ort.toLowerCase().indexOf(s)>=0)
      &&(!filter.typ||a.typ===filter.typ)
      &&(!filter.tag||a.tage.indexOf(filter.tag)>=0)
      &&(!zentrum||distKm(zentrum.lat,zentrum.lng,a.lat,a.lng)<=radius)
      &&(!nurHeute||a.tage.indexOf(heute)>=0)
      &&produktMatch(a,filter.produkt)
      &&(!nurFavoriten||favoriten.indexOf(a.id)>=0);
  }).sort(function(a,b){
    return userPos?distKm(userPos.lat,userPos.lng,a.lat,a.lng)-distKm(userPos.lat,userPos.lng,b.lat,b.lng):0;
  });

  var activeFilters=[filter.typ,filter.produkt,filter.tag,filter.text,zentrum,nurHeute||null,nurFavoriten||null].filter(Boolean).length;

  return (
    <div style={{minHeight:"100vh",background:"#f7f5f0",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column"}}>
      <div style={{background:"linear-gradient(135deg,#2d6a4f,#40916c)",color:"white",position:"sticky",top:0,zIndex:50}}>
        <div style={{padding:"14px 16px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <div style={{fontSize:22,fontWeight:800,letterSpacing:2}}>{"RegioMap"}</div>
              <div style={{fontSize:10,opacity:.7,letterSpacing:.5}}>{"Lokale & Regionale Erzeuger"}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={function(){setSaisonOffen(true);}} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:20,padding:"8px 12px",color:"white",fontWeight:600,fontSize:13,cursor:"pointer"}}>{"Saison"}</button>
              <button onClick={function(){setEintragenOffen(true);}} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:20,padding:"8px 12px",color:"white",fontWeight:600,fontSize:13,cursor:"pointer"}}>{"+Eintragen"}</button>
            </div>
          </div>
          <div style={{display:"flex",gap:8,paddingBottom:12}}>
            <button onClick={function(){setFilterOffen(true);}} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:"11px 16px",borderRadius:24,border:"none",background:"rgba(255,255,255,0.95)",color:activeFilters>0?"#2d6a4f":"#888",fontSize:14,cursor:"pointer",textAlign:"left",fontWeight:activeFilters>0?600:400}}>
              <span>{"🔍"}</span>
              <span style={{flex:1}}>
                {filter.produkt?(PRODUKTE.find(function(k){return k.id===filter.produkt;})||{label:""}).label+" suchen..."
                  :zentrum?zentrum.label+" - "+radius+" km"
                  :activeFilters>0?"Filter aktiv..."
                  :"Ort, Produkt oder Typ..."}
              </span>
              {activeFilters>0 && <span style={{background:"#2d6a4f",color:"white",borderRadius:"50%",width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{activeFilters}</span>}
            </button>
            <button onClick={function(){setNurHeute(function(v){return !v;});}} style={{flexShrink:0,padding:"11px 12px",borderRadius:24,border:"none",cursor:"pointer",background:nurHeute?"#fff":"rgba(255,255,255,0.25)",color:nurHeute?"#2d6a4f":"rgba(255,255,255,0.9)",fontWeight:700,fontSize:13,boxShadow:nurHeute?"0 0 0 2px #2d6a4f inset":"none"}}>{"📅"}</button>
            <button onClick={function(){setNurFavoriten(function(v){return !v;});}} style={{flexShrink:0,padding:"11px 12px",borderRadius:24,border:"none",cursor:"pointer",background:nurFavoriten?"#fff":"rgba(255,255,255,0.25)",color:nurFavoriten?"#e63946":"rgba(255,255,255,0.9)",fontWeight:700,fontSize:16,boxShadow:nurFavoriten?"0 0 0 2px #e63946 inset":"none"}}>{nurFavoriten?"❤️":"🤍"}</button>
          </div>
          <div style={{overflowX:"auto",display:"flex",gap:8,paddingBottom:10}}>
            {PRODUKTE.map(function(k) {
              return <button key={k.id} onClick={function(){setFilter(function(f){return Object.assign({},f,{produkt:k.id});});}} style={{flexShrink:0,padding:"7px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap",background:filter.produkt===k.id?"white":"rgba(255,255,255,0.2)",color:filter.produkt===k.id?"#2d6a4f":"rgba(255,255,255,0.9)"}}>{k.icon+" "+k.label}</button>;
            })}
          </div>
          <div style={{display:"flex",borderTop:"1px solid rgba(255,255,255,0.15)"}}>
            {[["liste","Liste"],["karte","Karte"]].map(function(pair) {
              return <button key={pair[0]} onClick={function(){setAnsicht(pair[0]);}} style={{flex:1,padding:"11px 0",border:"none",cursor:"pointer",fontSize:14,fontWeight:600,background:"transparent",color:ansicht===pair[0]?"white":"rgba(255,255,255,0.5)",borderBottom:"3px solid "+(ansicht===pair[0]?"white":"transparent")}}>{pair[1]}</button>;
            })}
          </div>
        </div>
      </div>

      {fehler && <div style={{padding:"8px 16px",background:"#fff8e8",fontSize:12,color:"#e65100",borderBottom:"1px solid #ffe0b2"}}>{"⚠️ "+fehler}</div>}

      {activeFilters>0 && (
        <div style={{padding:"7px 16px",background:"#e8f5e9",fontSize:12,color:"#2d6a4f",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>{gefiltert.length+" Anbieter"+(nurHeute?" - heute offen":"")+(nurFavoriten?" - Favoriten":"")+(zentrum?" - "+radius+"km um "+zentrum.label:"")}</span>
          <button onClick={function(){setFilter({typ:"",produkt:"",tag:"",text:""});setZentrum(null);setNurHeute(false);setNurFavoriten(false);}} style={{background:"none",border:"none",color:"#e63946",fontSize:12,cursor:"pointer",fontWeight:600}}>{"X Reset"}</button>
        </div>
      )}

      {laden && <div style={{textAlign:"center",padding:40,color:"#888"}}><div style={{fontSize:32,marginBottom:8}}>{"🌿"}</div><div>{"Laedt..."}</div></div>}

      {!laden&&ansicht==="karte" && <Karte anbieter={gefiltert} onSelect={setSelected} zentrum={zentrum} radius={zentrum?radius:null}/>}

      {!laden&&ansicht==="liste" && (
        <div style={{padding:"12px 12px 100px",flex:1,overflowY:"auto"}}>
          {gefiltert.length===0
            ? <div style={{textAlign:"center",padding:"48px 20px"}}>
                <div style={{fontSize:40,marginBottom:10}}>{nurFavoriten?"❤️":"🌾"}</div>
                <div style={{fontWeight:600,color:"#555",fontSize:16,marginBottom:6}}>{nurFavoriten?"Noch keine Favoriten":"Keine Anbieter"}</div>
                <div style={{fontSize:13,color:"#999",marginBottom:20}}>{zentrum?"Nichts im "+radius+"-km-Umkreis.":"Andere Filter versuchen."}</div>
                {zentrum && <button onClick={function(){setRadius(function(r){return Math.min(r+10,100);});}} style={{padding:13,borderRadius:12,border:"none",background:"#2d6a4f",color:"white",fontSize:14,cursor:"pointer",fontWeight:600,display:"block",margin:"0 auto 10px"}}>{"Radius erweitern"}</button>}
                {activeFilters>0 && <button onClick={function(){setFilter({typ:"",produkt:"",tag:"",text:""});setZentrum(null);setNurHeute(false);setNurFavoriten(false);}} style={{padding:13,borderRadius:12,border:"1px solid #2d6a4f",background:"white",color:"#2d6a4f",fontSize:14,cursor:"pointer",fontWeight:600,display:"block",margin:"0 auto"}}>{"Filter zuruecksetzen"}</button>}
              </div>
            : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {gefiltert.map(function(a) {
                  var typ=TYPEN.find(function(t){return t.id===a.typ;});
                  var farbe=FARBEN[a.typ]||"#2d6a4f";
                  var dist=userPos?distKm(userPos.lat,userPos.lng,a.lat,a.lng):null;
                  var offenHeute=a.tage.indexOf(heute)>=0;
                  var kalCount=a.kalender?a.kalender.length:0;
                  var istFav=favoriten.indexOf(a.id)>=0;
                  var hatWiederh=a.wiederholend&&a.wiederholungsMonate&&a.wiederholungsMonate.indexOf(monat)>=0;
                  return (
                    <div key={a.id} onClick={function(){setSelected(a);}} style={{background:"white",borderRadius:16,overflow:"hidden",border:"1px solid #ece8de",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,.05)",borderLeft:"4px solid "+farbe}}>
                      <div style={{padding:"14px 16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:16,fontWeight:700,color:"#1a1a1a",display:"flex",alignItems:"center",gap:6}}>
                              {a.name}
                              {istFav && <span style={{fontSize:14}}>{"❤️"}</span>}
                              {hatWiederh && <span style={{fontSize:11,background:"#fff8e8",color:"#e65100",padding:"2px 6px",borderRadius:8,fontWeight:600}}>{"jetzt"}</span>}
                            </div>
                            <div style={{fontSize:12,color:"#999",marginTop:2}}>
                              {"📍 "+a.ort}
                              {dist!==null && <span style={{color:"#2d6a4f",fontWeight:600,marginLeft:6}}>{dist.toFixed(1)+" km"}</span>}
                            </div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                            <span style={{fontSize:20}}>{typ?typ.icon:""}</span>
                            <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:8,background:offenHeute?"#e8f5e9":"#f5f5f0",color:offenHeute?"#2d6a4f":"#aaa"}}>{offenHeute?"Heute offen":"Heute zu"}</span>
                          </div>
                        </div>
                        <div style={{fontSize:13,color:"#666",marginBottom:8}}>{"🛒 "+a.angebot}</div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {TAGE.map(function(t) {
                              return <span key={t} style={{padding:"2px 7px",borderRadius:10,fontSize:11,background:a.tage.indexOf(t)>=0?farbe+"22":"#f5f5f0",color:a.tage.indexOf(t)>=0?farbe:"#ccc",fontWeight:a.tage.indexOf(t)>=0?600:400}}>{t}</span>;
                            })}
                          </div>
                          {kalCount>0 && <span style={{fontSize:11,background:"#e8f5e9",color:"#2d6a4f",padding:"3px 8px",borderRadius:10,fontWeight:600,flexShrink:0,marginLeft:8}}>{"📅 "+kalCount+(kalCount>1?" Termine":" Termin")}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

      {selected && <AnbieterSheet a={selected} onClose={function(){setSelected(null);}} userPos={userPos} favoriten={favoriten} toggleFavorit={toggleFavorit}/>}
      {filterOffen && <FilterSheet filter={filter} setFilter={setFilter} zentrum={zentrum} setZentrum={setZentrum} radius={radius} setRadius={setRadius} onClose={function(){setFilterOffen(false);}} anbieter={anbieter}/>}
      {eintragenOffen && <EintragenSheet onClose={function(){setEintragenOffen(false);}}/>}
      {saisonOffen && <SaisonSheet onClose={function(){setSaisonOffen(false);}}/>}
    </div>
  );
}

/* ─── Startbildschirm ─── */
function Startbildschirm(props) {
  var onEnter=props.onEnter;
  var [phase,setPhase]=useState(0);
  var [zooming,setZooming]=useState(false);
  var [gone,setGone]=useState(false);

  useEffect(function(){
    var t1=setTimeout(function(){setPhase(1);},200);
    var t2=setTimeout(function(){setPhase(2);},1000);
    var t3=setTimeout(function(){setPhase(3);},1800);
    return function(){clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[]);

  function go() {
    setZooming(true);
    setTimeout(function(){setGone(true);},900);
    setTimeout(function(){onEnter();},940);
  }

  if(gone) return null;

  var X0=92,X1=708,N=16,sw=(X1-X0)/N,TOP=62,BOT=140;
  var segs=[];
  for(var i=0;i<N;i++){
    var xa=X0+i*sw, xb=X0+(i+1)*sw;
    var col=i%2===0?"#dc1a1a":"#f0f0f0";
    var sc=i%2===0?"#b80808":"#cccccc";
    segs.push(<rect key={i} x={xa} y={TOP} width={sw} height={BOT-TOP} fill={col} stroke={sc} strokeWidth="0.5"/>);
    var cx=xa+sw/2, r=sw/2;
    segs.push(<path key={"h"+i} d={"M "+(cx-r)+","+BOT+" A "+r+" "+r+" 0 0 0 "+(cx+r)+","+BOT+" Z"} fill={col} stroke={sc} strokeWidth="0.5"/>);
  }

  return (
    <div style={{width:"100%",minHeight:"100vh",overflow:"hidden",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",position:"relative"}}>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,#6ab4d8 0%,#a8d0e8 40%,#c8dfa0 72%,#90b870 100%)",zIndex:0}}/>
      <div style={{position:"absolute",top:24,left:"5%",opacity:phase>=1?.85:0,transition:"opacity 1.4s",zIndex:1}}>
        <svg width="120" height="42"><ellipse cx="60" cy="28" rx="54" ry="14" fill="white" opacity=".9"/><ellipse cx="40" cy="20" rx="30" ry="18" fill="white"/><ellipse cx="78" cy="18" rx="26" ry="15" fill="white"/></svg>
      </div>
      <div style={{position:"absolute",top:20,right:"20%",opacity:phase>=1?1:0,transition:"opacity 1.2s",zIndex:1}}>
        <svg width="50" height="50" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="11" fill="#FFD700"/>
          {[0,40,80,120,160,200,240,280,320].map(function(ang){
            return <line key={ang} x1={25+13*Math.cos(ang*Math.PI/180)} y1={25+13*Math.sin(ang*Math.PI/180)} x2={25+20*Math.cos(ang*Math.PI/180)} y2={25+20*Math.sin(ang*Math.PI/180)} stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round"/>;
          })}
        </svg>
      </div>
      <div style={{position:"relative",zIndex:2,width:"100%",maxWidth:860,
        transformOrigin:"50% 31%",
        transform:zooming?"scale(5)":"scale(1)",
        opacity:zooming?0:phase>=1?1:0,
        transition:zooming?"transform 0.9s cubic-bezier(0.4,0,0.2,1),opacity 0.35s 0.55s":"opacity 1s ease",
        display:"flex",flexDirection:"column",alignItems:"center"}}>
        <svg width="100%" viewBox="0 0 800 580" style={{display:"block"}}>
          <defs>
            <linearGradient id="pG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#b85f1a"/><stop offset="22%" stopColor="#d4801e"/><stop offset="52%" stopColor="#f0a84a"/><stop offset="78%" stopColor="#d4801e"/><stop offset="100%" stopColor="#b05010"/></linearGradient>
            <linearGradient id="ctG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2d898"/><stop offset="100%" stopColor="#c89040"/></linearGradient>
            <linearGradient id="slE" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#c89040"/><stop offset="40%" stopColor="#e8c060"/><stop offset="100%" stopColor="#c89040"/></linearGradient>
            <linearGradient id="slO" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#b87830"/><stop offset="40%" stopColor="#d4a050"/><stop offset="100%" stopColor="#b87830"/></linearGradient>
            <pattern id="cobA" x="0" y="0" width="48" height="28" patternUnits="userSpaceOnUse"><rect x="1" y="1" width="46" height="26" rx="3" fill="#c0ae8a" stroke="#a89068" strokeWidth="0.7"/></pattern>
            <pattern id="cobB" x="24" y="28" width="48" height="28" patternUnits="userSpaceOnUse"><rect x="1" y="1" width="46" height="26" rx="3" fill="#b8a280" stroke="#a08860" strokeWidth="0.7"/></pattern>
            <linearGradient id="dpG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff"/><stop offset="100%" stopColor="#f2ede0"/></linearGradient>
          </defs>
          <rect x="0" y="470" width="800" height="110" fill="url(#cobA)"/>
          <rect x="0" y="498" width="800" height="82" fill="url(#cobB)"/>
          <rect x="0" y="468" width="800" height="5" fill="#988060"/>
          <rect x="90" y="138" width="620" height="220" fill="#f0ebe0"/>
          <rect x="92" y="140" width="616" height="213" rx="3" fill="url(#dpG)" stroke="#ddd5c0" strokeWidth="2"/>
          <rect x="100" y="290" width="600" height="7" rx="2" fill="#c8a860"/>
          <ellipse cx="196" cy="272" rx="46" ry="20" fill="#cc7c28"/>
          <ellipse cx="196" cy="266" rx="44" ry="18" fill="#d88c34"/>
          <path d="M158,262 Q196,248 234,262" fill="none" stroke="#b06018" strokeWidth="2" strokeLinecap="round"/>
          <ellipse cx="155" cy="278" rx="14" ry="20" fill="#e8a848" stroke="#c88428" strokeWidth="1" transform="rotate(-18,155,278)"/>
          <path d="M234,278 Q234,294 268,297 Q302,294 302,278 Z" fill="#9a7020"/>
          <circle cx="252" cy="270" r="12" fill="#cc2020"/>
          <circle cx="268" cy="267" r="11" fill="#f09040"/>
          <circle cx="284" cy="270" r="11" fill="#cc2020"/>
          <circle cx="276" cy="278" r="10" fill="#e8c820"/>
          <rect x="342" y="246" width="38" height="50" rx="8" fill="#f9c84a" stroke="#d8a010" strokeWidth="1.2"/>
          <rect x="338" y="237" width="46" height="15" rx="6" fill="#d89010"/>
          <rect x="386" y="258" width="30" height="38" rx="6" fill="#f8d050" stroke="#d8a010" strokeWidth="1"/>
          <polygon points="424,294 490,294 478,252" fill="#f0cc38" stroke="#c8a008" strokeWidth="1.2"/>
          <rect x="524" y="236" width="34" height="58" rx="9" fill="#f8f8f8" stroke="#d8d8c8" strokeWidth="1.2"/>
          <rect x="530" y="219" width="22" height="9" rx="4" fill="#d02020"/>
          <rect x="556" y="330" width="74" height="28" rx="4" fill="#f0e0a0" stroke="#c8b860" strokeWidth="1"/>
          <ellipse cx="568" cy="350" rx="9" ry="6" fill="#faeec0" stroke="#d0b040" strokeWidth="0.8"/>
          <ellipse cx="589" cy="350" rx="9" ry="6" fill="#faeec0" stroke="#d0b040" strokeWidth="0.8"/>
          <ellipse cx="610" cy="350" rx="9" ry="6" fill="#faeec0" stroke="#d0b040" strokeWidth="0.8"/>
          <path d="M126,354 Q126,366 168,369 Q210,366 210,354 Z" fill="#b87828" opacity="0.8"/>
          <circle cx="142" cy="348" r="13" fill="#c0d820"/>
          <circle cx="158" cy="345" r="13" fill="#d82020"/>
          <circle cx="174" cy="349" r="12" fill="#d88020"/>
          <circle cx="189" cy="346" r="12" fill="#c0d820"/>
          <circle cx="204" cy="350" r="11" fill="#d82020"/>
          <rect x="18" y="354" width="764" height="18" rx="4" fill="url(#ctG)"/>
          <rect x="18" y="354" width="764" height="5" rx="3" fill="#f8e298"/>
          {(function(){var sl=[];for(var i=0;i<28;i++){sl.push(<rect key={i} x={20+i*26.9} y="372" width="25" height="98" rx="2" fill={i%2===0?"url(#slE)":"url(#slO)"} stroke="#9a6818" strokeWidth="0.5"/>);}return sl;})()}
          <rect x="62" y="64" width="32" height="308" rx="6" fill="url(#pG)"/>
          <rect x="70" y="72" width="8" height="292" rx="4" fill="rgba(255,255,255,0.20)"/>
          <rect x="706" y="64" width="32" height="308" rx="6" fill="url(#pG)"/>
          <rect x="714" y="72" width="8" height="292" rx="4" fill="rgba(255,255,255,0.20)"/>
          {segs}
          <rect x="92" y={TOP} width="616" height="4" fill="#8a0000"/>
          <rect x="92" y={BOT-4} width="616" height="4" fill="#8a0000"/>
          <rect x="272" y="155" width="256" height="52" rx="8" fill="#2d4a1e" opacity="0.93"/>
          <text x="400" y="175" textAnchor="middle" fontSize="10" fill="#a8d898" fontFamily="sans-serif" letterSpacing="2">{"Lokale & Regionale Erzeuger"}</text>
          <text x="400" y="200" textAnchor="middle" fontSize="24" fontWeight="800" fill="#e8f5d8" fontFamily="sans-serif" letterSpacing="5">{"RegioMap"}</text>
        </svg>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",padding:"0 24px 36px",marginTop:-20,opacity:phase>=3?1:0,transform:phase>=3?"translateY(0)":"translateY(20px)",transition:"all 0.7s ease",position:"relative",zIndex:10}}>
          <button onClick={go} style={{background:"#2d6a4f",color:"white",border:"none",borderRadius:18,padding:"14px 30px",cursor:"pointer",boxShadow:"0 5px 22px rgba(0,0,0,.18)",minWidth:160,textAlign:"center"}}>
            <div style={{fontSize:26,marginBottom:4}}>{"🗺"}</div>
            <div style={{fontSize:15,fontWeight:700}}>{"Anbieter entdecken"}</div>
            <div style={{fontSize:11,opacity:.62,marginTop:2}}>{"Karte & Liste"}</div>
          </button>
          <button onClick={go} style={{background:"rgba(255,255,255,0.93)",color:"#2d4a1e",border:"2px solid #2d6a4f",borderRadius:18,padding:"14px 30px",cursor:"pointer",boxShadow:"0 5px 22px rgba(0,0,0,.18)",minWidth:160,textAlign:"center"}}>
            <div style={{fontSize:26,marginBottom:4}}>{"✏️"}</div>
            <div style={{fontSize:15,fontWeight:700}}>{"Anbieter vorschlagen"}</div>
            <div style={{fontSize:11,opacity:.62,marginTop:2}}>{"Eintrag einreichen"}</div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  var [started,setStarted]=useState(false);
  return started ? <HauptApp/> : <Startbildschirm onEnter={function(){setStarted(true);}} />;
}