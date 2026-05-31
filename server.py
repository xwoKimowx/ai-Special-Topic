"""
問答-1.71 後端伺服器
前後端分離架構：前端靜態頁面 + 此後端 API Proxy

啟動方式：
    pip install flask flask-cors requests
    python server.py

預設埠：5000
前端網址：http://localhost:5000
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os

app = Flask(__name__, static_folder='.')
CORS(app)

# ── API 設定：Key 從環境變數讀取，不寫死在程式碼 ──────────────
# 本機測試時在終端機設定：set API_KEY=sk-or-v1-xxx（Windows）
# Render 部署時在後台 Environment 欄位填入
_API_KEY = os.environ.get('API_KEY', '')
_API_URL = 'https://openrouter.ai/api/v1/chat/completions'


# ── /api/chat：接收前端請求，加上 Key，轉發給 OpenRouter ───────
@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        body = request.get_json()
        if not body:
            return jsonify({'error': 'Empty request body'}), 400

        headers = {
            'Authorization': f'Bearer {_API_KEY}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai-tutor.app',
            'X-Title': 'AI-Tutor',
        }

        resp = requests.post(_API_URL, json=body, headers=headers, timeout=120)
        return (resp.content, resp.status_code, {'Content-Type': 'application/json'})

    except requests.exceptions.Timeout:
        return jsonify({'error': 'Upstream timeout'}), 504
    except Exception as e:
        import traceback
        traceback.print_exc()   # 印到終端機方便除錯
        return jsonify({'error': str(e)}), 500


# ── 靜態前端檔案（index.html / script.js / style.css …）────────
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    if not _API_KEY:
        print('⚠️  警告：未設定 API_KEY 環境變數，AI 功能將無法使用')
        print('   本機測試請先執行：set API_KEY=sk-or-v1-你的key（Windows）')
    print(f'✅  後端啟動，請開啟瀏覽器至 http://localhost:{port}')
    app.run(host='0.0.0.0', port=port, debug=False)
