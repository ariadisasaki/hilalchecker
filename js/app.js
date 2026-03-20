console.log("APP FINAL - HIJRIYAH + MAGHRIB AKTIF");

// ================= GLOBAL =================
let hijriMonthIndex = 0;

// ================= INIT =================
window.onload = () => {
  startClock();
  getLocation(); // hijriyah dipanggil dari sini (pakai GPS)
};

// ================= JAM =================
function startClock(){
  setInterval(()=>{
    let now = new Date();

    let hari = now.toLocaleDateString('id-ID',{weekday:'long'});
    let tanggal = now.toLocaleDateString('id-ID',{
      day:'numeric', month:'long', year:'numeric'
    });

    let jam = now.toLocaleTimeString('id-ID');

    document.getElementById('waktu').innerText =
      `${capitalize(hari)}, ${tanggal} - Pkl. ${jam}`;
  },1000);
}

function capitalize(s){
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ================= HIJRIYAH + MAGHRIB =================
function getHijri(lat, lon){

  let now = new Date();

  // ================= ESTIMASI MAGHRIB =================
  // pendekatan sederhana berbasis longitude
  let maghrib = 18 + (lon / 180); 
  let currentHour = now.getHours() + (now.getMinutes()/60);

  let tambahHari = 0;

  if(currentHour >= maghrib){
    tambahHari = 1;
  }

  // ================= HITUNG HIJRIYAH =================
  let jd = Math.floor((now.getTime() / 86400000) + 2440587.5) + tambahHari;

  let l = jd - 1948440 + 10632;
  let n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;

  let j = (Math.floor((10985 - l) / 5316)) *
          (Math.floor((50 * l) / 17719)) +
          (Math.floor(l / 5670)) *
          (Math.floor((43 * l) / 15238));

  l = l - (Math.floor((30 - j) / 15)) *
      (Math.floor((17719 * j) / 50)) -
      (Math.floor(j / 16)) *
      (Math.floor((15238 * j) / 43)) + 29;

  let m = Math.floor((24 * l) / 709);
  let d = l - Math.floor((709 * m) / 24);
  let y = 30 * n + j - 30;

  const bulan = [
    "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
    "Jumadil Awal","Jumadil Akhir","Rajab","Syaban",
    "Ramadhan","Syawal","Zulkaidah","Zulhijjah"
  ];

  hijriMonthIndex = m - 1;

  document.getElementById('hijri').innerText =
    "🕌 " + d + " " + bulan[hijriMonthIndex] + " " + y + " H";
}

// ================= GPS =================
function getLocation(){
  navigator.geolocation.getCurrentPosition(async (p)=>{
    let lat = p.coords.latitude;
    let lon = p.coords.longitude;

    document.getElementById('loc').innerText =
      `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    try{
      let res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      );
      let data = await res.json();
      let a = data.address || {};

      let parts = [
        a.village || a.city || "",
        a.county || "",
        a.state || "",
        a.country || "Indonesia"
      ].filter(v => v && v.trim() !== "");

      document.getElementById('lokasi').innerText =
        `${parts.join(', ')} 🇮🇩`;

    }catch{
      document.getElementById('lokasi').innerText = "📍Tidak tersedia";
    }

    // 🔥 HIJRIYAH BERDASARKAN GPS
    getHijri(lat, lon);

    hitungHilal(lat, lon);
    startCam();

  }, ()=>{
    document.getElementById('loc').innerText = "❌ GPS ditolak";
    document.getElementById('lokasi').innerText = "Gunakan lokasi default";

    let lat = -8.5833;
    let lon = 116.1167;

    getHijri(lat, lon);
    hitungHilal(lat, lon);
    startCam();
  },{
    enableHighAccuracy:true
  });
}

// ================= HILAL =================
function hitungHilal(lat, lon){

  // masih simulasi
  let alt = Math.random()*10;
  let azi = Math.random()*360;
  let elo = Math.random()*15;
  let age = Math.random()*24;

  document.getElementById('alt').innerText = alt.toFixed(2);
  document.getElementById('azi').innerText = azi.toFixed(2);
  document.getElementById('elo').innerText = elo.toFixed(2);
  document.getElementById('age').innerText = age.toFixed(1);

  let statusEl = document.getElementById('status');
  let prediksiEl = document.getElementById('prediksi');

  const bulan = [
    "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
    "Jumadil Awal","Jumadil Akhir","Rajab","Syaban",
    "Ramadhan","Syawal","Zulkaidah","Zulhijjah"
  ];

  let nextMonth = bulan[(hijriMonthIndex + 1) % 12];

  // ambil tanggal hijriyah dari tampilan
  let teks = document.getElementById('hijri').innerText;
  let tanggalHijri = parseInt(teks.split(" ")[1]);

  if(tanggalHijri >= 29){

    if(alt >= 3 && elo >= 6.4){
      statusEl.innerText = '✅ Imkan Rukyat';
      statusEl.className = 'status ok';

      prediksiEl.innerText =
        `🌙 Besok kemungkinan awal bulan ${nextMonth}`;
    } else {
      statusEl.innerText = '❌ Belum Memenuhi';
      statusEl.className = 'status no';

      prediksiEl.innerText =
        "⏳ Hilal belum terlihat (istikmal ke-30)";
    }

  }else{
    statusEl.innerText = 'ℹ️ Belum Akhir Bulan';
    statusEl.className = 'status';

    prediksiEl.innerText =
      "📅 Masih pertengahan bulan Hijriyah";
  }

  updateAR(azi, alt);
}

// ================= CAMERA =================
function startCam(){
  navigator.mediaDevices.getUserMedia({
    video:{ facingMode:'environment' }
  })
  .then(stream=>{
    document.getElementById('cam').srcObject = stream;
  })
  .catch(()=>{});
}

// ================= AR =================
function updateAR(az, alt){
  const m = document.getElementById('marker');

  let x = (az / 360) * window.innerWidth;
  let y = window.innerHeight/2 - alt * 5;

  m.style.left = x + 'px';
  m.style.top = y + 'px';
}

// ================= NOTIF =================
function requestNotif(){
  Notification.requestPermission();
}
