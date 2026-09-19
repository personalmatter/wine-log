from fastapi.testclient import TestClient
from app.main import app
from app.models import init_db

client = TestClient(app)

def setup_module():
    init_db()

def test_status_endpoint():
    resp = client.get("/api/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "gemini_configured" in data
    assert "google_sheets_configured" in data

def test_vivino_search_endpoint():
    resp = client.get("/api/search-vivino?q=Chateau+Margaux&vintage=2015")
    assert resp.status_code == 200
    data = resp.json()
    assert data["rating"] is not None
    assert data["rating"] >= 4.0
    assert "vivino.com" in data["vivino_url"]

def test_create_and_get_wine():
    sample_wine = {
        "date": "2026-09-19",
        "wine_name": "샤또 마고 2015",
        "vintage": "2015",
        "producer": "Chateau Margaux",
        "grape": "카베르네 소비뇽",
        "region": "프랑스 보르도",
        "wine_type": "레드",
        "abv": "13.5%",
        "vivino_rating": 4.6,
        "vivino_ratings_count": 1924,
        "vivino_url": "https://www.vivino.com/wines/160100465",
        "my_rating": 4.8,
        "my_notes": "매우 우아하고 벨벳 같은 탄닌감, 긴 여운.",
        "price": 1200000,
        "food": "한우 안심 스테이크",
        "food_rating": 5.0,
        "food_notes": "완벽한 마리아주",
        "image_filename": ""
    }

    # 1. 저장 테스트
    resp = client.post("/api/wines", json=sample_wine)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["status"] == "success"
    wine_id = res_data["id"]

    # 2. 목록 조회 테스트
    resp = client.get("/api/wines")
    assert resp.status_code == 200
    wines = resp.json()
    assert len(wines) > 0
    saved = next((w for w in wines if w["id"] == wine_id), None)
    assert saved is not None
    assert saved["wine_name"] == "샤또 마고 2015"
    assert saved["my_rating"] == 4.8
    assert saved["food"] == "한우 안심 스테이크"
    assert saved["price"] == 1200000

    # 3. 삭제 테스트
    del_resp = client.delete(f"/api/wines/{wine_id}")
    assert del_resp.status_code == 200

    # 삭제 확인
    resp_after = client.get("/api/wines")
    wines_after = resp_after.json()
    assert not any(w["id"] == wine_id for w in wines_after)

if __name__ == "__main__":
    test_status_endpoint()
    test_vivino_search_endpoint()
    test_create_and_get_wine()
    print("ALL API TESTS PASSED SUCCESSFULLY!")
