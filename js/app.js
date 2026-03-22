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

// ================= KONSTANTA =================
const rad = Math.PI/180;
const deg = 180/Math.PI;

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

// ================= DELTA T =================
function deltaT(){
  return 69;
}

// ================= REFRACTION =================
function koreksiRefraction(alt){
  if(alt > -1){
    let R = 1.02 / Math.tan((alt + 10.3/(alt+5.11)) * rad);
    return alt + (R/60);
  }
  return alt;
}

// ================= PARALLAX =================
function koreksiParallax(alt){
  let pi = 0.9507;
  let altRad = alt * rad;
  let correction = Math.asin(Math.sin(pi*rad) * Math.cos(altRad));
  return alt - (correction * deg);
}

// ================= HIJRI =================
function getHijri(lat, lon){
  let now = new Date();

  let maghrib = 18;
  let maghribData = hitungMaghrib(lat, lon);
  if(maghribData) maghrib = maghribData.decimal;

  let jam = now.getHours() + now.getMinutes()/60;
  let tambahHari = jam >= (maghrib + 10/60) ? 1 : 0;

  let jd = Math.floor((now.getTime()/86400000)+2440587.5) + tambahHari;

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

  hijriMonthIndex = m-1;
  tanggalHijriGlobal = d;

  const bulan = ["Muharram","Safar","Rabiul Awal","Rabiul Akhir","Jumadil Awal","Jumadil Akhir","Rajab","Syaban","Ramadhan","Syawal","Zulkaidah","Zulhijjah"];

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
    document.getElementById('lokasi').innerText="Lokasi default";

    getHijri(lat, lon);
    hitungHilal(lat, lon);
    startCam();
  },{enableHighAccuracy:true});
}

// ================= HILAL =================
function hitungHilal(lat, lon){
  const now = new Date();
  const JD = (now/86400000)+2440587.5;
  const T = (JD-2451545)/36525;

  let epsilon = 23.439291 - 0.0130042*T;

  // ===== MATAHARI =====
  let L0 = (280.46646 + 36000.76983*T)%360;
  let M = 357.52911 + 35999.05029*T;

  let C = (1.914602 - 0.004817*T)*Math.sin(M*rad)
        + (0.019993 - 0.000101*T)*Math.sin(2*M*rad)
        + 0.000289*Math.sin(3*M*rad);

  let sunLong = L0 + C;

  let sunRA = Math.atan2(Math.cos(epsilon*rad)*Math.sin(sunLong*rad), Math.cos(sunLong*rad))*deg;
  let sunDec = Math.asin(Math.sin(epsilon*rad)*Math.sin(sunLong*rad))*deg;

  // ===== BULAN =====
  let D = (297.8501921 + 445267.1114034*T)%360;
  let Lm = (218.316 + 13.176396*(JD-2451545))%360;
  let Mm = (134.963 + 13.064993*(JD-2451545))%360;
  let F  = (93.272 + 13.229350*(JD-2451545))%360;

  let moonLong = Lm 
    + 6.289*Math.sin(Mm*rad)
    + 1.274*Math.sin((2*D-Mm)*rad)
    + 0.658*Math.sin(2*D*rad)
    + 0.214*Math.sin(2*Mm*rad)
    - 0.186*Math.sin(M*rad);

  let moonLat = 5.128*Math.sin(F*rad);

  let moonRA = Math.atan2(
    Math.sin(moonLong*rad)*Math.cos(epsilon*rad) - Math.tan(moonLat*rad)*Math.sin(epsilon*rad),
    Math.cos(moonLong*rad)
  )*deg;

  let moonDec = Math.asin(
    Math.sin(moonLat*rad)*Math.cos(epsilon*rad) +
    Math.cos(moonLat*rad)*Math.sin(epsilon*rad)*Math.sin(moonLong*rad)
  )*deg;

  let GMST = (280.46061837 + 360.98564736629*(JD-2451545))%360;
  let LST = GMST + lon;

  let HA = (LST - moonRA);

  let alt = Math.asin(
    Math.sin(lat*rad)*Math.sin(moonDec*rad) +
    Math.cos(lat*rad)*Math.cos(moonDec*rad)*Math.cos(HA*rad)
  )*deg;

  let azi = Math.atan2(
    -Math.sin(HA*rad),
    Math.tan(moonDec*rad)*Math.cos(lat*rad) - Math.sin(lat*rad)*Math.cos(HA*rad)
  )*deg;

  if(azi < 0) azi += 360;

  // ===== KOREKSI =====
  alt = koreksiParallax(alt);
  alt = koreksiRefraction(alt);

  let elo = Math.acos(
    Math.sin(sunDec*rad)*Math.sin(moonDec*rad) +
    Math.cos(sunDec*rad)*Math.cos(moonDec*rad)*Math.cos((sunRA-moonRA)*rad)
  )*deg;

  let age = elo/12.19*24;

  hilalData.alt = alt;
  hilalData.azi = azi;

  document.getElementById('alt').innerText = alt.toFixed(2);
  document.getElementById('azi').innerText = azi.toFixed(2);
  document.getElementById('elo').innerText = elo.toFixed(2);
  document.getElementById('age').innerText = age.toFixed(1);

  let statusEl = document.getElementById('status');
  let prediksiEl = document.getElementById('prediksi');

  if(alt < 0){
    statusEl.innerText = "🌑 Bulan di bawah horizon";
    prediksiEl.innerText = "Tidak mungkin rukyat";
    return;
  }

  let imkan = (alt>=3 && elo>=6.4 && age>=8);
  let q = alt - (0.1018*Math.sqrt(elo));

  let vis = q>0.216 ? "Mudah terlihat" :
            q>-0.014 ? "Terlihat dengan alat" :
            "Tidak terlihat";

  if(tanggalHijriGlobal >= 29){
    if(imkan){
      statusEl.innerText="✅ Imkan Rukyat";
      prediksiEl.innerText=vis;
    }else{
      statusEl.innerText="❌ Istikmal";
      prediksiEl.innerText=vis;
    }
  }else{
    statusEl.innerText="ℹ️ Belum akhir bulan";
    prediksiEl.innerText=vis;
  }
}

// ================= MAGHRIB =================
function hitungMaghrib(lat, lon){
  const now = new Date();
  const JD = (now/86400000)+2440587.5;
  const T = (JD-2451545)/36525;

  let L0=(280.46646+36000.76983*T)%360;
  let M=357.52911+35999.05029*T;

  let C=(1.914602-0.004817*T)*Math.sin(M*rad)
       +(0.019993-0.000101*T)*Math.sin(2*M*rad);

  let lambda=L0+C;
  let delta=Math.asin(Math.sin(23.44*rad)*Math.sin(lambda*rad));

  let h0=-0.833*rad;

  let cosH=(Math.sin(h0)-Math.sin(lat*rad)*Math.sin(delta))/
           (Math.cos(lat*rad)*Math.cos(delta));

  if(cosH<-1||cosH>1) return null;

  let H=Math.acos(cosH)*deg;
  let waktu=12+(H/15);

  let timezone=-new Date().getTimezoneOffset()/60;

  let maghrib=waktu+timezone-(lon/15);

  return {decimal:maghrib};
}

// ================= SENSOR =================
function initSensor(){
  let lastAlpha=0, lastGamma=0;

  window.addEventListener("deviceorientation", e=>{
    let alpha=e.alpha||0;
    let gamma=e.gamma||0;

    alpha=lastAlpha+(alpha-lastAlpha)*0.15;
    gamma=lastGamma+(gamma-lastGamma)*0.15;

    lastAlpha=alpha;
    lastGamma=gamma;

    updateAR(alpha,0,gamma);
  });
}

// ================= AR (ULTRA SMOOTH + SMART TRACKING) =================
function updateAR(alpha, beta, gamma){
  const marker = document.getElementById('marker');
  const wrapper = document.querySelector('.camera-wrapper');

  if(!marker || !wrapper) return;

  const width = wrapper.clientWidth;
  const height = wrapper.clientHeight;

  // ================= HITUNG SELISIH =================
  let deltaAz = hilalData.azi - alpha;
  if(deltaAz > 180) deltaAz -= 360;
  if(deltaAz < -180) deltaAz += 360;

  let deltaAlt = hilalData.alt - gamma;

  let error = Math.sqrt(deltaAz*deltaAz + deltaAlt*deltaAlt);

  // ================= POSISI TARGET =================
  let targetX = width/2 + deltaAz * 2;
  let targetY = height/2 - deltaAlt * 3;

  targetX = Math.max(20, Math.min(width - 20, targetX));
  targetY = Math.max(20, Math.min(height - 20, targetY));

  // ================= SMOOTHING ADAPTIVE =================
  let smoothing;

  if(error > 25){
    smoothing = 0.18;
  } else if(error > 10){
    smoothing = 0.12;
  } else if(error > 5){
    smoothing = 0.08;
  } else if(error > 2){
    smoothing = 0.05;
  } else {
    smoothing = 0.02; // super halus saat mendekati
  }

  smoothX += (targetX - smoothX) * smoothing;
  smoothY += (targetY - smoothY) * smoothing;

  marker.style.left = smoothX + "px";
  marker.style.top = smoothY + "px";

  // ================= WARNA + AUDIO (NO SPAM) =================
  if(error < 3){
    // 🟢 TEPAT
    marker.style.background = "lime";
    marker.style.boxShadow = "0 0 20px lime";

    // 🔊 bunyi HANYA SEKALI saat masuk area target
    if(!locked){
      playBeep(1200, 200);
      navigator.vibrate && navigator.vibrate(200);
      locked = true;
    }

  } else if(error < 10){
    // 🟡 MENDEKATI (TANPA AUDIO)
    marker.style.background = "yellow";
    marker.style.boxShadow = "0 0 15px yellow";

    locked = false;

  } else {
    // 🔴 JAUH (TANPA AUDIO)
    marker.style.background = "red";
    marker.style.boxShadow = "0 0 10px red";

    locked = false;
  }
}

// ================= AUDIO =================
function playBeep(freq=800,duration=100){
  if(!audioCtx){
    audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  }
  const osc=audioCtx.createOscillator();
  const gain=audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.frequency.value=freq;
  gain.gain.setValueAtTime(0.2,audioCtx.currentTime);

  osc.start();
  osc.stop(audioCtx.currentTime+duration/1000);
}

// ================= CAMERA =================
function startCam(){
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
  .then(s=>{
    document.getElementById('cam').srcObject=s;
  }).catch(()=>{
    alert("Izin kamera diperlukan");
  });
}

// ================= NOTIF =================
function showNotif(judul,pesan){
  if(Notification.permission==="granted"){
    new Notification(judul,{body:pesan,icon:"assets/icon-192.png"});
  }
}
