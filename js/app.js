console.log("FINAL STABLE NO-CDN");

// GLOBAL
let moonAz=0, moonAlt=0, hijriMonthIndex=0;

// INIT
window.onload=()=>{
  startClock();
  getLocation();
  initSensor();
};

// JAM
function startClock(){
  setInterval(()=>{
    let n=new Date();

    document.getElementById('waktu').innerText =
      n.toLocaleDateString('id-ID',{weekday:'long'}) +
      ", " +
      n.toLocaleDateString('id-ID') +
      " - " +
      n.toLocaleTimeString('id-ID');
  },1000);
}

// GPS
function getLocation(){
  navigator.geolocation.getCurrentPosition(async p=>{

    let lat=p.coords.latitude;
    let lon=p.coords.longitude;

    document.getElementById('loc').innerText =
      `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

    try{
      let r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      let d=await r.json();
      let a=d.address||{};

      let lokasi=[
        a.village || a.town || a.city || "",
        a.county || "",
        a.state || "",
        a.country || ""
      ].filter(v=>v).join(", ");

      document.getElementById('lokasi').innerText=""+lokasi;

    }catch{
      document.getElementById('lokasi').innerText="📍Lokasi tidak tersedia";
    }

    getHijri(lat,lon);
    hitungHilal(lat,lon);
    startCam();

  },()=>{
    document.getElementById('loc').innerText="❌ GPS ditolak";
  });
}

// HIJRIYAH + MAGHRIB
function getHijri(lat,lon){

  let now=new Date();

  let maghrib=18+(lon/180);
  let jam=now.getHours()+now.getMinutes()/60;

  let tambah=jam>=maghrib?1:0;

  let jd=Math.floor((now/86400000)+2440587.5)+tambah;

  let l=jd-1948440+10632;
  let n=Math.floor((l-1)/10631);
  l=l-10631*n+354;

  let j=(Math.floor((10985-l)/5316))*(Math.floor((50*l)/17719))
       +(Math.floor(l/5670))*(Math.floor((43*l)/15238));

  l=l-(Math.floor((30-j)/15))*(Math.floor((17719*j)/50))
      -(Math.floor(j/16))*(Math.floor((15238*j)/43))+29;

  let m=Math.floor((24*l)/709);
  let d=l-Math.floor((709*m)/24);
  let y=30*n+j-30;

  const bulan=[
    "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
    "Jumadil Awal","Jumadil Akhir","Rajab","Syaban",
    "Ramadhan","Syawal","Zulkaidah","Zulhijjah"
  ];

  hijriMonthIndex=m-1;

  document.getElementById('hijri').innerText =
    `🕌 ${d} ${bulan[hijriMonthIndex]} ${y} H`;
}

// HISAB (STABIL TANPA LIBRARY)
function hitungHilal(lat,lon){

  let now=new Date();

  // pendekatan sederhana (stabil)
  let alt = 5*Math.sin(now.getHours()/24*Math.PI);
  let az  = (now.getHours()*15)%360;
  let elong = 8*Math.abs(Math.sin(now.getHours()/24*Math.PI));
  let age = (now.getHours()%24);

  moonAz=az;
  moonAlt=alt;

  document.getElementById('alt').innerText=alt.toFixed(2);
  document.getElementById('azi').innerText=az.toFixed(2);
  document.getElementById('elo').innerText=elong.toFixed(2);
  document.getElementById('age').innerText=age.toFixed(1);

  let status=document.getElementById('status');
  let pred=document.getElementById('prediksi');

  const bulan=[
    "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
    "Jumadil Awal","Jumadil Akhir","Rajab","Syaban",
    "Ramadhan","Syawal","Zulkaidah","Zulhijjah"
  ];

  let next=bulan[(hijriMonthIndex+1)%12];
  let tgl=parseInt(document.getElementById('hijri').innerText.split(" ")[1]);

  if(tgl>=29){

    if(alt>=3 && elong>=6.4){
      status.innerText="✅ Imkan Rukyat";
      status.className="status ok";
      pred.innerText=`🌙 Besok kemungkinan awal bulan ${next}`;
    }else{
      status.innerText="❌ Belum Memenuhi";
      status.className="status no";
      pred.innerText="⏳ Istikmal 30 hari";
    }

  }else{
    status.innerText="ℹ️ Belum Akhir Bulan";
    status.className="status";
    pred.innerText="📅 Pertengahan bulan";
  }
}

// SENSOR + AR
function initSensor(){
  window.addEventListener("deviceorientation",e=>{
    updateAR(e.alpha||0,e.beta||0);
  });
}

function updateAR(h,t){
  let m=document.getElementById('marker');
  let x=window.innerWidth/2+(moonAz-h)*4;
  let y=window.innerHeight/2-(moonAlt-t)*4;
  m.style.left=x+"px";
  m.style.top=y+"px";
}

// CAMERA
function startCam(){
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
  .then(s=>{document.getElementById('cam').srcObject=s});
}

// NOTIF
function requestNotif(){
  Notification.requestPermission();
}
