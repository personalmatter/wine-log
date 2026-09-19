import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

# 구글 시트 헤더 목록
SHEET_HEADERS = [
    "기록일시", "마신날짜", "와인명", "빈티지", "생산자",
    "품종", "지역", "와인종류", "도수", "비비노평점",
    "비비노링크", "내평점", "구입가격(원)", "시음코멘트",
    "페어링안주", "안주평점", "안주메모", "라벨사진링크"
]

def get_sheets_client():
    """구글 시트 인증 클라이언트 생성 (인증 파일 존재 시)"""
    sa_file = settings.GOOGLE_SERVICE_ACCOUNT_FILE
    if not sa_file or not os.path.exists(sa_file):
        return None
    try:
        import gspread
        from google.oauth2.service_account import Credentials
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        creds = Credentials.from_service_account_file(sa_file, scopes=scopes)
        client = gspread.authorize(creds)
        return client
    except Exception as e:
        logger.error(f"구글 시트 인증 실패: {e}")
        return None

def upload_image_to_drive(image_path: Path) -> Optional[str]:
    """구글 드라이브 폴더에 이미지 업로드 후 공유 링크 반환"""
    sa_file = settings.GOOGLE_SERVICE_ACCOUNT_FILE
    folder_id = settings.GOOGLE_DRIVE_FOLDER_ID
    if not sa_file or not os.path.exists(sa_file) or not folder_id:
        return None

    try:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
        from google.oauth2.service_account import Credentials

        creds = Credentials.from_service_account_file(
            sa_file,
            scopes=["https://www.googleapis.com/auth/drive"]
        )
        drive_service = build("drive", "v3", credentials=creds)

        file_metadata = {
            "name": image_path.name,
            "parents": [folder_id]
        }
        media = MediaFileUpload(str(image_path), resumable=True)
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, webViewLink"
        ).execute()

        # 읽기 권한 추가 (누구나 링크로 보기)
        permission = {"type": "anyone", "role": "reader"}
        drive_service.permissions().create(fileId=file.get("id"), body=permission).execute()

        return file.get("webViewLink")
    except Exception as e:
        logger.error(f"구글 드라이브 업로드 실패: {e}")
        return None

def append_wine_to_sheet(entry: Dict[str, Any], image_link: str = "") -> bool:
    """구글 시트에 와인 기록 추가"""
    client = get_sheets_client()
    if not client:
        logger.info("구글 연동 설정이 되어있지 않아 시트 추가를 건너뜁니다.")
        return False

    try:
        # 스프레드시트 열기
        sheet_name = settings.GOOGLE_SHEET_NAME
        try:
            spreadsheet = client.open(sheet_name)
        except Exception:
            # 시트가 없으면 새로 생성
            spreadsheet = client.create(sheet_name)
            logger.info(f"새 스프레드시트 생성: {sheet_name}")

        worksheet = spreadsheet.sheet1

        # 헤더 확인 및 추가
        existing_values = worksheet.row_values(1)
        if not existing_values:
            worksheet.append_row(SHEET_HEADERS)

        # 행 데이터 조립
        row = [
            entry.get("created_at", ""),
            entry.get("date", ""),
            entry.get("wine_name", ""),
            entry.get("vintage", ""),
            entry.get("producer", ""),
            entry.get("grape", ""),
            entry.get("region", ""),
            entry.get("wine_type", ""),
            entry.get("abv", ""),
            entry.get("vivino_rating", "") or "",
            entry.get("vivino_url", "") or "",
            entry.get("my_rating", 0),
            entry.get("price", 0),
            entry.get("my_notes", ""),
            entry.get("food", ""),
            entry.get("food_rating", 0),
            entry.get("food_notes", ""),
            image_link or entry.get("drive_image_url", "") or ""
        ]

        worksheet.append_row(row)
        logger.info(f"구글 시트에 성공적으로 추가되었습니다: {entry.get('wine_name')}")
        return True
    except Exception as e:
        logger.error(f"구글 시트 기록 추가 실패: {e}")
        return False
