import logging
import re
import urllib.parse
from typing import Optional
import httpx
from app.models import VivinoInfo

logger = logging.getLogger(__name__)

# 비비노 공식 Algolia Search API 설정 (공개 search-only 키)
ALGOLIA_APP_ID = "9OJLYV9UOA"
ALGOLIA_API_KEY = "a2a6136d856d390a7dae3609cb5799a7"
ALGOLIA_INDEX = "Wines_production"
ALGOLIA_URL = (
    f"https://{ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries?"
    f"x-algolia-agent=Vivino&x-algolia-application-id={ALGOLIA_APP_ID}&x-algolia-api-key={ALGOLIA_API_KEY}"
)

async def search_vivino(query: str, vintage: Optional[str] = None) -> VivinoInfo:
    """
    와인명(+빈티지)으로 비비노 실시간 검색
    1. 비비노 공식 Algolia Search API를 호출하여 0.1초 내에 가장 정확한 평점, 리뷰 수, 썸네일 획득
    2. 와인 상세 URL 구성 (https://www.vivino.com/wines/{wine_id})
    3. 실패 시 기본 비비노 웹 검색 링크 fallback
    """
    clean_query = query.strip()
    if "[" in clean_query and "]" in clean_query:
        clean_query = re.sub(r"\[.*?\]", "", clean_query).strip()

    if not clean_query:
        return VivinoInfo()

    search_term = f"{clean_query} {vintage}".strip() if vintage and str(vintage).isdigit() else clean_query
    fallback_url = f"https://www.vivino.com/search/wines?q={urllib.parse.quote(search_term)}"

    try:
        payload = {
            "requests": [
                {
                    "indexName": ALGOLIA_INDEX,
                    "params": f"query={urllib.parse.quote(search_term)}&hitsPerPage=5"
                }
            ]
        }

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(ALGOLIA_URL, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                hits = data.get("results", [{}])[0].get("hits", [])
                if hits:
                    best = hits[0]
                    stats = best.get("statistics", {})
                    rating_avg = stats.get("ratings_average")
                    rating_cnt = stats.get("ratings_count", 0)
                    wine_id = best.get("id")

                    thumb = best.get("thumb", "")
                    if thumb and thumb.startswith("//"):
                        thumb = f"https:{thumb}"

                    vivino_url = f"https://www.vivino.com/wines/{wine_id}" if wine_id else fallback_url

                    return VivinoInfo(
                        rating=round(float(rating_avg), 1) if rating_avg else None,
                        ratings_count=int(rating_cnt) if rating_cnt else 0,
                        vivino_url=vivino_url,
                        thumb_url=thumb
                    )

    except Exception as e:
        logger.warning(f"비비노 Algolia 검색 오류: {e}")

    return VivinoInfo(
        rating=None,
        ratings_count=0,
        vivino_url=fallback_url,
        thumb_url=""
    )
