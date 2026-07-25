import { getInstaRecords, getSettings } from "./api.js";

const currentWeekLabel = document.querySelector("#current-week-label");
const prevWeekButton = document.querySelector("#prev-week-button");
const nextWeekButton = document.querySelector("#next-week-button");
const instaSearchInput = document.querySelector("#insta-search");
const instaList = document.querySelector("#insta-list");

let selectedWeek = 1;
let searchTerm = "";
let requestId = 0;

const SYNONYM_GROUPS = [
  ["つぶし粥", "つぶしがゆ", "5倍がゆ", "10倍がゆ"],
  // 他にも表記ゆれがあれば配列を追加してください。例:
  // ["しらす", "しらす干し"],
];

function expandSearchTerms(term) {
  const matchedGroup = SYNONYM_GROUPS.find((group) => group.some((word) => word.includes(term) || term.includes(word)));
  return matchedGroup ? [...new Set([term, ...matchedGroup])] : [term];
}

function recordMatchesAnyTerm(record, terms) {
  return terms.some((term) =>
    record.ingredient.includes(term)
    || record.summary.includes(term)
    || (record.usedFoods || []).some((food) => food === term) // ← 追加(完全一致)
  );
}


function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
    return entities[character];
  });
}

function calculateCurrentWeek(startDateValue) {
  if (!startDateValue) {
    return 1;
  }
  const start = new Date(`${startDateValue}T00:00:00`);
  const today = new Date();
  const diffDays = Math.floor((today.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) / 86_400_000);
  const dayNumber = diffDays + 1;
  return dayNumber < 1 ? 1 : Math.ceil(dayNumber / 7);
}

async function loadSettings() {
  try {
    const data = await getSettings();
    const savedStartDate = data.settings?.["開始日"] || "";
    if (savedStartDate) {
      selectedWeek = calculateCurrentWeek(savedStartDate);
    }
  } catch (error) {
    console.warn(error);
  }
}

function renderWeekLabel() {
  currentWeekLabel.textContent = `${selectedWeek}週目`;
}

prevWeekButton.addEventListener("click", () => {
  if (selectedWeek > 1) {
    selectedWeek -= 1;
    renderWeekLabel();
    loadRecords();
  }
});

nextWeekButton.addEventListener("click", () => {
  selectedWeek += 1;
  renderWeekLabel();
  loadRecords();
});

instaSearchInput.addEventListener("input", () => {
  searchTerm = instaSearchInput.value.trim();
  loadRecords();
});

function renderRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    instaList.innerHTML = `<p class="food-info-empty">該当する投稿記録はありません。</p>`;
    return;
  }

  instaList.innerHTML = records.map((record) => `
    <article class="insta-record-item">
      <div class="insta-record-meta">
        <span class="insta-record-day">${escapeHtml(record.day)}日目</span>
        ${record.meal ? `<span class="insta-record-meal">${escapeHtml(record.meal)}</span>` : ""}
      </div>
      ${record.ingredient ? `<p class="insta-record-ingredient">${escapeHtml(record.ingredient)}</p>` : ""}
      ${record.summary ? `<p class="insta-record-summary">${escapeHtml(record.summary)}</p>` : ""}
    </article>
  `).join("");
}

function sortRecordsForSearch(records) {
  return [...records].sort((a, b) => {
    const aIsCurrentWeek = a.week === selectedWeek ? 0 : 1;
    const bIsCurrentWeek = b.week === selectedWeek ? 0 : 1;
    if (aIsCurrentWeek !== bIsCurrentWeek) {
      return aIsCurrentWeek - bIsCurrentWeek;
    }
    return a.day - b.day;
  });
}

async function loadRecords() {
  const currentRequestId = requestId + 1;
  requestId = currentRequestId;
  instaList.innerHTML = `<p class="food-info-loading">読み込んでいます...</p>`;

  try {
    const data = await getInstaRecords({
      // 検索中は週もキーワードもサーバー側では絞り込まず、全件取得してクライアント側でフィルタする
      // (同義語グループを使ったOR一致をするため)
      week: searchTerm ? "" : selectedWeek,
      keyword: "",
    });

    if (currentRequestId !== requestId) {
      return;
    }

    if (searchTerm) {
      const terms = expandSearchTerms(searchTerm);
      const matched = (data.records || []).filter((record) => recordMatchesAnyTerm(record, terms));
      renderRecords(sortRecordsForSearch(matched));
    } else {
      renderRecords(data.records);
    }
  } catch (error) {
    console.warn(error);
    if (currentRequestId !== requestId) {
      return;
    }
    instaList.innerHTML = `<p class="food-info-empty">投稿記録の取得に失敗しました。時間をおいて再度お試しください。</p>`;
  }
}

async function init() {
  await loadSettings();
  renderWeekLabel();
  await loadRecords();
}

init();
