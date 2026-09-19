// 상태 관리
let currentImageFilename = "";
let myRating = 4.0;
let foodRating = 4.5;
let currentVivinoInfo = { rating: null, ratings_count: 0, vivino_url: "" };

// 초기화
document.addEventListener("DOMContentLoaded", () => {
  initDate();
  initRatingStars("star-container-wine", "my-rating-display", (val) => { myRating = val; }, myRating);
  initRatingStars("star-container-food", "food-rating-display", (val) => { foodRating = val; }, foodRating);
  initTabs();
  initFileUpload();
  checkStatus();
  loadWineLibrary();
});

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
    loadWineLibrary();
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
        // 같은 별을 다시 누르면 .5 단위 토글 또는 다음 별
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

// 사진 업로드 및 AI 분석
function initFileUpload() {
  const fileInput = document.getElementById("file-input");
  const uploadPlaceholder = document.getElementById("upload-placeholder");
  const previewContainer = document.getElementById("image-preview-container");
  const imagePreview = document.getElementById("image-preview");
  const analyzingOverlay = document.getElementById("analyzing-overlay");

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. 로컬 미리보기 표시
    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      uploadPlaceholder.classList.add("hidden");
      previewContainer.classList.remove("hidden");
      analyzingOverlay.classList.remove("hidden");
    };
    reader.readAsDataURL(file);

    // 2. 백엔드로 사진 전송하여 라벨 분석 + 비비노 검색
    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch("/api/analyze-label", {
        method: "POST",
        body: formData
      });

      if (!resp.ok) throw new Error("분석 요청 실패");
      const data = await resp.json();

      currentImageFilename = data.filename;

      // 폼 필드 채우기
      if (data.label) {
        if (data.label.wine_name) document.getElementById("input-wine-name").value = data.label.wine_name;
        if (data.label.vintage) document.getElementById("input-vintage").value = data.label.vintage;
        if (data.label.producer) document.getElementById("input-producer").value = data.label.producer;
        if (data.label.grape) document.getElementById("input-grape").value = data.label.grape;
        if (data.label.region) document.getElementById("input-region").value = data.label.region;
        if (data.label.wine_type) document.getElementById("input-wine-type").value = data.label.wine_type;
        if (data.label.abv) document.getElementById("input-abv").value = data.label.abv;
      }

      // 비비노 정보 갱신
      if (data.vivino) {
        updateVivinoUI(data.vivino);
      }

    } catch (err) {
      console.error(err);
      alert("라벨 분석 중 오류가 발생했습니다. 직접 입력해 주세요.");
    } finally {
      analyzingOverlay.classList.add("hidden");
      if (window.lucide) lucide.createIcons();
    }
  });
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
    const url = `/api/search-vivino?q=${encodeURIComponent(wineName)}&vintage=${encodeURIComponent(vintage)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    updateVivinoUI(data);
  } catch (e) {
    console.error(e);
  } finally {
    btn.innerHTML = originalHtml;
    if (window.lucide) lucide.createIcons();
  }
}

// 와인 기록 저장
async function saveWineLog() {
  const wineName = document.getElementById("input-wine-name").value.trim();
  if (!wineName) {
    alert("와인 이름을 입력해 주세요.");
    document.getElementById("input-wine-name").focus();
    return;
  }

  const btnSave = document.getElementById("btn-save");
  btnSave.disabled = true;
  btnSave.innerHTML = `<span class="animate-spin">⏳</span> 저장 및 동기화 중...`;

  const payload = {
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
    image_filename: currentImageFilename
  };

  try {
    const resp = await fetch("/api/wines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) throw new Error("저장 실패");
    const resData = await resp.json();

    let msg = "🎉 와인 기록이 성공적으로 저장되었습니다!";
    if (resData.synced_to_sheets) {
      msg += "\n📊 구글 시트에도 동기화되었습니다.";
    }
    alert(msg);

    // 폼 초기화
    resetForm();

    // 갤러리 탭으로 전환
    document.getElementById("tab-btn-library").click();

  } catch (err) {
    console.error(err);
    alert("저장 중 오류가 발생했습니다.");
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = `<i data-lucide="check" class="w-5 h-5"></i><span>와인 기록 저장하기</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

// 폼 초기화
function resetForm() {
  currentImageFilename = "";
  document.getElementById("file-input").value = "";
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

// 와인 서고 목록 불러오기
async function loadWineLibrary() {
  const container = document.getElementById("wine-card-list");
  const countSpan = document.getElementById("library-count");

  try {
    const resp = await fetch("/api/wines");
    const wines = await resp.json();

    countSpan.textContent = wines.length;

    if (wines.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center bg-stone-900/60 rounded-2xl border border-stone-800 space-y-2">
          <p class="text-3xl">🍷</p>
          <p class="text-sm font-semibold text-stone-300">아직 등록된 와인이 없습니다.</p>
          <p class="text-xs text-stone-500">라벨 사진을 찍고 첫 와인을 기록해 보세요!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = wines.map(w => {
      const priceText = w.price ? `${w.price.toLocaleString()}원` : "";
      const vivinoBadge = w.vivino_rating ? `
        <span class="text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800/60 px-1.5 py-0.5 rounded">
          Vivino ★${w.vivino_rating}
        </span>
      ` : "";

      const sheetBadge = w.synced_to_sheets ? `
        <span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded">
          시트 연동됨
        </span>
      ` : "";

      const imgTag = w.image_url ? `
        <div class="w-20 h-24 bg-stone-950 rounded-xl overflow-hidden shrink-0 border border-stone-800">
          <img src="${w.image_url}" alt="${w.wine_name}" class="w-full h-full object-cover">
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
                  ${sheetBadge}
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
          <button onclick="deleteWine(${w.id})" class="absolute top-2 right-2 text-stone-600 hover:text-rose-400 p-1 transition" title="삭제">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
    }).join("");

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error(err);
  }
}

// 와인 삭제
async function deleteWine(id) {
  if (!confirm("이 와인 기록을 삭제하시겠습니까?")) return;
  try {
    await fetch(`/api/wines/${id}`, { method: "DELETE" });
    loadWineLibrary();
  } catch (e) {
    console.error(e);
  }
}

// 설정 상태 확인
async function checkStatus() {
  try {
    const resp = await fetch("/api/status");
    const data = await resp.json();

    const alertBox = document.getElementById("api-alert");
    if (!data.gemini_configured) {
      alertBox.classList.remove("hidden");
    } else {
      alertBox.classList.add("hidden");
    }

    const badge = document.getElementById("status-sheet-badge");
    const nameEl = document.getElementById("status-sheet-name");
    if (data.google_sheets_configured) {
      badge.textContent = "연결됨 (활성)";
      badge.className = "font-semibold text-emerald-400";
    } else {
      badge.textContent = "미설정 (로컬 DB에만 저장됨)";
      badge.className = "font-semibold text-stone-500";
    }
    nameEl.textContent = data.sheet_name;

  } catch (e) {
    console.error(e);
  }
}

// 모달 제어
function openSettingsModal() {
  document.getElementById("settings-modal").classList.remove("hidden");
  checkStatus();
}

function closeSettingsModal() {
  document.getElementById("settings-modal").classList.add("hidden");
}

document.getElementById("btn-settings").addEventListener("click", openSettingsModal);

// 설정 저장
async function saveSettings() {
  const geminiKey = document.getElementById("modal-gemini-key").value.trim();
  const formData = new FormData();
  if (geminiKey) formData.append("gemini_api_key", geminiKey);

  try {
    const resp = await fetch("/api/settings", {
      method: "POST",
      body: formData
    });
    const res = await resp.json();
    alert("설정이 저장되었습니다.");
    closeSettingsModal();
    checkStatus();
  } catch (e) {
    console.error(e);
    alert("설정 저장 실패");
  }
}
