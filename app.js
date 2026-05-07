
const SHEET_ID = "1aC-GTEV7pdTYYF2KGw3PjJg54BiAtfREUC4uqWHYy1E";
const SHEET_NAME = "LOCDEX";
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&tqx=out:json`;

const state = {
  gpsBase: [106.79884, -6.59725],
  offsetMeters: { x: 0, y: 0 },
  playerWorld: [106.79884, -6.59725],
  hasRealGps: false,
  geoWatch: null,
  move: { up:false, down:false, left:false, right:false },
  moveSpeedMeters: 72.0,
  playerMarker: null,
  playerMarkerEl: null,
  playerFrameTick: 0,
  playerStepFrame: 0,
  collisionEnabled: true,
  roadOnlyMode: true,
  roadRadiusPx: 74,
  collisionRadiusPx: 26,
  collisionCooldown: 0,
  maxOffsetMeters: 1800,
  facing: "down",
  pois: [],
  activePoiId: null,
  activePoiMode: null,
  activeQuestPoiId: null,
  portalNoticeRadiusMeters: 36,
  portalSeenIds: new Set(),
  portalDismissedIds: new Set(),
  deviceHeadingEnabled: false,
  deviceHeadingBearing: null,
  deviceHeadingLastAt: 0,
  deviceHeadingRaw: null,
  deviceHeadingSmooth: null,
  headingCameraLastAt: 0,
  lastCameraCenter: null,
  compassRequested: false,
  lastPoi: null,
  discovered: new Set(),
  layers: { transit:true, gov:true, health:true, umkm:true },
  browsing: false,
  snapTimer: null,
  portalPulse: 0,
  activeNpcId: null,
  npcQuestCount: 0,
  reportMarkers: [],
  userReports: [],
  npcMarkers: [],
  eventMarkers: [],
  eventPortals: [],
  npcs: [
    { id:"npc_explorer", name:"Pak Ranger", role:"Penjaga Portal", asset:"assets/npc/npc-explorer.png", bubble:"Ranger, portal biru itu jalur transportasi. Coba dekati sampai quest aktif.", quest:"Misi: cari portal transportasi/BisKita terdekat lalu buka Dex-nya." },
    { id:"npc_nenek", name:"Nenek Data", role:"Warga Senior", asset:"assets/npc/npc-nenek.png", bubble:"Nak, jangan cuma lihat peta. Dengarkan warga, baru pilih lokasi yang tepat.", quest:"Misi: temui satu titik layanan publik dan baca fungsi/tupoksinya." },
    { id:"npc_prof", name:"Prof. Dex", role:"Peneliti Kota", asset:"assets/npc/npc-professor.png", bubble:"Aku meneliti portal BogorDex. Setiap portal menyimpan data lokasi penting.", quest:"Misi: scan titik terdekat dari menu utama untuk membuka koleksi Dex." },
    { id:"npc_boy", name:"Ari", role:"Warga Muda", asset:"assets/npc/npc-boy.png", bubble:"Bang, coba cari tempat UMKM. Katanya ada reward kalau ketemu!", quest:"Misi: aktifkan filter UMKM lalu cari portal kuning." },
    { id:"npc_girl", name:"Nisa", role:"Penjaga Quest", asset:"assets/npc/npc-girl.png", bubble:"Kalau mendekati portal, quest akan muncul. Kalau bingung, ngobrol dulu sama NPC.", quest:"Misi: dekati portal sampai popup quest keluar, lalu tekan Mulai Quest." }
  ]
};

state.environment = {
  lastFetchAt: 0,
  lastFetchCoords: null,
  timezone: "Asia/Jakarta",
  temperature: null,
  description: "Memuat cuaca",
  icon: "⛅",
  weatherCode: null,
  isDay: true,
  raining: false
};

const PORTAL_POPUP_DONE_KEY = "bogordex_portal_popup_done_v47";
function loadPortalPopupDone(){
  try{
    const raw = localStorage.getItem(PORTAL_POPUP_DONE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    if(Array.isArray(ids)){
      state.portalSeenIds = new Set(ids);
      state.portalDismissedIds = new Set(ids);
    }
  }catch(e){}
}
function savePortalPopupDone(){
  try{
    const ids = Array.from(new Set([
      ...Array.from(state.portalSeenIds || []),
      ...Array.from(state.portalDismissedIds || [])
    ]));
    localStorage.setItem(PORTAL_POPUP_DONE_KEY, JSON.stringify(ids));
  }catch(e){}
}
function markPortalPopupDone(id){
  if(!id) return;
  state.portalSeenIds.add(id);
  state.portalDismissedIds.add(id);
  savePortalPopupDone();
}
loadPortalPopupDone();

const statusEl = () => document.getElementById("statusText");
const sheetEl = () => document.getElementById("bottomSheet");
const playerSprite = () => document.getElementById("playerSpriteMap") || document.getElementById("playerSprite");
const PLAYER_PROFILE = {
  name: "Ranger Panji",
  gender: "Laki-laki",
  status: "BogorDex Ranger",
  mode: "Road Patrol",
  level: 10,
  summary: "Karakter utama eksplorasi BogorDex. Fokus patroli jalan, portal event, dan penelusuran titik kota."
};
const REALTIME_EVENT_ENDPOINT = window.BOGORDEX_GOOGLE_REALTIME_ENDPOINT || "";

function setStatus(text){
  statusEl().textContent = text;
  const lamp = document.getElementById("statusLamp");
  if(lamp){
    lamp.classList.remove("lamp-green","lamp-yellow","lamp-red");
    const t = String(text || "").toLowerCase();
    if(t.includes("gagal") || t.includes("error")) lamp.classList.add("lamp-red");
    else if(t.includes("memuat") || t.includes("mengambil") || t.includes("scan")) lamp.classList.add("lamp-yellow");
    else lamp.classList.add("lamp-green");
  }
}
function updatePlayerUiMeta(){
  document.querySelectorAll('.trainer-name').forEach(el => el.textContent = PLAYER_PROFILE.status);
  document.querySelectorAll('.trainer-level').forEach(el => el.textContent = `Lv ${PLAYER_PROFILE.level} Explorer`);
  const ids = { profileName:PLAYER_PROFILE.name, profileName2:PLAYER_PROFILE.name, profileGender:PLAYER_PROFILE.gender, profileRole:PLAYER_PROFILE.status, profileMode:PLAYER_PROFILE.mode, profileLevel:String(PLAYER_PROFILE.level), profileStatus:PLAYER_PROFILE.status + ' • ' + PLAYER_PROFILE.mode, profileSummary:PLAYER_PROFILE.summary };
  Object.entries(ids).forEach(([id,val]) => { const el=document.getElementById(id); if(el) el.textContent=val; });
  const lbl = document.querySelector('.player-name-tag b');
  if(lbl) lbl.textContent = PLAYER_PROFILE.name;
}
function chatDock(){ return document.getElementById('animeChatDock'); }
function openChatDock(){ chatDock()?.classList.remove('collapsed'); }
function closeChatDock(){ chatDock()?.classList.add('collapsed'); }

function clearNPCMarkers(){
  if(!state.npcMarkers) state.npcMarkers = [];
  state.npcMarkers.forEach(m => {
    try{ m.remove(); }catch(e){}
  });
  state.npcMarkers = [];
}
function npcCoordFromPortal(index, fallbackMetersX, fallbackMetersY){
  const poi = state.pois && state.pois[index % Math.max(1, state.pois.length)];
  const base = poi && poi.coords ? poi.coords : state.gpsBase;
  const [dLng,dLat] = metersToLngLatOffset(fallbackMetersX, fallbackMetersY, base[1]);
  return [base[0] + dLng, base[1] + dLat];
}
function placeNPCsNearPortals(){
  // NPC dibuat tetap di titik map yang agak menyebar. Bukan overlay layar dan bukan nempel portal.
  const base = state.gpsBase || [106.79884, -6.59725];
  const offsets = [
    [-420, 300], [390, 260], [-360, -310], [430, -250], [40, 430]
  ];
  state.npcs.forEach((npc, i) => {
    const o = offsets[i] || [0, 0];
    const [dLng,dLat] = metersToLngLatOffset(o[0], o[1], base[1]);
    npc.coords = [base[0] + dLng, base[1] + dLat];
  });
}
function npcElement(npc, idx){
  const el = document.createElement("button");
  el.type = "button";
  el.className = "npc map-npc";
  el.dataset.npcId = npc.id;
  el.style.animationDelay = (idx * .18) + "s";
  el.innerHTML = `
    <span class="npc-quest-mark">!</span>
    <span class="npc-name">${npc.name}</span>
    <span class="npc-bubble">${npc.bubble}</span>
    <span class="npc-sprite" style="background-image:url('${npc.asset}')"></span>
  `;
  el.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openNpcDialog(npc.id);
  });
  return el;
}
function renderNPCs(){
  if(!map || !maplibregl) return;
  clearNPCMarkers();
  placeNPCsNearPortals();
  state.npcs.forEach((npc, idx) => {
    const marker = new maplibregl.Marker({
      element: npcElement(npc, idx),
      anchor: "bottom",
      offset: [0, 4],
      rotationAlignment: "viewport",
      pitchAlignment: "viewport"
    }).setLngLat(npc.coords).addTo(map);
    state.npcMarkers.push(marker);
  });
}
function openNpcDialog(npcId){
  const npc = state.npcs.find(n => n.id === npcId);
  if(!npc) return;
  state.activeNpcId = npc.id;
  const modal = document.getElementById("npcDialog");
  const avatar = document.getElementById("npcDialogAvatar");
  avatar.style.backgroundImage = `url('${npc.asset}')`;
  document.getElementById("npcDialogRole").textContent = npc.role;
  document.getElementById("npcDialogName").textContent = npc.name;
  document.getElementById("npcDialogText").textContent = npc.bubble + " " + npc.quest;
  modal.classList.remove("hidden");
  updateStatus("Ngobrol dengan " + npc.name);
}
function closeNpcDialog(){
  document.getElementById("npcDialog").classList.add("hidden");
  state.activeNpcId = null;
}
function acceptNpcQuest(){
  const npc = state.npcs.find(n => n.id === state.activeNpcId);
  if(!npc) return;
  state.npcQuestCount += 1;
  closeNpcDialog();
  updateStatus("Quest diterima: " + npc.name);
  const hit = nearestPoiWithin(npc.coords || state.playerWorld, 999999);
  if(hit){
    state.lastPoi = hit.poi;
    showQuestPopup(hit.poi, hit.dist);
  }
}
function updateNpcNearState(){
  if(!state.npcMarkers || !state.npcMarkers.length) return;
  state.npcMarkers.forEach(marker => {
    const el = marker.getElement();
    const npc = state.npcs.find(n => n.id === el.dataset.npcId);
    if(!npc || !npc.coords) return;
    const d = haversineMeters(state.playerWorld, npc.coords);
    el.classList.toggle("near", d < 115);
  });
}

function setPlayerAnim(mode, facing){
  const el = playerSprite();
  if(!el) return;
  if(facing) state.facing = facing;
  state.playerMode = mode || "idle";
  el.classList.remove("idle","walk","run","face-down","face-up","face-left","face-right");
  el.classList.add(state.playerMode);
  el.classList.add("face-" + (state.facing || "down"));
  applyPlayerSpriteFrame();
}

function applyPlayerSpriteFrame(){
  const el = playerSprite();
  if(!el) return;
  // Sprite utama 4x4: baris = arah, kolom = frame langkah.
  // Ini sengaja dibuat pakai background-position manual supaya karakter tidak hilang
  // dan tidak ikut muter saat map/kompas berputar.
  const fw = 100;
  const fh = 100;
  const facingRows = { down:0, left:1, right:2, up:3 };
  const facing = state.facing || "down";
  const row = facingRows[facing] ?? 0;
  const col = (state.playerMode === "walk" || state.playerMode === "run") ? (state.playerStepFrame % 4) : 0;
  el.style.setProperty("--sprite-x", (-col * fw) + "px");
  el.style.setProperty("--sprite-y", (-row * fh) + "px");
}

function createPlayerMapMarker(){
  if(state.playerMarker || !maplibregl || !map) return;
  const el = document.createElement("div");
  el.className = "player-map-marker";
  el.innerHTML = `<div class="player-name-tag"><span>⚡</span><b>${PLAYER_PROFILE.name}</b></div><div class="player-ring"></div><div class="player-shadow"></div><div id="playerSpriteMap" class="player-sprite idle face-down"></div>`;
  state.playerMarkerEl = el;
  state.playerMarker = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, 2], rotationAlignment: "viewport", pitchAlignment: "viewport" })
    .setLngLat(state.playerWorld)
    .addTo(map);
  setPlayerAnim("idle", state.facing || "down");
}

function updatePlayerMapMarker(){
  if(state.playerMarker) state.playerMarker.setLngLat(state.playerWorld);
}
function metersToLngLatOffset(mx, my, latDeg){
  const latRad = latDeg * Math.PI / 180;
  return [mx / (111320 * Math.cos(latRad)), my / 110540];
}
function clampOffset(){
  const d = Math.hypot(state.offsetMeters.x, state.offsetMeters.y);
  if(d <= state.maxOffsetMeters) return;
  const r = state.maxOffsetMeters / d;
  state.offsetMeters.x *= r;
  state.offsetMeters.y *= r;
}
function recomputePlayerWorld(){
  const [dLng, dLat] = metersToLngLatOffset(state.offsetMeters.x, state.offsetMeters.y, state.gpsBase[1]);
  state.playerWorld = [state.gpsBase[0] + dLng, state.gpsBase[1] + dLat];
  updatePlayerMapMarker();
}
function haversineMeters(a, b){
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[1]-a[1]);
  const dLng = toRad(b[0]-a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function updateStatus(prefix){
  const d = Math.hypot(state.offsetMeters.x, state.offsetMeters.y).toFixed(1);
  setStatus(prefix ? `${prefix} • offset ${d} m` : `Offset manual ${d} / ${state.maxOffsetMeters} m`);
}

const WEATHER_REFRESH_MS = 10 * 60 * 1000;
const WEATHER_REFRESH_MOVE_METERS = 200;

function weatherCodeMeta(code){
  const c = Number(code);
  if(c === 0) return { text:'Cerah', icon:'☀️', rain:false };
  if([1,2].includes(c)) return { text:'Cerah Berawan', icon:'⛅', rain:false };
  if(c === 3) return { text:'Berawan', icon:'☁️', rain:false };
  if([45,48].includes(c)) return { text:'Berkabut', icon:'🌫️', rain:false };
  if([51,53,55,56,57].includes(c)) return { text:'Gerimis', icon:'🌦️', rain:true };
  if([61,63,65,66,67,80,81,82].includes(c)) return { text:'Hujan', icon:'🌧️', rain:true };
  if([71,73,75,77,85,86].includes(c)) return { text:'Salju', icon:'❄️', rain:false };
  if([95,96,99].includes(c)) return { text:'Badai', icon:'⛈️', rain:true };
  return { text:'Cuaca', icon:'⛅', rain:false };
}

function updateWeatherClock(){
  const timeEl = document.getElementById('weatherLocTime');
  if(!timeEl) return;
  const tz = state.environment?.timezone || 'Asia/Jakarta';
  const now = new Date();
  const timeText = now.toLocaleTimeString('id-ID',{ hour:'2-digit', minute:'2-digit', timeZone:tz });
  const dateText = now.toLocaleDateString('id-ID',{ weekday:'short', day:'numeric', month:'short', timeZone:tz });
  timeEl.textContent = `${timeText} • ${dateText}`;
}

function updateWeatherChip(){
  const tempEl = document.getElementById('weatherTemp');
  const descEl = document.getElementById('weatherDesc');
  const iconEl = document.getElementById('weatherIcon');
  if(tempEl) tempEl.textContent = Number.isFinite(state.environment.temperature) ? `${Math.round(state.environment.temperature)}°C` : '--°C';
  if(descEl) descEl.textContent = state.environment.description || 'Cuaca';
  if(iconEl) iconEl.textContent = state.environment.icon || '⛅';
  updateWeatherClock();
}

function applyEnvironmentClasses(){
  const app = document.getElementById('app');
  const raining = !!state.environment.raining;
  const isNight = state.environment.isDay === false;
  document.body.classList.toggle('weather-rain', raining);
  document.body.classList.toggle('is-night', isNight);
  if(app){
    app.classList.toggle('weather-rain', raining);
    app.classList.toggle('is-night', isNight);
  }
  updateWeatherChip();
  applySceneTheme();
}

function applySceneTheme(){
  if(!map || !map.getStyle || !map.isStyleLoaded()) return;
  const isNight = document.body.classList.contains('is-night');
  try{
    if(map.getLayer('bdx-ghost-buildings')){
      map.setPaintProperty('bdx-ghost-buildings', 'fill-extrusion-color', isNight ? '#7ea6ff' : '#87dcff');
      map.setPaintProperty('bdx-ghost-buildings', 'fill-extrusion-opacity', isNight ? 0.28 : 0.34);
    }
  }catch(e){}
  try{
    if(typeof map.setLight === 'function'){
      map.setLight({
        anchor: 'viewport',
        color: isNight ? '#bcd3ff' : '#fff4d2',
        intensity: isNight ? 0.26 : 0.42,
        position: [1.5, isNight ? 200 : 160, isNight ? 30 : 45]
      });
    }
  }catch(e){}
}

async function refreshEnvironment(force=false){
  try{
    const [lng, lat] = state.gpsBase || state.playerWorld || [106.79884, -6.59725];
    if(!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const now = Date.now();
    const last = state.environment.lastFetchCoords;
    const moved = last ? haversineMeters([last.lng, last.lat], [lng, lat]) : Infinity;
    if(!force && (now - (state.environment.lastFetchAt || 0) < WEATHER_REFRESH_MS) && moved < WEATHER_REFRESH_MOVE_METERS) return;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,is_day,rain,showers,snowfall,cloud_cover&timezone=auto`;
    const res = await fetch(url, { cache:'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const current = data.current || {};
    const meta = weatherCodeMeta(current.weather_code);
    const rainValue = Number(current.rain || 0) + Number(current.showers || 0);
    const cloudCover = Number(current.cloud_cover || 0);
    state.environment.lastFetchAt = now;
    state.environment.lastFetchCoords = { lat, lng };
    state.environment.timezone = data.timezone || 'Asia/Jakarta';
    state.environment.temperature = Number(current.temperature_2m);
    state.environment.description = rainValue > 0.12 ? "Hujan" : (cloudCover > 78 ? "Berawan" : "Cerah Berawan");
    state.environment.icon = rainValue > 0.12 ? "🌧️" : (cloudCover > 78 ? "☁️" : "⛅");
    state.environment.weatherCode = Number(current.weather_code);
    state.environment.isDay = Number(current.is_day) === 1;
    state.environment.raining = rainValue > 0.12;
    applyEnvironmentClasses();
  }catch(err){
    console.warn('Weather fetch failed:', err);
    updateWeatherChip();
  }
}

setInterval(updateWeatherClock, 30000);
function syncMiniButton(){}
function openSheet(poi, mode="manual"){
  sheetEl().classList.remove("hidden-sheet");
  sheetEl().classList.remove("collapsed");
  state.activePoiId = poi.id || null;
  state.activePoiMode = mode;
  state.lastPoi = poi;
  document.getElementById("sheetContent").innerHTML = `
    <h3>${poi.name}</h3>
    <p>${poi.desc || "Tidak ada deskripsi."}</p>
    <div class="section">
      <div class="section-title">Fungsi</div>
      <p>${poi.fungsi || "Belum diisi."}</p>
    </div>
    <div class="section">
      <div class="section-title">Tupoksi Singkat</div>
      <p>${poi.tupoksi || "Belum diisi."}</p>
    </div>
    <div class="tag-row">
      <span class="tag">${poi.group || "POI"}</span>
      ${poi.aktif ? '<span class="tag">Aktif</span>' : ""}
    </div>
  `;
  syncMiniButton();
  updateStatus(poi.name);
}
function closeSheet(resetStatus=true, fullyHide=true){
  if(fullyHide){
    sheetEl().classList.add("hidden-sheet");
    sheetEl().classList.remove("collapsed");
  }else{
    sheetEl().classList.remove("hidden-sheet");
    sheetEl().classList.add("collapsed");
  }
  if(resetStatus) updateStatus(state.hasRealGps ? "Lokasi aktif" : "Lokasi simulasi");
  syncMiniButton();
}
function renderDex(){ updatePlayerUiMeta(); }
function normalizeGroup(group){
  const g = String(group || "").toUpperCase().trim();
  if(g.includes("HALTE")) return "halte";
  if(g.includes("PUSKESMAS") || g.includes("RUMAH SAKIT")) return "health";
  if(g.includes("UMKM") || g.includes("KULINER")) return "umkm";
  return "gov";
}
function parseLocation(value){
  if(!value) return null;
  const parts = String(value).split(",").map(v => parseFloat(v.trim()));
  if(parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return [parts[1], parts[0]];
}
function normalizeRows(rows, plain){
  return rows.map((row, idx) => {
    const getVal = i => plain ? row[i] : row[i]?.v;
    const group = getVal(0) || "";
    const name = getVal(1) || `POI ${idx+1}`;
    const location = getVal(2) || "";
    const fungsi = getVal(3) || "";
    const tupoksi = getVal(4) || "";
    const deskripsi = getVal(5) || "";
    const warna = getVal(7) || "";
    const aktif = String(getVal(8) ?? "TRUE").toUpperCase() !== "FALSE";
    const coords = parseLocation(location);
    const category = normalizeGroup(group);
    return { id:`poi_${idx}`, group, name, fungsi, tupoksi, desc:deskripsi, warna, aktif, coords, category };
  }).filter(p => p.coords && p.aktif);
}
function toFeature(poi){
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: poi.coords },
    properties: { id: poi.id, name: poi.name, category: poi.category }
  };
}

function makePortalIcon(color, category){
  const c = document.createElement('canvas');
  c.width = 260; c.height = 300;
  const x = c.getContext('2d');
  x.save();
  x.translate(130, 158);

  // lantai portal
  x.fillStyle = 'rgba(0,0,0,0.22)';
  x.beginPath(); x.ellipse(0, 100, 62, 18, 0, 0, Math.PI*2); x.fill();

  // sinar bawah
  const beam = x.createRadialGradient(0, 42, 8, 0, 42, 108);
  beam.addColorStop(0, 'rgba(255,255,255,.70)');
  beam.addColorStop(.35, lighten(color,.42));
  beam.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = beam;
  x.beginPath(); x.ellipse(0, 22, 66, 104, 0, 0, Math.PI*2); x.fill();

  // lingkaran luar ala portal dunia digital
  for(let i=0;i<3;i++){
    x.save();
    x.rotate((i*0.62));
    x.strokeStyle = i===0 ? 'rgba(255,255,255,.95)' : (i===1 ? lighten(color,.18) : 'rgba(107,230,255,.74)');
    x.lineWidth = i===0 ? 10 : 5;
    x.setLineDash(i===0 ? [34,14] : [13,10]);
    x.beginPath(); x.ellipse(0, 0, 62+i*9, 82+i*7, 0, 0, Math.PI*2); x.stroke();
    x.restore();
  }

  // swirl dalam
  const vortex = x.createLinearGradient(-54,-70,54,70);
  vortex.addColorStop(0, 'rgba(255,255,255,.98)');
  vortex.addColorStop(.35, lighten(color,.34));
  vortex.addColorStop(.68, color);
  vortex.addColorStop(1, darken(color,.2));
  x.fillStyle = vortex;
  x.beginPath(); x.ellipse(0,0,44,62,0,0,Math.PI*2); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.92)'; x.lineWidth = 5;
  x.beginPath(); x.ellipse(0,0,44,62,0,0,Math.PI*2); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.52)'; x.lineWidth = 4;
  for(let i=0;i<4;i++){
    x.beginPath();
    x.arc(0,0,18+i*9, i*.9, i*.9+Math.PI*1.25);
    x.stroke();
  }

  // pecahan data digital
  x.fillStyle = 'rgba(255,255,255,.92)';
  [[-78,-56,9],[-82,30,6],[72,-34,7],[84,48,10],[-44,-94,5],[48,-98,6]].forEach(([px,py,r])=>{x.beginPath();x.roundRect(px,py,r*2,r*2,3);x.fill();});

  // badge kategori
  x.fillStyle = 'rgba(8,18,44,.46)'; x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 4;
  x.beginPath(); x.arc(0, -7, 21, 0, Math.PI*2); x.fill(); x.stroke();
  x.font = '22px sans-serif'; x.textAlign='center'; x.textBaseline='middle';
  const emoji = category === 'gov' ? '🏢' : category === 'halte' ? '🚌' : category === 'health' ? '🏥' : '🛍️';
  x.fillStyle = 'white'; x.fillText(emoji, 0, -5);

  x.restore();
  return x.getImageData(0,0,c.width,c.height);
}
function hexToRgb(hex){
  const h = hex.replace('#','');
  return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
}
function lighten(hex, amount){
  const [r,g,b] = hexToRgb(hex);
  const mix = v => Math.round(v + (255-v)*amount);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
function darken(hex, amount){
  const [r,g,b] = hexToRgb(hex);
  const mix = v => Math.round(v*(1-amount));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

const CAMERA_PITCH = 78;
const CAMERA_ZOOM = 19.25;
// Jangan terlalu jauh: kalau terlalu besar karakter terdorong ke bawah dan hilang di balik UI.
const CAMERA_AHEAD_METERS = 70;
const CAMERA_FOLLOW_MIN_MS = 210;
const HEADING_DEADBAND_DEG = 2.8;
const HEADING_SMOOTH_ALPHA = 0.075;
function degToRad(d){ return d * Math.PI / 180; }
function getCameraBearing(){
  if(state.deviceHeadingEnabled && typeof state.deviceHeadingBearing === "number") return state.deviceHeadingBearing;
  return map && typeof map.getBearing === "function" ? map.getBearing() : 0;
}
function getScreenOrientationAngle(){
  try{
    if(screen && screen.orientation && typeof screen.orientation.angle === "number") return screen.orientation.angle || 0;
  }catch(e){}
  if(typeof window.orientation === "number") return window.orientation || 0;
  return 0;
}
function shortestHeadingDiff(target, current){
  return ((target - current + 540) % 360) - 180;
}
function applyDeviceHeadingToCamera(heading, duration=240){
  heading = normalizeHeading(heading);
  if(heading === null) return;
  state.deviceHeadingRaw = heading;
  state.deviceHeadingEnabled = true;
  state.deviceHeadingLastAt = Date.now();

  // Sensor kompas Android sering noise. Ini dibuat seperti Google Maps:
  // perubahan kecil diabaikan, perubahan besar dikejar pelan.
  if(typeof state.deviceHeadingSmooth !== "number"){
    state.deviceHeadingSmooth = heading;
  }else{
    const diff = shortestHeadingDiff(heading, state.deviceHeadingSmooth);
    if(Math.abs(diff) < HEADING_DEADBAND_DEG) return;
    state.deviceHeadingSmooth = normalizeHeading(state.deviceHeadingSmooth + diff * HEADING_SMOOTH_ALPHA);
  }
  state.deviceHeadingBearing = state.deviceHeadingSmooth;

  const now = performance.now();
  if(now - (state.headingCameraLastAt || 0) < CAMERA_FOLLOW_MIN_MS) return;
  state.headingCameraLastAt = now;
  if(map && !state.browsing){
    followPlayerCamera({ bearing: state.deviceHeadingBearing, duration });
  }
}
function cameraCenterAhead(bearing){
  const b = typeof bearing === "number" ? bearing : getCameraBearing();
  const rad = degToRad(b);
  // Center digeser ke depan sedikit supaya karakter tetap terlihat di bawah-tengah, bukan hilang di bawah UI.
  const mx = Math.sin(rad) * CAMERA_AHEAD_METERS;
  const my = Math.cos(rad) * CAMERA_AHEAD_METERS;
  const [dLng,dLat] = metersToLngLatOffset(mx, my, state.playerWorld[1]);
  return [state.playerWorld[0] + dLng, state.playerWorld[1] + dLat];
}
function followPlayerCamera(opts={}){
  if(!map) return;
  const bearing = typeof opts.bearing === "number" ? normalizeHeading(opts.bearing) : getCameraBearing();
  const zoom = typeof opts.zoom === "number" ? opts.zoom : CAMERA_ZOOM;
  const center = cameraCenterAhead(bearing);
  const payload = { center, zoom, pitch: CAMERA_PITCH, bearing };
  state.lastCameraCenter = center;
  if(opts.duration) map.easeTo({ ...payload, duration: opts.duration, easing:t=>(1 - Math.pow(1-t, 3)) });
  else map.jumpTo(payload);
}
function lockPitchOnly(){
  if(!map) return;
  const currentPitch = Math.round(map.getPitch());
  if(Math.abs(currentPitch - CAMERA_PITCH) > 1){
    map.easeTo({ pitch: CAMERA_PITCH, duration: 120 });
  }
}

const MAPLIBRE_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const map = new maplibregl.Map({
  container: "map",
  style: MAPLIBRE_STYLE_URL,
  center: state.playerWorld,
  zoom: CAMERA_ZOOM,
  minZoom: 18.4,
  maxZoom: 20.2,
  pitch: CAMERA_PITCH,
  minPitch: CAMERA_PITCH,
  maxPitch: CAMERA_PITCH,
  bearing: 0,
  antialias: true,
  renderWorldCopies: false,
  refreshExpiredTiles: false,
  fadeDuration: 80,
  maxTileCacheSize: 192,
  dragRotate: true,
  pitchWithRotate: false,
  touchPitch: false
});
try{ map.touchZoomRotate.enableRotation(); }catch(e){}
try{ map.dragRotate.enable(); }catch(e){}


function setupMapLibre3D(){
  // V34: Pokemon GO/anime map mode. Gedung 3D disembunyikan supaya peta terasa lapang,
  // tapi layer collision transparan tetap ada agar karakter tidak gampang masuk area bangunan.
  setupAnimeMapMode();
  applySceneTheme();
  refreshEnvironment(true);
}

function getVectorBuildingSourceId(){
  const style = map.getStyle();
  if(!style || !style.sources) return null;
  if(style.sources.openmaptiles) return 'openmaptiles';
  if(style.sources.openfreemap) return 'openfreemap';
  return Object.keys(style.sources).find(id => /openmaptiles|openfreemap|osm|vector/i.test(id)) || null;
}

function setupAnimeMapMode(){
  if(!map || !map.getStyle) return;
  const style = map.getStyle();
  const layers = style.layers || [];

  // Mode Pokemon GO: gedung tetap ada sebagai volume MapLibre, tapi transparan/tembus pandang.
  layers.forEach(layer => {
    const id = String(layer.id || '').toLowerCase();
    const sl = String(layer['source-layer'] || '').toLowerCase();
    if(id.includes('building') || sl.includes('building')){
      try{ map.setLayoutProperty(layer.id, 'visibility', 'none'); }catch(e){}
      return;
    }
    // Hilangkan layer yang sering bikin garis/strip saat pitch tinggi.
    const noisy = id.includes('hillshade') || id.includes('contour') || id.includes('landcover') || id.includes('landuse-pattern') || id.includes('background-pattern');
    if(noisy){
      try{ map.setLayoutProperty(layer.id, 'visibility', 'none'); }catch(e){}
    }
  });

  const vectorSourceId = getVectorBuildingSourceId();
  if(!vectorSourceId) return;

  try{
    const labelLayer = layers.find(l => l.type === 'symbol' && l.layout && l.layout['text-field']);
    const beforeId = labelLayer && labelLayer.id;
    if(!map.getLayer('bdx-ghost-buildings')){
      map.addLayer({
        id:'bdx-ghost-buildings',
        source:vectorSourceId,
        'source-layer':'building',
        type:'fill-extrusion',
        minzoom:15,
        paint:{
          'fill-extrusion-color':'#78ddff',
          'fill-extrusion-height':['interpolate',['linear'],['zoom'],15,2,18,['coalesce',['get','render_height'],['get','height'],18]],
          'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0],
          'fill-extrusion-opacity':0.22,
          'fill-extrusion-vertical-gradient':true
        }
      }, beforeId);
    }
    if(!map.getLayer('bdx-building-collision')){
      map.addLayer({
        id:'bdx-building-collision',
        source:vectorSourceId,
        'source-layer':'building',
        type:'fill',
        minzoom:15,
        paint:{
          'fill-color':'#6ee7ff',
          'fill-opacity':0.001
        }
      }, beforeId);
    }
  }catch(err){
    console.warn('Ghost building layer skipped:', err);
  }
}

const routeFeatures = {
  k5:{type:"Feature",geometry:{type:"LineString",coordinates:[[106.78984,-6.59458],[106.7942,-6.5937],[106.7986,-6.5914],[106.80643,-6.60276],[106.81581,-6.54236]]}},
  k6:{type:"Feature",geometry:{type:"LineString",coordinates:[[106.76385,-6.56339],[106.75124,-6.57380],[106.78984,-6.59458],[106.80643,-6.60276]]}},
  run:{type:"Feature",geometry:{type:"LineString",coordinates:[[106.79884,-6.59725],[106.8010,-6.5965],[106.8011,-6.5938],[106.7987,-6.5930],[106.79884,-6.59725]]}}
};


function makeGameBuildingIcon(kind){
  const c = document.createElement('canvas');
  c.width = 150; c.height = 150;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.18)';
  x.beginPath(); x.ellipse(75,128,42,14,0,0,Math.PI*2); x.fill();
  const palette = {
    tower:['#6be6ff','#3b7dff','#244bba'],
    shop:['#ffd76b','#ff7aa8','#c74478'],
    park:['#89f0a8','#32b871','#16744d'],
    civic:['#ffffff','#9fb7ff','#4c63cf']
  }[kind] || ['#fff','#9fd4ff','#4373d8'];
  const g = x.createLinearGradient(0,22,0,122);
  g.addColorStop(0,palette[0]); g.addColorStop(.54,palette[1]); g.addColorStop(1,palette[2]);
  x.fillStyle = g;
  x.strokeStyle = 'rgba(255,255,255,.78)';
  x.lineWidth = 4;
  if(kind === 'park'){
    x.beginPath(); x.arc(75,62,35,0,Math.PI*2); x.fill(); x.stroke();
    x.fillStyle = '#8b5a3c'; x.fillRect(68,82,14,38);
    x.fillStyle = '#5be08d'; x.beginPath(); x.arc(54,78,20,0,Math.PI*2); x.fill();
    x.beginPath(); x.arc(96,78,20,0,Math.PI*2); x.fill();
  } else {
    x.beginPath(); x.roundRect(42,45,66,76,14); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.84)';
    x.beginPath(); x.roundRect(52,33,46,20,10); x.fill();
    x.fillStyle = 'rgba(21,39,78,.20)';
    for(let yy=64; yy<=94; yy+=18){
      x.fillRect(55,yy,12,10); x.fillRect(72,yy,12,10); x.fillRect(89,yy,12,10);
    }
    if(kind === 'shop'){
      x.fillStyle = '#fff'; x.fillRect(48,48,54,12);
      x.fillStyle = '#ff4f91'; x.fillRect(48,48,9,12); x.fillRect(66,48,9,12); x.fillRect(84,48,9,12);
    }
  }
  return x.getImageData(0,0,c.width,c.height);
}

function gameBuildingFeatures(){
  const base = state.playerWorld || state.gpsBase;
  const offsets = [
    [-105,72,'tower','Balai Quest'], [104,62,'shop','Kios UMKM'], [-78,-92,'park','Taman Dex'],
    [126,-92,'civic','Gedung Data'], [42,132,'shop','Warung Buff'], [-136,18,'tower','Menara Portal'],
    [162,20,'civic','Pusat Misi'], [-170,-64,'park','Hutan Mini'], [0,-150,'tower','Gate Ranger'],
    [210,112,'shop','Pasar Digital'], [-220,104,'civic','Kantor NPC']
  ];
  const features = offsets.map((o,idx)=>{
    const [dLng,dLat]=metersToLngLatOffset(o[0],o[1],base[1]);
    return {type:'Feature',geometry:{type:'Point',coordinates:[base[0]+dLng,base[1]+dLat]},properties:{id:'gb_'+idx,kind:o[2],name:o[3]}};
  });
  // Bangunan pendamping di sekitar beberapa portal asli supaya map terasa kota-game, bukan map polos.
  state.pois.slice(0, 18).forEach((poi, idx)=>{
    const kinds = ['tower','civic','shop','park'];
    const meters = 28 + (idx % 4) * 12;
    const angle = (idx * 47) * Math.PI / 180;
    const [dLng,dLat]=metersToLngLatOffset(Math.cos(angle)*meters, Math.sin(angle)*meters, poi.coords[1]);
    features.push({type:'Feature',geometry:{type:'Point',coordinates:[poi.coords[0]+dLng, poi.coords[1]+dLat]},properties:{id:'gb_poi_'+idx,kind:kinds[idx%kinds.length],name:'Area '+poi.name}});
  });
  return features;
}

function setupGameBuildings(){
  if(!map.getSource('game-buildings')) map.addSource('game-buildings',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  ['tower','shop','park','civic'].forEach(k=>{ if(!map.hasImage('gb-'+k)) map.addImage('gb-'+k, makeGameBuildingIcon(k), {pixelRatio:2}); });
  if(!map.getLayer('game-ground')){
    map.addLayer({id:'game-ground',type:'circle',source:'game-buildings',paint:{
      'circle-radius':['interpolate',['linear'],['zoom'],16.4,34,19.3,72],
      'circle-color':['match',['get','kind'],'park','#5be08d','shop','#ffd76b','tower','#6be6ff','civic','#b9c7ff','#ffffff'],
      'circle-opacity':0.16,
      'circle-blur':0.55
    }});
  }
  if(!map.getLayer('game-building-symbols')){
    map.addLayer({id:'game-building-symbols',type:'symbol',source:'game-buildings',layout:{
      'icon-image':['concat','gb-',['get','kind']],
      'icon-size':['interpolate',['linear'],['zoom'],16.4,0.74,19.3,1.16],
      'icon-anchor':'bottom','icon-allow-overlap':true,'icon-ignore-placement':true,
      'icon-pitch-alignment':'viewport','icon-rotation-alignment':'viewport','symbol-sort-key':3
    }});
  }
  map.getSource('game-buildings').setData({type:'FeatureCollection',features:gameBuildingFeatures()});
}

function setupPoiLayers(){
  if(!map.getSource("pois")){
    map.addSource("pois", { type:"geojson", data:{ type:"FeatureCollection", features:[] }});
  }
  if(!map.hasImage("gov-marker")) map.addImage("gov-marker", makePortalIcon("#ff6475","gov"), {pixelRatio:2});
  if(!map.hasImage("halte-marker")) map.addImage("halte-marker", makePortalIcon("#4b84ff","halte"), {pixelRatio:2});
  if(!map.hasImage("health-marker")) map.addImage("health-marker", makePortalIcon("#8d7bff","health"), {pixelRatio:2});
  if(!map.hasImage("umkm-marker")) map.addImage("umkm-marker", makePortalIcon("#ffbf5e","umkm"), {pixelRatio:2});

  if(!map.getLayer("poi-glow")){
    map.addLayer({
      id:"poi-glow",
      type:"circle",
      source:"pois",
      paint:{
        "circle-radius":["interpolate",["linear"],["zoom"],16.4,74,19.3,152],
        "circle-color":["match",["get","category"],"gov","#ff6475","halte","#4b84ff","health","#8d7bff","umkm","#ffbf5e","#ffffff"],
        "circle-opacity":0.18,
        "circle-blur":0.7
      }
    });
  }

  if(!map.getLayer("poi-ring-outer")){
    map.addLayer({
      id:"poi-ring-outer",
      type:"circle",
      source:"pois",
      paint:{
        "circle-radius":["interpolate",["linear"],["zoom"],16.4,44,19.3,96],
        "circle-color":"rgba(255,255,255,0)",
        "circle-stroke-color":["match",["get","category"],"gov","#ff6475","halte","#4b84ff","health","#8d7bff","umkm","#ffbf5e","#ffffff"],
        "circle-stroke-width":4,
        "circle-stroke-opacity":0.74,
        "circle-blur":0.08
      }
    });
  }
  if(!map.getLayer("poi-ring-inner")){
    map.addLayer({
      id:"poi-ring-inner",
      type:"circle",
      source:"pois",
      paint:{
        "circle-radius":["interpolate",["linear"],["zoom"],16.4,26,19.3,58],
        "circle-color":"rgba(255,255,255,0)",
        "circle-stroke-color":"#ffffff",
        "circle-stroke-width":2,
        "circle-stroke-opacity":0.84,
        "circle-blur":0.05
      }
    });
  }

  if(!map.getLayer("poi-symbols")){
    map.addLayer({
      id:"poi-symbols",
      type:"symbol",
      source:"pois",
      layout:{
        "icon-image":["concat",["get","category"],"-marker"],
        "icon-size":["interpolate",["linear"],["zoom"],16.4,1.28,19.3,2.16],
        "icon-anchor":"bottom",
        "icon-allow-overlap":true,
        "icon-ignore-placement":true,
        "icon-pitch-alignment":"viewport",
        "icon-rotation-alignment":"viewport",
        "symbol-sort-key":20
      }
    });
  }

  if(!map.getLayer("poi-label")){
    map.addLayer({
      id:"poi-label",
      type:"symbol",
      source:"pois",
      layout:{
        "text-field":["get","name"],
        "text-size":["interpolate",["linear"],["zoom"],16.4,12,19.3,16],
        "text-offset":[0,5.2],
        "text-anchor":"top",
        "text-allow-overlap":true,
        "symbol-sort-key":10
      },
      paint:{
        "text-color":"#20365f",
        "text-halo-color":"rgba(255,255,255,0.96)",
        "text-halo-width":1.8
      },
      minzoom:16.0
    });
  }

  applyLayerFilters();

  map.on("click", "poi-symbols", (e) => {
    const feature = e.features && e.features[0];
    if(!feature) return;
    const poi = state.pois.find(p => p.id === feature.properties.id);
    if(!poi) return;
    state.discovered.add(poi.id);
    state.portalDismissedIds.add(poi.id);
    renderDex();
    openSheet(poi, "manual");
  });

  map.on("mouseenter", "poi-symbols", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "poi-symbols", () => { map.getCanvas().style.cursor = ""; });
}
function refreshPoiSource(){
  const source = map.getSource("pois");
  if(!source) return;
  source.setData({ type:"FeatureCollection", features: state.pois.map(toFeature) });
}
function applyLayerFilters(){
  const f = ["any"];
  if(state.layers.gov) f.push(["==", ["get","category"], "gov"]);
  if(state.layers.transit) f.push(["==", ["get","category"], "halte"]);
  if(state.layers.health) f.push(["==", ["get","category"], "health"]);
  if(state.layers.umkm) f.push(["==", ["get","category"], "umkm"]);
  const filter = f.length === 1 ? ["==", ["get","category"], "__none__"] : f;
  if(map.getLayer("poi-glow")) map.setFilter("poi-glow", filter);
  if(map.getLayer("poi-ring-outer")) map.setFilter("poi-ring-outer", filter);
  if(map.getLayer("poi-ring-inner")) map.setFilter("poi-ring-inner", filter);
  if(map.getLayer("poi-symbols")) map.setFilter("poi-symbols", filter);
  if(map.getLayer("poi-label")) map.setFilter("poi-label", filter);
}

function questPopupEl(){ return document.getElementById("questPopup"); }
function showQuestPopup(poi, dist){
  const el = questPopupEl();
  if(!poi || !poi.id || !el || state.activeQuestPoiId === poi.id) return;
  if(state.portalDismissedIds.has(poi.id) || state.portalSeenIds.has(poi.id)) return;
  // Portal quest hanya boleh muncul sekali. Begitu popup pertama kali tampil,
  // id langsung disimpan supaya tidak spam muncul lagi walaupun user masih di radius.
  markPortalPopupDone(poi.id);
  state.activeQuestPoiId = poi.id;
  state.lastPoi = poi;
  document.getElementById("questPortalName").textContent = poi.name;
  document.getElementById("questPortalType").textContent = poi.group || "Portal BogorDex";
  document.getElementById("questPortalDesc").textContent = poi.fungsi || poi.desc || "Dekati portal ini untuk membuka informasi lokasi dan menambah koleksi Dex.";
  document.getElementById("questPortalDistance").textContent = Math.max(1, Math.round(dist)) + " m";
  el.classList.remove("hidden");
  el.classList.remove("quest-pop");
  void el.offsetWidth;
  el.classList.add("quest-pop");
}
function hideQuestPopup(markDismissed=false){
  if(markDismissed && state.activeQuestPoiId) markPortalPopupDone(state.activeQuestPoiId);
  const el = questPopupEl();
  if(el) el.classList.add("hidden");
  state.activeQuestPoiId = null;
}
function dismissActiveQuestPopup(){ hideQuestPopup(true); }
function startQuestFromPopup(){
  if(!state.lastPoi) return;
  state.discovered.add(state.lastPoi.id);
  renderDex();
  if(state.lastPoi && state.lastPoi.id) markPortalPopupDone(state.lastPoi.id);
  hideQuestPopup(true);
  openSheet(state.lastPoi, "manual");
  updateStatus("Quest dibuka: " + state.lastPoi.name);
}

function nearestPoiWithin(pos, threshold=90){
  let best = null, bestDist = Infinity;
  for(const poi of state.pois){
    const d = haversineMeters(pos, poi.coords);
    if(d < bestDist){ bestDist = d; best = poi; }
  }
  return best && bestDist <= threshold ? { poi: best, dist: bestDist } : null;
}
function updateNearestHighlight(){
  if(!map.getSource("nearest-poi")) return;
  const hit = nearestPoiWithin(state.playerWorld, 320);
  const features = hit ? [{
    type:"Feature",
    geometry:{type:"Point", coordinates: hit.poi.coords},
    properties:{name:hit.poi.name}
  }] : [];
  map.getSource("nearest-poi").setData({type:"FeatureCollection", features});
}
function detectNearby(){
  updateNearestHighlight();
  const hit = nearestPoiWithin(state.playerWorld, state.portalNoticeRadiusMeters);
  if(hit){
    state.discovered.add(hit.poi.id);
    renderDex();
    showQuestPopup(hit.poi, hit.dist);
    updateStatus("Portal terdeteksi: " + hit.poi.name);
  } else {
    hideQuestPopup(false);
    if(state.activePoiMode === "auto") closeSheet(true, true);
    updateStatus(state.hasRealGps ? "Lokasi aktif" : "Lokasi simulasi");
  }
}
function clearEventMarkers(){ (state.eventMarkers||[]).forEach(m => { try{m.remove();}catch(e){} }); state.eventMarkers=[]; }
function eventPortalElement(event){
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'event-portal-marker ' + (event.kind || 'ramai');
  el.innerHTML = `<span class="event-portal-core"></span><span class="event-portal-img"></span><span class="event-portal-label">${event.title}</span>`;
  el.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); openSheet({ id:event.id, name:event.title, desc:event.desc || 'Portal event realtime.', fungsi:event.level || 'Realtime event', tupoksi:event.source || (REALTIME_EVENT_ENDPOINT ? 'Google realtime endpoint' : 'Demo local fallback'), group:'EVENT PORTAL', aktif:true }, 'manual'); });
  return el;
}
async function loadRealtimeEventPortals(){
  try{
    let items = [];
    if(REALTIME_EVENT_ENDPOINT){
      const res = await fetch(REALTIME_EVENT_ENDPOINT, { cache:'no-store' });
      if(res.ok){
        const data = await res.json();
        items = Array.isArray(data?.events) ? data.events : [];
      }
    }
    if(!items.length){
      const seed = state.pois.slice(0,3);
      items = seed.map((poi, i) => ({
        id:'event_'+i,
        title: i===0 ? 'Portal Ramai' : (i===1 ? 'Portal Macet' : 'Portal Event Kota'),
        desc: i===0 ? 'Titik sedang ramai. Hook realtime Google masih kosong, jadi sementara fallback lokal.' : (i===1 ? 'Titik terindikasi padat/kepadatan lalu lintas. Endpoint realtime belum diisi.' : 'Portal event aktif.'),
        level: i===1 ? 'Potensi Kemacetan' : 'Aktivitas Ramai',
        kind: i===1 ? 'macet' : 'ramai',
        source: REALTIME_EVENT_ENDPOINT ? 'Google realtime' : 'Fallback demo',
        coords: poi?.coords || state.playerWorld
      }));
    }
    state.eventPortals = items.filter(x => Array.isArray(x.coords) && x.coords.length===2);
    renderRealtimeEventPortals();
  }catch(err){ console.warn('Realtime event portal skipped', err); }
}
function renderRealtimeEventPortals(){
  if(!map || !maplibregl) return;
  clearEventMarkers();
  (state.eventPortals || []).forEach((event) => {
    const marker = new maplibregl.Marker({ element:eventPortalElement(event), anchor:'bottom', offset:[0,8], rotationAlignment:'viewport', pitchAlignment:'viewport' }).setLngLat(event.coords).addTo(map);
    state.eventMarkers.push(marker);
  });
}
async function loadSheetData(){
  try{
    updateStatus("Memuat data Google Sheet…");
    const res = await fetch(GVIZ_URL);
    const txt = await res.text();
    const json = JSON.parse(txt.substring(47, txt.length - 2));
    state.pois = normalizeRows((json.table.rows || []).map(r => r.c || []), false);
  } catch(err){
    const rows = (window.BOGORDEX_FALLBACK_DATA || []).map(r => [r.KELOMPOK,r.NAMA,r.LOKASI,r.FUNGSI,r.TUPOKSI,r.DESKRIPSI,r.IKON,r.WARNA,r.AKTIF]);
    state.pois = normalizeRows(rows, true);
  }
  setupPoiLayers();
  refreshPoiSource();
  updateNearestHighlight();
  renderDex();
  renderNPCs();
  await loadRealtimeEventPortals();
  updateStatus(`Mode game aktif • ${state.pois.length} portal`);
}
function normalizeHeading(value){
  let n = Number(value);
  if(!Number.isFinite(n)) return null;
  n = ((n % 360) + 360) % 360;
  return n;
}
function handleDeviceOrientation(ev){
  let heading = null;
  if(typeof ev.webkitCompassHeading === "number"){
    // iOS/Safari: ini heading kompas asli.
    heading = ev.webkitCompassHeading;
  }else if(ev.absolute === true && typeof ev.alpha === "number"){
    // Android Chrome: alpha absolut. Koreksi orientasi layar supaya portrait/landscape tetap pas.
    heading = 360 - ev.alpha + getScreenOrientationAngle();
  }else if(typeof ev.alpha === "number" && ev.absolute !== false){
    heading = 360 - ev.alpha + getScreenOrientationAngle();
  }
  heading = normalizeHeading(heading);
  if(heading === null) return;
  applyDeviceHeadingToCamera(heading, 260);
}
async function requestDeviceCompass(){
  if(state.compassRequested) return;
  state.compassRequested = true;
  try{
    if(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function"){
      const res = await DeviceOrientationEvent.requestPermission();
      if(res !== "granted"){ updateStatus("Kompas HP belum diizinkan"); return; }
    }
    window.addEventListener("deviceorientationabsolute", handleDeviceOrientation, true);
    window.addEventListener("deviceorientation", handleDeviceOrientation, true);
    window.addEventListener("orientationchange", () => setTimeout(() => { if(state.deviceHeadingEnabled) followPlayerCamera({ duration:120 }); }, 180), true);
    updateStatus("Kompas HP aktif • arah pandangan mengikuti HP");
  }catch(err){
    console.warn("Compass unavailable", err);
  }
}
function startLocation(){
  requestDeviceCompass();
  if(!navigator.geolocation){ updateStatus("Browser tidak mendukung lokasi"); return; }
  updateStatus("Mengambil lokasi…");
  if(state.geoWatch !== null) navigator.geolocation.clearWatch(state.geoWatch);
  state.geoWatch = navigator.geolocation.watchPosition(
    (pos) => {
      state.hasRealGps = true;
      state.gpsBase = [pos.coords.longitude, pos.coords.latitude];
      clampOffset();
      recomputePlayerWorld();
      snapPlayerToRoad(true);
      if(pos.coords && Number.isFinite(pos.coords.heading)){
        // Fallback: kalau sensor kompas browser tidak aktif, pakai arah gerak GPS.
        if(!state.deviceHeadingEnabled && (pos.coords.speed || 0) > 0.6){
          applyDeviceHeadingToCamera(pos.coords.heading, 180);
        }
      }
      if(!state.browsing) followPlayerCamera({ duration:250 });
      detectNearby();
      updateStatus(state.deviceHeadingEnabled ? "Lokasi aktif • kompas aktif" : "Lokasi aktif");
      refreshEnvironment();
    },
    (err) => { state.hasRealGps = false; updateStatus("Lokasi gagal: " + err.message); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}
function startBrowse(){
  state.browsing = true;
  document.getElementById("app")?.classList.add("app-browsing");
  if(state.snapTimer) clearTimeout(state.snapTimer);
}
function stopBrowse(){
  if(state.snapTimer) clearTimeout(state.snapTimer);
  state.snapTimer = setTimeout(() => {
    state.browsing = false;
    document.getElementById("app")?.classList.remove("app-browsing");
    // V36: jangan paksa map balik ke karakter setelah user geser peta.
    // Karakter tetap di koordinat aslinya sebagai marker map.
  }, 220);
}

function getBuildingCollisionLayers(){
  if(!map || !map.getStyle) return [];
  const preferred = ['bdx-building-collision','bdx-3d-buildings','building','buildings','building-3d','3d-buildings'];
  const found = [];
  preferred.forEach(id => { if(map.getLayer(id)) found.push(id); });
  const styleLayers = (map.getStyle().layers || []);
  styleLayers.forEach(layer => {
    const id = String(layer.id || '').toLowerCase();
    const sourceLayer = String(layer['source-layer'] || '').toLowerCase();
    if((layer.type === 'fill' || layer.type === 'fill-extrusion') && (id.includes('building') || sourceLayer.includes('building'))){
      if(!found.includes(layer.id)) found.push(layer.id);
    }
  });
  return found;
}
function getBlockedMapLayers(){
  if(!map || !map.getStyle) return [];
  const styleLayers = (map.getStyle().layers || []);
  const found = [];
  styleLayers.forEach(layer => {
    const id = String(layer.id || '').toLowerCase();
    const sl = String(layer['source-layer'] || '').toLowerCase();
    const isSolid = layer.type === 'fill' || layer.type === 'fill-extrusion';
    const isBlocked =
      id.includes('building') || sl.includes('building') ||
      id.includes('water') || sl.includes('water') ||
      id.includes('waterway') || sl.includes('waterway') ||
      id.includes('landcover') || sl.includes('landcover') ||
      id.includes('park') || id.includes('grass') || id.includes('cemetery');
    if(isSolid && isBlocked && !found.includes(layer.id)) found.push(layer.id);
  });
  if(map.getLayer('bdx-building-collision') && !found.includes('bdx-building-collision')) found.push('bdx-building-collision');
  return found;
}
function getRoadCollisionLayers(){
  if(!map || !map.getStyle) return [];
  const styleLayers = (map.getStyle().layers || []);
  const found = [];
  styleLayers.forEach(layer => {
    const id = String(layer.id || '').toLowerCase();
    const sl = String(layer['source-layer'] || '').toLowerCase();
    const cls = String(layer.filter || '').toLowerCase();
    const looksRoad =
      layer.type === 'line' &&
      !id.includes('label') &&
      !id.includes('rail') &&
      !id.includes('route') &&
      !id.includes('water') &&
      (id.includes('road') || id.includes('street') || id.includes('path') || id.includes('highway') || sl.includes('transportation') || cls.includes('road') || cls.includes('street') || cls.includes('path'));
    if(looksRoad && !found.includes(layer.id)) found.push(layer.id);
  });
  return found;
}
function queryFeaturesAround(coord, layers, radiusPx){
  if(!layers.length) return [];
  const p = map.project(coord);
  const r = radiusPx || 20;
  try{
    return map.queryRenderedFeatures([[p.x-r, p.y-r], [p.x+r, p.y+r]], { layers });
  }catch(err){
    return [];
  }
}
function isCoordBlockedBySolidMap(coord){
  if(!state.collisionEnabled || !map || !map.loaded || !map.loaded()) return false;
  const layers = getBlockedMapLayers().filter(id => map.getLayer(id));
  const features = queryFeaturesAround(coord, layers, state.collisionRadiusPx || 20);
  return features.length > 0;
}
function isCoordOnRoad(coord){
  if(!state.roadOnlyMode || !map || !map.loaded || !map.loaded()) return true;
  const layers = getRoadCollisionLayers().filter(id => map.getLayer(id));
  // Kalau style belum expose layer jalan, jangan bikin player stuck total.
  if(!layers.length) return true;
  const features = queryFeaturesAround(coord, layers, state.roadRadiusPx || 34);
  return features.length > 0;
}
function canPlayerStandAt(coord){
  if(isCoordBlockedBySolidMap(coord)) return false;
  if(!isCoordOnRoad(coord)) return false;
  return true;
}
function worldFromOffset(x, y){
  const [dLng, dLat] = metersToLngLatOffset(x, y, state.gpsBase[1]);
  return [state.gpsBase[0] + dLng, state.gpsBase[1] + dLat];
}
function nearestPointOnSegmentPx(p, a, b){
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const ab2 = abx*abx + aby*aby || 1;
  const t = Math.max(0, Math.min(1, (apx*abx + apy*aby) / ab2));
  return { x:a.x + abx*t, y:a.y + aby*t, t };
}
function snapCoordToNearestRoad(coord, maxRadiusPx = 120){
  if(!map || !map.loaded || !map.loaded()) return coord;
  const layers = getRoadCollisionLayers().filter(id => map.getLayer(id));
  if(!layers.length) return coord;
  const p = map.project(coord);
  let best = null;
  let bestDist = Infinity;
  const feats = queryFeaturesAround(coord, layers, maxRadiusPx);
  feats.forEach(feat => {
    const geom = feat?.geometry;
    if(!geom) return;
    const lines = geom.type === 'LineString' ? [geom.coordinates] : (geom.type === 'MultiLineString' ? geom.coordinates : []);
    lines.forEach(line => {
      for(let i=0;i<line.length-1;i++){
        const a = map.project(line[i]);
        const b = map.project(line[i+1]);
        const np = nearestPointOnSegmentPx(p, a, b);
        const dx = np.x - p.x, dy = np.y - p.y;
        const d = Math.hypot(dx, dy);
        if(d < bestDist){ bestDist = d; best = map.unproject([np.x, np.y]); }
      }
    });
  });
  if(best && bestDist <= maxRadiusPx){
    return [best.lng, best.lat];
  }
  return coord;
}
function snapPlayerToRoad(force = false){
  const snapped = snapCoordToNearestRoad(state.playerWorld, force ? 180 : 120);
  if(!snapped) return;
  if(haversineMeters(state.playerWorld, snapped) > 1.4){
    state.playerWorld = snapped;
    const [baseLng, baseLat] = state.gpsBase;
    const dx = (snapped[0] - baseLng) * (111320 * Math.cos(baseLat * Math.PI/180));
    const dy = (snapped[1] - baseLat) * 110540;
    state.offsetMeters.x = dx;
    state.offsetMeters.y = dy;
    updatePlayerMapMarker();
  }
}
function tryMoveWithCollision(mx, my){
  const originalX = state.offsetMeters.x;
  const originalY = state.offsetMeters.y;
  const candidates = [
    [originalX + mx, originalY + my, 'full'],
    [originalX + mx, originalY, 'x'],
    [originalX, originalY + my, 'y']
  ];
  for(const [nx, ny] of candidates){
    const d = Math.hypot(nx, ny);
    let tx = nx, ty = ny;
    if(d > state.maxOffsetMeters){
      const r = state.maxOffsetMeters / d;
      tx *= r; ty *= r;
    }
    const nextCoord = worldFromOffset(tx, ty);
    if(canPlayerStandAt(nextCoord)){
      state.offsetMeters.x = tx;
      state.offsetMeters.y = ty;
      state.playerWorld = nextCoord;
      return true;
    }
  }
  state.collisionCooldown = 12;
  return false;
}

function updateMovement(dt=1/60){
  const forwardInput = (state.move.up ? 1 : 0) - (state.move.down ? 1 : 0);
  const strafeInput = (state.move.right ? 1 : 0) - (state.move.left ? 1 : 0);
  if(!forwardInput && !strafeInput){
    if(!playerSprite().classList.contains("idle")) setPlayerAnim("idle");
    return;
  }

  // V38: gerak karakter mengikuti arah kamera, bukan utara/selatan absolut.
  // Jadi saat map di-rotate kiri/kanan, tombol atas tetap berarti maju ke depan layar.
  const step = state.moveSpeedMeters * Math.min(0.033, Math.max(0.008, dt));
  const bearingRad = degToRad(getCameraBearing());
  const forwardX = Math.sin(bearingRad);
  const forwardY = Math.cos(bearingRad);
  const rightX = Math.cos(bearingRad);
  const rightY = -Math.sin(bearingRad);
  let mx = (forwardX * forwardInput + rightX * strafeInput) * step;
  let my = (forwardY * forwardInput + rightY * strafeInput) * step;
  if(forwardInput && strafeInput){ mx *= 0.7071; my *= 0.7071; }

  let facing = state.facing || "down";
  if(Math.abs(strafeInput) > Math.abs(forwardInput)) facing = strafeInput < 0 ? "left" : "right";
  else if(forwardInput) facing = forwardInput > 0 ? "up" : "down";

  const moved = tryMoveWithCollision(mx, my);
  state.playerFrameTick += dt;
  if(state.playerFrameTick > 0.15){
    state.playerFrameTick = 0;
    state.playerStepFrame = (state.playerStepFrame + 1) % 4;
    applyPlayerSpriteFrame();
  }
  if(!playerSprite().classList.contains("walk") || state.facing !== facing) setPlayerAnim("walk", facing);
  if(moved){
    snapPlayerToRoad();
    updatePlayerMapMarker();
    if(!state.browsing){ followPlayerCamera({ duration: 120 }); }
    detectNearby();
  }else{
    updateStatus("Jalur tertutup • karakter hanya bisa jalan di lintasan");
  }
}
function bindMoveButton(btn){
  const dir = btn.dataset.dir;
  const down = () => { state.move[dir] = true; };
  const up = () => { state.move[dir] = false; };
  btn.addEventListener("mousedown", down);
  btn.addEventListener("mouseup", up);
  btn.addEventListener("mouseleave", up);
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); down(); }, { passive:false });
  btn.addEventListener("touchend", up);
}

map.on("load", () => {
  setupMapLibre3D();
  map.addSource("route-k5",{type:"geojson",data:routeFeatures.k5});
  map.addSource("route-k6",{type:"geojson",data:routeFeatures.k6});
  map.addSource("route-run",{type:"geojson",data:routeFeatures.run});
  map.addLayer({id:"route-k5-line",type:"line",source:"route-k5",paint:{"line-color":"#ff9a3d","line-width":3.2,"line-opacity":0.46}});
  map.addLayer({id:"route-k6-line",type:"line",source:"route-k6",paint:{"line-color":"#53a3ff","line-width":3.2,"line-opacity":0.46}});
  map.addLayer({id:"route-run-line",type:"line",source:"route-run",paint:{"line-color":"#49d08b","line-width":3,"line-opacity":0.38,"line-dasharray":[1.5,1.5]}});
  map.addSource("nearest-poi",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
  map.addLayer({
    id:"nearest-poi-ring",
    type:"circle",
    source:"nearest-poi",
    paint:{
      "circle-radius":["interpolate",["linear"],["zoom"],16.4,24,19.3,50],
      "circle-color":"#ffffff",
      "circle-opacity":0.03,
      "circle-stroke-color":"#ffd86b",
      "circle-stroke-width":3,
      "circle-stroke-opacity":0.9
    }
  });
  recomputePlayerWorld();
  createPlayerMapMarker();
  followPlayerCamera({ zoom: CAMERA_ZOOM });
  lockPitchOnly();
  document.getElementById("sheetContent").innerHTML = `
    <h3>BogorDex GO v42 Smooth Compass</h3>
    <p>MapLibre street-anime mode: kamera lebih rendah seperti berdiri di jalan, rotate kiri-kanan aktif, pitch atas-bawah dikunci, gedung transparan, dan karakter tetap road-only.</p>
    <div class="section"><div class="section-title">Fix Inti</div><p>Basis MapLibre tetap dipakai tanpa kartu kredit Mapbox. Nuansa dibuat lebih game HP/Pokemon GO: gedung ghost transparan, kamera dari belakang karakter, MapDex phone aktif, dan laporan titik tetap jalan.</p></div>
  `;
  state.lastPoi = {id:"intro",name:"BogorDex GO v42 Smooth Compass",desc:"Mode street-anime MapDex road-only dengan kamera lebih luas ke depan.",fungsi:"Dekati portal/NPC untuk quest, rotate/tilt map, atau tambah laporan titik dari menu utama.",tupoksi:"Laporan user tersimpan lokal dulu dan siap disambungkan ke Firebase/GAS pada versi berikutnya.",group:"SISTEM",aktif:true};
  syncMiniButton();
  loadUserReports();
  renderUserReports();
  renderNPCs();
  loadSheetData();
  requestAnimationFrame(loop);
});

map.on("dragstart", startBrowse);
map.on("dragend", stopBrowse);
map.on("zoomstart", startBrowse);
map.on("zoomend", stopBrowse);
map.on("rotatestart", startBrowse);
map.on("rotateend", stopBrowse);
map.on("pitchstart", () => { startBrowse(); setTimeout(lockPitchOnly, 30); });
map.on("pitch", lockPitchOnly);
map.on("move", () => { if(Math.abs(map.getPitch() - CAMERA_PITCH) > 0.75) lockPitchOnly(); });
map.on("pitchend", () => { lockPitchOnly(); stopBrowse(); });
map.on("rotateend", () => { if(!state.browsing) followPlayerCamera({duration:80}); });

function animatePortalRings(){
  if(!map || !map.getLayer || !map.getLayer("poi-ring-outer")) return;
  state.portalPulse += 0.055;
  const wave = (Math.sin(state.portalPulse) + 1) / 2;
  const outerBase = 44 + wave * 18;
  const innerBase = 24 + (1 - wave) * 10;
  map.setPaintProperty("poi-ring-outer", "circle-radius", ["interpolate",["linear"],["zoom"],16.4,outerBase,19.3,outerBase*2.05]);
  map.setPaintProperty("poi-ring-outer", "circle-stroke-opacity", 0.46 + wave * 0.42);
  map.setPaintProperty("poi-ring-inner", "circle-radius", ["interpolate",["linear"],["zoom"],16.4,innerBase,19.3,innerBase*2.05]);
  map.setPaintProperty("poi-ring-inner", "circle-stroke-opacity", 0.50 + (1-wave) * 0.42);
}
let lastFrameTime = performance.now();
function loop(now){
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
  lastFrameTime = now;
  if(state.collisionCooldown > 0) state.collisionCooldown -= 1;
  updateMovement(dt);
  animatePortalRings();
  updateNpcNearState();
  // Kamera kompas sudah di-throttle di applyDeviceHeadingToCamera.
  // Jangan follow tiap frame, karena itu bikin pandangan geter-geter.
  if(!state.browsing && !state.move.up && !state.move.down && !state.move.left && !state.move.right){
    // keep alive ringan supaya karakter tetap terlihat setelah tile/render selesai
  }
  requestAnimationFrame(loop);
}

function reportEmoji(category){
  return { lobang:"🕳️", pohon:"🌳", pembangunan:"🚧", macet:"🚦", lainnya:"📌" }[category] || "📌";
}
function loadUserReports(){
  try{ state.userReports = JSON.parse(localStorage.getItem("bogordex_user_reports_v30") || "[]"); }catch(e){ state.userReports = []; }
}
function saveUserReports(){
  localStorage.setItem("bogordex_user_reports_v30", JSON.stringify(state.userReports.slice(-80)));
}
function clearReportMarkers(){
  (state.reportMarkers || []).forEach(m => { try{ m.remove(); }catch(e){} });
  state.reportMarkers = [];
}
function reportMarkerElement(report){
  const el = document.createElement("button");
  el.type = "button";
  el.className = "user-report-marker";
  el.title = (report.note || "Info warga");
  el.innerHTML = `<span class="report-pin ${report.category}"><span>${reportEmoji(report.category)}</span></span>`;
  el.addEventListener("click", (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    openSheet({
      id:report.id, name:"Info Warga: " + reportEmoji(report.category),
      desc:report.note || "Catatan lapangan dari user.",
      fungsi:"Laporan titik lapangan BogorDex.",
      tupoksi:"Data tersimpan lokal di browser. Nanti bisa disambungkan ke Google Sheet/GAS agar laporan masuk dashboard admin.",
      group:"CITIZEN REPORT", aktif:true
    }, "manual");
  });
  return el;
}
function renderUserReports(){
  if(!map || !maplibregl) return;
  clearReportMarkers();
  state.userReports.forEach(report => {
    const marker = new maplibregl.Marker({ element: reportMarkerElement(report), anchor:"bottom", rotationAlignment:"viewport", pitchAlignment:"viewport" })
      .setLngLat(report.coords).addTo(map);
    state.reportMarkers.push(marker);
  });
}
function openReportModal(){
  document.getElementById("reportNote").value = "";
  document.getElementById("reportModal").classList.remove("hidden");
}
function closeReportModal(){ document.getElementById("reportModal").classList.add("hidden"); }
function saveCurrentPointReport(){
  const category = document.getElementById("reportCategory").value || "lainnya";
  const note = (document.getElementById("reportNote").value || "").trim();
  const report = { id:"report_" + Date.now(), category, note: note || "Info titik dari user", coords:[state.playerWorld[0], state.playerWorld[1]], createdAt:new Date().toISOString() };
  state.userReports.push(report);
  saveUserReports();
  renderUserReports();
  closeReportModal();
  updateStatus("Info warga dipasang di map");
}

function openMainMenu(){ document.getElementById('mainMenuModal').classList.remove('hidden'); }
function closeMainMenu(){ document.getElementById('mainMenuModal').classList.add('hidden'); }
function scanNearestFromMenu(){
  const hit = nearestPoiWithin(state.playerWorld, 999999);
  if(!hit){ updateStatus('Belum ada titik untuk discan'); return; }
  state.discovered.add(hit.poi.id);
  markPortalPopupDone(hit.poi.id);
  renderDex();
  map.easeTo({center: hit.poi.coords, zoom: 18.2, pitch: CAMERA_PITCH, bearing: getCameraBearing(), duration: 450});
  openSheet(hit.poi, 'manual');
  updateStatus('Scan menemukan: ' + hit.poi.name);
}
function resetGameCamera(){
  requestDeviceCompass();
  state.browsing = false;
  if(state.snapTimer) clearTimeout(state.snapTimer);
  state.browsing = false; document.getElementById("app")?.classList.remove("app-browsing"); followPlayerCamera({ zoom: CAMERA_ZOOM, duration: 320 });
}


function getMapDexItems(){
  const items = [];
  (state.pois || []).forEach(p => { if(p.coords) items.push({type:"portal", name:p.name, coords:p.coords, emoji:"🌀", ref:p}); });
  (state.npcs || []).forEach(n => { if(n.coords) items.push({type:"npc", name:n.name, coords:n.coords, emoji:"!", ref:n}); });
  (state.userReports || []).forEach(r => { if(r.coords) items.push({type:"report", name:r.note || "Info warga", coords:r.coords, emoji:"📍", ref:r}); });
  return items.map(item => ({...item, dist:haversineMeters(state.playerWorld, item.coords)})).sort((a,b)=>a.dist-b.dist).slice(0,60);
}
function focusMapDexItem(item){
  closeMapDex();
  map.easeTo({ center:item.coords, zoom:18.25, pitch:CAMERA_PITCH, bearing:getCameraBearing(), duration:450 });
  if(item.type === "portal" && item.ref){ markPortalPopupDone(item.ref.id); openSheet(item.ref, "manual"); }
  if(item.type === "npc" && item.ref) openNpcDialog(item.ref.id);
  if(item.type === "report" && item.ref){
    openSheet({id:item.ref.id,name:"Info Warga",desc:item.ref.note || "Info titik",fungsi:"Kategori: " + reportEmoji(item.ref.category),tupoksi:"Titik laporan dari user.",group:"CITIZEN REPORT",aktif:true}, "manual");
  }
}
function openMapDex(){
  renderMapDex();
  document.getElementById("mapDexModal").classList.remove("hidden");
}
function closeMapDex(){ document.getElementById("mapDexModal").classList.add("hidden"); }
function renderMapDex(){
  const canvas = document.getElementById("mapDexCanvas");
  const list = document.getElementById("mapDexList");
  if(!canvas || !list) return;
  canvas.querySelectorAll(".mapdex-pin").forEach(n => n.remove());
  list.innerHTML = "";
  const items = getMapDexItems();
  const rectSize = 310;
  const radiusMeters = 900;
  items.slice(0,28).forEach((item, idx) => {
    const dx = haversineMeters(state.playerWorld, [item.coords[0], state.playerWorld[1]]) * (item.coords[0] >= state.playerWorld[0] ? 1 : -1);
    const dy = haversineMeters(state.playerWorld, [state.playerWorld[0], item.coords[1]]) * (item.coords[1] >= state.playerWorld[1] ? -1 : 1);
    const x = Math.max(8, Math.min(92, 50 + (dx / radiusMeters) * 42));
    const y = Math.max(10, Math.min(92, 50 + (dy / radiusMeters) * 42));
    const btn = document.createElement("button");
    btn.className = "mapdex-pin " + item.type;
    btn.style.left = x + "%";
    btn.style.top = y + "%";
    btn.title = item.name;
    btn.innerHTML = `<i><span>${item.emoji}</span></i>`;
    btn.addEventListener("click", () => focusMapDexItem(item));
    canvas.appendChild(btn);
  });
  items.slice(0,20).forEach(item => {
    const row = document.createElement("button");
    row.className = "mapdex-row";
    const label = item.type === "portal" ? "Portal" : item.type === "npc" ? "NPC" : "Laporan";
    row.innerHTML = `<span><strong>${item.name}</strong><small>${label}</small></span><b>${Math.round(item.dist)} m</b>`;
    row.addEventListener("click", () => focusMapDexItem(item));
    list.appendChild(row);
  });
}

document.getElementById("locateBtn").addEventListener("click", startLocation);
document.addEventListener("pointerdown", requestDeviceCompass, { once:true, passive:true });
document.getElementById("resetViewBtn").addEventListener("click", resetGameCamera);
document.getElementById("toggleTransitBtn").addEventListener("click", (e) => { e.currentTarget.classList.toggle("active"); state.layers.transit = e.currentTarget.classList.contains("active"); applyLayerFilters(); });
document.getElementById("toggleGovBtn").addEventListener("click", (e) => { e.currentTarget.classList.toggle("active"); state.layers.gov = e.currentTarget.classList.contains("active"); applyLayerFilters(); });
document.getElementById("toggleHealthBtn").addEventListener("click", (e) => { e.currentTarget.classList.toggle("active"); state.layers.health = e.currentTarget.classList.contains("active"); applyLayerFilters(); });
document.getElementById("toggleUmkmBtn").addEventListener("click", (e) => { e.currentTarget.classList.toggle("active"); state.layers.umkm = e.currentTarget.classList.contains("active"); applyLayerFilters(); });
document.getElementById("mainMenuBtn").addEventListener("click", openMainMenu);
document.getElementById("closeMainMenuBtn").addEventListener("click", closeMainMenu);
document.querySelector("#mainMenuModal .game-menu-backdrop").addEventListener("click", closeMainMenu);
document.getElementById("menuExploreBtn").addEventListener("click", () => { closeMainMenu(); updateStatus("Mode jelajah portal aktif"); });
document.getElementById("menuScanBtn").addEventListener("click", () => { closeMainMenu(); scanNearestFromMenu(); });
document.getElementById("menuDexBtn").addEventListener("click", () => { closeMainMenu(); renderDex(); document.getElementById("dexModal").classList.remove("hidden"); });
document.getElementById("menuResetBtn").addEventListener("click", () => { closeMainMenu(); resetGameCamera(); });
document.getElementById("menuReportBtn").addEventListener("click", () => { closeMainMenu(); openReportModal(); });
document.getElementById("reportCloseBtn").addEventListener("click", closeReportModal);
document.getElementById("reportCancelBtn").addEventListener("click", closeReportModal);
document.getElementById("reportSaveBtn").addEventListener("click", saveCurrentPointReport);
document.getElementById("reportModal").addEventListener("click", (e) => { if(e.target.id === "reportModal") closeReportModal(); });
document.getElementById("questStartBtn").addEventListener("click", startQuestFromPopup);
document.getElementById("npcDialogClose").addEventListener("click", closeNpcDialog);
document.getElementById("npcDialogLaterBtn").addEventListener("click", closeNpcDialog);
document.getElementById("npcDialogQuestBtn").addEventListener("click", acceptNpcQuest);
document.getElementById("npcDialog").addEventListener("click", (e) => { if(e.target.id === "npcDialog") closeNpcDialog(); });
document.getElementById("questCloseBtn").addEventListener("click", dismissActiveQuestPopup);
document.getElementById("mapDexBtn").addEventListener("click", openMapDex);
document.getElementById("chatToggleBtn").addEventListener("click", () => { chatDock()?.classList.toggle("collapsed"); });
document.getElementById("chatCloseBtn").addEventListener("click", closeChatDock);
document.getElementById("closeMapDexBtn").addEventListener("click", closeMapDex);
document.getElementById("mapDexModal").addEventListener("click", (e) => { if(e.target.id === "mapDexModal") closeMapDex(); });
document.getElementById("dexBtn").addEventListener("click", () => document.getElementById("dexModal").classList.remove("hidden"));
document.getElementById("closeDexBtn").addEventListener("click", () => document.getElementById("dexModal").classList.add("hidden"));
document.getElementById("sheetHandle").addEventListener("click", () => { sheetEl().classList.remove("hidden-sheet"); sheetEl().classList.toggle("collapsed"); syncMiniButton(); });
document.getElementById("sheetCloseBtn").addEventListener("click", (e) => { e.stopPropagation(); closeSheet(true, true); });
const __sheetMiniBtn = document.getElementById("sheetMiniBtn"); if(__sheetMiniBtn){ __sheetMiniBtn.addEventListener("click", () => { if(state.lastPoi) openSheet(state.lastPoi, state.activePoiMode || "manual"); }); }
document.querySelectorAll(".move-btn").forEach(bindMoveButton);
document.addEventListener("keydown", (e) => { const k = e.key.toLowerCase(); if(k==="w"||k==="arrowup") state.move.up=true; if(k==="s"||k==="arrowdown") state.move.down=true; if(k==="a"||k==="arrowleft") state.move.left=true; if(k==="d"||k==="arrowright") state.move.right=true; });
document.addEventListener("keyup", (e) => { const k = e.key.toLowerCase(); if(k==="w"||k==="arrowup") state.move.up=false; if(k==="s"||k==="arrowdown") state.move.down=false; if(k==="a"||k==="arrowleft") state.move.left=false; if(k==="d"||k==="arrowright") state.move.right=false; });


updateWeatherChip();
updatePlayerUiMeta();
setTimeout(() => refreshEnvironment(true), 900);
