import os
import threading
import time
import urllib.request
from flask import Flask, request, redirect, url_for, send_file, render_template_string

app = Flask(__name__)

# Cấu hình thư mục lưu trữ cục bộ
UPLOAD_FOLDER = os.getcwd()
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Tên các file đích đồng bộ với Tool Python của bạn
TARGET_ARCHIVE = "autocaiapp.py.7z"
CONFIG_FILE = ".sys_key.cfg"

# --- GỘP GIAO DIỆN HTML VÀO TRONG CODE PYTHON ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hệ Thống Nạp File Server</title>
    <style>
        body { font-family: Arial, sans-serif; background-color: #1e1e2e; color: #cdd6f4; max-width: 500px; margin: 40px auto; padding: 20px; }
        .card { background: #313244; padding: 20px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        h2 { color: #a6e3a1; text-align: center; margin-top: 0; }
        .status { margin-bottom: 20px; padding: 10px; border-radius: 5px; background: #45475a; font-size: 14px; line-height: 1.6; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #bac2de; }
        input[type="file"], input[type="text"] { width: 100%; padding: 10px; box-sizing: border-box; border-radius: 5px; border: 1px solid #585b70; background: #181825; color: #fff; }
        button { width: 100%; padding: 12px; background: #22c55e; border: none; color: white; font-weight: bold; border-radius: 5px; cursor: pointer; margin-top: 10px; }
        button:hover { background: #16a34a; }
        .link-zone { margin-top: 15px; font-size: 13px; text-align: center; }
        a { color: #89b4fa; text-decoration: none; }
    </style>
</head>
<body>

<div class="card">
    <h2>🛠️ SERVER FILE MANAGER</h2>
    
    <div class="status">
        🔴 <b>Trạng thái file (.7z):</b> 
        {% if archive_exists %}
            <span style="color:#22c55e">Đã có trên Server</span>
        {% else %}
            <span style="color:#ef4444">Chưa có file</span>
        {% endif %}<br>
        🔑 <b>Mật khẩu hiện tại:</b> <span style="color:#f9e2af">{{ current_key }}</span>
    </div>

    <form action="/upload" method="post" enctype="multipart/form-data">
        <div class="form-group">
            <label>1. Chọn file cần nạp từ điện thoại (.7z):</label>
            <input type="file" name="file" accept=".7z" required>
        </div>
        <div class="form-group">
            <label>2. Nhập MẬT KHẨU VỐN CÓ của file:</label>
            <input type="text" name="password" placeholder="Nhập mật khẩu đồng bộ..." required>
        </div>
        <button type="submit">🚀 TIẾN HÀNH NẠP LÊN SERVER</button>
    </form>
    
    <div class="link-zone">
        <p>🔗 Link tải cho Tool: <br><a href="/download/archive" target="_blank">[Bấm xem Link Tải File]</a></p>
    </div>
</div>

</body>
</html>
"""

@app.route('/')
def index():
    # Kiểm tra trạng thái file hiện tại trên server
    archive_exists = os.path.exists(os.path.join(UPLOAD_FOLDER, TARGET_ARCHIVE))
    
    current_key = "Chưa có"
    if os.path.exists(os.path.join(UPLOAD_FOLDER, CONFIG_FILE)):
        with open(os.path.join(UPLOAD_FOLDER, CONFIG_FILE), "r", encoding="utf-8") as f:
            current_key = f.read().strip()

    # Sử dụng render_template_string để render thẳng biến giao diện mà không cần file html bên ngoài
    return render_template_string(HTML_TEMPLATE, archive_exists=archive_exists, current_key=current_key)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return "Không tìm thấy file", 400
    
    file = request.files['file']
    password = request.form.get('password', '').strip()
    
    if file.filename == '':
        return "Chưa chọn file", 400

    if file:
        # Lưu file đè/đổi tên thành autocaiapp.py.7z
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], TARGET_ARCHIVE))
        
        # Lưu mật khẩu giải mã ngầm thành .sys_key.cfg
        if password:
            with open(os.path.join(app.config['UPLOAD_FOLDER'], CONFIG_FILE), "w", encoding="utf-8") as f:
                f.write(password)
                
        return redirect(url_for('index'))

# Endpoint để Tool Python của bạn gọi tải file về
@app.route('/download/archive')
def download_archive():
    path = os.path.join(app.config['UPLOAD_FOLDER'], TARGET_ARCHIVE)
    if os.path.exists(path):
        return send_file(path, as_attachment=True)
    return "File không tồn tại trên server", 404

# Endpoint để Tool Python tải file config mật khẩu về
@app.route('/download/config')
def download_config():
    path = os.path.join(app.config['UPLOAD_FOLDER'], CONFIG_FILE)
    if os.path.exists(path):
        return send_file(path, as_attachment=True)
    return "Config không tồn tại", 404

# --- CƠ CHẾ ANTI NGỦ ĐÔNG / ANTI DIE (SELF-PING CŨ) ---
def anti_sleep_ping():
    """Tự động gửi request đến chính nó mỗi 10 phút để Render không tắt Server"""
    time.sleep(10) # Đợi server khởi động
    
    # Lấy URL tự động do Render cung cấp qua biến môi trường
    self_url = os.environ.get("RENDER_EXTERNAL_URL")
    
    if not self_url:
        print("[Anti-Sleep] Không tìm thấy biến RENDER_EXTERNAL_URL. Cơ chế ping tạm nghỉ.")
        return

    print(f"[Anti-Sleep] Kích hoạt luồng chống sập thành công cho: {self_url}")
    while True:
        try:
            req = urllib.request.Request(self_url, headers={'User-Agent': 'Anti-Sleep-Bot'})
            with urllib.request.urlopen(req, timeout=10) as response:
                response.read()
            print("[Anti-Sleep] Ping thành công! Giữ Server luôn hoạt động.")
        except Exception as e:
            print(f"[Anti-Sleep] Lỗi Ping: {e}")
        
        # Cứ 10 phút ping một lần (Mức an toàn trước mốc 15 phút của Render)
        time.sleep(600)

if __name__ == '__main__':
    # Khởi chạy luồng Anti-sleep chạy ẩn
    ping_thread = threading.Thread(target=anti_sleep_ping, daemon=True)
    ping_thread.start()
    
    # Chạy ứng dụng Flask cục bộ (Khi up Render, Gunicorn sẽ đè lệnh chạy này)
    app.run(host='0.0.0.0', port=5000)
