const express = require("express");
const fs = require("fs");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ===== DATABASE =====
let db = { keys: [], users: [] };

if (fs.existsSync("db.json")) {
  db = JSON.parse(fs.readFileSync("db.json"));
}

function saveDB() {
  fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}

// ===== LOGIN ADMIN =====
const ADMIN_PASS = "120510";

app.post("/login", (req, res) => {
  if (req.body.password === ADMIN_PASS) {
    return res.json({ ok: true });
  }
  res.json({ ok: false });
});

// ===== USER LOGIN =====
app.post("/user/login", (req, res) => {
  const { username } = req.body;

  let user = db.users.find(u => u.username === username);
  if (!user) {
    user = { username, history: [] };
    db.users.push(user);
  }

  saveDB();
  res.json(user);
});

// ===== CREATE KEY =====
app.post("/create", (req, res) => {
  const { key, days, maxDevices, vip } = req.body;

  const newKey = {
    key: key || Math.random().toString(36).substring(2, 10),
    expire: Date.now() + (days || 1) * 86400000,
    devices: [],
    maxDevices: maxDevices || 1,
    vip: vip || false,
    banned: false,
    active: true,
    history: [],
    ipList: []
  };

  db.keys.push(newKey);
  saveDB();

  res.json(newKey);
});

// ===== USE KEY =====
app.post("/use-key", (req, res) => {
  const { key, device, username } = req.body;
  const k = db.keys.find(x => x.key === key);

  if (!k) return res.json({ ok: false, msg: "Sai key" });
  if (k.banned) return res.json({ ok: false, msg: "Key bị ban" });
  if (!k.active) return res.json({ ok: false, msg: "Chưa kích hoạt" });
  if (Date.now() > k.expire) return res.json({ ok: false, msg: "Hết hạn" });

  // Anti share IP
  if (!k.ipList.includes(req.ip)) {
    if (k.ipList.length >= 3) {
      k.banned = true;
      return res.json({ ok: false, msg: "Nghi share key" });
    }
    k.ipList.push(req.ip);
  }

  // Device limit
  if (!k.devices.includes(device)) {
    if (k.devices.length >= k.maxDevices)
      return res.json({ ok: false, msg: "Quá thiết bị" });

    k.devices.push(device);
  }

  k.history.push({ device, time: Date.now(), username });

  const user = db.users.find(u => u.username === username);
  if (user) {
    user.history.push({ key, time: Date.now() });
  }

  saveDB();

  res.json({ ok: true, vip: k.vip });
});

// ===== BAN / UNBAN =====
app.post("/ban", (req, res) => {
  const k = db.keys.find(x => x.key === req.body.key);
  if (k) k.banned = true;
  saveDB();
  res.json({ ok: true });
});

app.post("/unban", (req, res) => {
  const k = db.keys.find(x => x.key === req.body.key);
  if (k) k.banned = false;
  saveDB();
  res.json({ ok: true });
});

// ===== DELETE =====
app.post("/delete", (req, res) => {
  db.keys = db.keys.filter(k => k.key !== req.body.key);
  saveDB();
  res.json({ ok: true });
});

// ===== EXPORT =====
app.get("/export", (req, res) => {
  res.send(db.keys.map(k => k.key).join("\n"));
});

// ===== STATS =====
app.get("/stats", (req, res) => {
  res.json({
    totalKeys: db.keys.length,
    totalUsers: db.users.length,
    activeKeys: db.keys.filter(k => !k.banned).length
  });
});

// ===== UI =====
app.get("/", (req, res) => {
  res.send(`
  <html>
  <head>
  <title>KEY SYSTEM PRO</title>
  <style>
    body { font-family: Arial; background:#111; color:#fff; text-align:center }
    input,button { padding:10px; margin:5px; border-radius:8px; border:none }
    .card { background:#222; padding:10px; margin:10px; border-radius:10px }
  </style>
  </head>

  <body>
  <h1>🔥 KEY SYSTEM PRO MAX</h1>

  <input id="pass" placeholder="Admin password">
  <button onclick="login()">Login</button>

  <div id="admin" style="display:none">
    <h2>Tạo key</h2>
    <input id="key" placeholder="custom key">
    <input id="days" placeholder="days">
    <button onclick="create()">Create</button>

    <h2>Danh sách key</h2>
    <div id="list"></div>
  </div>

<script>
let isLogin = false;

function login(){
  fetch("/login",{method:"POST",headers:{'Content-Type':'application/json'},
  body:JSON.stringify({password:pass.value})})
  .then(r=>r.json()).then(d=>{
    if(d.ok){
      admin.style.display="block";
      load();
    } else alert("Sai mk");
  });
}

function create(){
  fetch("/create",{method:"POST",headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
    key:key.value,
    days:parseInt(days.value)||1
  })}).then(()=>load());
}

function ban(k){
  fetch("/ban",{method:"POST",headers:{'Content-Type':'application/json'},
  body:JSON.stringify({key:k})}).then(()=>load());
}

function del(k){
  fetch("/delete",{method:"POST",headers:{'Content-Type':'application/json'},
  body:JSON.stringify({key:k})}).then(()=>load());
}

function load(){
  fetch("/stats").then(r=>r.json()).then(s=>{
    document.title = "Keys: "+s.totalKeys;
  });

  fetch("/export").then(r=>r.text()).then(t=>{
    const arr = t.split("\\n");

    list.innerHTML = arr.map(k=>\`
      <div class="card">
        \${k}
        <br>
        <button onclick="ban('\${k}')">Ban</button>
        <button onclick="del('\${k}')">Xóa</button>
      </div>
    \`).join("");
  });
}
</script>

  </body>
  </html>
  `);
});

// ===== START =====
app.listen(PORT, () => console.log("Server running " + PORT));
