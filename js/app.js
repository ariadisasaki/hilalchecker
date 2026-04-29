// === FINAL ULTRA COMPLETE - HILAL CHECKER ===
console.log("FINAL ULTRA COMPLETE - HILAL CHECKER");

// === GLOBAL ===
let hijriMonthIndex = 0;
let tanggalHijriGlobal = 1;
let hilalData = { alt: 0, azi: 0 };
let smoothX = 0;
let smoothY = 0;
let smoothHeading = 0;
let smoothPitch = 0;
let smoothRoll = 0;
let kalmanFactor = 0.12;
let audioCtx = null;
let locked = false;
let beepCooldown = false;
let headingOffset = 0;
let calibrating = false;
let lastPathUpdate = 0;
let declinationGlobal = 0;
let altitudeOffset = 0;
let arSpeed = 1;
let running = true;
let loopId = null;
let lastCheckDate = null;
let sudahCekHariIni = false;
let hijriFinalState = null;
let lastTriggeredDate = "";
let locationInitialized = false;
let currentLat = null;
let currentLon = null;
let hilalDataFull = { alt: 0, azi: 0, elo: 0, age: 0, illumination: 0 };
let hijriState = {
  d: 1,
  m: 1,
  y: 1447,
  locked: false
};

// === HITUNG SEKALI SAJA SAAT APLIKASI DIBUKA ===
let CACHED_IJTIMA = null; 
function refreshIjtimaData() {
    // Panggil fungsi berat Anda hanya di sini
    CACHED_IJTIMA = getLastIjtima();
}
// === JALANKAN SAAT STARTUP ===
refreshIjtimaData();

const SYNODIC_MONTH = 29.530588;
const DAY_MS = 86400000;

document.addEventListener("DOMContentLoaded", () => {

  // === GLOBAL INSTALL ===
  let deferredPrompt = null;
  const installBtn = document.getElementById("installBtn");

  if (!installBtn) return;

  // === SEBELUM INSTALL ===
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    installBtn.style.display = "block";
  });

  // === TOMBOL INSTALL ===
  installBtn.addEventListener("click", async () => {

    if (!deferredPrompt) return;

    // === HAPUS NOTIFIKASI ===
    deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      console.log("User menerima install");
    } else {
      console.log("User menolak install");
    }

    deferredPrompt = null;
  });

  // === NOTIFIKASI INSTALL ===
  function showInstallNotification(msg){

    if ("serviceWorker" in navigator){
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification("App Installer", {
          body: msg,
          icon: "/assets/icon-192.png"
        });
      });
    } else {
      alert(msg);
    }
  }

  // === SUDAH DIINSTALL ===
  window.addEventListener("appinstalled", () => {
    console.log("App sudah diinstall");

    installBtn.style.display = "none";

    // === MUNCULKAN NOTIFIKASI ===
    showInstallNotification("Aplikasi berhasil diinstall!");
  });

  // === CEK MODE STANDALONE ===
  if (window.matchMedia("(display-mode: standalone)").matches){
    installBtn.style.display = "none";
  }
});

let lastUpdateDay = null;

// === ORBIT PLANET ===
function deg2rad(d){ return d * Math.PI / 180; }
function rad2deg(r){ return r * 180 / Math.PI; }

function normalize(deg){
  return (deg % 360 + 360) % 360;
}

// === HITUNG JD ===
function getJulianDay(date){
  return date.getTime() / 86400000 + 2440587.5;
}

// === CACHE REALTIME ===
let sunCache = {
  alt: 0,
  azi: 0
};

let moonCache = {
  alt: 0,
  azi: 0
};

// === GLOBAL ===
let modeHijri = true; // default: Hisab

let stars = [];

// === DATA BINTANG REAL ===
const STAR_CATALOG = [
  ["Sirius", 101.287, -16.716, -1.46],
  ["Canopus", 95.987, -52.695, -0.74],
  ["Arcturus", 213.915, 19.182, -0.05],
  ["Vega", 279.234, 38.783, 0.03],
  ["Capella", 79.172, 45.997, 0.08],
  ["Rigel", 78.634, -8.202, 0.18],
  ["Procyon", 114.825, 5.225, 0.38],
  ["Achernar", 24.428, -57.236, 0.46],
  ["Betelgeuse", 88.793, 7.407, 0.50],
  ["Hadar", 210.955, -60.373, 0.61],
  ["Altair", 297.695, 8.868, 0.77],
  ["Acrux", 186.650, -63.099, 0.76],
  ["Aldebaran", 68.980, 16.509, 0.85],
  ["Spica", 201.298, -11.161, 0.97],
  ["Antares", 247.351, -26.432, 1.06],
  ["Pollux", 113.650, 28.026, 1.14],
  ["Fomalhaut", 344.412, -29.622, 1.16],
  ["Deneb", 310.358, 45.280, 1.25],
  ["Mimosa", 191.930, -59.688, 1.25]
];

// === GALAXY POINTS ===
let galaxyPoints = [];

// === DATA PLANET ===
const PLANETS = [
  { name: "Merkurius", color: "gray" },
  { name: "Venus", color: "white" },
  { name: "Mars", color: "red" },
  { name: "Jupiter", color: "orange" },
  { name: "Saturnus", color: "gold" }
];

const PLANET_ELEMENTS = {

  Merkurius: {
    N: [48.3313, 3.24587E-5],
    i: [7.0047, 5.00E-8],
    w: [29.1241, 1.01444E-5],
    a: 0.387098,
    e: [0.205635, 5.59E-10],
    M: [168.6562, 4.0923344368]
  },

  Venus: {
    N: [76.6799, 2.46590E-5],
    i: [3.3946, 2.75E-8],
    w: [54.8910, 1.38374E-5],
    a: 0.723330,
    e: [0.006773, -1.302E-9],
    M: [48.0052, 1.6021302244]
  },

  Mars: {
    N: [49.5574, 2.11081E-5],
    i: [1.8497, -1.78E-8],
    w: [286.5016, 2.92961E-5],
    a: 1.523688,
    e: [0.093405, 2.516E-9],
    M: [18.6021, 0.5240207766]
  },

  Jupiter: {
    N: [100.4542, 2.76854E-5],
    i: [1.3030, -1.557E-7],
    w: [273.8777, 1.64505E-5],
    a: 5.20256,
    e: [0.048498, 4.469E-9],
    M: [19.8950, 0.0830853001]
  },

  Saturnus: {
    N: [113.6634, 2.38980E-5],
    i: [2.4886, -1.081E-7],
    w: [339.3939, 2.97661E-5],
    a: 9.55475,
    e: [0.055546, -9.499E-9],
    M: [316.9670, 0.0334442282]
  }

};

// === GLOBAL AWAN ===
let clouds = [];

// === GLOBAL STATE HILAL ENGINE ===
let ctx, canvas; // canvas context global
let sun = {
  alt: 0,
  azi: 0
};

let moon = {
  alt: 0,
  azi: 0,
  illuminated: 0 // 0 - 1 (fase bulan/terang)
};

let star_catalog = []; // array bintang

// threshold waktu
const TWILIGHT_ALT = -6;

// === INIT PLANETARIUM ===
function initPlanetarium(){
  canvas = document.getElementById("planetarium");
  ctx = canvas.getContext("2d");

  resizeCanvas();

  window.addEventListener("resize", resizeCanvas);
  
  initStars();

  requestAnimationFrame(loopPlanetarium);
}

// === UBAH CANVAS ===
function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// === FAKTOR VISIBILITAS ====
function getVisibilityFactor(sunAlt){
  if(sunAlt > 0) return 0;              // siang → bintang hilang
  if(sunAlt > -6) return (0 - sunAlt)/6;   // senja terang
  if(sunAlt > -12) return (6 - (sunAlt+6))/6; // senja medium
  if(sunAlt > -18) return (12 - (sunAlt+12))/6; // senja gelap
  return 1; // malam total
}

// === INISIALISASI TOGGLE HIJRI ===
function initHijriToggle(){

  const checkbox = document.getElementById("hijriModeToggle");
  const label = document.getElementById("hijriModeLabel");

  if(!checkbox || !label){
    console.log("❌ Toggle tidak ditemukan");
    return;
  }

  // === AMBIL MODE DARI STORAGE ===
  modeHijri = JSON.parse(localStorage.getItem("modeHijri"));

  if(modeHijri === null) modeHijri = true; // default: hisab

  // === SET UI AWAL ===
  checkbox.checked = modeHijri;
  label.innerText = modeHijri ? "Mode Hisab" : "Mode Hybrid";

  // === RENDER AWAL ===
  if(currentLat && currentLon){
    updateHijriDisplay(); // ✅ pakai display centralized
  }

  // === EVENT TOGGLE ===
  checkbox.addEventListener("change", ()=>{

    modeHijri = checkbox.checked;

    // === SIMPAN MODE ===
    localStorage.setItem("modeHijri", JSON.stringify(modeHijri));

    // === UPDATE LABEL ===
    label.innerText = modeHijri ? "Mode Hisab" : "Mode Hybrid";

    console.log("🔄 Mode berubah:", modeHijri ? "Hisab" : "Hybrid");

    // === RESET STATE ===
    sudahCekHariIni = false;

    if(typeof lastRender !== "undefined"){
      lastRender.time = 0;
    }

    // === UPDATE UI ===
    if(currentLat && currentLon){

      updateHijriDisplay();
    }

  });
}

// === INISIALISASI SETELAH DOM READY ===
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHijriToggle);
} else {
  initHijriToggle();
}

// === GLOBAL LOCK ===
let lastRender = {
  mode: null,
  time: 0
};
  
// === INIT ===
window.onload = () => {
  preloadHijri();
  startClock();
  initPlanetarium();
  generateGalaxy();
  generateClouds();
  getLocation();
  initSensor();
  
  // === UKURAN CANVAS ===
  const canvas = document.getElementById("marker");
  if(canvas){
    canvas.width = 80;
    canvas.height = 80;
  }
  
  // === TOMBOL KALIBRASI KOMPAS ===
  const calibBtn = document.getElementById("calibrateBtn");
  if(calibBtn){
    calibBtn.addEventListener("click", ()=>{
      calibrateCompass();
    });
  }

  // === NOTIF DAN AUDIO AKTIF SAAT KLIK PERTAMA ===
  document.body.addEventListener("click", () => {
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      console.log("Audio aktif");
    }

    if(Notification.permission === "default"){
      Notification.requestPermission().then(p=>{
        if(p==="granted"){
          showNotif("Hilal Checker", "Notifikasi aktif 🌙");
        }
      });
    }
  }, { once:true });
};

// === GENERATE GALAXY ===
function generateGalaxy(){

  galaxyPoints = [];

  for(let i=0; i<2000; i++){

    // panjang galaksi
    let ra = Math.random() * 360;

    // band sempit (galactic plane)
    let dec = (Math.random() - 0.5) * 30;

    galaxyPoints.push({ ra, dec });
  }
}

// === GENERATE AWAN ===
function generateClouds(){

  clouds = [];

  for(let i=0; i<25; i++){
    clouds.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.4, // langit atas
      size: 60 + Math.random() * 120,
      speed: 0.02 + Math.random() * 0.05 // 🔥 lebih pelan & smooth
    });
  }
}

// === DETEKSI SIANG SENJA MALAM ===
function isDayTime() {
  return sun.alt > 0;
}

function isTwilight() {
  return sun.alt <= 0 && sun.alt > TWILIGHT_ALT;
}

function isNight() {
  return sun.alt <= TWILIGHT_ALT;
}

// === SISTEM WARNA LABEL ===
function getLabelColor(alpha = 1) {

  if (isDayTime()) {
    return `rgba(0,0,0,${alpha})`; // siang → hitam
  }

  if (isTwilight()) {
    return `rgba(200,200,200,${alpha})`; // senja → abu terang
  }

  return `rgba(255,255,255,${alpha})`; // malam → putih
}

// === TULIS LABEL ===
function drawLabel(text, x, y, color="white"){

  ctx.font = "12px Arial";

  // 🔥 KUNCI CENTER ATAS
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  ctx.fillStyle = color;

  // jarak dari objek
  const offset = 10;

  ctx.fillText(text, x, y - offset);
}

// === LANGIT KE LAYAR ===
function skyToScreen(alt, azi){

  const r = (90 - alt) / 90;

  const x = canvas.width/2 + r * Math.sin(azi * Math.PI/180) * canvas.width/2;
  const y = canvas.height/2 - r * Math.cos(azi * Math.PI/180) * canvas.height/2;

  return { x, y };
}

// === GRID LANGIT ===
function drawSkyGrid(pitch, heading){

  const grid = document.getElementById("skyGrid");
  if(!grid) return;

  grid.innerHTML = "";

  const width = grid.clientWidth;
  const height = grid.clientHeight;

  const FOV = 60;

  // MODE AGAR TIDAK RAMAI
  const minimal = true;

  let altSteps = minimal ? [0] : [-30,-15,0,15,30];
  let azSteps  = minimal ? [-30,0,30] : [-60,-30,0,30,60];

  // === HORIZONTAL (ALTITUDE) ===
  altSteps.forEach(alt => {

    let deltaAlt = alt - pitch;

    // === HANYA DEKAT HORIZON ===
    if(Math.abs(deltaAlt) > 40) return;

    let y = height/2 - (deltaAlt / FOV) * height;

    if(y < 0 || y > height) return;

    const line = document.createElement("div");
    line.className = "grid-line grid-h";
    line.style.top = y + "px";

    if(alt === 0){
      line.style.background = "rgba(255,255,255,0.35)";
    }

    grid.appendChild(line);
  });

  // === VERTIKAL (AZIMUTH) ===
  azSteps.forEach(az => {

    let x = width/2 + (az / FOV) * width;

    if(x < 0 || x > width) return;

    const line = document.createElement("div");
    line.className = "grid-line grid-v";
    line.style.left = x + "px";

    if(az === 0){
      line.style.background = "rgba(255,255,255,0.35)";
    }

    grid.appendChild(line);
  });
}

// === INIT BINTANG ===
function initStars(){

  // === BINTANG KATALOG ===
  stars = STAR_CATALOG.map(s => ({
    name: s[0],
    ra: s[1],
    dec: s[2],
    mag: s[3],
    real: true
  }));

  // === TAMBAHAN BINTANG ===
  const extraStars = 1000; // bisa diubah (500–3000)

  for(let i=0;i<extraStars;i++){
    stars.push({
      ra: Math.random() * 360,
      dec: (Math.random() * 180) - 90,
      mag: Math.random() * 6 + 1, // redup
      real: false
    });
  }
}

// === KONVERSI DEC TO ALTAZ ===
function raDecToAltAz(ra, dec, lat, lon, date){

  const rad = Math.PI/180;
  const deg = 180/Math.PI;

  const JD = (date.getTime()/86400000)+2440587.5;
  const T = (JD - 2451545) / 36525;

  // === GMST ===
  let GMST = 280.46061837 + 360.98564736629*(JD - 2451545);
  GMST = (GMST % 360 + 360) % 360;

  const LST = GMST + lon;

  const HA = (LST - ra);

  const alt = Math.asin(
    Math.sin(lat*rad)*Math.sin(dec*rad) +
    Math.cos(lat*rad)*Math.cos(dec*rad)*Math.cos(HA*rad)
  ) * deg;

  let azi = Math.atan2(
    -Math.sin(HA*rad),
    Math.tan(dec*rad)*Math.cos(lat*rad) -
    Math.sin(lat*rad)*Math.cos(HA*rad)
  ) * deg;

  if(azi < 0) azi += 360;

  return { alt, azi };
}

// === POSISI PLANET ===
function getPlanetPosition(name, date){

  const d = getJulianDay(date) - 2451545.0;
  const el = PLANET_ELEMENTS[name];

  if(!el) return null;

  const N = normalize(el.N[0] + el.N[1]*d);
  const i = el.i[0] + el.i[1]*d;
  const w = normalize(el.w[0] + el.w[1]*d);
  const a = el.a;
  const e = el.e[0] + el.e[1]*d;
  const M = normalize(el.M[0] + el.M[1]*d);

  let E = M + rad2deg(e * Math.sin(deg2rad(M)) * (1 + e * Math.cos(deg2rad(M))));

  const xv = a * (Math.cos(deg2rad(E)) - e);
  const yv = a * (Math.sqrt(1 - e*e) * Math.sin(deg2rad(E)));

  const v = rad2deg(Math.atan2(yv, xv));
  const r = Math.sqrt(xv*xv + yv*yv);

  const xh = r * (
    Math.cos(deg2rad(N)) * Math.cos(deg2rad(v+w)) -
    Math.sin(deg2rad(N)) * Math.sin(deg2rad(v+w)) * Math.cos(deg2rad(i))
  );

  const yh = r * (
    Math.sin(deg2rad(N)) * Math.cos(deg2rad(v+w)) +
    Math.cos(deg2rad(N)) * Math.sin(deg2rad(v+w)) * Math.cos(deg2rad(i))
  );

  const zh = r * (
    Math.sin(deg2rad(v+w)) * Math.sin(deg2rad(i))
  );

  const Ls = normalize(280.460 + 0.9856474*d);
  const xs = Math.cos(deg2rad(Ls));
  const ys = Math.sin(deg2rad(Ls));

  const xg = xh - xs;
  const yg = yh - ys;
  const zg = zh;

  const ecl = 23.4393 - 3.563E-7*d;

  const xe = xg;
  const ye = yg * Math.cos(deg2rad(ecl)) - zg * Math.sin(deg2rad(ecl));
  const ze = yg * Math.sin(deg2rad(ecl)) + zg * Math.cos(deg2rad(ecl));

  const ra = normalize(rad2deg(Math.atan2(ye, xe)));
  const dec = rad2deg(Math.atan2(ze, Math.sqrt(xe*xe + ye*ye)));

  return { ra, dec };
}

// === ALTAZ TO XY ===
function altAzToXY(alt, azi){

  if(alt === undefined || azi === undefined) return null;
  if(isNaN(alt) || isNaN(azi)) return null;
  if(alt < 0) return null;

  // === NORMALISASI ===
  azi = (azi + 360) % 360;

  // === BALIK ARAH AZIMUTH ===
  let x = ((360 - azi) / 360) * canvas.width;

  // === ALTITUDE TETAP ===
  let y = canvas.height - (alt / 90) * canvas.height;

  return { x, y };
}
    
// === BACKGROUND LANGIT ===
function drawSkyBackground(){

  let sun = sunCache;
  let vf = getVisibilityFactor(sun.alt);

  let r = Math.floor(10 + (135 * (1 - vf)));
  let g = Math.floor(10 + (206 * (1 - vf)));
  let b = Math.floor(30 + (235 * (1 - vf)));

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0,0,canvas.width,canvas.height);

}

// === GAMBAR BULAN ===
function drawMoon(){

  let moonData = moonCache;
  if(!moonData || moonData.alt < -90) return;

  let pos = altAzToXY(moonData.alt, moonData.azi);
  if(!pos) return;

  let sun = sunCache;

  // === VISIBILITY SYSTEM ===
  let vf = getVisibilityFactor(sun.alt);

  // === FASE BULAN (0 = GELAP, 1 = PURNAMA)
  let phase = moonData.illumination ?? 0.5;

  // === FINAL KECERAHAN ===
  // moon tetap terlihat siang tapi lebih redup
  let alpha = (0.2 + 0.8 * phase) * vf;

  // === TAMBAHAN RULE REALISTIS ===
  if(sun.alt > 0){
    alpha *= 0.25; // siang → redup tapi masih ada
  } 
  else if(sun.alt > -6){
    alpha *= 0.6;  // senja → agak jelas
  }

  // === GAMBAR BENTUK BULAN ===
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);

  ctx.fillStyle = `rgba(255, 255, 210, ${alpha})`;
  ctx.fill();

  // === GLOW LEMBUAT ===
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.15})`;
  ctx.fill();

  // === LABEL BULAN ===
  if(alpha > 0.15){

    ctx.font = "12px Arial";

    // === BAYANGAN HANYA MALAM/SENJA ===
    if(sun.alt <= 0){
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 3;
    } else {
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }

    let labelColor;

    if(sun.alt > 0){
      labelColor = `rgba(0,0,0,${alpha})`; // siang
    } 
    else if(sun.alt > -6){
      labelColor = `rgba(180,180,180,${alpha})`; // senja
    } 
    else {
      labelColor = `rgba(255,255,255,${alpha})`; // malam
    }

    ctx.fillStyle = labelColor;
    drawLabel("Bulan", pos.x, pos.y, labelColor);

    // reset shadow (WAJIB)
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }
}

// === GAMBAR AWAN ===
function drawClouds(){

  const sun = sunCache;

  // === MALAM TIDAK TAMPIL ===
  if(sun.alt <= 0) return;

  // === OPACITY BERDASARKAN KETINGGIAN MATAHARI ===
  let alpha = Math.min(1, sun.alt / 30) * 0.6;

  // === WAKTU DIPERLAMBAT ===
  const t = Date.now() * 0.00003;

  clouds.forEach(c => {

    // === GERAKAN UTAMA (DRIFT PELAN KE KANAN) ===
    c.x += c.speed;

    // === EFEK ANGIN HALUS ===
    c.x += Math.sin(t + c.y) * c.speed * 0.3;

    // === WRAP LAYAR ===
    if(c.x > canvas.width + 120){
      c.x = -120;
      c.y = Math.random() * canvas.height * 0.4; // biar variasi
    }

    // === GAMBAR AWAN ===
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;

    ctx.arc(c.x, c.y, c.size * 0.5, 0, Math.PI * 2);
    ctx.arc(c.x + 25, c.y + 10, c.size * 0.4, 0, Math.PI * 2);
    ctx.arc(c.x - 25, c.y + 10, c.size * 0.4, 0, Math.PI * 2);

    ctx.fill();
  });
}

// === GAMBAR HORIZON ===
function drawHorizon(){
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.strokeStyle = "lime";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// === GAMBAR BINTANG ===
function drawStars(){

  let sun = sunCache;
  let vf = getVisibilityFactor(sun.alt);

  if(vf <= 0) return;

  const now = new Date();

  stars.forEach(star => {

    // === HITUNG POSISI DULU ===
    const coord = raDecToAltAz(
      star.ra,
      star.dec,
      currentLat,
      currentLon,
      now
    );

    if(!coord) return;

    const pos = altAzToXY(coord.alt, coord.azi);
    if(!pos) return;

    // === KECERAHAN SISTEM ===
    const size = star.real ? 2.5 : 1;
    const baseBrightness = star.real ? 1 : 0.3;

    // === FADE BERDASARKAN VISIBILITY DAN ATMOSFER === 
    let alpha = vf * baseBrightness;

    // === TAMBAHAN FADE SIANG ===
    if(sun.alt > 0){
      alpha *= 0;          // siang → hilang total
    } else if(sun.alt > -6){
      alpha *= 0.25;       // senja → redup
    }

    // === GAMBAR TITIK BINTANG ===
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();

    // === LABEL SISTEM ===
    if(star.real && star.mag < 1.0 && alpha > 0.15){

      let labelColor;

      if(sun.alt > 0){
        labelColor = `rgba(0,0,0,${alpha})`; // siang
      } 
      else if(sun.alt > -6){
        labelColor = `rgba(200,200,200,${alpha})`; // senja
      } 
      else {
        labelColor = `rgba(255,255,255,${alpha})`; // malam
      }

      ctx.font = "11px Arial";

      // shadow hanya saat malam / senja (biar siang tidak blur)
      if(sun.alt <= 0){
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 3;
      } else {
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
      }

      ctx.fillStyle = labelColor;
      drawLabel(star.name, pos.x, pos.y, labelColor);

      // reset shadow (WAJIB)
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }

  });
}

// === GAMBAR PLANET ===
function drawPlanets(){

  const now = new Date();

  let sun = sunCache;
  let vf = getVisibilityFactor(sun.alt);

  if(vf <= 0) return;

  PLANETS.forEach(planet => {

    // === POSISI PLANET ===
    const eq = getPlanetPosition(planet.name, now);

    const coord = raDecToAltAz(
      eq.ra,
      eq.dec,
      currentLat,
      currentLon,
      now
    );

    if(!coord) return;

    const pos = altAzToXY(coord.alt, coord.azi);
    if(!pos) return;

    // === VISIBILITY SYSTEM ===
    const sizeMap = {
      "Merkurius": 3,
      "Venus": 5,
      "Mars": 4,
      "Jupiter": 6,
      "Saturnus": 5
    };

    let baseBrightness = 1;

    // === FADING UTAMA IKUT LANGIT ===
    let alpha = vf * baseBrightness;

    // === TAMBAHAN ATMOSFER SEPERTI BINTANG ===
    if(sun.alt > 0){
      alpha *= 0;        // siang → hilang total
    } 
    else if(sun.alt > -6){
      alpha *= 0.25;     // senja → redup
    }

    // === GAMBAR PLANET ===
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, sizeMap[planet.name], 0, Math.PI * 2);

    ctx.fillStyle = `${planet.color.replace("rgb", "rgba").replace(")", `,${alpha})`)}`;
    ctx.fill();

    // === GLOW ===
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = `${planet.color.replace("rgb", "rgba").replace(")", `,${alpha * 0.3})`)}`;
    ctx.fill();

    // === LABEL SISTEM ===
    if(alpha > 0.15){

      let labelColor;

      if(sun.alt > 0){
        labelColor = `rgba(0,0,0,${alpha})`;
      } 
      else if(sun.alt > -6){
        labelColor = `rgba(200,200,200,${alpha})`;
      } 
      else {
        labelColor = `rgba(255,255,255,${alpha})`;
      }

      ctx.shadowBlur = (sun.alt <= 0) ? 3 : 0;
      ctx.shadowColor = (sun.alt <= 0) ? "rgba(0,0,0,0.5)" : "transparent";

      drawLabel(planet.name, pos.x, pos.y, labelColor);

      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }

  });
}

// === GAMBAR GALAKSI ===
function drawGalaxy(){

  const now = new Date();

  let sun = sunCache;
  let vf = getVisibilityFactor(sun.alt);

  if(vf <= 0) return;

  galaxyPoints.forEach(point => {

    const coord = raDecToAltAz(
      point.ra,
      point.dec,
      currentLat,
      currentLon,
      now
    );

    if(!coord) return;

    const pos = altAzToXY(coord.alt, coord.azi);
    if(!pos) return;

    // === VISIBILITY SYSTEM ===
    let alpha = vf * 0.05; // galaksi sangat redup

    if(sun.alt > 0){
      alpha = 0;        // ☀️ siang hilang total
    } 
    else if(sun.alt > -6){
      alpha *= 0.2;     // 🌇 senja redup
    }

    if(alpha <= 0) return;

    // === GAMBAR ===
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,200,255,${alpha})`;
    ctx.fill();

  });
}

// === GAMBAR MATAHARI ===
function drawSun(){

  let sun = sunCache;
  if(!sun || sun.alt < -90) return;

  let pos = altAzToXY(sun.alt, sun.azi);
  if(!pos) return;

  // === KECERAHAN SISTEM ===
  let alpha = 1;

  if(sun.alt < -5){
    alpha = 0;
  }

  if(alpha <= 0) return;

  // === CORE + GLOW (UTAMA) ===
  ctx.shadowColor = "rgba(255, 200, 100, 0.6)";
  ctx.shadowBlur = 40;

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
  ctx.fill();

  // reset shadow (WAJIB)
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  // === GLOW BESAR (TEMBUS AWAN) ===
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 60, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 220, 120, ${alpha * 0.05})`;
  ctx.fill();

  // === HALO KECIL ===
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 200, 0, ${alpha * 0.15})`;
  ctx.fill();

  // === LABEL ===
  ctx.font = "12px Arial";

  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 3;

  let labelColor;

  if(sun.alt > 0){
    labelColor = `rgba(0,0,0,1)`; // siang
  } 
  else if(sun.alt > -6){
    labelColor = `rgba(80,80,80,1)`; // senja
  } 
  else {
    labelColor = `rgba(255,255,255,1)`; // malam
  }

  ctx.fillStyle = labelColor;
  drawLabel("Matahari", pos.x, pos.y, labelColor);

  // reset shadow lagi
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

// === GAMBAR GRID ===
function drawGrid(){
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height/2);
  ctx.lineTo(canvas.width, canvas.height/2);
  ctx.stroke();
}

// === AUTO SPEED ===
function getAutoSpeed(){
  const now = new Date();

  const jam = now.getHours() + now.getMinutes()/60;

  const maghribData = hitungMaghrib(currentLat, currentLon);
  const maghrib = maghribData ? maghribData.decimal : 18;

  const selisih = Math.abs(jam - maghrib);

  // === LOGIKA AUTO ===
  if(selisih > 3){
    return 1;        // normal (jauh dari maghrib)
  } else if(selisih > 1){
    return 60;       // agak cepat
  } else {
    return 3600;     // super cepat (dekat maghrib)
  }
}

// === LOOP PLANETARIUM ===
function loopPlanetarium(){

  if(!running) return;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(currentLat && currentLon){

    // === HITUNG SEKALI SAJA DI SINI ===
    sunCache = hitungMatahari(currentLat, currentLon);
    moonCache = hitungHilalCore(currentLat, currentLon);

    // === AGAR TETAP KOMPATIBEL ===
    sun = sunCache;
    moon = moonCache;
  }

  drawSkyBackground();
  drawGrid();
  drawHorizon();
  drawStars();
  drawSun();
  drawPlanets();
  drawMoon();
  drawGalaxy();
  drawClouds();

  loopId = requestAnimationFrame(loopPlanetarium);
}

// === JAM ===
function startClock(){
  setInterval(()=>{
    const now = new Date();
    const hari = now.toLocaleDateString('id-ID',{weekday:'long'});
    const tanggal = now.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    const jam = now.toLocaleTimeString('id-ID').replace(/\./g,":");
    document.getElementById('waktu').innerText = `${hari}, ${tanggal} - ${jam}`;
  },1000);
}

// === HITUNG HILAL CORE ===
function hitungHilalCore(lat, lon, customTime=null){

  const rad = Math.PI/180;
  const deg = 180/Math.PI;

  const now = customTime ? new Date(customTime) : new Date();

  // === TIME ===
  const JD_UTC = (now.getTime()/86400000)+2440587.5;
  const deltaT = getDeltaT()/86400;
  const JD = JD_UTC + deltaT;
  const T = (JD - 2451545)/36525;

  // === OBLIQUITY + NUTATION ===
  let epsilon0 = 23 + 26/60 + 21.448/3600
    - (46.8150*T + 0.00059*T*T - 0.001813*T*T*T)/3600;

  const L = (280.4665 + 36000.7698*T) % 360;
  const Lm = (218.3165 + 481267.8813*T) % 360;
  const omega = (125.04452 - 1934.136261*T) % 360;

  const deltaPsi =
    (-17.20*Math.sin(omega*rad)
    -1.32*Math.sin(2*L*rad)
    -0.23*Math.sin(2*Lm*rad)
    +0.21*Math.sin(2*omega*rad))/3600;

  const deltaEps =
    (9.20*Math.cos(omega*rad)
    +0.57*Math.cos(2*L*rad)
    +0.10*Math.cos(2*Lm*rad)
    -0.09*Math.cos(2*omega*rad))/3600;

  const epsilon = epsilon0 + deltaEps;

  // === SUN ===
  const M = (357.52911 + 35999.05029*T) % 360;

  const C =
    (1.914602 - 0.004817*T)*Math.sin(M*rad)
    + 0.019993*Math.sin(2*M*rad);

  const sunLong = L + C + deltaPsi;

  const sunRA = Math.atan2(
    Math.cos(epsilon*rad)*Math.sin(sunLong*rad),
    Math.cos(sunLong*rad)
  ) * deg;

  const sunDec = Math.asin(
    Math.sin(epsilon*rad)*Math.sin(sunLong*rad)
  ) * deg;

  // === MOON ===
  const D = (297.8501921 + 445267.1114034*T) % 360;
  const Mm = (134.9633964 + 477198.8675055*T) % 360;
  const Ms = M;
  const F  = (93.2720950 + 483202.0175233*T) % 360;

  let lonMoon =
    Lm
    + 6.289*Math.sin(Mm*rad)
    + 1.274*Math.sin((2*D - Mm)*rad)
    + 0.658*Math.sin(2*D*rad)
    + 0.214*Math.sin(2*Mm*rad)
    - 0.186*Math.sin(Ms*rad)
    - 0.059*Math.sin((2*D - 2*Mm)*rad)
    - 0.057*Math.sin((2*D - Ms - Mm)*rad)
    + 0.053*Math.sin((2*D + Mm)*rad)
    + 0.046*Math.sin((2*D - Ms)*rad);

  let latMoon =
    5.128*Math.sin(F*rad)
    + 0.280*Math.sin((Mm + F)*rad)
    + 0.277*Math.sin((Mm - F)*rad)
    + 0.173*Math.sin((2*D - F)*rad);

  lonMoon += deltaPsi;

  // === MOON RA/DEC ===
  const moonRA = Math.atan2(
    Math.sin(lonMoon*rad)*Math.cos(epsilon*rad)
    - Math.tan(latMoon*rad)*Math.sin(epsilon*rad),
    Math.cos(lonMoon*rad)
  ) * deg;

  const moonDec = Math.asin(
    Math.sin(latMoon*rad)*Math.cos(epsilon*rad)
    + Math.cos(latMoon*rad)*Math.sin(epsilon*rad)*Math.sin(lonMoon*rad)
  ) * deg;

  // === STABILITAS USNO ===
  const GMST = (280.46061837 + 360.98564736629*(JD - 2451545)) % 360;

  // === NORMALISASI LST ===
  const LST = (GMST + lon + 360) % 360;

  // === STABILISASI HA ===
  const HA = ((LST - moonRA) + 540) % 360 - 180;

  // === ALTITUDE ===
  let alt = Math.asin(
    Math.sin(lat*rad)*Math.sin(moonDec*rad)
    + Math.cos(lat*rad)*Math.cos(moonDec*rad)*Math.cos(HA*rad)
  ) * deg;

  // === AZIMUTH USNO ===
  let azi = Math.atan2(
    Math.sin(HA*rad),
    Math.cos(HA*rad)*Math.sin(lat*rad)
    - Math.tan(moonDec*rad)*Math.cos(lat*rad)
  ) * deg;

  // === NORMALISASI ===
  azi = (azi + 360) % 360;

  // === KONVERSI KE KOMPAS ===
  azi = (azi + 180) % 360;

  // === KOREKSI ===
  alt = koreksiParallax(alt);
  alt = koreksiRefraction(alt);

  // === ELONGASI ===
  let cosElo =
    Math.sin(sunDec*rad)*Math.sin(moonDec*rad)
    + Math.cos(sunDec*rad)*Math.cos(moonDec*rad)
    * Math.cos((sunRA - moonRA)*rad);

  cosElo = Math.max(-1, Math.min(1, cosElo));

  const elo = Math.acos(cosElo) * deg;

  // Umur
  const ijtima = getLastIjtima();
  const age = ijtima ? Math.max(0, (now - ijtima) / 3600000) : 0;

  // Cahaya Bulan
  const illumination = (1 - Math.cos(elo * rad)) / 2 * 100;

  // === OUTPUT ===
  return {
    alt: Number(alt) || 0,
    azi: Number(azi) || 0,
    elo: Number(elo) || 0,
    age: Number(age) || 0,
    illumination: Number(illumination) || 0
  };
}

// === HITUNG MAGHRIB ===
function hitungMaghrib(lat, lon, customDate=null){
  const now = customDate ? new Date(customDate) : new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const JD = (date.getTime()/86400000)+2440587.5;
  const T = (JD-2451545)/36525;

  const epsilon = 23.439291 - 0.0130042*T;
  const L0 = (280.46646 + 36000.76983*T)%360;
  const M = 357.52911 + 35999.05029*T;

  const C = (1.914602 - 0.004817*T)*Math.sin(M*rad)
          + (0.019993 - 0.000101*T)*Math.sin(2*M*rad)
          + 0.000289*Math.sin(3*M*rad);

  const lambda = L0 + C;
  const delta = Math.asin(Math.sin(epsilon*rad)*Math.sin(lambda*rad));
  const y = Math.tan((epsilon/2)*rad)**2;

  const EoT = 4 * deg * (
    y*Math.sin(2*L0*rad)
    - 2*0.0167*Math.sin(M*rad)
    + 4*0.0167*y*Math.sin(M*rad)*Math.cos(2*L0*rad)
    - 0.5*y*y*Math.sin(4*L0*rad)
    - 1.25*0.0167*0.0167*Math.sin(2*M*rad)
  );

  const h0 = -0.833 * rad; 
  const cosH = (Math.sin(h0) - Math.sin(lat*rad)*Math.sin(delta)) /
               (Math.cos(lat*rad)*Math.cos(delta));

  let H;
  if(cosH < -1) H = 180;
  else if(cosH > 1) H = 0;
  else H = Math.acos(cosH)*deg;

  const timezone = -now.getTimezoneOffset()/60;
  const solarNoon = 12 + timezone - (lon/15) - (EoT/60);

  const sunrise = solarNoon - (H/15); // Terbit (Noon dikurang Hour Angle)
  const sunset = solarNoon + (H/15);  // Terbenam (Noon ditambah Hour Angle)

  return { 
    sunrise: sunrise, 
    decimal: sunset, // Tetap gunakan nama 'decimal' agar tidak merusak kode lama Anda
    noon: solarNoon 
  };
}

// ===== HIJRI INSIGHT =====
function getHijriInsight(data, maghrib, now) {
  // 1. Ambil data dari parameter (pastikan data valid)
  const alt = Number(data.alt) || 0;
  const azi = Number(data.azi) || 0;
  const elo = Number(data.elo) || 0;
  const age = Number(data.age) || 0;
  const illumination = Number(data.illumination) || 0;

  // 2. Gunakan CACHED_IJTIMA (Jangan hitung ulang agar tidak lag/glitch)
  const ijtimaNow = typeof CACHED_IJTIMA !== 'undefined' ? CACHED_IJTIMA : new Date();
  
  // 3. Logika Penjelasan Dinamis
  const deskripsiAlt = alt > 0 
    ? `<span style="color:#4ade80">Bulan sudah di atas ufuk dan berpotensi terlihat.</span>` 
    : `<span style="color:#f87171">Bulan masih di bawah ufuk sehingga tidak mungkin terlihat.</span>`;
  
  return `
🔭 <b>Tinggi Bulan:</b> ${alt.toFixed(2)}°<br>
Menunjukkan posisi bulan dari horizon. 
${alt > 0 ? "Bulan sudah di atas ufuk dan berpotensi terlihat." : "Bulan masih di bawah ufuk sehingga tidak mungkin terlihat."}
<br><br>

🧭 <b>Azimuth:</b> ${azi.toFixed(2)}°<br>
Menunjukkan arah bulan dari utara (0° = Utara, 90° = Timur, 180° = Selatan, 270° = Barat).
<br><br>

📐 <b>Elongasi:</b> ${elo.toFixed(2)}°<br>
Jarak sudut bulan terhadap matahari. 
Semakin besar elongasi, semakin besar peluang hilal terlihat.
<br><br>

💡 <b>Cahaya Bulan:</b> ${illumination.toFixed(2)}%<br>
Menunjukkan fase bulan (semakin besar → semakin terang).
<br><br>

🌙 <b>Umur Bulan:</b> ${age.toFixed(1)} jam (~${(age/24).toFixed(2)} hari astronomi)<br><br>

<b>Perkiraan:</b><br>
Sekitar ${(24 - (age % 24)).toFixed(1)} jam lagi menuju fase hari berikutnya. Perkiraan berdasarkan fase bulan, dapat berbeda dari waktu Maghrib lokal.
<br><br>

🔭 <b>Metode Yallop</b><br>
Digunakan secara internasional untuk menentukan apakah hilal bisa terlihat.
Kategori A–B mudah terlihat, sedangkan E berarti tidak mungkin terlihat.<br><br>

🔭 <b>Metode Odeh</b><br>
Metode modern yang mirip Yallop, digunakan dalam penelitian rukyat.
Menunjukkan apakah hilal bisa dilihat dengan mata atau alat bantu.<br><br>

📊 <b>Visibility Score</b><br>
Persentase peluang terlihatnya hilal berdasarkan tinggi, elongasi, dan umur bulan.
Semakin tinggi nilainya, semakin besar kemungkinan hilal terlihat.<br><br>

🌑 <b>Ijtima (Konjungsi)</b><br>
Adalah saat bulan dan matahari sejajar. Ini adalah awal fase bulan baru,
tetapi hilal belum tentu langsung terlihat setelah ijtima.<br><br>

<b>Kesimpulan:</b><br>
Penentuan awal bulan Hijriah tidak hanya berdasarkan ijtima,
tetapi juga kemungkinan hilal dapat dirukyat saat Maghrib.
`;
}

// === GPS LOKASI ===
function getLocation() {
    navigator.geolocation.getCurrentPosition(async (p) => {
        currentLat = p.coords.latitude;
        currentLon = p.coords.longitude;
        
        // === UPDATE KOORDINAT DAN ALAMAT ===
        updateAddress(currentLat, currentLon);

        if (!locationInitialized) {
            initApp(currentLat, currentLon);
        }
    }, (err) => {
        // === FALLBACK JIKA GPS MATI (SELONG, NTB) ===
        currentLat = -8.652082;
        currentLon = 116.528827;
        
        const lokasiEl = document.getElementById('lokasi');
        if (lokasiEl) lokasiEl.innerText = "GPS mati, memakai lokasi default";
        
        updateAddress(currentLat, currentLon);
        
        if (!locationInitialized) {
            initApp(currentLat, currentLon);
        }
    }, { enableHighAccuracy: true, timeout: 15000 });
}

async function updateAddress(lat, lon) {
    const locEl = document.getElementById('loc');
    const lokasiEl = document.getElementById('lokasi');

    // 1. Update teks koordinat angka
    if (locEl) locEl.innerText = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

    try {
        if (lokasiEl) lokasiEl.innerText = "Mencari lokasi...";

        // Menambahkan parameter accept-language=id agar nama tempat dalam Bahasa Indonesia
        const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=id`
        );
        
        if (!r.ok) throw new Error("Gagal mengambil data");
        
        const d = await r.json();
        const a = d.address || {};
        
        // 2. Susun komponen alamat secara hierarkis
        const komponenAlamat = [
            a.village || a.suburb || a.town || a.city || "", // Desa/Kelurahan/Kota
            a.district || a.county || "",                    // Kecamatan/Kabupaten
            a.state || "",                                   // Provinsi                         
            a.country || ""                                  // Negara
        ];

        // 3. Gabungkan komponen yang tidak kosong dengan tanda koma
        const alamatLengkap = komponenAlamat
            .filter(v => v.trim() !== "") // Menghapus bagian yang kosong
            .join(", ");                  // Menggabungkan dengan koma

        if (lokasiEl) {
            lokasiEl.innerText = alamatLengkap || "Lokasi tidak dikenal";
        }

    } catch (err) {
        console.error("Geocode Error:", err);
        if (lokasiEl) {
            lokasiEl.innerText = "Gagal memuat nama lokasi (Cek Koneksi)";
        }
    }
}

// === 3. INISIALISASI APLIKASI (CENTRALIZED VERSION) ===
async function initApp(lat, lon) {
    if (!lat || !lon) return;
    locationInitialized = true;
    
    // A. Jalankan fungsi pendukung sekali di awal
    try {
        if (typeof getMagneticDeclination === 'function') await getMagneticDeclination(lat, lon);
        if (typeof startMaghribWatcher === 'function') startMaghribWatcher(lat, lon);
    } catch (e) { console.warn("Pendukung gagal."); }

    // B. Hitungan Pertama
    if (!CACHED_IJTIMA) refreshIjtimaData();
    hilalDataFull = hitungHilal(lat, lon);

    // ============================================================
    // TIMER 1: Komputasi Berat (Tiap 5-10 Detik)
    // ============================================================
    setInterval(() => {
        if (currentLat && currentLon) {
            hilalDataFull = hitungHilal(currentLat, currentLon);
            if (typeof updateSunCard === 'function') updateSunCard();
        }
    }, 10000); 

    // ============================================================
    // TIMER 2: UI & Visual (Tiap 1 Detik)
    // ============================================================
    setInterval(() => {
        // CUKUP PANGGIL renderUI() SAJA
        // Semua urusan update teks, countdown, dan progress bar 
        // harusnya sudah ada di dalam fungsi renderUI agar tidak tumpang tindih.
        if (typeof renderUI === 'function') {
            renderUI(); 
        }

        // Update fungsi visual lain yang tidak ada di renderUI
        if (typeof updatePrediksiCard === 'function') updatePrediksiCard();
        if (typeof updateHilalAR === 'function') updateHilalAR();
    }, 1000);

    // ============================================================
    // TIMER 3: Kalender (Tiap 2 Detik)
    // ============================================================
    setInterval(() => {
        if (typeof updateHijriDisplay === 'function') updateHijriDisplay();
    }, 2000);

    // Eksekusi awal
    setTimeout(() => { updateSunCard(); }, 0);
    debugHilal();
}

// === SENSOR ===
function initSensor(){

  let lastAlpha = 0;
  let lastBeta  = 0;
  let lastGamma = 0;

  let initialized = false;

  function handleOrientation(e){

    let alpha = e.alpha ?? 0;
    let beta  = e.beta  ?? 0;
    let gamma = e.gamma ?? 0;

    // === NORMALISASI HEADING ===
    alpha = (alpha + 360) % 360;

    // === FIRST INIT ===
    if(!initialized){
      lastAlpha = alpha;
      lastBeta  = beta;
      lastGamma = gamma;
      initialized = true;
    }

    // === FILTER HEADING (ANTI LONCAT 360) ===
    let deltaAlpha = ((alpha - lastAlpha + 540) % 360) - 180;

    let factorA = Math.abs(deltaAlpha) > 5 ? 0.2 : 0.08;
    let factorB = Math.abs(beta - lastBeta) > 5 ? 0.15 : 0.07;
    let factorG = Math.abs(gamma - lastGamma) > 5 ? 0.15 : 0.07;

    lastAlpha += deltaAlpha * factorA;
    lastBeta  += (beta  - lastBeta)  * factorB;
    lastGamma += (gamma - lastGamma) * factorG;

    // === SIMPAN GLOBAL ===
    window.lastAlpha = lastAlpha;

    // === KIRIM KE AR ===
    /* updateAR(lastAlpha, lastBeta, lastGamma); */
  }

  // === EVENT UTAMA ===
  if("ondeviceorientationabsolute" in window){
    window.addEventListener("deviceorientationabsolute", handleOrientation);
  } else {
    window.addEventListener("deviceorientation", handleOrientation);
  }
}

// === DEKLINASI ===
async function getMagneticDeclination(lat, lon){

  try {

    // coba API (kalau ada key di masa depan)
    const url = `https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination?lat1=${lat}&lon1=${lon}&resultFormat=json`;

    const res = await fetch(url);
    const data = await res.json();

    if(data?.result?.[0]?.declination !== undefined){
      declinationGlobal = data.result[0].declination;
      return declinationGlobal;
    }

  } catch(e){
    console.warn("Pemanggilan API deklinasi gagal, diubah pakai offline");
  }

  // === FALLBACK OFFLINE ===
  declinationGlobal = (lon - 110) * 0.05;

  return declinationGlobal;
}

// === KONSTANTA ===
const rad = Math.PI/180;
const deg = 180/Math.PI;

// === TANGGAL INDONESIA ===
function formatTanggalIndonesia(date){
  const bulan = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];

  const d = date.getDate();
  const m = bulan[date.getMonth()];
  const y = date.getFullYear();

  const jam = String(date.getHours()).padStart(2,'0');
  const menit = String(date.getMinutes()).padStart(2,'0');
  const detik = String(date.getSeconds()).padStart(2,'0');

  return `${d} ${m} ${y} - Pkl. ${jam}:${menit}:${detik}`;
}

// === IJTIMA TERAKHIR ===
function getLastIjtima() {
    const now = new Date();
    const JD = (now.getTime() / 86400000) + 2440587.5;
    
    // Ijtima terdekat
    let k = Math.floor((JD - 2451550.09765) / 29.530588853);
    
    function hitung(k) {
        const T = k / 1236.85;
        const JDE = 2451550.09765 + 29.530588853 * k + 0.0001337 * T * T;
        return (JDE - 2440587.5) * 86400000;
    }

    let ijtimaMillis = hitung(k);
    
    // Jika hasil hitungan k ternyata di masa depan, mundurkan k sekali
    if (ijtimaMillis > now.getTime()) {
        ijtimaMillis = hitung(k - 1);
    }

    return new Date(ijtimaMillis);
}

// === IJTIMA BERIKUTNYA ===
function getNextIjtima(){
  const now = new Date();
  const JD = (now.getTime()/86400000)+2440587.5;

  let k = Math.floor((JD - 2451550.09765) / 29.530588853);

  function hitungIjtima(k){
    const T = k / 1236.85;

    return 2451550.09765
      + 29.530588853*k
      + 0.0001337*T*T
      - 0.000000150*T*T*T
      + 0.00000000073*T*T*T*T;
  }

  let JDE = hitungIjtima(k);

  if(JDE <= JD){
    k++;
    JDE = hitungIjtima(k);
  }

  const millis = (JDE - 2440587.5) * 86400000;
  return new Date(millis);
}

// === HITUNG MUNDUR IJTIMA ===
function getCountdownIjtima(now, target){
  let diff = target - now;

  if(diff <= 0) return "Sedang berlangsung / sudah lewat";

  const jam = Math.floor(diff / 3600000);
  const menit = Math.floor((diff % 3600000)/60000);
  const detik = Math.floor((diff % 60000)/1000);

  return `${jam} jam ${menit} menit ${detik} detik`;
}

// === REFRACTION & PARALLAX ===
function koreksiRefraction(alt){
  if(alt > -1){
    const R = (1.02 / Math.tan((alt + 10.3/(alt+5.11)) * rad)) + 0.0019;
    return alt + (R/60);
  }
  return alt;
}
function koreksiParallax(alt){
  const pi = 0.9507;
  const altRad = alt * rad;
  const correction = Math.asin(Math.sin(pi*rad) * Math.cos(altRad));
  return alt - (correction * deg);
}

// === DELTA TIME ===
function getDeltaT(){
  const year = new Date().getFullYear();
  const t = (year - 2000) / 100;
  return 64.7 + 64.5*t + 0.21*t*t; // aproksimasi Meeus modern
}

// === HIJRI PROGRESS ===
function getNextHijriProgress(age){
  const jamDalamHari = age % 24; // sisa jam dalam 1 hari hijriah
  return (jamDalamHari / 24) * 100;
}

// === HITUNG MUNDUR MAGHRIB ===
function getCountdownMaghrib(now, maghrib){
  const jamSekarang = now.getHours() + now.getMinutes()/60;

  let sisaJam;

  if(jamSekarang < maghrib){
    sisaJam = maghrib - jamSekarang;
  } else {
    sisaJam = (24 - jamSekarang) + maghrib;
  }

  const jam = Math.floor(sisaJam);
  const menit = Math.floor((sisaJam - jam) * 60);

  return `${jam} jam ${menit} menit lagi menuju Maghrib`;
}

// === RENDER UI ====
function renderUI() {
    // 1. Pastikan koordinat tersedia (gunakan satu sumber kebenaran)
    // Jika currentLat kosong, jangan render dulu agar tidak terjadi glitch angka lompat
    if (!currentLat || !currentLon) {
        document.getElementById('insight').innerHTML = "⏳ Menunggu koordinat GPS...";
        return;
    }

    // 2. Cek data Hilal (sudah dihitung oleh interval utama belum?)
    if (!hilalDataFull || typeof hilalDataFull.age === 'undefined') {
        document.getElementById('insight').innerHTML = "⏳ Mengkalkulasi data astronomi...";
        return;
    }

    const now = new Date();

    try {
        // 3. Ambil data Maghrib (hanya panggil jika fungsinya ada)
        const maghribData = typeof hitungMaghrib === 'function' ? hitungMaghrib(currentLat, currentLon) : { decimal: 18 };
        const maghrib = maghribData.decimal;

        // 4. Update UI Insight (kirim hilalDataFull yang sudah matang)
        // Pastikan Anda sudah mengupdate fungsi getHijriInsight seperti saran sebelumnya
        const insightHTML = getHijriInsight(hilalDataFull, maghrib, now);
        const insightElement = document.getElementById('insight');
        if (insightElement) insightElement.innerHTML = insightHTML;

        // 5. Update Elemen Penunjang lainnya
        const countdownStr = typeof getCountdownMaghrib === 'function' ? getCountdownMaghrib(now, maghrib) : "--:--";
        const countdownElement = document.getElementById('countdownMaghrib');
        if (countdownElement) countdownElement.innerText = countdownStr;

        const progressVal = typeof getProgressToMaghrib === 'function' ? getProgressToMaghrib(now, currentLat, currentLon) : 0;
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = progressVal + "%";

    } catch (err) {
        console.error("❌ Render UI Error:", err);
    }
}

// === PRELOAD HIJRI ===
function preloadHijri(){

  const cache = localStorage.getItem("hybridCache");

  if(cache){
    const result = JSON.parse(cache);

    const bulan = [
      "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
      "Jumadil Awal","Jumadil Akhir","Rajab","Syaban",
      "Ramadhan","Syawal","Zulkaidah","Zulhijjah"
    ];

    const el = document.getElementById('hijri');

    if(el){
      el.innerText = `${result.d} ${bulan[result.m-1]} ${result.y} H`;
    }

    console.log("⚡ Hijri preload dari cache");
  }
}

// === PROGRESS MENUJU MAGHRIB ===
function getProgressToMaghrib(now, lat, lon){

  const todayMaghribData = hitungMaghrib(lat, lon);
  if(!todayMaghribData) return 0;

  const maghribDecimal = todayMaghribData.decimal;

  const maghribToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Math.floor(maghribDecimal),
    Math.floor((maghribDecimal % 1)*60),
    0, 0
  );

  let maghribPrev, maghribNext;

  if(now >= maghribToday){
    // setelah maghrib → ambil besok
    maghribPrev = maghribToday;

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const nextData = hitungMaghrib(lat, lon);
    const nextDec = nextData.decimal;

    maghribNext = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      Math.floor(nextDec),
      Math.floor((nextDec % 1)*60),
      0, 0
    );

  } else {
    // sebelum maghrib → ambil kemarin
    maghribNext = maghribToday;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const prevData = hitungMaghrib(lat, lon);
    const prevDec = prevData.decimal;

    maghribPrev = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate(),
      Math.floor(prevDec),
      Math.floor((prevDec % 1)*60),
      0, 0
    );
  }

  const total = maghribNext - maghribPrev;
  const passed = now - maghribPrev;

  let progress = (passed / total) * 100;

  return Math.max(0, Math.min(100, progress));
}

// === UPDATE HILAL AR ===
function updateHilalAR(){

  if(!currentLat || !currentLon) return;

  // === AUTO SPEED ===
  arSpeed = getAutoSpeed();

  const now = new Date();
  const simulatedTime = new Date(now.getTime() + (1000 * arSpeed));

  const data = hitungHilalCore(currentLat, currentLon, simulatedTime);

  hilalData.alt = data.alt;
  hilalData.azi = data.azi;

  hilalDataFull = data;
}

// === KECEPATAN AR ===
function setARSpeed(speed){
  arSpeed = speed;
}

// === BENTUK BULAN ===
function drawMoonRealistic(illumination){

  const canvas = document.getElementById("marker");
  if(!canvas) return;

  const ctx = canvas.getContext("2d");

  const size = canvas.width;
  ctx.clearRect(0,0,size,size);

  const r = size/2;

  // === FULL MOON BASE ===
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI*2);
  ctx.fillStyle = "white";
  ctx.fill();

  // === SHADOW (UNTUK HILAL) ===
  const phase = illumination / 100;

  ctx.globalCompositeOperation = "destination-out";

  ctx.beginPath();

  // === KUNCI BENTUK HILAL ===
  const offset = (1 - phase) * r * 2;

  ctx.arc(r + offset - r, r, r, 0, Math.PI*2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";

  // === GLOW EFFECT ===
  const glow = ctx.createRadialGradient(r, r, r*0.3, r, r, r);
  glow.addColorStop(0, "rgba(255,255,255,0.9)");
  glow.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI*2);
  ctx.fill();
}

// ==== HITUNG HILAL ===
function hitungHilal(lat, lon, customTime = null) {
  const statusEl = document.getElementById('status');
  const prediksiEl = document.getElementById('prediksi');

  if (statusEl) statusEl.innerText = "⏳ Menghitung hilal...";
  if (prediksiEl) prediksiEl.innerText = "";

  // 1. Definisikan Waktu Referensi
  const now = customTime ? new Date(customTime) : new Date();

  // 2. Gunakan CACHED_IJTIMA (pastikan sudah ada di baris paling atas script luar)
  // Mencegah fungsi memanggil getLastIjtima() berulang kali yang bikin lag
  const ijtima = CACHED_IJTIMA; 

  // 3. Ambil data Kalender (jadi ringan karena pakai Cache)
  const dataHisab = getHijriAstronomical(lat, lon);
  const dataHybrid = getHijriHybrid(lat, lon);
  
  const hariHisab = dataHisab.d;
  const hariHybrid = dataHybrid.d;

  // 4. Hitung Data Astronomi Core
  const data = hitungHilalCore(lat, lon, now);
  
  const alt = Number(data.alt) || 0;
  const azi = Number(data.azi) || 0;
  const elo = Number(data.elo) || 0;
  const illumination = Number(data.illumination) || 0;

  // 5. HITUNG UMUR BULAN ===
  // Rumus: (Waktu Sekarang - Waktu Ijtima) dalam jam
  const age = (now.getTime() - ijtima.getTime()) / 3600000;

  // === UI ANGKA ===
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  set("alt", alt.toFixed(2) + "°");
  set("azi", azi.toFixed(2) + "°");
  set("elo", elo.toFixed(2) + "°");
  set("age", age.toFixed(1) + " jam"); // Menampilkan age hasil hitungan di atas
  set("illum", illumination.toFixed(2) + "%");

  // === VISIBILITY ===
  const yallop = hitungVisibilitasYallop(alt, elo);
  const odeh = hitungVisibilitasOdeh(alt, elo);
  set("yallop", yallop);
  set("odeh", odeh);
  set("visibility", hitungVisibilityScore(alt, elo, age) + "%");

  // === REFERENSI WAKTU ===
  // Menggunakan ijtima dari cache, bukan panggil fungsi baru
  set("statusIjtima", now >= ijtima ? "Sudah Ijtima" : "Belum Ijtima");

  const maghrib = hitungMaghrib(lat, lon, now)?.decimal ?? 18;
  const jamNow = now.getHours() + now.getMinutes() / 60;
  const sebelumMaghrib = jamNow < maghrib;
  const imkan = (alt >= 3 && elo >= 6.4);

  // === LOGIKA STATUS & PREDIKSI (UI DECISION) ===
  if (alt < 0) {
    if (statusEl) statusEl.innerText = "Bulan di bawah ufuk";
    if (prediksiEl) prediksiEl.innerText = "Tidak dapat dilakukan observasi hilal";
  } 
  else if (sebelumMaghrib) {
    if (hariHisab < 29) {
      if (statusEl) statusEl.innerText = "Fase normal bulan berjalan";
      if (prediksiEl) prediksiEl.innerText = "Belum memasuki fase akhir bulan";
    } else {
      if (statusEl) statusEl.innerText = `Fase evaluasi hilal (${hariHisab} H)`;
      if (prediksiEl) prediksiEl.innerText = imkan ? 
        "Hilal memenuhi kriteria, berpotensi terlihat nanti sore" : 
        "Hilal di bawah kriteria, kemungkinan besar Istikmal";
    }
  } 
  else {
    // === KONDISI SETELAH MAGHRIB ===
    if (hariHybrid === 29 || hariHybrid === 30 || hariHybrid === 1) {
      if (imkan) {
        statusEl.innerText = "Hilal terlihat (Imkan Rukyat).";
        prediksiEl.innerText = "Kriteria terpenuhi, awal bulan dimulai.";
      } else {
        statusEl.innerText = "Istikmal/Hilal tak terlihat.";
        prediksiEl.innerText = "Bulan digenapkan menjadi 30 hari sesuai kriteria.";
      }
    } 
    else {
      if (hariHisab === 15) {
        statusEl.innerText = "Malam Purnama.";
        prediksiEl.innerText = "Bulan tepat di titik oposisi 180°.";
      } else {
        statusEl.innerText = `Malam ke-${hariHisab} Hijriah.`;
        prediksiEl.innerText = hariHisab < 15 ? 
          "Bulan menuju fase Purnama" : "Bulan menuju fase akhir bulan.";
      }
    }
  }
  return data;
}

// === DATA MATAHARI ===
function updateSunCard() {
    // 1. Validasi keberadaan koordinat GPS
    if (typeof currentLat === "undefined" || !currentLat || !currentLon) {
        return; 
    }

    try {
        // 2. Hitung posisi matahari (Azimuth & Altitude)
        const sunPos = hitungMatahari(currentLat, currentLon);
        
        // 3. Hitung waktu matahari (Terbit & Terbenam)
        const sunTimes = hitungMaghrib(currentLat, currentLon);

        // 4. Update UI: Azimuth
        const elAzi = document.getElementById('sun-azimuth');
        if (elAzi) elAzi.textContent = sunPos.azi.toFixed(2) + "°";

        // 5. Update UI: Altitude dengan indikator warna malam
        const elAlt = document.getElementById('sun-altitude');
        if (elAlt) {
            elAlt.textContent = sunPos.alt.toFixed(2) + "°";
            
            // Jika matahari di bawah horizon (malam), tambahkan class 'night'
            if (sunPos.alt < 0) {
                elAlt.classList.add('night');
            } else {
                elAlt.classList.remove('night');
            }
        }

        // 6. Update UI: Waktu Terbit & Terbenam
        const elRise = document.getElementById('sun-rise');
        const elSet = document.getElementById('sun-set');

        if (elRise) elRise.textContent = formatDecimalTime(sunTimes.sunrise);
        if (elSet) elSet.textContent = formatDecimalTime(sunTimes.decimal);

    } catch (error) {
        console.error("Gagal memperbarui Sun Card:", error);
    }
}

// === FUNGSI PEMBANTU WAKTU DESIMAL ===
function formatDecimalTime(decimal) {
    if (isNaN(decimal) || decimal === null) return "--:--";
    
    // Pastikan nilai tetap dalam siklus 24 jam
    let hours = Math.floor(decimal % 24);
    if (hours < 0) hours += 24; 
    
    let minutes = Math.floor((decimal * 60) % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// === JALUR BULAN ===
function generateHilalPath(lat, lon){
  let path = [];

  for(let i=0;i<=60;i++){ // 60 menit ke depan
    let future = new Date(Date.now() + i*60000);
    let data = hitungHilalFuture(lat, lon, future);
    path.push(data);
  }

  return path;
}

// ==== HITUNG HILAL MENDATANG ===
function hitungHilalFuture(lat, lon, time){
  return hitungHilalCore(lat, lon, time);
}

// === HITUNG MATAHARI ===
function hitungMatahari(lat, lon){
  const now = new Date();

  const JD = (now/86400000)+2440587.5;
  const T = (JD-2451545)/36525;

  const L0 = (280.46646 + 36000.76983*T)%360;
  const M = 357.52911 + 35999.05029*T;

  const C = (1.914602 - 0.004817*T)*Math.sin(M*rad)
          + (0.019993 - 0.000101*T)*Math.sin(2*M*rad)
          + 0.000289*Math.sin(3*M*rad);

  const lambda = L0 + C;

  const epsilon = 23.439291 - 0.0130042*T;

  const RA = Math.atan2(
    Math.cos(epsilon*rad)*Math.sin(lambda*rad),
    Math.cos(lambda*rad)
  )*deg;

  const Dec = Math.asin(
    Math.sin(epsilon*rad)*Math.sin(lambda*rad)
  )*deg;

  const GMST = (280.46061837 + 360.98564736629*(JD-2451545)) % 360;
  const LST = GMST + lon;
  const HA = (LST - RA);

  let alt = Math.asin(
    Math.sin(lat*rad)*Math.sin(Dec*rad) +
    Math.cos(lat*rad)*Math.cos(Dec*rad)*Math.cos(HA*rad)
  )*deg;

  let azi = Math.atan2(
    -Math.sin(HA*rad),
    Math.tan(Dec*rad)*Math.cos(lat*rad) -
    Math.sin(lat*rad)*Math.cos(HA*rad)
  )*deg;

  if(azi < 0) azi += 360;

  return { alt, azi };
}

// === KALIBRASI MATAHARI ===
function calibrateWithSun(){
  if(!currentLat || !currentLon){
    alert("Lokasi belum tersedia");
    return;
  }

  alert("Arahkan kamera tepat ke Matahari, lalu tekan OK");

  setTimeout(()=>{
    const sun = hitungMatahari(currentLat, currentLon);

    // Ambil arah HP sekarang
    let heading;

    if(window.lastAlpha !== undefined){
      heading = lastAlpha;
    } else {
      alert("Sensor belum siap");
      return;
    }

    // Hitung offset
    headingOffset = (sun.azi - heading + 360) % 360;

    alert("Kalibrasi Matahari berhasil ✅\nOffset: " + headingOffset.toFixed(2) + "°");

  }, 1000);
}

// === MAGHRIB WATCHER ===
function startMaghribWatcher() {
    console.log("🚀 Maghrib Watcher aktif: Memantau pergantian hari...");
    
    setInterval(() => {
        if (!currentLat || !currentLon) return;
        
        const now = new Date();
        const jamSekarangDesimal = now.getHours() + (now.getMinutes() / 60) + (now.getSeconds() / 3600);
        
        // Hitung waktu Maghrib hari ini
        const maghrib = hitungMaghrib(currentLat, currentLon);
        const todayId = now.toISOString().split('T')[0];

        // Jalankan jika sudah Maghrib dan belum diproses hari ini
        if (jamSekarangDesimal >= maghrib.decimal && lastTriggeredDate !== todayId) {
            console.log(`%c 🌇 Maghrib Tiba: ${now.toLocaleTimeString()} `, 'background: #d35400; color: white; font-weight: bold;');
            
            lastTriggeredDate = todayId; // Kunci agar tidak berulang
            requestHijriUpdate(); // Panggil fungsi eksekusi
        }
    }, 1000); 
}

// === MINTA UPDATE HIJRI (TANPA DUPLIKASI) ===
function requestHijriUpdate() {
    const now = new Date();
    // Buat kunci unik berdasarkan tanggal
    const dateKey = now.toISOString().split('T')[0]; 
    const lastTriggered = localStorage.getItem("lastHijriNotifDate");

    // 1. CEK: Jika sudah pernah dikirim hari ini, jangan kirim lagi
    if (lastTriggered === dateKey) {
        console.log("✅ Update Hijri sudah dilakukan hari ini.");
        
        // Tetap update tampilan UI agar tanggalnya benar, tapi tanpa notifikasi pop-up
        if (typeof updateHijriDisplay === "function") updateHijriDisplay();
        return; 
    }

    // 2. JALANKAN UPDATE JIKA BELUM PERNAH
    console.log("🔄 Update hari baru terdeteksi. Mengirim notifikasi...");
    
    if (typeof updateHijriDisplay === "function") {
        updateHijriDisplay();
    }

    // 3. TAMPILKAN NOTIF POP-UP
    showNotif("Waktu Maghrib", "Tanggal Hijriah telah berganti ke hari baru.");

    // 4. SIMPAN KE LOCALSTORAGE ===
    localStorage.setItem("lastHijriNotifDate", dateKey);

    // 5. LOG AUDIT
    if (typeof currentLat !== "undefined" && currentLat) {
        const data = getHijriFinal(currentLat, currentLon);
        logHijriAudit(data, modeHijri);
    }
}

// === KALIBRASI HORIZON ===
function calibrateHorizon(){
  altitudeOffset = hilalData.alt + pitch;
  alert("Kalibrasi horizon berhasil");
}

// === AR ===
function updateAR(alpha, beta, gamma){

  const marker  = document.getElementById('marker');
  const wrapper = document.querySelector('.camera-wrapper');
  const horizon = document.getElementById('horizonLine');
  const label   = document.getElementById("horizonLabel");
  const azEl    = document.getElementById('arAzimuth');
  const altEl   = document.getElementById('arAltitude');

  if(!marker || !wrapper) return;

  const width  = wrapper.clientWidth;
  const height = wrapper.clientHeight;

  const FOV = 60;

  if(smoothX === 0 && smoothY === 0){
    smoothX = width/2;
    smoothY = height/2;
  }

  // === HEADING ===
  let rawHeading = window.lastAlpha ?? alpha ?? 0;
  smoothHeading += ((rawHeading - smoothHeading + 540) % 360 - 180) * kalmanFactor;
  let heading = (smoothHeading + headingOffset + declinationGlobal + 360) % 360;

  // === PITCH & ROLL ===
  smoothPitch += ((beta || 0) - smoothPitch) * 0.1;
  smoothRoll  += ((gamma || 0) - smoothRoll) * 0.1;

  const pitch = smoothPitch;
  const roll  = smoothRoll;

  // === HORIZON ===
  if(horizon){

    const isPortrait = window.innerHeight > window.innerWidth;

    let deltaAlt = isPortrait ? -(pitch - 45) : -pitch;

    let y = height/2 - (deltaAlt / FOV) * height;

    if(y < 0) y = 5;
    if(y > height) y = height - 5;

    horizon.style.top = y + "px";

    if(label){
      label.style.top = y + "px";

      if(y <= 5) label.innerText = "⬆ Horizon di atas";
      else if(y >= height - 5) label.innerText = "⬇ Horizon di bawah";
      else label.innerText = "Horizon";
    }

    horizon.style.opacity = (y <= 5 || y >= height - 5) ? 0.5 : 1;

    const sun = hitungMatahari(currentLat, currentLon);
    horizon.style.background = sun.alt > 0 ? "orange" : "lime";
  }

  // === MARKER ===
  let deltaAz = ((hilalData.azi - heading + 540) % 360) - 180;
  let deviceAlt = -pitch; // kunci utama
  let deltaAlt = hilalData.alt - deviceAlt;

  deltaAz  = Math.max(-60, Math.min(60, deltaAz));
  deltaAlt = Math.max(-45, Math.min(45, deltaAlt));

  let targetX = width/2 + (deltaAz / FOV) * width + roll * 0.3;
  let targetY = height/2 - (deltaAlt / FOV) * height - pitch * 0.2;

  targetX = Math.max(30, Math.min(width-30, targetX));
  targetY = Math.max(40, Math.min(height-40, targetY));

  smoothX += (targetX - smoothX) * 0.08;
  smoothY += (targetY - smoothY) * 0.08;

  marker.style.left = smoothX + "px";
  marker.style.top  = smoothY + "px";

  // === GRID ===
  drawSkyGrid(pitch, heading);

  // === FEEDBACK ===
  const error = Math.sqrt(deltaAz*deltaAz + deltaAlt*deltaAlt);

  if(error < 5){
    marker.style.color = "lime";
  } else if(error < 15){
    marker.style.color = "yellow";
  } else {
    marker.style.color = "red";
  }

  if(azEl) azEl.innerText = `Azimuth: ${hilalData.azi.toFixed(2)}°`;
  if(altEl) altEl.innerText = `Tinggi: ${hilalData.alt.toFixed(2)}°`;
  drawMoonRealistic(hilalDataFull.illumination);
}

// === KALIBRASI KOMPAS ===
function calibrateCompass(){
  calibrating = true;
  let samples = [];

  const handler = (e)=>{
    samples.push(e.alpha);

    if(samples.length > 20){
      let avg = samples.reduce((a,b)=>a+b)/samples.length;
      headingOffset = (-avg + 360) % 360;
      calibrating = false;
      window.removeEventListener("deviceorientation", handler);

      alert("Gerakkan perangkat anda dengan membentuk pola angka 8 di udara ✅");
    }
  };

  window.addEventListener("deviceorientation", handler);
}

// === AUDIO ===
function playBeep(freq=800, duration=100){
  if(!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  osc.start();
  osc.stop(audioCtx.currentTime + duration/1000);
}

// === NOTIFIKASI ===
function showNotif(judul, pesan) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        // Gunakan Service Worker agar support Android/PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(judul, {
                    body: pesan,
                    icon: "/assets/icon-192.png", // pastikan path icon benar
                    badge: "/assets/icon-192.png",
                    vibrate: [200, 100, 200]
                });
            }).catch(err => {
                console.error("SW Notification Error:", err);
                new Notification(judul, { body: pesan }); // Fallback Desktop
            });
        } else {
            // Standar Browser Desktop
            new Notification(judul, { body: pesan, icon: "/assets/icon-192.png" });
        }
    } else {
        console.warn("Izin notifikasi belum diberikan.");
    }
}

// === OBSERVASI ===
// ==== YALLOP ====
function hitungVisibilitasYallop(alt, elo){
  const q = alt - (0.1018 * Math.sqrt(elo));

  if(q > 0.216) return "A (Mudah terlihat)";
  if(q > -0.014) return "B (Optik)";
  if(q > -0.16) return "C (Sulit)";
  if(q > -0.232) return "D (Sangat sulit)";
  return "E (Tidak terlihat)";
}

// === ODEH ===
function hitungVisibilitasOdeh(alt, elo){
  const V = alt - (0.1018 * Math.sqrt(elo));

  if(V >= 0.5) return "Sangat mudah";
  if(V >= 0) return "Terlihat";
  if(V >= -0.2) return "Optik";
  if(V >= -0.5) return "Sulit";
  return "Tidak mungkin";
}

// === ATMOSFER ===
function koreksiAtmosfer(alt){
  if(alt <= 0) return 0;
  const airmass = 1 / Math.sin(alt * rad);
  return 0.25 * airmass;
}

// === CUACA ===
async function getWeather(lat, lon){
  try{
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    const data = await res.json();
    return data.current_weather;
  }catch{
    return null;
  }
}

// === VISIBILITY SCORE ===
function hitungVisibilityScore(alt, elo, age){

  const altSafe = Number(alt) || 0;
  const eloSafe = Number(elo) || 0;
  const ageSafe = Number(age) || 0;

  let score = 0;

  score += Math.min(altSafe / 12, 1) * 45;
  score += Math.min(eloSafe / 15, 1) * 35;
  score += Math.min(ageSafe / 24, 1) * 20;

  // kondisi mudah terlihat
  if(altSafe > 10 && eloSafe > 6){
    score += 10;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

// === LOGGING ===
function simpanRukyat(data){
  let logs = JSON.parse(localStorage.getItem("rukyatLogs") || "[]");

  logs.push({
    waktu: new Date().toISOString(),
    lokasi: `${currentLat},${currentLon}`,
    alt: data.alt,
    elo: data.elo,
    hasil: data.alt > 0 ? "Potensi terlihat" : "Tidak"
  });

  localStorage.setItem("rukyatLogs", JSON.stringify(logs));
}

// === UPDATE PREDIKSI ===
function updatePrediksiCard(){

  const now = new Date();

  const ijtimaNow = getLastIjtima();
  const ijtimaNext = getNextIjtima();

  const sudahIjtima = now >= ijtimaNow;

  document.getElementById("statusIjtima").innerText =
    sudahIjtima ? "✅ Sudah Ijtima" : "⏳ Belum Ijtima";

  document.getElementById("ijtimaLast").innerText =
    formatTanggalIndonesia(ijtimaNow);

  document.getElementById("ijtimaNext").innerText =
    formatTanggalIndonesia(ijtimaNext);

  document.getElementById("countdownIjtima").innerText =
    getCountdownIjtima(now, ijtimaNext);
}

// === TOMBOL INSIGHT ====
function toggleInsight(){
  const card = document.getElementById("insightCard");
  const btn = document.getElementById("toggleInsightBtn");

  if(card.classList.contains("insight-hidden")){
    card.classList.remove("insight-hidden");
    card.classList.add("insight-show");
    btn.innerText = "❌ Sembunyikan Penjelasan";
  } else {
    card.classList.remove("insight-show");
    card.classList.add("insight-hidden");
    btn.innerText = "🔽 Tampilkan Penjelasan";
  }
}

// === TOMBOL PENJELASAN ===
function toggleHijriInfo(){
  const card = document.getElementById("hijriInfoCard");
  const btn = document.getElementById("toggleHijriBtn");

  if(card.classList.contains("insight-hidden")){
    // buka
    card.classList.remove("insight-hidden");

    // set tinggi sesuai isi
    card.style.maxHeight = card.scrollHeight + "px";

    btn.innerText = "❌ Tutup Informasi";
  } else {
    // tutup
    card.style.maxHeight = "0px";
    card.classList.add("insight-hidden");

    btn.innerText = "🔽 Tampilkan Informasi";
  }
}

// === AWAL BULAN HIJRI ===
function setAwalBulanHijri(tanggalMasehi, hijriDay, hijriMonth, hijriYear){
  const data = {
    baseDate: tanggalMasehi.toISOString(),
    day: hijriDay,
    month: hijriMonth,
    year: hijriYear
  };

  localStorage.setItem("hijriBase", JSON.stringify(data));
}

// === SELISIH HARI ====
function hitungSelisihHariMaghrib(start, now, lat, lon){

  let count = 0;
  let current = new Date(start);

  while(current < now){

    const maghribData = hitungMaghrib(lat, lon);
    const maghrib = maghribData ? maghribData.decimal : 18;

    const maghribTime = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      Math.floor(maghrib),
      Math.floor((maghrib % 1)*60),
      0, 0
    );

    if(now >= maghribTime){
      count++;
    }

    current.setDate(current.getDate() + 1);
  }
  return count;
}

// === HIJRI EPOCH ===
function getHijriEpoch(){
  const ijtima = getLastIjtima();

  if(!ijtima){
    console.error("Ijtima tidak ditemukan");
    return new Date();
  }

  const epoch = new Date(ijtima);
  epoch.setHours(0,0,0,0);

  return epoch;
}

// === BASELINE BULAN BERIKUTNYA ===
function nextMonth(current){

  let m = current.m + 1;
  let y = current.y;

  if(m > 12){
    m = 1;
    y++;
  }

  return {
    d: 1,
    m,
    y,
    source: "hybrid"
  };
}

// === HIJRI HISAB ===
function getHijriAstronomical(lat, lon, customDate = null) { 
    const now = customDate ? new Date(customDate) : new Date();
    
    // GUNAKAN CACHE
    const ijtima = CACHED_IJTIMA; 

    const tglSekarang = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tglIjtima = new Date(ijtima.getFullYear(), ijtima.getMonth(), ijtima.getDate());

    let diffDays = Math.round((tglSekarang - tglIjtima) / 86400000);
    const maghrib = hitungMaghrib(lat, lon, now)?.decimal ?? 18;
    const jamNow = now.getHours() + now.getMinutes() / 60;
    
    let d = diffDays;
    if (jamNow >= maghrib) d += 1;

    const ageTotal = (now.getTime() - ijtima.getTime()) / 86400000;
    const cycle = Math.floor(ageTotal / 29.530588853);
    let m = ((11 - 1 + cycle) % 12) + 1;
    let y = 1447 + Math.floor((11 - 1 + cycle) / 12);

    return { d: Math.max(1, d), m, y };
}

// === HIJRI HYBRID ===
let statusHilal = "-";
function getHijriHybrid(lat, lon, customDate = null) {
    const now = customDate ? new Date(customDate) : new Date();
    
    // 1. Ambil data hisab (Sekarang sudah ringan)
    const hisab = getHijriAstronomical(lat, lon, now);
    
    // 2. Gunakan Cache Ijtima
    const ijtima = CACHED_IJTIMA;
    const tglPenentuan = new Date(ijtima);
    tglPenentuan.setHours(18, 15, 0, 0);

    // 3. Panggil core (hitung posisi hilal)
    const hilal = hitungHilalCore(lat, lon, tglPenentuan);
    const imkanRukyat = (hilal.alt >= 3 && hilal.elo >= 6.4);

    let d = hisab.d;
    let m = hisab.m;
    let y = hisab.y;

    if (!imkanRukyat) d -= 1;

    if (d < 1) {
        d = 30; m -= 1;
        if (m < 1) { m = 12; y--; }
    }
    return { d, m, y };
}

// === RESET HYBRID ===
function resetHybridDaily(){

  const today = new Date().toDateString();
  const last = localStorage.getItem("hybridLastCheck");

  if(last !== today){
    sudahCekHariIni = false; // 🔥 reset trigger
    localStorage.setItem("hybridLastCheck", today);
  }
}

// === HIJRI DISPLAY ===
function updateHijriDisplay(){
    if(!currentLat || !currentLon) return;

    // Ambil hasil akhir dari seleksi mode
    const data = getHijriFinal(currentLat, currentLon);

    const bulan = [
        "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
        "Jumadil Awal","Jumadil Akhir","Rajab","Syaban",
        "Ramadhan","Syawal","Zulkaidah","Zulhijjah"
    ];
    
    const el = document.getElementById("hijri");
    if(el && data) {
        el.innerText = `${data.d} ${bulan[data.m - 1]} ${data.y} H`;
    }
  
  if (typeof logHijriAudit === "function" && locationInitialized) {
        // Ambil data tanggal yang sedang tampil
        const dataTanggal = { d: hijriState.d, m: hijriState.m, y: hijriState.y }; 
        logHijriAudit(dataTanggal, modeHijri);
    }
}

// === HIJRI MOONT YEAR ===
function getHijriMonthYear(date){

  const jd = date.getTime() / 86400000 + 2440587.5;
  const ISLAMIC_EPOCH = 1948439.5;

  const days = Math.floor(jd - ISLAMIC_EPOCH);

  const year = Math.floor(days / 354.36667);

  return {
    m: ((Math.floor(days / 29.530588853) % 12) + 1),
    y: 1445 + year
  };
}

// === RENDER HIJRI ===
function renderHijriUI(){

  if(!currentLat || !currentLon) return;

  const data = getHijriFinal(currentLat, currentLon);

  const bulan = [
    "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
    "Jumadil Awal","Jumadil Akhir","Rajab","Syaban",
    "Ramadhan","Syawal","Zulkaidah","Zulhijjah"
  ];

  const el = document.getElementById("hijri");

  if(el){
    el.innerText = `${data.d} ${bulan[data.m - 1]} ${data.y} H`;
  }
}

// === HIJRI FINAL ===
function getHijriFinal(lat, lon){
    // modeHijri = true berarti HISAB
    // modeHijri = false berarti HYBRID
    
    if (modeHijri === true) {
        return getHijriAstronomical(lat, lon);
    } else {
        return getHijriHybrid(lat, lon);
    }
}

// === WAKTU MAGHRIB ===
function isMaghribTime(lat, lon){

  const now = new Date();

  const maghribData = hitungMaghrib(lat, lon);
  if(!maghribData) return false;

  const jamNow = now.getHours() + now.getMinutes()/60;

  const tolerance = 0.05; // ~3 menit

  return jamNow >= (maghribData.decimal - tolerance);
}

// === TOGLLE SET ===
function setMode(mode){
  modeHijri = mode;
  localStorage.setItem("modeHijri", JSON.stringify(modeHijri));

  updateHijriDisplay(); // WAJIB
}

// === TOGGLE HIJRI HISAB ===
function toggleHijriMode() {
    const checkbox = document.getElementById("hijriModeToggle");
    modeHijri = checkbox.checked; 
    
    // Gunakan JSON.stringify agar tersimpan sebagai boolean asli (bukan string)
    localStorage.setItem("modeHijri", JSON.stringify(modeHijri));
    
    updateHijriDisplay(); 
}

// === SISTEM AUDIT & DEBUG LOG ===
// 1. FUNGSI AUDIT: Mencatat riwayat perubahan tanggal ke LocalStorage
function logHijriAudit(data, mode) {
    try {
        let logs = JSON.parse(localStorage.getItem("hijriAuditLogs") || "[]");
        const dateString = `${data.d}-${data.m}-${data.y}`;
        
        // Cek apakah entri terakhir berbeda dengan tanggal sekarang
        if (logs.length === 0 || logs[logs.length - 1].hijriDate !== dateString) {
            const newEntry = {
                timestamp: new Date().toLocaleString('id-ID'),
                mode: mode ? "HISAB" : "HYBRID",
                hijriDate: dateString,
                koordinat: `${currentLat.toFixed(4)}, ${currentLon.toFixed(4)}`,
                // Data Hilal saat perubahan terjadi
                h_alt: hilalDataFull.alt.toFixed(2) + "°",
                h_elo: hilalDataFull.elo.toFixed(2) + "°"
            };
            
            logs.push(newEntry);
            if (logs.length > 50) logs.shift(); // Simpan 50 record terakhir
            localStorage.setItem("hijriAuditLogs", JSON.stringify(logs));
            
            console.log("%c 📝 Audit Log Updated! ", "color: #2ecc71; font-weight: bold", newEntry);
        }
    } catch (e) {
        console.error("Gagal menyimpan audit log:", e);
    }
}

// 2. FUNGSI DEBUG: Dashboard Monitoring Lengkap
function debugHilal() {
    // Proteksi: Pastikan koordinat sudah ada
    if (typeof currentLat === "undefined" || currentLat === null) {
        console.warn("⏳ [Debug] Menunggu data lokasi/GPS...");
        return;
    }

    const now = new Date();

    try {
        // 1. Pengambilan data (gunakan fallback agar tidak crash)
        const maghribData = typeof hitungMaghrib === 'function' ? hitungMaghrib(currentLat, currentLon) : { decimal: 18 };
        const sun = typeof hitungMatahari === 'function' ? hitungMatahari(currentLat, currentLon) : { alt: 0, azi: 0 };
        const moon = hilalDataFull; // Mengambil state global
        const hisab = typeof getHijriAstronomical === 'function' ? getHijriAstronomical(currentLat, currentLon) : {d:0,m:1,y:0};
        const hybrid = typeof getHijriHybrid === 'function' ? getHijriHybrid(currentLat, currentLon) : {d:0,m:1,y:0};
        
        const bulanIndo = ["","Muharram","Safar","Rabiul Awal","Rabiul Akhir","Jumadil Awal","Jumadil Akhir","Rajab","Syaban","Ramadhan","Syawal","Zulkaidah","Zulhijjah"];

        console.clear();
        console.log(`%c 🌙 HILAL SYSTEM MONITOR - ${now.toLocaleTimeString('id-ID')} `, 'background: #2c3e50; color: #ecf0f1; font-weight: bold; padding: 5px; border-radius: 3px;');

        // DASHBOARD 1: KESEHATAN SISTEM
        console.group("⚙️ System Health");
        console.table({
            "Ijtima Cache": CACHED_IJTIMA ? "✅ Loaded" : "❌ MISSING",
            "Hilal Data": (moon.alt !== 0) ? "✅ Active" : "⚠️ Still Zero/Loading",
            "GPS Status": locationInitialized ? "✅ Locked" : "⏳ Searching",
            "Memory Logs": JSON.parse(localStorage.getItem("hijriAuditLogs") || "[]").length + " entries"
        });
        console.groupEnd();

        // DASHBOARD 2: ASTRONOMI REAL-TIME
        console.group("🔭 Realtime Astronomy");
        console.table({
            "Matahari": { Alt: sun.alt.toFixed(2) + "°", Azi: sun.azi.toFixed(2) + "°" },
            "Bulan": { Alt: moon.alt.toFixed(2) + "°", Azi: moon.azi.toFixed(2) + "°" },
            "Elongasi": moon.elo.toFixed(2) + "°",
            "Umur Bulan": moon.age.toFixed(1) + " jam",
            "Kriteria MABIMS": (moon.alt >= 3 && moon.elo >= 6.4) ? "✅ LOLOS" : "❌ TIDAK"
        });
        console.groupEnd();

        // DASHBOARD 3: KALENDER & IJTIMA
        console.group("📅 Calendar & Cycle");
        console.table({
            "Mode Aktif": typeof modeHijri !== 'undefined' && modeHijri ? "HISAB (Astronomi)" : "HYBRID (MABIMS)",
            "Output Hisab": `${hisab.d} ${bulanIndo[hisab.m] || ''} ${hisab.y}`,
            "Output Hybrid": `${hybrid.d} ${bulanIndo[hybrid.m] || ''} ${hybrid.y}`,
            "Ijtima Terakhir": CACHED_IJTIMA ? CACHED_IJTIMA.toLocaleString('id-ID') : "N/A",
            "Jarak ke Ijtima": CACHED_IJTIMA ? ((now - CACHED_IJTIMA) / (1000 * 3600 * 24)).toFixed(2) + " hari" : "N/A"
        });
        console.groupEnd();

        // 1. Kesimpulan
        const statusWarna = (moon.alt >= 3 && moon.elo >= 6.4) ? 'color: #2ecc71' : 'color: #e74c3c';
        console.log(`%c KESIMPULAN: ${ (moon.alt >= 3 && moon.elo >= 6.4) ? "SUDAH IMKAN RUKYAT" : "BELUM IMKAN RUKYAT" }`, `font-weight: bold; font-size: 12px; ${statusWarna}`);
        
        // 2. RIWAYAT AUDIT (Otomatis tampil di bawah Dashboard)
        const auditData = JSON.parse(localStorage.getItem("hijriAuditLogs") || "[]");
        if (auditData.length > 0) {
            console.log("%c 📑 RIWAYAT AUDIT TERAKHIR ", "background: #27ae60; color: white; padding: 2px; font-weight: bold;");
            console.table(auditData);
        }

        // 3. Stop Debugging
        console.log("%c Ketik 'stopDebug()' untuk berhenti. ", 'color: #3498db; font-style: italic;');
      
    } catch (err) {
        console.error("❌ Debug Dashboard Crash:", err);
    }
}

// 3. UTILTIES (Pengecekan Riwayat)
window.checkAudit = function() {
    const data = JSON.parse(localStorage.getItem("hijriAuditLogs") || "[]");
    if (data.length === 0) {
        console.log("%c Belum ada riwayat perubahan tanggal ditemukan di LocalStorage. ", "color: #f39c12");
    } else {
        console.log("%c 📑 RIWAYAT PERUBAHAN TANGGAL ", "background: #27ae60; color: white; padding: 3px;");
        console.table(data);
    }
};

window.stopDebug = function() {
    if (typeof debugInterval !== 'undefined') {
        clearInterval(debugInterval);
        console.log("%c Auto-debug dihentikan. ", "color: #e74c3c; font-weight: bold;");
    }
};

// 4. JALANKAN INTERVAL (Setiap 30 detik)
let debugInterval = setInterval(debugHilal, 30000);
