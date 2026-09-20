# 🍷 와인 다이어리 (Wine Log) - 단독 모바일 웹앱

서버 호스팅(Render 등) 없이 브라우저(아이폰 Safari)에서 100% 독립 동작하는 초경량 모바일 와인 다이어리 웹앱입니다.

아이폰으로 와인 라벨 사진을 찍으면 **Gemini AI**가 와인 정보를 자동으로 추출하고, **비비노(Vivino)** 평점과 함께 나의 시음 노트, 안주 페어링, 가격을 기록하고 체계적으로 데이터베이스화하여 관리할 수 있습니다.

---

## ✨ 핵심 기능

1. **서버리스(Serverless) 0초 즉시 실행**
   - 백엔드 서버가 없어 슬립(절전 모드)이나 데이터 리셋 걱정이 전혀 없습니다.
   - 링크를 열자마자 0.01초 만에 실행됩니다.

2. **아이폰 영구 보존 데이터베이스 (IndexedDB)**
   - 와인 기록과 라벨 사진이 내 아이폰 내부 스토리지에 영구 보존됩니다.
   - 인터넷 연결이 없는 오프라인 상태에서도 기록과 사진을 언제든 열람할 수 있습니다.

3. **실시간 통합 검색 & 스마트 필터 & 정렬**
   - 🔍 **검색**: 와인 이름, 품종, 지역, 안주, 테이스팅 코멘트 실시간 키워드 검색
   - 🏷️ **필터**: [전체] [레드] [화이트] [스파클링] [로제] [기타] 칩 필터
   - 📊 **정렬**: 최신 등록순, 마신 날짜순, 내 평점순, 비비노 평점순, 가격순
   - 👁️ **뷰 전환**: 카드 갤러리 뷰 & 데이터베이스 테이블 뷰 지원

4. **AI 라벨 자동 인식 & 비비노 실시간 연동**
   - 📸 [즉시 사진 촬영] / [앨범에서 선택] 듀얼 버튼 지원
   - Gemini 2.5 Flash를 브라우저에서 직접 호출하여 와인명/도수/품종/생산자/지역 자동 입력
   - 비비노 공식 Algolia 검색 연동으로 평점, 리뷰 수, 와인 링크 자동 연동

5. **구글 스프레드시트 실시간 연동 (선택)**
   - Google Apps Script를 통해 와인을 기록할 때마다 내 구글 시트에 1행씩 실시간 자동 기록
   - PC나 아이패드 구글 드라이브에서도 누적된 와인 기록표 실시간 확인 가능

6. **원클릭 백업 & 엑셀(CSV) 다운로드**
   - 📥 **엑셀 저장**: 한글 깨짐 없는 UTF-8 BOM 인코딩 엑셀 CSV 파일 즉시 다운로드
   - 💾 **전체 백업/복원**: 기기를 바꾸더라도 JSON 백업 파일로 언제든 복원 가능

---

## 🚀 GitHub Pages 1분 무료 배포 방법

1. GitHub 저장소(`personalmatter/wine-log`) 상단 메뉴에서 **[Settings]** 클릭.
2. 좌측 메뉴에서 **[Pages]** 클릭.
3. **Build and deployment** 섹션의 **Branch** 설정을:
   - Branch: `main`
   - Folder: `/ (root)`
   - 로 선택한 후 **[Save]** 클릭.
4. 약 1분 후 배포가 완료되며, 화면 상단에 나만의 전용 웹앱 주소가 표시됩니다:
   - 🔗 `https://personalmatter.github.io/wine-log`
5. 아이폰 Safari로 해당 주소에 접속한 뒤, **[공유 버튼] → [홈 화면에 추가]**를 누르면 끝!

---

## 📊 구글 스프레드시트 1분 연동 방법

1. 내 구글 드라이브에서 새 **구글 스프레드시트**를 하나 만듭니다.
2. 상단 메뉴 **[확장 프로그램] → [Apps Script]**를 클릭합니다.
3. 코드 편집기에 아래 스크립트를 붙여넣고 저장(Ctrl+S)합니다:
```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var d = JSON.parse(e.postData.contents);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["기록일시","마신날짜","와인명","빈티지","생산자","품종","지역","종류","도수","비비노평점","비비노리뷰수","비비노링크","내평점","가격","코멘트","안주","안주평점","안주메모"]);
  }
  sheet.appendRow([d.created_at, d.date, d.wine_name, d.vintage, d.producer, d.grape, d.region, d.wine_type, d.abv, d.vivino_rating, d.vivino_ratings_count, d.vivino_url, d.my_rating, d.price, d.my_notes, d.food, d.food_rating, d.food_notes]);
  return ContentService.createTextOutput(JSON.stringify({result:"ok"})).setMimeType(ContentService.MimeType.JSON);
}
```
4. 우측 상단 **[배포] → [새 배포]**를 누르고,
   - 유형: **웹 앱(Web app)** 선택
   - 액세스 권한: **모든 사용자(Anyone)** 선택 후 **[배포]** 클릭!
5. 생성된 **웹 앱 URL**을 복사하여, 와인 웹앱 우측 상단 **⚙️ 설정**의 **[구글 시트 실시간 연동]** 칸에 붙여넣고 저장하면 완료됩니다!
