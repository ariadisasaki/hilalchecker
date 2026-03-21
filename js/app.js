console.log("FINAL PERFECT AR + AUDIO - HILAL");

// ================= GLOBAL =================
let hijriMonthIndex = 0;
let notifSudah = false;

// data hilal untuk AR
let hilalData = {
  alt: 0,
  azi: 0
};

// smoothing marker
let smoothX = 0;
let smoothY = 0;

// ================= AUDIO + FEEDBACK =================
let audioCtx = null;
let lastBeepTime = 0;
let locked = false;

// ================= INIT =================
window.onload = () => {
  startClock();
  getLocation();
  initSensor();

  setTimeout(()=>{
    showNotif("Hilal Checker","Aplikasi siap digunakan 🌙");
  },2000);
};

// ================= JAM =================
function startClock(){
  setInterval(()=>{
    let now = new Date();
    let hari = now.toLocaleDateString('id-ID',{weekday:'long'});
    let tanggal = now.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    let jam = now.toLocaleTimeString('id-ID').replace(/\./g,":");
    document.getElementById('waktu').innerText = `${hari}, ${tanggal} - ${jam}`;
  },1000);
}

// ================= HIJRIYAH =================
function getHijri(lat, lon){
  let now = new Date();
  let maghrib = 18 + (lon/180);
  let jam = now.getHours() + now.getMinutes()/60;
  let tambahHari = jam >= maghrib ? 1 : 0;

  let jd = Math.floor((now.getTime()/86400000) + 2440587.5) + tambahHari;

  let l = jd - 1948440 + 10632;
  let n = Math.floor((l-1)/10631);
  l = l - 10631*n + 354;
  let j = (Math.floor((10985-l)/5316))*(Math.floor((50*l)/17719))
        +(Math.floor(l/5670))*(Math.floor((43*l)/15238));
  l = l - (Math.floor((30-j)/15))*(Math.floor((17719*j)/50))
        - (Math.floor(j/16))*(Math.floor((15238*j)/43)) + 29;
  let m = Math.floor((24*l)/709);
  let d = l - Math.floor((709*m)/24);
  let y = 30*n + j - 30;

  const bulan = ["Muharram","Safar","Rabiul Awal","Rabiul Akhir","Jumadil Awal","Jumadil Akhir","Rajab","Syaban","Ramadhan","Syawal","Zulkaidah","Zulhijjah"];
  hijriMonthIndex = m-1;

  document.getElementById('hijri').innerText = `🕌 ${d} ${bulan[hijriMonthIndex]} ${y} H`;
}

// ================= GPS =================
function getLocation(){
  navigator.geolocation.getCurrentPosition(async p=>{
    let lat = p.coords.latitude;
    let lon = p.coords.longitude;

    document.getElementById('loc').innerText = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

    try{
      let r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      let d = await r.json();
      let a = d.address||{};
      let lokasi = [
        a.village||a.town||a.city||"",
        a.county||"",
        a.state||"",
        a.country||""
      ].filter(v=>v).join(", ");
      document.getElementById('lokasi').innerText = lokasi;
    }catch{
      document.getElementById('lokasi').innerText="Lokasi tidak tersedia";
    }

    getHijri(lat, lon);
    hitungHilal(lat, lon);
    startCam();

  }, ()=>{
    let lat=-8.5833, lon=116.1167;
    document.getElementById('loc').innerText=`${lat}, ${lon}`;
    document.getElementById('lokasi').innerText="Gunakan lokasi default";
    getHijri(lat, lon);
    hitungHilal(lat, lon);
    startCam();
  },{enableHighAccuracy:true});
}

// ================= HILAL =================
function hitungHilal(lat, lon){
  let now = new Date();

  let alt = 5 + Math.sin(now.getHours()/24*Math.PI)*2;
  let azi = (now.getHours()*15)%360;
  let elo = 7 + Math.abs(Math.sin(now.getHours()/24*Math.PI))*1.5;
  let age = (now.getHours() % 24) + now.getMinutes()/60;

  hilalData.alt = alt;
  hilalData.azi = azi;

  document.getElementById('alt').innerText = alt.toFixed(2);
  document.getElementById('azi').innerText = azi.toFixed(2);
  document.getElementById('elo').innerText = elo.toFixed(2);
  document.getElementById('age').innerText = age.toFixed(1);

  let statusEl = document.getElementById('status');
  let prediksiEl = document.getElementById('prediksi');

  const bulan = ["Muharram","Safar","Rabiul Awal","Rabiul Akhir","Jumadil Awal","Jumadil Akhir","Rajab","Syaban","Ramadhan","Syawal","Zulkaidah","Zulhijjah"];
  let nextMonth = bulan[(hijriMonthIndex+1)%12];

  let teks = document.getElementById('hijri').innerText;
  let tanggalHijri = parseInt(teks.split(" ")[1]);

  if(!tanggalHijri){
    statusEl.innerText = "⏳ Menunggu data Hijriyah...";
    prediksiEl.innerText = "⏳ Memuat...";
    return;
  }

  if(tanggalHijri >= 29){
    if(alt >= 3 && elo >= 6.4){
      statusEl.innerText = '✅ Imkan Rukyat';
      statusEl.className = 'status ok';
      prediksiEl.innerText = `🌙 Besok kemungkinan awal bulan ${nextMonth}`;

      if(!notifSudah){
        showNotif("Hilal Terpenuhi", `🌙 Besok kemungkinan awal bulan ${nextMonth}`);
        notifSudah = true;
      }

    } else {
      statusEl.innerText = '❌ Belum Memenuhi';
      statusEl.className = 'status no';
      prediksiEl.innerText = "⏳ Hilal belum terlihat (istikmal ke-30)";
    }

  } else {
    statusEl.innerText = 'ℹ️ Belum Akhir Bulan';
    statusEl.className = 'status';
    prediksiEl.innerText = "📅 Masih pertengahan bulan Hijriyah";
  }
}

// ================= SENSOR =================
function initSensor(){
  let lastAlpha = 0;
  let lastGamma = 0;

  window.addEventListener("deviceorientation", e => {

    let alpha = e.alpha || 0;
    let gamma = e.gamma || 0;

    alpha = lastAlpha + (alpha - lastAlpha) * 0.15;
    gamma = lastGamma + (gamma - lastGamma) * 0.15;

    lastAlpha = alpha;
    lastGamma = gamma;

    updateAR(alpha, 0, gamma);
  });
}

// ================= AR + AUDIO =================
function updateAR(alpha, beta, gamma){
  const marker = document.getElementById('marker');
  const wrapper = document.querySelector('.camera-wrapper');
  const statusText = document.getElementById('arStatus');

  if(!marker || !wrapper) return;

  const width = wrapper.clientWidth;
  const height = wrapper.clientHeight;

  let deltaAz = hilalData.azi - alpha;
  if(deltaAz > 180) deltaAz -= 360;
  if(deltaAz < -180) deltaAz += 360;

  let deltaAlt = hilalData.alt - gamma;

  let error = Math.sqrt(deltaAz*deltaAz + deltaAlt*deltaAlt);

  let x = width/2 + deltaAz * 2;
  let y = height/2 - deltaAlt * 3;

  x = Math.max(20, Math.min(width - 20, x));
  y = Math.max(20, Math.min(height - 20, y));

  smoothX += (x - smoothX) * 0.1;
  smoothY += (y - smoothY) * 0.1;

  // ================= FEEDBACK =================
  let now = Date.now();

  if(error < 4){
    marker.style.color = "lime";

    if(!locked){
      playBeep(1200, 200);
      navigator.vibrate && navigator.vibrate(200);
      locked = true;
    }

    statusText.innerText = "🎯 Tepat (Hilal ditemukan)";
    statusText.style.background = "#1f8f4e";

  } else {
    marker.style.color = "white";
    locked = false;

    if(now - lastBeepTime > 600 - Math.min(error*40, 500)){
      playBeep(500, 80);
      lastBeepTime = now;
    }

    if(error < 12){
      statusText.innerText = "⚠️ Hampir tepat";
      statusText.style.background = "#b58b00";
    } else {
      statusText.innerText = "🔍 Arahkan ke hilal";
      statusText.style.background = "rgba(0,0,0,0.6)";
    }
  }

  marker.style.left = smoothX + "px";
  marker.style.top = smoothY + "px";
}

// ================= AUDIO =================
function playBeep(freq = 800, duration = 100){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.frequency.value = freq;
  osc.type = "sine";

  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);

  osc.start();
  osc.stop(audioCtx.currentTime + duration/1000);
}

// ================= CAMERA =================
function startCam(){
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
  .then(s=>{
    document.getElementById('cam').srcObject=s;
  });
}

// ================= NOTIFIKASI =================
function requestNotif(){
  Notification.requestPermission().then(p=>{
    if(p==="granted"){
      showNotif("Notifikasi Aktif","🔔 Notifikasi berhasil diaktifkan");
    }
  });
}

function showNotif(judul,pesan){
  if(Notification.permission==="granted"){
    new Notification(judul,{body:pesan,icon:"assets/icon-512.png"});
  }
}
