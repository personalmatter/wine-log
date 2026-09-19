import sqlite3
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.config import settings

class WineLabelAnalysis(BaseModel):
    """AI 라벨 분석 결과"""
    wine_name: str = Field(default="", description="와인 이름 (영문/한글)")
    vintage: str = Field(default="", description="빈티지 (연도 또는 NV)")
    producer: str = Field(default="", description="와이너리 또는 생산자")
    grape: str = Field(default="", description="주요 포도 품종")
    region: str = Field(default="", description="생산국 및 지역 (예: 프랑스, 보르도)")
    wine_type: str = Field(default="레드", description="와인 종류 (레드, 화이트, 스파클링, 로제, 디저트 등)")
    abv: str = Field(default="", description="알코올 도수 (예: 13.5%)")

class VivinoInfo(BaseModel):
    """비비노 검색 결과"""
    rating: Optional[float] = Field(default=None, description="비비노 평점")
    ratings_count: Optional[int] = Field(default=0, description="리뷰 수")
    vivino_url: Optional[str] = Field(default="", description="비비노 링크")
    thumb_url: Optional[str] = Field(default="", description="비비노 와인 이미지 링크")

class WineEntryCreate(BaseModel):
    """와인 기록 등록 요청"""
    date: str
    wine_name: str
    vintage: Optional[str] = ""
    producer: Optional[str] = ""
    grape: Optional[str] = ""
    region: Optional[str] = ""
    wine_type: Optional[str] = "레드"
    abv: Optional[str] = ""
    
    # 비비노
    vivino_rating: Optional[float] = None
    vivino_ratings_count: Optional[int] = 0
    vivino_url: Optional[str] = ""
    
    # 사용자 평가
    my_rating: Optional[float] = 0.0
    my_notes: Optional[str] = ""
    price: Optional[int] = 0
    food: Optional[str] = ""
    food_rating: Optional[float] = 0.0
    food_notes: Optional[str] = ""
    
    # 이미지
    image_filename: Optional[str] = ""

class WineEntry(WineEntryCreate):
    id: int
    created_at: str
    image_url: Optional[str] = ""
    drive_image_url: Optional[str] = ""
    synced_to_sheets: bool = False

def get_db():
    conn = sqlite3.connect(str(settings.DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS wine_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT,
        date TEXT,
        wine_name TEXT,
        vintage TEXT,
        producer TEXT,
        grape TEXT,
        region TEXT,
        wine_type TEXT,
        abv TEXT,
        vivino_rating REAL,
        vivino_ratings_count INTEGER,
        vivino_url TEXT,
        my_rating REAL,
        my_notes TEXT,
        price INTEGER,
        food TEXT,
        food_rating REAL,
        food_notes TEXT,
        image_filename TEXT,
        drive_image_url TEXT,
        synced_to_sheets INTEGER DEFAULT 0
    )
    """)
    conn.commit()
    conn.close()
