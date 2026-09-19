// ==========================================
// 와인 다이어리 (Wine Log) - 완전 단독 클라이언트 웹앱
// ==========================================

const DEFAULT_GEMINI_KEY = "";

// Vivino Algolia 공개 검색 키
const ALGOLIA_APP_ID = "9OJLYV9UOA";
const ALGOLIA_API_KEY = "a2a6136d856d390a7dae3609cb5799a7";
const ALGOLIA_INDEX = "Wines_production";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Vivino&x-algolia-application-id=${ALGOLIA_APP_ID}&x-algolia-api-key=${ALGOLIA_API_KEY}`;

// 상태 관리
let currentImageDataUrl = "";
let currentImageMime = "image/jpeg";
let myRating = 4.0;
let foodRating = 4.5;
let currentVivinoInfo = { rating: null, ratings_count: 0, vivino_url: "" };

let allWines = [];
let currentFilterType = "all";
let currentSearchQuery = "";
let currentSort = "created_desc";
let isTableView = false;

// ==========================================
// 1. IndexedDB 영구 데이터베이스 엔진
// ==========================================
class WineDB {
  constructor() {
    this.dbName = "WineDiaryAppDB";
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("wines")) {
          const store = db.createObjectStore("wines", { keyPath: "id", autoIncrement: true });
          store.createIndex("date", "date", { unique: false });
          store.createIndex("wine_name", "wine_name", { unique: false });
          store.createIndex("wine_type", "wine_type", { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error("IndexedDB open error:", e);
        reject(e);
      };
    });
  }

  async addWine(wine) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["wines"], "readwrite");
      const store = tx.objectStore("wines");
      const req = store.add(wine);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllWines() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["wines"], "readonly");
      const store = tx.objectStore("wines");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteWine(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["wines"], "readwrite");
      const store = tx.objectStore("wines");
      const req = store.delete(Number(id));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async importWines(winesList) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["wines"], "readwrite");
      const store = tx.objectStore("wines");
      for (const item of winesList) {
        delete item.id; // 신규 ID 생성되도록
        store.add(item);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
}

const wineDB = new WineDB();

// ==========================================
// 2. 초기화
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  initDate();
  initRatingStars("star-container-wine", "my-rating-display", (val) => { myRating = val; }, myRating);
  initRatingStars("star-container-food", "food-rating-display", (val) => { foodRating = val; }, foodRating);
  initTabs();
  initFileUpload();
  
  // IndexedDB 초기화 및 데이터 로드
  try {
    await wineDB.init();
    await loadWinesFromDB();
  } catch (err) {
    console.error("DB init failed:", err);
  }

  // 모달 키 세팅 & 배너 상태 점검
  checkApiKeyStatus();

  if (window.lucide) lucide.createIcons();
});

// API 키 가져오기 (localStorage 우선, 없으면 기본값)
function getGeminiApiKey() {
  return localStorage.getItem("gemini_api_key") || DEFAULT_GEMINI_KEY;
}

function checkApiKeyStatus() {
  const key = getGeminiApiKey();
  const alertBanner = document.getElementById("api-alert");
  const keyInput = document.getElementById("modal-gemini-key");

  if (keyInput) keyInput.value = key;

  if (alertBanner) {
    if (!key) {
      alertBanner.classList.remove("hidden");
    } else {
      alertBanner.classList.add("hidden");
    }
  }
}

function saveApiKeySetting() {
  const input = document.getElementById("modal-gemini-key");
  const val = input.value.trim();
  if (val) {
    localStorage.setItem("gemini_api_key", val);
    alert("Gemini API 키가 안전하게 저장되었습니다.");
  } else {
    localStorage.removeItem("gemini_api_key");
    alert("API 키가 삭제되었습니다.");
  }
  checkApiKeyStatus();
  closeSettingsModal();
}

// 오늘 날짜 세팅
function initDate() {
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("input-date");
  if (dateInput) dateInput.value = today;
}

// 탭 전환
function initTabs() {
  const btnRecord = document.getElementById("tab-btn-record");
  const btnLibrary = document.getElementById("tab-btn-library");
  const tabRecord = document.getElementById("tab-record");
  const tabLibrary = document.getElementById("tab-library");

  btnRecord.addEventListener("click", () => {
    tabRecord.classList.remove("hidden");
    tabLibrary.classList.add("hidden");
    btnRecord.classList.replace("text-stone-400", "text-wine-100");
    btnRecord.classList.add("bg-wine-800", "shadow");
    btnLibrary.classList.remove("bg-wine-800", "shadow", "text-wine-100");
    btnLibrary.classList.add("text-stone-400");
  });

  btnLibrary.addEventListener("click", () => {
    tabLibrary.classList.remove("hidden");
    tabRecord.classList.add("hidden");
    btnLibrary.classList.replace("text-stone-400", "text-wine-100");
    btnLibrary.classList.add("bg-wine-800", "shadow");
    btnRecord.classList.remove("bg-wine-800", "shadow", "text-wine-100");
    btnRecord.classList.add("text-stone-400");
    renderLibrary();
  });
}

// 별점 컴포넌트 렌더링
function initRatingStars(containerId, displayId, onRate, initialValue = 4.0) {
  const container = document.getElementById(containerId);
  const display = document.getElementById(displayId);
  if (!container || !display) return;

  function renderStars(currentScore) {
    container.innerHTML = "";
    display.textContent = `${currentScore.toFixed(1)} / 5.0`;

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("button");
      star.type = "button";
      star.className = "text-xl transition transform active:scale-125 focus:outline-none p-1";
      
      if (currentScore >= i) {
        star.textContent = "★";
        star.classList.add("text-amber-400");
      } else if (currentScore >= i - 0.5) {
        star.textContent = "★";
        star.classList.add("text-amber-400", "opacity-60");
      } else {
        star.textContent = "☆";
        star.classList.add("text-stone-600");
      }

      star.addEventListener("click", () => {
        let newScore = i;
        if (currentScore === i) {
          newScore = i - 0.5;
        }
        onRate(newScore);
        renderStars(newScore);
      });

      container.appendChild(star);
    }
  }

  renderStars(initialValue);
}

// ==========================================
// 3. 사진 업로드 & 이미지 압축 (Canvas)
// ==========================================
function initFileUpload() {
  const fileInputAlbum = document.getElementById("file-input-album");
  const fileInputCamera = document.getElementById("file-input-camera");

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
    e.target.value = "";
  };

  if (fileInputAlbum) fileInputAlbum.addEventListener("change", onFileChange);
  if (fileInputCamera) fileInputCamera.addEventListener("change", onFileChange);
}

// 고화질 사진을 웹 최적화 크기(최대 1200px)로 압축
async function compressImage(file, maxWidth = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// 사진 선택 시 처리
async function handleImageFile(file) {
  const uploadPlaceholder = document.getElementById("upload-placeholder");
  const previewContainer = document.getElementById("image-preview-container");
  const imagePreview = document.getElementById("image-preview");
  const analyzingOverlay = document.getElementById("analyzing-overlay");
  const analyzingText = document.getElementById("analyzing-text");

  // 1. 이미지 압축 및 미리보기
  analyzingText.textContent = "📸 사진 최적화 중...";
  uploadPlaceholder.classList.add("hidden");
  previewContainer.classList.remove("hidden");
  analyzingOverlay.classList.remove("hidden");

  try {
    currentImageDataUrl = await compressImage(file);
    currentImageMime = "image/jpeg";
    imagePreview.src = currentImageDataUrl;

    // 2. Gemini 2.5 Flash API 직접 호출
    analyzingText.textContent = "🍇 AI 라벨 인식 중...";
    const labelData = await callGeminiVision(currentImageDataUrl);

    if (labelData) {
      if (labelData.wine_name) document.getElementById("input-wine-name").value = labelData.wine_name;
      if (labelData.vintage) document.getElementById("input-vintage").value = labelData.vintage;
      if (labelData.producer) document.getElementById("input-producer").value = labelData.producer;
      if (labelData.grape) document.getElementById("input-grape").value = labelData.grape;
      if (labelData.region) document.getElementById("input-region").value = labelData.region;
      if (labelData.wine_type) document.getElementById("input-wine-type").value = labelData.wine_type;
      if (labelData.abv) document.getElementById("input-abv").value = labelData.abv;

      // 3. 비비노 평점 검색
      if (labelData.wine_name) {
        analyzingText.textContent = "🍷 비비노 평점 찾는 중...";
        const vivinoData = await searchVivinoDirect(labelData.wine_name, labelData.vintage);
        updateVivinoUI(vivinoData);
      }
    }
  } catch (err) {
    console.error("Analysis failed:", err);
    alert("라벨 분석 중 오류가 발생했습니다. 직접 입력해 주세요.");
  } finally {
    analyzingOverlay.classList.add("hidden");
    if (window.lucide) lucide.createIcons();
  }
}

// ==========================================
// 4. Gemini 2.5 Flash API 직접 호출
// ==========================================
async function callGeminiVision(dataUrl) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    alert("Gemini API 키가 등록되지 않았습니다.\n설정 창에서 발급받으신 API 키를 입력해 주세요.");
    openSettingsModal();
    return null;
  }

  const base64Data = dataUrl.split(",")[1];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `당신은 세계 최고의 소믈리에이자 와인 라벨 인식 전문가입니다.
첨부된 와인 라벨 사진을 정밀하게 분석하여 다음 JSON 형식으로만 응답해 주세요.

규칙:
1. wine_name: 와인의 정식 명칭 (가능하면 한글과 영문 병기 또는 가장 보편적인 이름).
2. vintage: 연도 4자리 (예: 2019) 또는 빈티지가 없으면 "NV".
3. producer: 와이너리 또는 생산자 이름.
4. grape: 주요 포도 품종 (예: 카베르네 소비뇽, 샤르도네 등).
5. region: 생산국 및 지역 (예: 프랑스, 보르도 / 미국, 나파 밸리).
6. wine_type: 레드, 화이트, 스파클링, 로제, 디저트, 주정강화 중 하나.
7. abv: 알코올 도수 (예: 13.5% 또는 알 수 없으면 빈 문자열).

반드시 유효한 JSON 문자열만 출력하세요. 마크다운 따옴표(\`\`\`json)는 포함하지 마세요.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 호출 실패 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON 파싱 에러:", text);
    return null;
  }
}

// ==========================================
// 5. Vivino Algolia Search API 직접 호출
// ==========================================
async function searchVivinoDirect(query, vintage = "") {
  let cleanQuery = query.replace(/\[.*?\]/g, "").trim();
  if (!cleanQuery) return { rating: null, ratings_count: 0, vivino_url: "" };

  let searchTerm = cleanQuery;
  if (vintage && /^\d{4}$/.test(vintage.trim())) {
    searchTerm += ` ${vintage.trim()}`;
  }

  const fallbackUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(searchTerm)}`;

  try {
    const payload = {
      requests: [
        {
          indexName: ALGOLIA_INDEX,
          params: `query=${encodeURIComponent(searchTerm)}&hitsPerPage=5`
        }
      ]
    };

    const resp = await fetch(ALGOLIA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      const data = await resp.json();
      const hits = data.results?.[0]?.hits || [];
      if (hits.length > 0) {
        const best = hits[0];
        const stats = best.statistics || {};
        const rating = stats.ratings_average ? Number(stats.ratings_average.toFixed(1)) : null;
        const ratingsCount = stats.ratings_count || 0;
        const wineId = best.id;
        const vivinoUrl = wineId ? `https://www.vivino.com/wines/${wineId}` : fallbackUrl;

        return {
          rating: rating,
          ratings_count: ratingsCount,
          vivino_url: vivinoUrl
        };
      }
    }
  } catch (err) {
    console.warn("비비노 검색 실패:", err);
  }

  return {
    rating: null,
    ratings_count: 0,
    vivino_url: fallbackUrl
  };
}

// 비비노 UI 업데이트
function updateVivinoUI(vivino) {
  currentVivinoInfo = vivino;
  const vivinoScore = document.getElementById("vivino-score");
  const vivinoLink = document.getElementById("vivino-link");

  if (vivino.rating) {
    vivinoScore.textContent = `★ ${vivino.rating}`;
    if (vivino.ratings_count) {
      vivinoScore.textContent += ` (${vivino.ratings_count.toLocaleString()})`;
    }
  } else {
    vivinoScore.textContent = "평점 없음";
  }

  if (vivino.vivino_url) {
    vivinoLink.href = vivino.vivino_url;
    vivinoLink.classList.remove("hidden");
  } else {
    vivinoLink.classList.add("hidden");
  }
}

// 와인명 직접 수정 후 비비노 수동 재검색
async function searchVivinoManually() {
  const wineName = document.getElementById("input-wine-name").value.trim();
  const vintage = document.getElementById("input-vintage").value.trim();
  if (!wineName) {
    alert("검색할 와인 이름을 입력하세요.");
    return;
  }

  const btn = document.getElementById("btn-re-vivino");
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<span class="animate-spin">🔄</span> 찾는 중...`;

  try {
    const vivinoData = await searchVivinoDirect(wineName, vintage);
    updateVivinoUI(vivinoData);
  } catch (e) {
    console.error(e);
  } finally {
    btn.innerHTML = originalHtml;
    if (window.lucide) lucide.createIcons();
  }
}

// ==========================================
// 6. 와인 기록 저장 (IndexedDB 영구 보존)
// ==========================================
async function saveWineRecord() {
  const wineName = document.getElementById("input-wine-name").value.trim();
  if (!wineName) {
    alert("와인 이름을 입력해 주세요.");
    document.getElementById("input-wine-name").focus();
    return;
  }

  const btnSave = document.getElementById("btn-save");
  btnSave.disabled = true;
  btnSave.innerHTML = `<span class="animate-spin">⏳</span> 내 폰에 영구 저장 중...`;

  const now = new Date();
  const wineEntry = {
    created_at: now.toISOString(),
    date: document.getElementById("input-date").value,
    wine_name: wineName,
    vintage: document.getElementById("input-vintage").value.trim(),
    producer: document.getElementById("input-producer").value.trim(),
    grape: document.getElementById("input-grape").value.trim(),
    region: document.getElementById("input-region").value.trim(),
    wine_type: document.getElementById("input-wine-type").value,
    abv: document.getElementById("input-abv").value.trim(),
    vivino_rating: currentVivinoInfo.rating,
    vivino_ratings_count: currentVivinoInfo.ratings_count,
    vivino_url: currentVivinoInfo.vivino_url,
    my_rating: myRating,
    my_notes: document.getElementById("input-my-notes").value.trim(),
    price: parseInt(document.getElementById("input-price").value) || 0,
    food: document.getElementById("input-food").value.trim(),
    food_rating: foodRating,
    food_notes: document.getElementById("input-food-notes").value.trim(),
    image_data: currentImageDataUrl // 압축된 사진 영구 보존
  };

  try {
    await wineDB.addWine(wineEntry);
    alert("🎉 와인 기록이 내 아이폰에 안전하게 영구 저장되었습니다!");

    resetForm();
    await loadWinesFromDB();

    // 갤러리 탭으로 자동 이동
    document.getElementById("tab-btn-library").click();
  } catch (err) {
    console.error("Save error:", err);
    alert("저장 중 오류가 발생했습니다: " + err.message);
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = `<i data-lucide="check" class="w-5 h-5"></i><span>와인 기록 저장하기</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

// 폼 초기화
function resetForm() {
  currentImageDataUrl = "";
  const fAlbum = document.getElementById("file-input-album");
  const fCamera = document.getElementById("file-input-camera");
  if (fAlbum) fAlbum.value = "";
  if (fCamera) fCamera.value = "";

  document.getElementById("upload-placeholder").classList.remove("hidden");
  document.getElementById("image-preview-container").classList.add("hidden");
  document.getElementById("image-preview").src = "";
  
  document.getElementById("input-wine-name").value = "";
  document.getElementById("input-vintage").value = "";
  document.getElementById("input-producer").value = "";
  document.getElementById("input-grape").value = "";
  document.getElementById("input-region").value = "";
  document.getElementById("input-abv").value = "";
  document.getElementById("input-price").value = "";
  document.getElementById("input-my-notes").value = "";
  document.getElementById("input-food").value = "";
  document.getElementById("input-food-notes").value = "";

  updateVivinoUI({ rating: null, ratings_count: 0, vivino_url: "" });
  initDate();
}

// ==========================================
// 7. 데이터베이스 조회, 검색, 필터, 정렬
// ==========================================
async function loadWinesFromDB() {
  allWines = await wineDB.getAllWines();
  document.getElementById("library-count").textContent = allWines.length;
  renderLibrary();
}

function onSearchChange() {
  const input = document.getElementById("search-input");
  currentSearchQuery = input.value.trim().toLowerCase();
  
  const clearBtn = document.getElementById("btn-clear-search");
  if (currentSearchQuery) {
    clearBtn.classList.remove("hidden");
  } else {
    clearBtn.classList.add("hidden");
  }
  renderLibrary();
}

function clearSearch() {
  document.getElementById("search-input").value = "";
  currentSearchQuery = "";
  document.getElementById("btn-clear-search").classList.add("hidden");
  renderLibrary();
}

function setFilterType(type, btnEl) {
  currentFilterType = type;
  document.querySelectorAll(".badge-chip").forEach(el => el.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  renderLibrary();
}

function onSortChange() {
  currentSort = document.getElementById("sort-select").value;
  renderLibrary();
}

function toggleViewMode() {
  isTableView = !isTableView;
  const cardList = document.getElementById("wine-card-list");
  const tableView = document.getElementById("wine-table-view");
  const viewIcon = document.getElementById("view-icon");

  if (isTableView) {
    cardList.classList.add("hidden");
    tableView.classList.remove("hidden");
    viewIcon.setAttribute("data-lucide", "table");
  } else {
    cardList.classList.remove("hidden");
    tableView.classList.add("hidden");
    viewIcon.setAttribute("data-lucide", "layout-grid");
  }
  if (window.lucide) lucide.createIcons();
  renderLibrary();
}

// 필터링 및 정렬 적용
function getFilteredAndSortedWines() {
  let list = [...allWines];

  // 1. 종류 필터
  if (currentFilterType !== "all") {
    if (currentFilterType === "기타") {
      const standards = ["레드", "화이트", "스파클링", "로제"];
      list = list.filter(w => !standards.includes(w.wine_type));
    } else {
      list = list.filter(w => w.wine_type === currentFilterType);
    }
  }

  // 2. 검색어 필터
  if (currentSearchQuery) {
    list = list.filter(w => {
      const searchTarget = [
        w.wine_name,
        w.vintage,
        w.producer,
        w.grape,
        w.region,
        w.food,
        w.my_notes,
        w.food_notes
      ].filter(Boolean).join(" ").toLowerCase();

      return searchTarget.includes(currentSearchQuery);
    });
  }

  // 3. 정렬
  list.sort((a, b) => {
    switch (currentSort) {
      case "date_desc":
        return (b.date || "").localeCompare(a.date || "") || (b.id - a.id);
      case "my_rating_desc":
        return (b.my_rating || 0) - (a.my_rating || 0);
      case "vivino_rating_desc":
        return (b.vivino_rating || 0) - (a.vivino_rating || 0);
      case "price_desc":
        return (b.price || 0) - (a.price || 0);
      case "price_asc":
        return (a.price || 0) - (b.price || 0);
      case "created_desc":
      default:
        return (b.id || 0) - (a.id || 0);
    }
  });

  return list;
}

// 화면 렌더링
function renderLibrary() {
  const filtered = getFilteredAndSortedWines();
  document.getElementById("filtered-count").textContent = filtered.length;

  const cardContainer = document.getElementById("wine-card-list");
  const tableBody = document.getElementById("wine-table-body");

  if (filtered.length === 0) {
    const emptyMsg = `
      <div class="p-8 text-center bg-stone-900/60 rounded-2xl border border-stone-800 space-y-2">
        <p class="text-3xl">🍷</p>
        <p class="text-sm font-semibold text-stone-300">
          ${allWines.length === 0 ? "아직 등록된 와인이 없습니다." : "검색 조건에 맞는 와인이 없습니다."}
        </p>
        <p class="text-xs text-stone-500">
          ${allWines.length === 0 ? "라벨 사진을 찍고 첫 와인을 기록해 보세요!" : "검색어나 필터를 변경해 보세요."}
        </p>
      </div>
    `;
    cardContainer.innerHTML = emptyMsg;
    tableBody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-stone-500">조건에 맞는 와인이 없습니다.</td></tr>`;
    return;
  }

  // 1. 카드 뷰 렌더링
  cardContainer.innerHTML = filtered.map(w => {
    const priceText = w.price ? `${w.price.toLocaleString()}원` : "";
    const vivinoBadge = w.vivino_rating ? `
      <span class="text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800/60 px-1.5 py-0.5 rounded">
        Vivino ★${w.vivino_rating}
      </span>
    ` : "";

    const imgTag = w.image_data ? `
      <div class="w-20 h-24 bg-stone-950 rounded-xl overflow-hidden shrink-0 border border-stone-800">
        <img src="${w.image_data}" alt="${w.wine_name}" class="w-full h-full object-cover">
      </div>
    ` : `
      <div class="w-20 h-24 bg-stone-950 rounded-xl flex items-center justify-center shrink-0 text-stone-700 text-2xl border border-stone-800">
        🍷
      </div>
    `;

    return `
      <div class="bg-stone-900 border border-stone-800 rounded-2xl p-3.5 shadow-md flex gap-3 relative">
        ${imgTag}
        <div class="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="text-[11px] text-stone-400">${w.date} · ${w.wine_type || '와인'}</span>
              <div class="flex items-center gap-1">
                ${vivinoBadge}
              </div>
            </div>
            
            <h4 class="font-bold text-sm text-stone-100 truncate">${w.wine_name}</h4>
            <p class="text-[11px] text-stone-400 truncate">
              ${[w.vintage, w.producer, w.region].filter(Boolean).join(" · ")}
            </p>
          </div>

          <div class="mt-2 pt-2 border-t border-stone-800/80 space-y-1">
            <div class="flex items-center justify-between text-xs">
              <span class="text-amber-400 font-semibold">내 평점 ★ ${w.my_rating || 0}</span>
              ${priceText ? `<span class="text-stone-300 font-medium">${priceText}</span>` : ""}
            </div>

            ${w.food ? `
              <div class="text-[11px] text-stone-300 flex items-center justify-between">
                <span class="truncate">🧀 ${w.food}</span>
                <span class="text-amber-400/90 font-medium shrink-0 ml-1">★ ${w.food_rating || 0}</span>
              </div>
            ` : ""}

            ${w.my_notes ? `
              <p class="text-[11px] text-stone-400 line-clamp-2 italic bg-stone-950/50 p-1.5 rounded-lg mt-1">
                "${w.my_notes}"
              </p>
            ` : ""}
          </div>
        </div>

        <!-- 삭제 버튼 -->
        <button onclick="deleteWineRecord(${w.id})" class="absolute top-2 right-2 text-stone-600 hover:text-rose-400 p-1 transition" title="삭제">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
  }).join("");

  // 2. 테이블 뷰 렌더링
  tableBody.innerHTML = filtered.map(w => `
    <tr class="hover:bg-stone-800/40">
      <td class="py-2 px-2 whitespace-nowrap text-[11px] text-stone-400">${w.date}</td>
      <td class="py-2 px-2 font-medium text-stone-100 max-w-[120px] truncate" title="${w.wine_name}">
        ${w.wine_name}
        <div class="text-[10px] text-stone-500">${w.wine_type || ''}</div>
      </td>
      <td class="py-2 px-2 whitespace-nowrap text-amber-400 font-semibold">★ ${w.my_rating || '-'}</td>
      <td class="py-2 px-2 whitespace-nowrap text-rose-300 text-[11px]">${w.vivino_rating ? '★ ' + w.vivino_rating : '-'}</td>
      <td class="py-2 px-2 whitespace-nowrap text-stone-300 text-[11px]">${w.price ? w.price.toLocaleString() + '원' : '-'}</td>
      <td class="py-2 px-2 max-w-[80px] truncate text-[11px] text-stone-400">${w.food || '-'}</td>
      <td class="py-2 px-1 text-center">
        <button onclick="deleteWineRecord(${w.id})" class="text-stone-600 hover:text-rose-400 p-1">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </td>
    </tr>
  `).join("");

  if (window.lucide) lucide.createIcons();
}

// 와인 삭제
async function deleteWineRecord(id) {
  if (!confirm("이 와인 기록을 영구 삭제하시겠습니까?")) return;
  try {
    await wineDB.deleteWine(id);
    await loadWinesFromDB();
  } catch (e) {
    console.error(e);
    alert("삭제 중 오류가 발생했습니다.");
  }
}

// ==========================================
// 8. 엑셀(CSV) 다운로드 (한글 UTF-8 BOM)
// ==========================================
function exportToCSV() {
  if (allWines.length === 0) {
    alert("내보낼 와인 기록이 없습니다.");
    return;
  }

  const headers = [
    "ID", "등록일시", "마신날짜", "와인명", "빈티지", "와이너리/생산자",
    "품종", "국가/지역", "와인종류", "도수",
    "비비노평점", "비비노리뷰수", "비비노링크",
    "내평점", "구입가격(원)", "시음코멘트",
    "페어링안주", "안주평점", "안주메모"
  ];

  const rows = allWines.map(w => [
    w.id,
    w.created_at || "",
    w.date || "",
    escapeCSV(w.wine_name),
    escapeCSV(w.vintage),
    escapeCSV(w.producer),
    escapeCSV(w.grape),
    escapeCSV(w.region),
    escapeCSV(w.wine_type),
    escapeCSV(w.abv),
    w.vivino_rating || "",
    w.vivino_ratings_count || 0,
    w.vivino_url || "",
    w.my_rating || "",
    w.price || 0,
    escapeCSV(w.my_notes),
    escapeCSV(w.food),
    w.food_rating || "",
    escapeCSV(w.food_notes)
  ]);

  const csvContent = "\ufeff" + [
    headers.join(","),
    ...rows.map(r => r.join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const todayStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
  a.href = url;
  a.download = `와인다이어리_${todayStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCSV(str) {
  if (!str) return '""';
  const stringVal = String(str).replace(/"/g, '""');
  return `"${stringVal}"`;
}

// ==========================================
// 9. 전체 데이터 백업 & 복원 (JSON)
// ==========================================
function exportBackupJSON() {
  if (allWines.length === 0) {
    alert("백업할 와인 데이터가 없습니다.");
    return;
  }

  const backupData = {
    version: 1,
    exported_at: new Date().toISOString(),
    wines: allWines
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const todayStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
  a.href = url;
  a.download = `wine_log_backup_${todayStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importBackupJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const list = data.wines || (Array.isArray(data) ? data : null);

      if (!list || !Array.isArray(list) || list.length === 0) {
        alert("유효한 백업 파일이 아닙니다.");
        return;
      }

      if (confirm(`${list.length}개의 와인 기록을 복원하시겠습니까?`)) {
        await wineDB.importWines(list);
        await loadWinesFromDB();
        alert("성공적으로 복원되었습니다!");
        closeSettingsModal();
      }
    } catch (err) {
      console.error(err);
      alert("백업 파일 읽기 실패: 올바른 JSON 파일인지 확인하세요.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

// ==========================================
// 10. 모달 제어
// ==========================================
function openSettingsModal() {
  document.getElementById("settings-modal").classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("settings-modal").classList.add("hidden");
}
