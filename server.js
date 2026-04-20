const express = require("express");
const fs = require("fs");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DB_FILE = "./database.json";
const ADMIN_PASS = "120510";

// ===== DB =====
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { keys: {} };
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===== AUTH =====
app.use((req, res, next) => {
  if (req.path === "/login") return next();
  if (req.path === "/api/check") return next();

  const cookie = req.headers.cookie || "";
  if (cookie.includes("auth=true")) return next();

  res.redirect("/login");
});

// ===== LOGIN =====
app.get("/login", (req, res) => {
  res.send(`
  <style>
    body{background:#0f172a;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh}
    .box{background:#1e293b;padding:30px;border-radius:15px;width:300px;text-align:center}
    input,button{width:100%;padding:10px;margin-top:10px;border-radius:10px;border:none}
    button{background:#6366f1;color:white;font-weight:bold}
  </style>
  <div class="box">
    <h2>🔐 ADMIN LOGIN</h2>
    <form method="POST">
      <input name="pass" placeholder="Mật khẩu">
      <button>Đăng nhập</button>
    </form>
  </div>
  `);
});

app.post("/login", (req, res) => {
  if (req.body.pass === ADMIN_PASS) {
    res.setHeader("Set-Cookie", "auth=true; Path=/");
    res.redirect("/");
  } else {
    res.send("Sai mật khẩu");
  }
});

// ===== API CHECK =====
app.post("/api/check", (req, res) => {
  let { key, deviceId } = req.body;
  let db = loadDB();

  if (!db.keys[key]) return res.json({ ok: false });

  let k = db.keys[key];

  if (k.banned) return res.json({ ok: false, msg: "Banned" });

  if (k.exp === "pending") {
    k.exp = Date.now() + k.duration;
  }

  if (k.exp !== "permanent" && Date.now() > k.exp)
    return res.json({ ok: false, msg: "Expired" });

  if (!k.devices.includes(deviceId)) {
    if (k.devices.length >= k.maxDevices)
      return res.json({ ok: false, msg: "Full device" });
    k.devices.push(deviceId);
  }

  // lưu lịch sử
  k.logs.push({
    time: Date.now(),
    device: deviceId,
    ip: req.headers["x-forwarded-for"] || "unknown"
  });

  saveDB(db);

  res.json({ ok: true, vip: k.vip });
});

// ===== CREATE =====
app.post("/create", (req, res) => {
  let db = loadDB();

  let key = req.body.custom || ("LVT-" + Math.random().toString(36).substr(2,6).toUpperCase());

  let timeMap = {
    sec:1000,min:60000,hour:3600000,day:86400000,month:2592000000,year:31536000000
  };

  let duration = req.body.type==="permanent"?0:parseInt(req.body.time)*timeMap[req.body.type];

  db.keys[key] = {
    exp: req.body.type==="permanent"?"permanent":"pending",
    duration: duration,
    maxDevices: parseInt(req.body.devices),
    devices: [],
    vip: req.body.vip==="true",
    banned:false,
    logs:[]
  };

  saveDB(db);
  res.redirect("/");
});

// ===== ACTION =====
app.get("/ban/:k",(req,res)=>{let db=loadDB();db.keys[req.params.k].banned=true;saveDB(db);res.redirect("/")});
app.get("/unban/:k",(req,res)=>{let db=loadDB();db.keys[req.params.k].banned=false;saveDB(db);res.redirect("/")});
app.get("/delete/:k",(req,res)=>{let db=loadDB();delete db.keys[req.params.k];saveDB(db);res.redirect("/")});
app.get("/reset/:k",(req,res)=>{let db=loadDB();db.keys[req.params.k].devices=[];saveDB(db);res.redirect("/")});
app.get("/addtime/:k",(req,res)=>{
  let db=loadDB();
  let k=db.keys[req.params.k];
  if(k.exp!=="permanent"){
    k.exp = (k.exp==="pending"?Date.now():k.exp)+86400000;
  }
  saveDB(db);res.redirect("/")
});

// ===== UI =====
app.get("/", (req, res) => {
  let db = loadDB();
  let html="";

  for(let k in db.keys){
    let d=db.keys[k];
    html+=`
    <tr>
      <td>${k}</td>
      <td>${d.vip?"👑":"🔑"}</td>
      <td>${d.devices.length}/${d.maxDevices}</td>
      <td>${d.banned?"❌":"✅"}</td>
      <td>
        <a href="/ban/${k}">Ban</a> |
        <a href="/unban/${k}">Unban</a> |
        <a href="/reset/${k}">Reset</a> |
        <a href="/delete/${k}">Xoá</a>
      </td>
    </tr>`;
  }

  res.send(`
  <style>
    body{font-family:sans-serif;background:#0f172a;color:white;padding:20px}
    input,select,button{padding:8px;margin:5px;border-radius:8px;border:none}
    button{background:#22c55e;color:white}
    table{width:100%;margin-top:20px;border-collapse:collapse}
    td,th{border:1px solid #334155;padding:8px}
  </style>

  <h2>🔥 KEY PANEL</h2>

  <form method="POST" action="/create">
    <input name="custom" placeholder="Key custom (bỏ trống = random)">
    <input name="time" placeholder="Số">
    <select name="type">
      <option value="sec">Giây</option>
      <option value="min">Phút</option>
      <option value="hour">Giờ</option>
      <option value="day">Ngày</option>
      <option value="month">Tháng</option>
      <option value="year">Năm</option>
      <option value="permanent">Vĩnh viễn</option>
    </select>
    <input name="devices" placeholder="Thiết bị" value="1">
    <select name="vip">
      <option value="false">Thường</option>
      <option value="true">VIP</option>
    </select>
    <button>Tạo Key</button>
  </form>

  <table>
    <tr><th>Key</th><th>Type</th><th>Devices</th><th>Status</th><th>Action</th></tr>
    ${html}
  </table>
  `);
});

// ===== RUN =====
app.listen(PORT, () => console.log("RUNNING " + PORT));
