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
  let maghribData = hitungMaghrib(lat, lon);
  let maghrib = 18; // fallback
  if(maghribData){
    maghrib = maghribData.jam + maghribData.menit/60;
  }
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
  const now = new Date();

  // ================= TIME =================
  const rad = Math.PI/180;
  const deg = 180/Math.PI;

  const JD = (now / 86400000) + 2440587.5;
  const T = (JD - 2451545.0) / 36525;

  // ================= SUN =================
  let L0 = (280.46646 + 36000.76983*T) % 360;
  let M = 357.52911 + 35999.05029*T;
  let e = 0.016708634;

  let C = (1.914602 - 0.004817*T) * Math.sin(M*rad)
        + (0.019993 - 0.000101*T) * Math.sin(2*M*rad)
        + 0.000289 * Math.sin(3*M*rad);

  let sunLong = L0 + C;
  let sunRA = Math.atan2(Math.cos(23.44*rad)*Math.sin(sunLong*rad), Math.cos(sunLong*rad))*deg;
  let sunDec = Math.asin(Math.sin(23.44*rad)*Math.sin(sunLong*rad))*deg;

  // ================= MOON =================
  let Lm = (218.316 + 13.176396*(JD - 2451545)) % 360;
  let Mm = (134.963 + 13.064993*(JD - 2451545)) % 360;
  let F  = (93.272 + 13.229350*(JD - 2451545)) % 360;

  let moonLong = Lm + 6.289 * Math.sin(Mm*rad);
  let moonLat  = 5.128 * Math.sin(F*rad);

  let moonRA = Math.atan2(
    Math.sin(moonLong*rad)*Math.cos(23.44*rad) - Math.tan(moonLat*rad)*Math.sin(23.44*rad),
    Math.cos(moonLong*rad)
  ) * deg;

  let moonDec = Math.asin(
    Math.sin(moonLat*rad)*Math.cos(23.44*rad) +
    Math.cos(moonLat*rad)*Math.sin(23.44*rad)*Math.sin(moonLong*rad)
  ) * deg;

  // ================= SIDEREAL TIME =================
  let GMST = (280.46061837 + 360.98564736629*(JD - 2451545)) % 360;
  let LST = GMST + lon;

  // ================= HOUR ANGLE =================
  let HA = (LST - moonRA);

  // ================= ALTITUDE =================
  let alt = Math.asin(
    Math.sin(lat*rad)*Math.sin(moonDec*rad) +
    Math.cos(lat*rad)*Math.cos(moonDec*rad)*Math.cos(HA*rad)
  ) * deg;

  // ================= AZIMUTH =================
  let azi = Math.atan2(
    -Math.sin(HA*rad),
    Math.tan(moonDec*rad)*Math.cos(lat*rad) - Math.sin(lat*rad)*Math.cos(HA*rad)
  ) * deg;

  if(azi < 0) azi += 360;

  // ================= ELONGATION =================
  let elo = Math.acos(
    Math.sin(sunDec*rad)*Math.sin(moonDec*rad) +
    Math.cos(sunDec*rad)*Math.cos(moonDec*rad)*Math.cos((sunRA-moonRA)*rad)
  ) * deg;

  // ================= MOON AGE =================
  let age = elo / 12.19 * 24;

  // ================= SIMPAN =================
  hilalData.alt = alt;
  hilalData.azi = azi;

  // ================= UPDATE UI =================
  document.getElementById('alt').innerText = alt.toFixed(2);
  document.getElementById('azi').innerText = azi.toFixed(2);
  document.getElementById('elo').innerText = elo.toFixed(2);
  document.getElementById('age').innerText = age.toFixed(1);

  // ================= STATUS =================
  let statusEl = document.getElementById('status');
  let prediksiEl = document.getElementById('prediksi');

  // ================= TAMBAHAN BARU (PENTING) =================
  if(alt < 0){
    statusEl.innerText = `🌑 Bulan di bawah horizon (${alt.toFixed(1)}°)`;
    statusEl.className = "status no";
    prediksiEl.innerText = "⛔ Tidak bisa rukyat saat ini";
    return; // 🔥 hentikan di sini
  }

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
    } else {
      statusEl.innerText = '❌ Belum Memenuhi';
      statusEl.className = 'status no';
      prediksiEl.innerText = "⏳ Hilal belum terlihat (istikmal)";
    }
  } else {
    statusEl.innerText = 'ℹ️ Belum Akhir Bulan';
    statusEl.className = 'status';
    prediksiEl.innerText = "📅 Masih pertengahan bulan";
  }
}

// ================ HITUNG MAGHRIB ================
function hitungMaghrib(lat, lon){

  const rad = Math.PI/180;
  const deg = 180/Math.PI;

  const now = new Date();

  // ================= JULIAN DAY =================
  const JD = (now / 86400000) + 2440587.5;
  const T = (JD - 2451545.0) / 36525;

  // ================= POSISI MATAHARI =================
  let L0 = (280.46646 + 36000.76983*T) % 360;
  let M  = 357.52911 + 35999.05029*T;

  let C = (1.914602 - 0.004817*T) * Math.sin(M*rad)
        + (0.019993 - 0.000101*T) * Math.sin(2*M*rad)
        + 0.000289 * Math.sin(3*M*rad);

  let lambda = L0 + C;

  let epsilon = 23.44;

  let delta = Math.asin(Math.sin(epsilon*rad) * Math.sin(lambda*rad));

  // ================= SUDUT TERBENAM =================
  let h0 = -0.833 * rad;

  let cosH = (Math.sin(h0) - Math.sin(lat*rad)*Math.sin(delta)) /
             (Math.cos(lat*rad)*Math.cos(delta));

  if(cosH < -1 || cosH > 1){
    return null;
  }

  let H = Math.acos(cosH); // radian

  let Hdeg = H * deg;

  // ================= WAKTU =================
  let waktu = 12 + (Hdeg / 15);

  // ================= ZONA WAKTU =================
  let timezone = Math.round(lon / 15);

  let maghrib = waktu + timezone - (lon / 15);

  // ================= FORMAT =================
  let jam = Math.floor(maghrib);
  let menit = Math.floor((maghrib - jam) * 60);

  return {
    jam,
    menit,
    decimal: maghrib
  };
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
    playBeep(1200, 200); // 🔊 bunyi SEKALI
    navigator.vibrate && navigator.vibrate(200);
    locked = true;
  }

  statusText.innerText = "🎯 Tepat (Hilal ditemukan)";
  statusText.style.background = "#1f8f4e";

} else {
  marker.style.color = "white";
  locked = false;
  if(error < 12){
    statusText.innerText = "⚠️ Hampir tepat";
    statusText.style.background = "#b58b00";
  } else {
    statusText.innerText = "🔍 Mengacu ke Data Hilal";
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
