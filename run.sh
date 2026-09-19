#!/usr/bin/env bash
# 와인 다이어리 웹앱 실행 스크립트

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d ".venv" ]; then
    echo "가상환경(.venv)이 없습니다. 생성을 진행합니다..."
    python3 -m venv .venv
    ./.venv/bin/pip install --upgrade pip
    ./.venv/bin/pip install -r requirements.txt
fi

# 로컬 IP 주소 탐색 (아이폰 접속용)
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo "=========================================================="
echo "🍷 와인 다이어리 (Wine Log) 서버를 시작합니다!"
echo "=========================================================="
echo "👉 Mac 브라우저 접속: http://localhost:8000"
echo "👉 아이폰(동일 Wi-Fi) 접속: http://${LOCAL_IP}:8000"
echo "=========================================================="
echo "아이폰 Safari에서 위 주소 접속 후 '홈 화면에 추가'를 누르면"
echo "앱처럼 전체화면으로 사용하실 수 있습니다."
echo "=========================================================="

./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
