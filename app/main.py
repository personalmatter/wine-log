import os
import uuid
import shutil
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models import (
    init_db, get_db,
    WineLabelAnalysis, VivinoInfo, WineEntryCreate, WineEntry
)
from app.services.vision import analyze_wine_label
from app.services.vivino import search_vivino
from app.services.sheets import append_wine_to_sheet, upload_image_to_drive

# DB 초기화
init_db()

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙
STATIC_DIR = settings.BASE_DIR / "app" / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")


@app.get("/")
def read_root():
    """모바일 웹앱 메인 페이지"""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Wine Log Server is running"}


@app.get("/api/status")
def get_status():
    """현재 API 및 구글 연동 설정 상태"""
    has_gemini = bool(settings.GEMINI_API_KEY)
    has_google = bool(
        settings.GOOGLE_SERVICE_ACCOUNT_FILE and 
        os.path.exists(settings.GOOGLE_SERVICE_ACCOUNT_FILE)
    )
    return {
        "gemini_configured": has_gemini,
        "google_sheets_configured": has_google,
        "sheet_name": settings.GOOGLE_SHEET_NAME,
        "has_drive_folder": bool(settings.GOOGLE_DRIVE_FOLDER_ID)
    }


@app.post("/api/settings")
def update_settings(gemini_api_key: Optional[str] = Form(None)):
    """웹 화면에서 간편하게 API 키 설정"""
    if gemini_api_key is not None:
        settings.GEMINI_API_KEY = gemini_api_key.strip()
        env_path = settings.BASE_DIR / ".env"
        # .env 파일 저장/갱신
        env_lines = []
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if not line.startswith("GEMINI_API_KEY="):
                        env_lines.append(line.strip())
        env_lines.append(f"GEMINI_API_KEY={settings.GEMINI_API_KEY}")
        with open(env_path, "w", encoding="utf-8") as f:
            f.write("\n".join(env_lines) + "\n")

    return {"status": "success", "gemini_configured": bool(settings.GEMINI_API_KEY)}


@app.post("/api/analyze-label")
async def analyze_label_endpoint(file: UploadFile = File(...)):
    """
    와인 라벨 사진을 업로드받아:
    1. 사진 로컬 저장
    2. Gemini Vision으로 라벨 분석
    3. 추출된 와인명으로 비비노 평점 자동 검색
    4. 분석 정보 결합 반환
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".heic"]:
        ext = ".jpg"
    
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    saved_path = settings.UPLOAD_DIR / unique_filename

    # 파일 저장
    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 1. Vision 분석
    vision_task = analyze_wine_label(saved_path)
    label_info: WineLabelAnalysis = await vision_task

    # 2. 비비노 검색 (와인명이 추출된 경우)
    vivino_info = VivinoInfo()
    if label_info.wine_name and not label_info.wine_name.startswith("[API 키 미설정]"):
        vivino_info = await search_vivino(label_info.wine_name, label_info.vintage)

    return {
        "filename": unique_filename,
        "image_url": f"/uploads/{unique_filename}",
        "label": label_info.dict(),
        "vivino": vivino_info.dict()
    }


@app.get("/api/search-vivino")
async def search_vivino_endpoint(q: str = Query(..., min_length=1), vintage: Optional[str] = None):
    """와인명 수동 변경 시 비비노 재검색"""
    result = await search_vivino(q, vintage)
    return result.dict()


@app.post("/api/wines")
async def create_wine_entry(entry: WineEntryCreate):
    """
    와인 최종 기록 저장 (SQLite 저장 + 구글 드라이브 업로드 + 구글 시트 행 추가)
    """
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    drive_image_url = ""
    # 구글 드라이브 사진 업로드 시도 (이미지가 있는 경우)
    if entry.image_filename:
        local_img_path = settings.UPLOAD_DIR / entry.image_filename
        if local_img_path.exists():
            drive_url = upload_image_to_drive(local_img_path)
            if drive_url:
                drive_image_url = drive_url

    # 구글 시트 추가 시도
    entry_dict = entry.dict()
    entry_dict["created_at"] = now_iso
    entry_dict["drive_image_url"] = drive_image_url
    synced = append_wine_to_sheet(entry_dict, image_link=drive_image_url)

    # SQLite DB 저장
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO wine_logs (
        created_at, date, wine_name, vintage, producer, grape, region,
        wine_type, abv, vivino_rating, vivino_ratings_count, vivino_url,
        my_rating, my_notes, price, food, food_rating, food_notes,
        image_filename, drive_image_url, synced_to_sheets
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        now_iso, entry.date, entry.wine_name, entry.vintage, entry.producer,
        entry.grape, entry.region, entry.wine_type, entry.abv,
        entry.vivino_rating, entry.vivino_ratings_count, entry.vivino_url,
        entry.my_rating, entry.my_notes, entry.price,
        entry.food, entry.food_rating, entry.food_notes,
        entry.image_filename, drive_image_url, 1 if synced else 0
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "id": new_id,
        "synced_to_sheets": synced,
        "drive_image_url": drive_image_url
    }


@app.get("/api/wines")
def get_wine_entries(limit: int = 50, offset: int = 0):
    """와인 기록 목록 조회 (최신순)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM wine_logs ORDER BY id DESC LIMIT ? OFFSET ?",
        (limit, offset)
    )
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        d["image_url"] = f"/uploads/{d['image_filename']}" if d.get("image_filename") else ""
        d["synced_to_sheets"] = bool(d.get("synced_to_sheets"))
        results.append(d)

    return results


@app.delete("/api/wines/{wine_id}")
def delete_wine_entry(wine_id: int):
    """와인 기록 삭제"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM wine_logs WHERE id = ?", (wine_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": wine_id}
