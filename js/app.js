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
let currentLat = 0;
let currentLon = 0;
let lastPathUpdate = 0;
let declinationGlobal = 0;
let hilalDataFull = {
  alt: 0,
  azi: 0,
  elo: 0,
  age: 0,
  illumination: 0
};
// === GLOBAL ===
let modeHijri = true; // default: Hisab

// Ambil mode dari localStorage jika ada
const savedMode = localStorage.getItem("modeHijri");
if (savedMode !== null) {
  modeHijri = savedMode === "true";
}

// === INISIALISASI TOGGLE HIJRI ===
function initHijriToggle() {
  const checkbox = document.getElementById("hijriModeToggle");
  const label = document.getElementById("hijriModeLabel");
  const hijriEl = document.getElementById("hijri");
  if (!checkbox || !label || !hijriEl) return;

  // set status awal
  checkbox.checked = modeHijri;
  label.innerText = modeHijri ? "Mode Hisab" : "Mode Rukyat";

  // event listener toggle
  checkbox.addEventListener("change", async () => {
    modeHijri = checkbox.checked;
    label.innerText = modeHijri ? "Mode Hisab" : "Mode Rukyat";
    localStorage.setItem("modeHijri", modeHijri);

    if (!modeHijri) { // Rukyat
      hijriEl.innerText = "Menunggu rukyat..";

      // tunggu sebentar supaya repaint UI terlihat
      await new Promise(r => setTimeout(r, 100));

      // ambil data rukyat (async)
      const result = await getHijriRukyat(currentLat, currentLon);

      tanggalHijriGlobal = result.d;
      hijriMonthIndex = result.m - 1;

      const bulan = [
        "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
        "Jumadil Awal","Jumadil Akhir","Rajab","Syaban",
        "Ramadhan","Syawal","Zulkaidah","Zulhijjah"
      ];

      hijriEl.innerText = `${result.d} ${bulan[hijriMonthIndex]} ${result.y} H`;
    } else {
      // Hisab: langsung refresh
      updateHijriRealTime(currentLat, currentLon);
    }
  });
}

// === INISIALISASI SETELAH DOM READY ===
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHijriToggle);
} else {
  initHijriToggle();
}

// === UPDATE HIJRI REALTIME ===
async function updateHijriRealTime(lat, lon) {
  if(!tanggalHijriGlobal){
    console.warn("Hijri belum siap, skip update...");
    return;
  }
  
  if (!lat || !lon) return;

  let result;

  if (modeHijri) {
    result = getHijriAuto(lat, lon); // Hisab
  } else {
    const hijriEl = document.getElementById("hijri");
    if (hijriEl) hijriEl.innerText = "Menunggu rukyat... 🌙";

    result = getHijriRukyat(lat, lon); // tetap sync
  }

  const { d, m, y } = result;

  const bulan = [
    "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
    "Jumadil Awal","Jumadil Akhir","Rajab","Syaban",
    "Ramadhan","Syawal","Zulkaidah","Zulhijjah"
  ];

  tanggalHijriGlobal = d;
  hijriMonthIndex = m - 1;

  document.getElementById('hijri').innerText =
    `${d} ${bulan[hijriMonthIndex]} ${y} H`;
}
  
// === INIT ===
window.onload = () => {
  startClock();
  getLocation();
  initSensor();

  // Tombol Kalibrasi Kompas
  const calibBtn = document.getElementById("calibrateBtn");
  if(calibBtn){
    calibBtn.addEventListener("click", ()=>{
      calibrateCompass();
    });
  }

  // Notifikasi & audio aktif otomatis saat klik pertama
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

// === GPS ===
function getLocation(){
    navigator.geolocation.getCurrentPosition(async p=>{
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;

        // ✅ Simpan ke global
        currentLat = lat;
        currentLon = lon;

        const locEl = document.getElementById('loc');
        const lokasiEl = document.getElementById('lokasi');

        locEl.innerText = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

        try{
            const r = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
            );
            const d = await r.json();
            const a = d.address || {};
            const lokasi = [
                a.village || a.town || a.city || "",
                a.county || "",
                a.state || "",
                a.country || ""
            ].filter(v=>v).join(", ");

            lokasiEl.innerText = lokasi;

        }catch{
            lokasiEl.innerText = "Lokasi tidak tersedia";
        }

        // 🔹 Declination
        await getMagneticDeclination(lat, lon);

        // 🔹 Init utama
        hitungHilal(lat, lon); // hitung dulu
        setTimeout(()=>{
          updateHijriRealTime(lat, lon); // baru hijri
        }, 500);
        startCam();
        autoReloadAtMaghrib(lat, lon);
        
        // === INTERVAL FINAL ===
        // 🔁 Hitung hilal (berat → tiap 10 detik)
        setInterval(()=>{
          hitungHilal(currentLat, currentLon);
        }, 10000);
        
        // 🔁 Update Hijriah (tiap 1 menit)
        setInterval(()=>{
          updateHijriRealTime(currentLat, currentLon);
        }, 60000);
      
        // 🔁 UI Realtime
        setInterval(()=>{
          renderUI();
          updatePrediksiCard();
        }, 1000);
      
        // 🔥 Insight + countdown (opsional kalau mau pisah)
        setInterval(()=>{
          const now = new Date();
          
          const maghribData = hitungMaghrib(currentLat, currentLon);
          const maghrib = maghribData ? maghribData.decimal : 18;
          
          const insight = getHijriInsight(hilalDataFull, maghrib, now);
          document.getElementById('insight').innerHTML = insight;
          
          const countdown = getCountdownMaghrib(now, maghrib);
          document.getElementById('countdownMaghrib').innerText = countdown;
        
        }, 1000);

    }, ()=>{
        // ==== FALLBACK ===
        const lat = -8.5833;
        const lon = 116.1167;

        currentLat = lat;
        currentLon = lon;

        document.getElementById('loc').innerText = `${lat}, ${lon}`;
        document.getElementById('lokasi').innerText = "Lokasi default";

        declinationGlobal = 0;

        updateHijriRealTime(lat, lon);
        hitungHilal(lat, lon);
        startCam();
        autoReloadAtMaghrib(lat, lon);

        // 🔁 Update hilal tiap 10 detik
        setInterval(()=>{
            hitungHilal(currentLat, currentLon);
        }, 10 * 1000);

        // 🔁 Update hijri tiap 1 menit
        setInterval(()=>{
            updateHijriRealTime(currentLat, currentLon);
        }, 60 * 1000);

        // 🔥 REALTIME UI (WAJIB FALLBACK)
        setInterval(()=>{
            const now = new Date();

            const maghribData = hitungMaghrib(currentLat, currentLon);
            const maghrib = maghribData ? maghribData.decimal : 18;

            const age = parseFloat(document.getElementById('age').innerText) || 0;

            const insight = getHijriInsight(hilalDataFull, maghrib, now);;
            document.getElementById('insight').innerHTML = insight;

            const countdown = getCountdownMaghrib(now, maghrib);
            document.getElementById('countdownMaghrib').innerText = countdown;
          
            updatePrediksiCard();

        }, 1000);

    }, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    });
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
    updateAR(lastAlpha, lastBeta, lastGamma);
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
        const now = new Date();
        const response = await fetch(
            `https://www.ngdc.noaa.gov/geomag-web/calculators/calcDeclination?lat1=${lat}&lon1=${lon}&resultFormat=json&model=WMM`
        );
        const data = await response.json();
        declinationGlobal = data.result[0].declination;
        console.log("Declination global:", declinationGlobal.toFixed(2), "°");
        return declinationGlobal;
    } catch(e){
        declinationGlobal = 0;
        console.warn("Declination API gagal, pakai 0°");
        return 0;
    }
}

// === KONSTANTA ===
const rad = Math.PI/180;
const deg = 180/Math.PI;

// ===== HIJRI INSIGHT =====
function getHijriInsight(data, maghrib, now){
  const { alt, azi, elo, age, illumination } = data;

  const jam = now.getHours() + now.getMinutes()/60 + now.getSeconds()/3600;

  const statusWaktu = jam < maghrib ? "Sebelum Maghrib" : "Setelah Maghrib";
  
  const ijtimaNow = getIjtimaGlobal();
  const ijtimaNext = getNextIjtima();
  
  const sudahIjtima = now >= ijtimaNow;
  const statusIjtima = sudahIjtima ? "✅ Sudah Ijtima" : "⏳ Belum Ijtima";
  const countdownIjtima = getCountdownIjtima(now, ijtimaNext);
  
  const ijtimaStr = formatTanggalIndonesia(ijtimaNow);
  const ijtimaNextStr = formatTanggalIndonesia(ijtimaNext);
  
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

<b>Penjelasan:</b><br>
Walaupun umur bulan mendekati ${(age/24).toFixed(0)} hari,
tanggal Hijriah tetap ${tanggalHijriGlobal} karena:<br>
- Awal bulan ditentukan oleh rukyat/hisab<br>
- Pergantian hari terjadi saat Maghrib<br>
- Tidak selalu sinkron dengan umur bulan astronomi<br><br>

<b>Perkiraan:</b><br>
Sekitar ${(24 - (age % 24)).toFixed(1)} jam lagi menuju fase hari berikutnya. Perkiraan berdasarkan fase bulan, dapat berbeda dari waktu Maghrib lokal.
<br><br>

<b>📘 Penjelasan Prediksi Hilal:</b><br><br>

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

// === IJTIMA GLOBAL ===
function getIjtimaGlobal(){

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

  if(JDE > JD){
    k--;
    JDE = hitungIjtima(k);
  }

  const millis = (JDE - 2440587.5) * 86400000;
  return new Date(millis); // ✅ UTC global moment
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

  // 🔥 ambil yang berikutnya
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

// === HITUNG MUNDUR NAGHRIB ===
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
function renderUI(){
  if(!currentLat || !currentLon) return;

  // 🔥 CEK DATA SUDAH ADA BELUM
  if(!hilalDataFull || hilalDataFull.age === 0){
    document.getElementById('insight').innerHTML = "⏳ Mengambil data hilal...";
    return;
  }

  const now = new Date();
  const maghribData = hitungMaghrib(currentLat, currentLon);
  const maghrib = maghribData ? maghribData.decimal : 18;

  const insight = getHijriInsight(hilalDataFull, maghrib, now);
  document.getElementById('insight').innerHTML = insight;

  const countdown = getCountdownMaghrib(now, maghrib);
  document.getElementById('countdownMaghrib').innerText = countdown;

  const progress = getProgressToMaghrib(now, currentLat, currentLon);
  document.getElementById('progressBar').style.width = progress + "%";
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

// ==== HITUNG HILAL ===
function hitungHilal(lat, lon, customTime=null){
  const statusEl = document.getElementById('status');
  const prediksiEl = document.getElementById('prediksi');

  statusEl.innerText = "⏳ Menghitung hilal...";
  prediksiEl.innerText = "";

  const data = hitungHilalCore(lat, lon, customTime);
  const { alt, azi, elo, age, illumination } = data;

  // 🔥 SIMPAN GLOBAL
  hilalDataFull = { alt, azi, elo, age, illumination };
  window.hilalDataFull = hilalDataFull;
  hilalData.alt = alt;
  hilalData.azi = azi;

  // === UPDATE ANGKA ===
  document.getElementById('alt').innerText = alt.toFixed(2);
  document.getElementById('azi').innerText = azi.toFixed(2);
  document.getElementById('elo').innerText = elo.toFixed(2);
  document.getElementById('age').innerText = age.toFixed(1);
  document.getElementById('illum').innerText = illumination.toFixed(2) + " %";

  // === HITUNG PREDIKSI ===
  const yallop = hitungVisibilitasYallop(alt, elo);
  const odeh   = hitungVisibilitasOdeh(alt, elo);
  const score  = hitungVisibilityScore(alt, elo, age);

  document.getElementById("yallop").innerText = yallop;
  document.getElementById("odeh").innerText = odeh;
  document.getElementById("visibility").innerText = score + "%";

  // === STATUS IJTIMA ===
  const now = new Date();
  const ijtima = getIjtimaGlobal();
  document.getElementById("statusIjtima").innerText =
    now >= ijtima ? "✅ Sudah Ijtima" : "⏳ Belum Ijtima";

  // === WARNA SCORE ===
  const visEl = document.getElementById("visibility");
  visEl.classList.remove("ok","warn","bad");

  if(score > 70){
    visEl.classList.add("ok");
  }else if(score > 40){
    visEl.classList.add("warn");
  }else{
    visEl.classList.add("bad");
  }

  // === LOGIKA STATUS (MABIMS UPGRADE) ===
  // 🔹 Kriteria MABIMS
  const imkanMABIMS = (alt >= 3 && elo >= 6.4);
  
  // 🔹 Info tambahan (opsional)
  const umurCukup = age >= 8;
  
  // 🔹 Waktu sekarang
  const nowTime = new Date();
  const jamNow = nowTime.getHours() + nowTime.getMinutes()/60;
  
  // 🔹 Maghrib
  const maghribData = hitungMaghrib(lat, lon);
  const maghrib = maghribData ? maghribData.decimal : 18;
  
  // === 1. BULAN DI BAWAH UFUK ===
  if(alt < 0){
    statusEl.innerText = "🌑 Bulan di bawah horizon";
    prediksiEl.innerText = "Tidak mungkin rukyat karena bulan sudah di bawah ufuk";
  }
    
  // === 2. SEBELUM MAGHRIB ===
  else if(jamNow < maghrib){
    statusEl.innerText = "⏳ Menunggu Maghrib";
    prediksiEl.innerText = "Rukyat hanya dilakukan setelah matahari terbenam";
  }
    
  // === 3. SUDAH MAGHRIB ===
  else {
    
  // 🔸 BELUM AKHIR BULAN
  if(tanggalHijriGlobal < 29){
    statusEl.innerText = "ℹ️ Belum akhir bulan";
    prediksiEl.innerText = "Rukyat biasanya dilakukan pada tanggal 29 Hijriah";
  }

  // 🔸 TANGGAL 29 (KRUSIAL)
  else if(tanggalHijriGlobal === 29){

  if(imkanMABIMS){
    statusEl.innerText = "✅ Imkan Rukyat (MABIMS)";
    
    prediksiEl.innerText =
      "Hilal memenuhi kriteria MABIMS → berpotensi terlihat\n" +
      `Alt: ${alt.toFixed(2)}° (≥ 3°)\n` +
      `Elo: ${elo.toFixed(2)}° (≥ 6.4°)\n` +
      `Umur Bulan: ${age.toFixed(1)} jam`;
      
  } else {
    statusEl.innerText = "❌ Istikmal";
    
    prediksiEl.innerText =
      "Hilal belum memenuhi kriteria MABIMS → bulan digenapkan 30 hari\n" +
      `Alt: ${alt.toFixed(2)}°\n` +
      `Elo: ${elo.toFixed(2)}°\n` +
      `Umur Bulan: ${age.toFixed(1)} jam`;
  }

}

  // 🔸 TANGGAL 30
    else {
      statusEl.innerText = "📅 Istikmal (30 hari)";
      prediksiEl.innerText = "Bulan otomatis berakhir (istikmal)";

    }
  }

  // === LOG RUKYAT ===
  const lastLog = localStorage.getItem("lastRukyatLog");
  const nowLog = new Date();
  const jam = nowLog.getHours();

  if(
    jam >= 17 && jam <= 19 &&
    (!lastLog || (Date.now() - lastLog) > 600000)
  ){
    simpanRukyat({ alt, elo });
    localStorage.setItem("lastRukyatLog", Date.now());
  }

  return data;
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
  const U = T/100;
  let epsilon0 = 23 + 26/60 + 21.448/3600
    - (46.8150*T + 0.00059*T*T - 0.001813*T*T*T)/3600;

  const L = (280.4665 + 36000.7698*T) % 360;
  const Lm = (218.3165 + 481267.8813*T) % 360;
  const omega = (125.04452 - 1934.136261*T) % 360;

  const deltaPsi = (-17.20*Math.sin(omega*rad) - 1.32*Math.sin(2*L*rad)
                   -0.23*Math.sin(2*Lm*rad) + 0.21*Math.sin(2*omega*rad))/3600;

  const deltaEps = (9.20*Math.cos(omega*rad) + 0.57*Math.cos(2*L*rad)
                   +0.10*Math.cos(2*Lm*rad) -0.09*Math.cos(2*omega*rad))/3600;

  const epsilon = epsilon0 + deltaEps;

  // === MATAHARI ===
  const M = (357.52911 + 35999.05029*T) % 360;
  const C = (1.914602 - 0.004817*T - 0.000014*T*T)*Math.sin(M*rad)
          + (0.019993 - 0.000101*T)*Math.sin(2*M*rad)
          + 0.000289*Math.sin(3*M*rad);

  const sunLong = L + C + deltaPsi;
  const sunRA = Math.atan2(Math.cos(epsilon*rad)*Math.sin(sunLong*rad), Math.cos(sunLong*rad))*deg;
  const sunDec = Math.asin(Math.sin(epsilon*rad)*Math.sin(sunLong*rad))*deg;

  // === BULAN ===
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

  // === RA DEC BULAN ===
  const moonRA = Math.atan2(
    Math.sin(lonMoon*rad)*Math.cos(epsilon*rad) - Math.tan(latMoon*rad)*Math.sin(epsilon*rad),
    Math.cos(lonMoon*rad)
  )*deg;

  const moonDec = Math.asin(
    Math.sin(latMoon*rad)*Math.cos(epsilon*rad)
    + Math.cos(latMoon*rad)*Math.sin(epsilon*rad)*Math.sin(lonMoon*rad)
  )*deg;

  // === SIDEREAL ===
  const GMST = (280.46061837 + 360.98564736629*(JD-2451545)) % 360;
  const LST = GMST + lon;
  const HA = (LST - moonRA);

  // === TOPOCENTRIC ALT AZ ===
  let alt = Math.asin(
    Math.sin(lat*rad)*Math.sin(moonDec*rad)
    + Math.cos(lat*rad)*Math.cos(moonDec*rad)*Math.cos(HA*rad)
  )*deg;

  let azi = Math.atan2(
    -Math.sin(HA*rad),
    Math.tan(moonDec*rad)*Math.cos(lat*rad) - Math.sin(lat*rad)*Math.cos(HA*rad)
  )*deg;

  if(azi < 0) azi += 360;

  // === KOREKSI ===
  alt = koreksiParallax(alt);
  alt = koreksiRefraction(alt);

  // === ELO & AGE ===
  const elo = Math.acos(
    Math.sin(sunDec*rad)*Math.sin(moonDec*rad)
    + Math.cos(sunDec*rad)*Math.cos(moonDec*rad)*Math.cos((sunRA - moonRA)*rad)
  )*deg;

  // === AGE BERBASIS IJTIMA GLOBAL ===
  const ijtima = getIjtimaGlobal();
  const age = (now - ijtima) / 3600000; // jam

  // === ILUMINASI ====
  const illumination = (1 - Math.cos(elo * rad)) / 2 * 100;

  // === OUTPUT ===
  return { alt, azi, elo, age, illumination };
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

  alert("Arahkan kamera tepat ke Matahari ☀️ lalu tekan OK");

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

// === MAGHRIB ===
function hitungMaghrib(lat, lon){
  const now = new Date();
  const JD = (now/86400000)+2440587.5;
  const T = (JD-2451545)/36525;
  const epsilon = 23.439291 - 0.0130042*T - 1.64e-7*T*T + 5.04e-7*T*T*T;
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
  const cosH = (Math.sin(h0) - Math.sin(lat*rad)*Math.sin(delta)) / (Math.cos(lat*rad)*Math.cos(delta));
  if(cosH < -1 || cosH > 1) return null;
  const H = Math.acos(cosH)*deg;
  const timezone = -now.getTimezoneOffset()/60;
  const solarNoon = 12 + timezone - (lon/15) - (EoT/60);
  const maghrib = solarNoon + (H/15);
  return { decimal: maghrib };
}

// === AUTO RELOAD MAGHRIB ===
function autoReloadAtMaghrib(lat, lon){
  const now = new Date();
  const todayKey = 'hilalReloadDate';
  const lastReload = localStorage.getItem(todayKey);
  if(lastReload === now.toDateString()) return;

  const maghribData = hitungMaghrib(lat, lon);
  if(!maghribData) return;

  const maghribDecimal = maghribData.decimal;
  const maghribHour = Math.floor(maghribDecimal);
  const maghribMinute = Math.floor((maghribDecimal - maghribHour)*60);

  const maghribTime = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    maghribHour, maghribMinute, 0, 0
  );

  let diff = maghribTime - now;
  if(diff < 0) diff = 0;

  setTimeout(()=>{
  localStorage.setItem(todayKey, now.toDateString());

  console.log("🌙 Maghrib tercapai, update Hijri");

  // 🔥 PANGGIL 2x (fix delay hilal & async)
  updateHijriRealTime(lat, lon);

  setTimeout(()=>{
    updateHijriRealTime(lat, lon);
  }, 2000);

}, diff);
}

// === AR ===
function updateAR(alpha, beta, gamma){
    const marker = document.getElementById('marker');
    const wrapper = document.querySelector('.camera-wrapper');
    const azEl = document.getElementById('arAzimuth');
    const altEl = document.getElementById('arAltitude');
    if(!marker || !wrapper) return;

    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    if(smoothX === 0 && smoothY === 0){
        smoothX = width/2;
        smoothY = height/2;
    }

    // === HEADING SMOOTH ===
    let rawHeading = alpha ?? 0;
    
    // anti loncat 360°
    smoothHeading += ((rawHeading - smoothHeading + 540) % 360 - 180) * kalmanFactor;
  
    let heading = (smoothHeading + headingOffset + declinationGlobal) % 360;
  
    // === PITCH & ROLL SMOOTH ===
    smoothPitch += ((beta || 0) - smoothPitch) * 0.1;
    smoothRoll  += ((gamma || 0) - smoothRoll) * 0.1;
    
    const pitch = smoothPitch;
    const roll  = smoothRoll;

    // === AZIMUTH (FIX BESAR) ===
    let deltaAz = ((hilalData.azi - heading + 540) % 360) - 180;

    // === ALTITUDE (FIX) ===
    let deviceAlt = pitch;
    let deltaAlt = hilalData.alt - deviceAlt;

    // 🔹 koreksi horizon kamera
    deltaAlt -= 1.5;

    // === BATAS ===
    deltaAz  = Math.max(-60, Math.min(60, deltaAz));
    deltaAlt = Math.max(-45, Math.min(45, deltaAlt));

    // === PROYEKSI REALISTIS ===
    const fov = Math.max(45, Math.min(75, width/10));

    let targetX = width/2 + (deltaAz / fov) * width + roll*0.3;
    let targetY = height/2 - (deltaAlt / fov) * height - pitch*0.2;

    targetX = Math.max(30, Math.min(width-30, targetX));
    targetY = Math.max(40, Math.min(height-40, targetY));

    // ==== SMOOTHING (TETAP DIPAKAI) ===
    smoothX += (targetX - smoothX) * 0.12;
    smoothY += (targetY - smoothY) * 0.1;

    marker.style.left = smoothX + "px";
    marker.style.top  = smoothY + "px";

    // === ERROR & FEEDBACK ===
   const error = Math.sqrt(deltaAz*deltaAz + deltaAlt*deltaAlt);

   // === VISIBILITY SCORE ===
   let visibilityScore = 100 - error * 2;
   visibilityScore = Math.max(0, Math.min(100, visibilityScore));

   // efek visual (biar makin realistis)
   marker.style.opacity = 0.5 + (visibilityScore / 200);

   // === WARNA MARKER ===
   if(error < 5){
     marker.style.color = "lime";
     if(!beepCooldown){
         playBeep(1200, 200);
         navigator.vibrate && navigator.vibrate(150);
         beepCooldown = true;
         setTimeout(()=> beepCooldown = false, 1000);
     }
   } else if(error < 15){
     marker.style.color = "yellow";
   } else {
     marker.style.color = "red";
   }
    
   // === INFO UI ===
    if(azEl) azEl.innerText = `Azimuth: ${hilalData.azi.toFixed(2)}°`;
    if(altEl) altEl.innerText = `Tinggi: ${hilalData.alt.toFixed(2)}°`;

    // === PATH HILAL ===
    if(Date.now() - lastPathUpdate > 2000){
        lastPathUpdate = Date.now();
        const path = generateHilalPath(currentLat, currentLon);

        path.forEach(p=>{
            const dot = document.createElement("div");
            dot.className = "hilal-path-dot";

            let dx = ((p.azi - heading + 540) % 360) - 180;
            let dy = p.alt - pitch;

            const fov = 60;

            dot.style.left = (width/2 + (dx/fov)*width) + "px";
            dot.style.top  = (height/2 - (dy/fov)*height) + "px";

            wrapper.appendChild(dot);
            setTimeout(()=>dot.remove(),1500);
        });
    }
}

// === KALIBRASI KOMPAS ===
function calibrateCompass(){
  calibrating = true;
  let samples = [];

  const handler = (e)=>{
    samples.push(e.alpha);

    if(samples.length > 20){
      let avg = samples.reduce((a,b)=>a+b)/samples.length;
      headingOffset = (360 - avg) % 360;
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

// === KAMERA ===
function startCam(){
  const video = document.getElementById('cam');
  const status = document.getElementById('arStatus');

  if(!video) return;

  // tampilkan status loading
  if(status){
    status.innerText = "Mengaktifkan kamera...";
  }

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false
  })
  .then(stream => {
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();

      // 🔥 update status saat kamera siap
      if(status){
        status.innerText = "📷 Kamera aktif";
      }
    };
  })
  .catch(err => {
    console.error(err);

    if(status){
      status.innerText = "❌ Kamera gagal";
    }

    alert("Izin kamera diperlukan");
  });
}

// === NOTIF ===
function showNotif(judul,pesan){
  if(Notification.permission==="granted"){
    new Notification(judul,{body:pesan,icon:"assets/icon-192.png"});
  }
}

// === OBSERVATORY UPGRADE ===
// ==== YALLOP ====
function hitungVisibilitasYallop(alt, elo){
  const q = alt - (0.1018 * Math.sqrt(elo));

  if(q > 0.216) return "A (Mudah terlihat)";
  if(q > -0.014) return "B (Optik)";
  if(q > -0.16) return "C (Sulit)";
  if(q > -0.232) return "D (Sangat sulit)";
  return "E (Tidak terlihat)";
}

// ===== ODEH =====
function hitungVisibilitasOdeh(alt, elo){
  const V = alt - (0.1018 * Math.sqrt(elo));

  if(V >= 0.5) return "Sangat mudah";
  if(V >= 0) return "Terlihat";
  if(V >= -0.2) return "Optik";
  if(V >= -0.5) return "Sulit";
  return "Tidak mungkin";
}

// ==== ATMOSFER ====
function koreksiAtmosfer(alt){
  if(alt <= 0) return 0;
  const airmass = 1 / Math.sin(alt * rad);
  return 0.25 * airmass;
}

// ==== CUACA ====
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

  // ❗ jika sudah jelas mustahil
  if(alt < 0 || elo < 3){
    return 0;
  }

  let score = 0;

  const altSafe = Math.max(0, alt);
  const eloSafe = Math.max(0, elo);
  const ageSafe = Math.max(0, age);

  score += Math.min(altSafe/10,1)*40;
  score += Math.min(eloSafe/15,1)*30;
  score += Math.min(ageSafe/24,1)*30;

  score = Math.max(0, Math.min(100, score));

  return Math.round(score);
}

// ==== LOGGING ====
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

// === UPDATE CARD PREDIKSI ===
function updatePrediksiCard(){

  const now = new Date();

  const ijtimaNow = getIjtimaGlobal();
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

    // 🔥 set tinggi sesuai isi (INI KUNCI)
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

// === DAPATKAN HIJRI ====
function getHijriAuto(lat, lon){

  const now = new Date();

  const maghribData = hitungMaghrib(lat, lon);
  const maghrib = maghribData ? maghribData.decimal : 18;

  const jam = now.getHours() + now.getMinutes()/60;

  let shiftDate = new Date(now);

  if(jam < maghrib){
    shiftDate.setDate(shiftDate.getDate() - 1);
  }

  const formatter = new Intl.DateTimeFormat("id-ID-u-ca-islamic", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  });

  const parts = formatter.formatToParts(shiftDate);

  let d, m, y;

  parts.forEach(p => {
    if(p.type === "day") d = parseInt(p.value);
    if(p.type === "month") m = parseInt(p.value);
    if(p.type === "year") y = parseInt(p.value);
  });

  const offset = parseInt(localStorage.getItem("hijriOffset") || 0);
  d += offset;

  while(d > 30){
    d -= 30;
    m++;
    if(m > 12){ m = 1; y++; }
  }

  while(d < 1){
    d += 30;
    m--;
    if(m < 1){ m = 12; y--; }
  }

  return { d, m, y };
}

// === TOGLLE SET ===
function setMode(mode){
  modeHijri = mode;
  localStorage.setItem("modeHijri", mode);
  location.reload();
}

// === DAPATKAN HIJRI RUKYAT ===
function getHijriRukyat(lat, lon){

  const now = new Date();

  // === AMBIL DATA ===
  let data = JSON.parse(localStorage.getItem("hijriRukyatData"));

  // 🔥 INIT JIKA BELUM ADA
  if(!data){
    const awal = getHijriAuto(lat, lon);
    data = {
      d: awal.d,
      m: awal.m,
      y: awal.y,
      lastUpdate: now.toDateString()
    };
    localStorage.setItem("hijriRukyatData", JSON.stringify(data));
    return data;
  }

  // === HITUNG SELISIH HARI ===
  const last = new Date(data.lastUpdate);
  const diffTime = now - last;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // 🔥 LOOP UNTUK MENGECEJAR HARI YANG TERLEWAT
  for(let i = 0; i <= diffDays; i++){

    // tanggal yang sedang diproses
    const currentDate = new Date(last);
    currentDate.setDate(currentDate.getDate() + i);

    // hitung maghrib hari tersebut
    const maghribData = hitungMaghrib(lat, lon, currentDate);
    const maghrib = maghribData ? maghribData.decimal : 18;

    // tentukan jam (hari terakhir pakai jam real)
    const jam = (i === diffDays)
      ? now.getHours() + now.getMinutes()/60
      : 24;

    // hanya proses jika sudah maghrib
    if(jam >= maghrib){

      // === TANGGAL 1–28 ===
      if(data.d >= 1 && data.d <= 28){
        data.d += 1;
      }

      // === TANGGAL 29 (RUKYAT) ===
      else if(data.d === 29){

        const maghribDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          Math.floor(maghrib),
          Math.floor((maghrib % 1)*60),
          0, 0
        );

        const hilal = hitungHilalCore(lat, lon, maghribDate);

        const ijtima = getIjtimaGlobal();
        const sudahIjtima = ijtima <= maghribDate;

        const imkanMABIMS = (
          hilal.alt >= 3 &&
          hilal.elo >= 6.4 &&
          sudahIjtima
        );

        if(imkanMABIMS){
          // 🌙 BULAN BARU
          data.d = 1;
          data.m += 1;

          if(data.m > 12){
            data.m = 1;
            data.y += 1;
          }

        } else {
          // 📅 ISTIKMAL
          data.d = 30;
        }
      }

      // === TANGGAL 30 ===
      else if(data.d === 30){
        data.d = 1;
        data.m += 1;

        if(data.m > 12){
          data.m = 1;
          data.y += 1;
        }
      }

    }
  }

  // === UPDATE TERAKHIR ===
  data.lastUpdate = now.toDateString();
  localStorage.setItem("hijriRukyatData", JSON.stringify(data));

  return data;
}

// === TOGGLE HIJRI HISAB ===
function toggleHijriMode() {
  const checkbox = document.getElementById("hijriModeToggle");
  const label = document.getElementById("hijriModeLabel");

  modeHijri = checkbox.checked; // true = hisab, false = rukyat
  label.innerText = modeHijri ? "Mode Hisab" : "Mode Rukyat";

  console.log("Hijri mode:", modeHijri ? "Hisab" : "Rukyat");

  // Simpan pilihan user ke localStorage
  localStorage.setItem("modeHijri", modeHijri);

  if (!modeHijri) {
    // Jika Rukyat, reset tanggal Hijri agar menunggu input rukyat
    tanggalHijriGlobal = 0;
    document.getElementById("hijri").innerText = "Menunggu rukyat...";
  }
}
