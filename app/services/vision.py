import base64
import json
import logging
from pathlib import Path
import httpx
from app.config import settings
from app.models import WineLabelAnalysis

logger = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

PROMPT = """
이 사진은 와인 병 또는 와인 라벨입니다.
사진에서 와인에 관한 정보를 최대한 정확하게 읽어내어 JSON 형식으로 반환해 주세요.
반드시 아래 JSON 스키마를 준수해야 하며, 한국어로 번역/표기할 수 있는 부분은 한국어(필요시 원문 병기)로 작성해 주세요.
확인하기 어려운 항목은 빈 문자열("")로 남겨두세요.

{
  "wine_name": "와인 정식 명칭 (예: 샤또 딸보 / Chateau Talbot)",
  "vintage": "생산 연도 (예: 2018 또는 빈티지 없는 경우 NV)",
  "producer": "와이너리 또는 생산자 (예: Chateau Talbot)",
  "grape": "주요 포도 품종 (예: 카베르네 소비뇽, 메를로)",
  "region": "국가 및 생산 지역 (예: 프랑스, 보르도, 생쥘리앙)",
  "wine_type": "와인 종류 중 하나: 레드, 화이트, 스파클링, 로제, 디저트, 주정강화",
  "abv": "알코올 도수 (예: 13.5%)"
}
"""

async def analyze_wine_label(image_path: Path) -> WineLabelAnalysis:
    """Gemini API를 사용하여 와인 라벨 이미지 분석"""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.warning("GEMINI_API_KEY가 설정되지 않았습니다.")
        return WineLabelAnalysis(
            wine_name="[API 키 미설정] 와인명을 직접 입력하세요",
            vintage="",
            producer="",
            grape="",
            region="",
            wine_type="레드",
            abv=""
        )

    try:
        # 이미지 읽기 및 base64 인코딩
        with open(image_path, "rb") as f:
            image_bytes = f.read()
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        # 확장자에 따른 mime type
        ext = image_path.suffix.lower()
        mime_type = "image/jpeg"
        if ext == ".png":
            mime_type = "image/png"
        elif ext == ".webp":
            mime_type = "image/webp"
        elif ext == ".heic":
            mime_type = "image/heic"

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": PROMPT},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": image_b64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.2
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{GEMINI_API_URL}?key={api_key}",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            resp.raise_for_status()
            data = resp.json()

            # 응답 텍스트 추출
            candidates = data.get("candidates", [])
            if not candidates:
                logger.error("Gemini API에서 후보 응답이 없습니다.")
                return WineLabelAnalysis()

            text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
            parsed_json = json.loads(text_content)

            return WineLabelAnalysis(
                wine_name=parsed_json.get("wine_name", ""),
                vintage=str(parsed_json.get("vintage", "")),
                producer=parsed_json.get("producer", ""),
                grape=parsed_json.get("grape", ""),
                region=parsed_json.get("region", ""),
                wine_type=parsed_json.get("wine_type", "레드"),
                abv=parsed_json.get("abv", "")
            )

    except Exception as e:
        logger.error(f"라벨 분석 중 오류 발생: {e}")
        return WineLabelAnalysis(
            wine_name="라벨 인식 실패 (수동 입력 필요)",
            vintage="",
            producer="",
            grape="",
            region="",
            wine_type="레드",
            abv=""
        )
