# 🌐 와인 다이어리 24시간 무료 클라우드 배포 가이드

Mac을 켜두지 않아도 **외부(와인바, 레스토랑 등)에서 24시간 언제든지 아이폰으로 접속**할 수 있도록, **완전 무료 클라우드 호스팅(Render)**에 배포하는 3분 가이드입니다.

---

## 1단계: GitHub에 코드 올리기

1. [GitHub](https://github.com)에 로그인 후, 우측 상단 **[+] > 'New repository'**를 클릭하여 빈 저장소를 만듭니다 (예: `wine-log`).
2. 터미널에서 아래 명령어로 코드를 GitHub에 푸시합니다:

```bash
cd "/Users/gs/Library/CloudStorage/GoogleDrive-personalmatter.son@gmail.com/내 드라이브/GS/wine"

# 본인의 GitHub 주소로 변경하여 실행하세요
git remote add origin https://github.com/[내깃허브아이디]/wine-log.git
git push -u origin main
```

---

## 2단계: Render 무료 클라우드에 연결하기

1. **[Render.com](https://render.com)**에 접속하여 GitHub 계정으로 간편 로그인합니다 (신용카드 등록 불필요).
2. 대시보드 우측 상단 **[New +] > 'Web Service'**를 클릭합니다.
3. 방금 올린 **`wine-log`** 레포지토리를 선택하고 **[Connect]**를 누릅니다.
4. 설정 화면:
   - **Name**: 원하는 이름 (예: `my-wine-diary`)
   - **Region**: `Singapore` (한국에서 접속 속도가 가장 빠릅니다)
   - **Instance Type**: **Free (무료)** 선택
5. **Environment Variables (환경 변수)** 섹션에 다음을 추가합니다:
   - `GEMINI_API_KEY`: Google AI Studio에서 발급받은 API 키
   - `GOOGLE_SHEET_NAME`: `와인 기록장`
6. 하단의 **[Create Web Service]** 버튼을 클릭하면 약 1~2분 후 배포가 완료됩니다!

---

## 3단계: 아이폰에서 24시간 앱으로 등록하기

배포가 완료되면 Render 화면 상단에 나만의 고유 주소가 생성됩니다:
> 예: `https://my-wine-diary.onrender.com`

1. **아이폰 사파리(Safari)**를 열고 위 주소로 접속합니다.
2. 하단 중앙의 **[공유 버튼]** (네모에 위 화살표) 클릭
3. **[홈 화면에 추가]** 터치 후 **[추가]**

이제 Mac을 끄거나 외출하더라도, **아이폰 홈 화면에서 와인 앱을 터치하면 언제 어디서든 바로 실행**됩니다! 🍷
