// ================= FINAL ULTRA COMPLETE - HILAL CHECKER =================
console.log("FINAL ULTRA COMPLETE - HILAL CHECKER");

// ================= GLOBAL =================
let hijriMonthIndex = 0;
let tanggalHijriGlobal = 0;
let hilalData = { alt: 0, azi: 0 };
let smoothX = 0;
let smoothY = 0;
let audioCtx = null;
let locked = false;
let lastBeepTime = 0;
let reloadedToday = false;

// ================= KONSTANTA =================
const rad = Math.PI/180;
const deg = 180/Math.PI;

// ================= INIT =================
window.onload = () => {
  startClock();
  getLocation();
  initSensor();

  // Notifikasi & audio aktif otomatis saat klik pertama
  document.body.addEventListener("click", () => {
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      console.log("Audio aktif");
    }

    // Minta izin notifikasi sekali
    if(Notification.permission === "default"){
      Notification.requestPermission().then(p=>{
        if(p==="granted"){
          showNotif("Hilal Checker", "Notifikasi aktif 🌙");
        }
      });
    }
  }, { once:true });
};

// ================= JAM =================
function startClock(){
  setInterval(()=>{
    const now = new Date();
    const hari = now.toLocaleDateString('id-ID',{weekday:'long'});
    const tanggal = now.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    const jam = now.toLocaleTimeString('id-ID').replace(/\./g,":");
    document.getElementById('waktu').innerText = `${hari}, ${tanggal} - ${jam}`;
  },1000);
}

// ================= REFRACTION & PARALLAX =================
function koreksiRefraction(alt){
  if(alt > -1){
    const R = 1.02 / Math.tan((alt + 10.3/(alt+5.11)) * rad);
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

// ================= HIJRI =================
function getHijri(lat, lon){
  const now = new Date();
  const maghribData = hitungMaghrib(lat, lon);
  const maghrib = maghribData ? maghribData.decimal : 18;

  const jam = now.getHours() + now.getMinutes()/60;
  let tambahHari = 0;

  if(jam >= maghrib){
    const hilal = hitungHilal(lat, lon);
    const bisaRukyat = hilal.alt >= 3 && hilal.elo >= 6.4 && hilal.age >= 8;
    if(bisaRukyat) tambahHari = 1;
  }

  let jd = Math.floor((now.getTime()/86400000)+2440587.5) + tambahHari;

  let l = jd - 1948440 + 10632;
  let n = Math.floor((l-1)/10631);
  l = l - 10631*n + 354;
  let j = (Math.floor((10985-l)/5316))*(Math.floor((50*l)/17719))
        +(Math.floor(l/5670))*(Math.floor((43*l)/15238));
  l = l - (Math.floor((30-j)/15))*(Math.floor((17719*j)/50))
        - (Math.floor(j/16))*(Math.floor((15238*j)/43)) + 29;

  const m = Math.floor((24*l)/709);
  const d = l - Math.floor((709*m)/24);
  const y = 30*n + j - 30;

  hijriMonthIndex = m-1;
  tanggalHijriGlobal = d;

  const bulan = ["Muharram","Safar","Rabiul Awal","Rabiul Akhir","Jumadil Awal","Jumadil Akhir","Rajab","Syaban","Ramadhan","Syawal","Zulkaidah","Zulhijjah"];
  document.getElementById('hijri').innerText = `🕌 ${d} ${bulan[hijriMonthIndex]} ${y} H`;
}

// ================= GPS =================
function getLocation(){
  navigator.geolocation.getCurrentPosition(async p=>{
    const lat = p.coords.latitude;
    const lon = p.coords.longitude;

    document.getElementById('loc').innerText = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

    try{
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const d = await r.json();
      const a = d.address||{};
      const lokasi = [a.village||a.town||a.city||"", a.county||"", a.state||"", a.country||""].filter(v=>v).join(", ");
      document.getElementById('lokasi').innerText = lokasi;
    }catch{
      document.getElementById('lokasi').innerText="Lokasi tidak tersedia";
    }

    getHijri(lat, lon);
    hitungHilal(lat, lon);
    autoReloadAtMaghrib(lat, lon);
    startCam();

  }, ()=>{
    const lat=-8.5833, lon=116.1167;
    document.getElementById('loc').innerText=`${lat}, ${lon}`;
    document.getElementById('lokasi').innerText="Lokasi default";

    getHijri(lat, lon);
    hitungHilal(lat, lon);
    autoReloadAtMaghrib(lat, lon);
    startCam();
  },{enableHighAccuracy:true});
}

// ================= HILAL =================
function hitungHilal(lat, lon){
  const now = new Date();
  const JD = (now/86400000)+2440587.5;
  const T = (JD-2451545)/36525;
  const epsilon = 23.439291 - 0.0130042*T;

  // Matahari
  const L0 = (280.46646 + 36000.76983*T)%360;
  const M = 357.52911 + 35999.05029*T;
  const C = (1.914602 - 0.004817*T)*Math.sin(M*rad)
          + (0.019993 - 0.000101*T)*Math.sin(2*M*rad)
          + 0.000289*Math.sin(3*M*rad);
  const sunLong = L0 + C;
  const sunRA = Math.atan2(Math.cos(epsilon*rad)*Math.sin(sunLong*rad), Math.cos(sunLong*rad))*deg;
  const sunDec = Math.asin(Math.sin(epsilon*rad)*Math.sin(sunLong*rad))*deg;

  // Bulan
  const D = (297.8501921 + 445267.1114034*T)%360;
  const Lm = (218.316 + 13.176396*(JD-2451545))%360;
  const Mm = (134.963 + 13.064993*(JD-2451545))%360;
  const F  = (93.272 + 13.229350*(JD-2451545))%360;
  const moonLong = Lm + 6.289*Math.sin(Mm*rad) + 1.274*Math.sin((2*D-Mm)*rad)
                  + 0.658*Math.sin(2*D*rad) + 0.214*Math.sin(2*Mm*rad)
                  - 0.186*Math.sin(M*rad);
  const moonLat = 5.128*Math.sin(F*rad);
  const moonRA = Math.atan2(
    Math.sin(moonLong*rad)*Math.cos(epsilon*rad) - Math.tan(moonLat*rad)*Math.sin(epsilon*rad),
    Math.cos(moonLong*rad)
  )*deg;
  const moonDec = Math.asin(Math.sin(moonLat*rad)*Math.cos(epsilon*rad)
                  + Math.cos(moonLat*rad)*Math.sin(epsilon*rad)*Math.sin(moonLong*rad))*deg;

  const GMST = (280.46061837 + 360.98564736629*(JD-2451545))%360;
  const LST = GMST + lon;
  const HA = (LST - moonRA);

  let alt = Math.asin(Math.sin(lat*rad)*Math.sin(moonDec*rad)
            + Math.cos(lat*rad)*Math.cos(moonDec*rad)*Math.cos(HA*rad))*deg;
  let azi = Math.atan2(-Math.sin(HA*rad), Math.tan(moonDec*rad)*Math.cos(lat*rad) - Math.sin(lat*rad)*Math.cos(HA*rad))*deg;
  if(azi < 0) azi += 360;

  alt = koreksiParallax(alt);
  alt = koreksiRefraction(alt);

  const elo = Math.acos(
    Math.sin(sunDec*rad)*Math.sin(moonDec*rad)
    + Math.cos(sunDec*rad)*Math.cos(moonDec*rad)*Math.cos((sunRA-moonRA)*rad)
  )*deg;
  const age = elo/12.19*24;

  hilalData.alt = alt;
  hilalData.azi = azi;

  document.getElementById('alt').innerText = alt.toFixed(2);
  document.getElementById('azi').innerText = azi.toFixed(2);
  document.getElementById('elo').innerText = elo.toFixed(2);
  document.getElementById('age').innerText = age.toFixed(1);

  // Status
  const statusEl = document.getElementById('status');
  const prediksiEl = document.getElementById('prediksi');
  if(alt < 0){
    statusEl.innerText = "🌑 Bulan di bawah horizon";
    prediksiEl.innerText = "Tidak mungkin rukyat";
  } else {
    const imkan = (alt>=3 && elo>=6.4 && age>=8);
    const q = alt - (0.1018*Math.sqrt(elo));
    const vis = q>0.216 ? "Mudah terlihat" : q>-0.014 ? "Terlihat dengan alat" : "Tidak terlihat";

    if(tanggalHijriGlobal >= 29){
      statusEl.innerText = imkan ? "✅ Imkan Rukyat" : "❌ Istikmal";
      prediksiEl.innerText = vis;
    } else {
      statusEl.innerText = "ℹ️ Belum akhir bulan";
      prediksiEl.innerText = vis;
    }
  }

  return { alt, azi, elo, age };
}

// ================= MAGHRIB =================
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

// ================= AUTO RELOAD AT MAGHRIB =================
function autoReloadAtMaghrib(lat, lon){
  if(reloadedToday) return;

  const now = new Date();
  const maghribData = hitungMaghrib(lat, lon);
  if(!maghribData) return;

  const maghribDecimal = maghribData.decimal;
  const maghribHour = Math.floor(maghribDecimal);
  const maghribMinute = Math.floor((maghribDecimal - maghribHour)*60);

  const maghribTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    maghribHour,
    maghribMinute,
    0,
    0
  );

  let diff = maghribTime - now;
  if(diff < 0) diff = 0;

  console.log(`Halaman akan reload saat maghrib dalam ${Math.round(diff/1000)} detik`);

  setTimeout(()=>{
    reloadedToday = true;
    location.reload();
  }, diff);
}

// ================= SENSOR =================
function initSensor(){
  let lastAlpha=0, lastGamma=0;
  window.addEventListener("deviceorientation", e=>{
    let alpha=e.alpha||0;
    let gamma=e.gamma||0;

    alpha=lastAlpha+(alpha-lastAlpha)*0.08;
    gamma=lastGamma+(gamma-lastGamma)*0.08;

    lastAlpha=alpha;
    lastGamma=gamma;

    updateAR(alpha,0,gamma);
  });
}

// ================= AR PRESISI =================
function updateAR(alpha, beta, gamma){
  const marker = document.getElementById('marker');
  const wrapper = document.querySelector('.camera-wrapper');
  if(!marker || !wrapper) return;

  const width = wrapper.clientWidth;
  const height = wrapper.clientHeight;

  if(smoothX === 0 && smoothY === 0){
    smoothX = width/2;
    smoothY = height/2;
  }

  const heading = 360 - alpha;
  const pitch = beta || 0;
  const roll  = gamma || 0;

  let deltaAz  = hilalData.azi - heading;
  let deltaAlt = hilalData.alt - pitch;

  if(deltaAz > 180) deltaAz -= 360;
  if(deltaAz < -180) deltaAz += 360;

  deltaAz  = Math.max(-45, Math.min(45, deltaAz));
  deltaAlt = Math.max(-30, Math.min(30, deltaAlt));

  let targetX = width/2 + deltaAz * 1.6 + roll*0.5;
  let targetY = height/2 - deltaAlt * 1.4 - pitch*0.3;

  targetX = Math.max(30, Math.min(width-30, targetX));
  targetY = Math.max(40, Math.min(height-40, targetY));

  smoothX += (targetX - smoothX) * 0.08;
  smoothY += (targetY - smoothY) * 0.06;

  marker.style.left = smoothX + "px";
  marker.style.top  = smoothY + "px";

  const error = Math.sqrt(deltaAz*deltaAz + deltaAlt*deltaAlt);
  const nowTime = Date.now();

  if(error < 6){
    marker.style.color = "lime";
    if(!locked && nowTime - lastBeepTime > 1000){
      playBeep(1200, 200);
      navigator.vibrate && navigator.vibrate(150);
      locked = true;
      lastBeepTime = nowTime;
    }
  } else if(error < 15){
    marker.style.color = "yellow";
    locked = false;
  } else {
    marker.style.color = "red";
    locked = false;
  }
}

// ================= AUDIO =================
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

// ================= CAMERA =================
function startCam(){
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
  .then(s => document.getElementById('cam').srcObject = s)
  .catch(()=> alert("Izin kamera diperlukan"));
}

// ================= NOTIF =================
function showNotif(judul,pesan){
  if(Notification.permission==="granted"){
    new Notification(judul,{body:pesan,icon:"assets/icon-192.png"});
  }
}
