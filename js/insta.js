import { getInstaRecords, getSettings, saveSetting } from "./api.js";

const startDateInput = document.querySelector("#start-date-input");
const saveStartDateButton = document.querySelector("#save-start-date-button");
const startDateStatus = document.querySelector("#start-date-status");
const currentWeekLabel = document.querySelector("#current-week-label");
const prevWeekButton = document.querySelector("#prev-week-button");
const nextWeekButton = document.querySelector("#next-week-button");
const instaSearchInput = document.querySelector("#insta-search");
const instaList = document.querySelector("#insta-list");

let startDate = null; // Date | null
let selectedWeek = 1;
let searchTerm = "";
let requestId = 0;

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

function showStartDateStatus(message, type = "info") {
  startDateStatus.textContent = message;
  startDateStatus.className = `status-message ${type}`;
}

async function loadSettings() {
  try {
    const data = await getSettings();
    const savedStartDate = data.settings?.["開始日"] || "";
    if (savedStartDate) {
      startDate = savedStartDate;
      startDateInput.value = savedStartDate;
      selectedWeek = calculateCurrentWeek(savedStartDate);
    }
  } catch (error) {
    console.warn(error);
    showStartDateStatus("設定の取得に失敗しました。", "error");
  }
}

saveStartDateButton.addEventListener("click", async () => {
  const value = startDateInput.value;
  if (!value) {
    showStartDateStatus("開始日を選択してください。", "error");
    return;
  }

  try {
    saveStartDateButton.disabled = true;
    await saveSetting("開始日", value);
    startDate = value;
    selectedWeek = calculateCurrentWeek(value);
    showStartDateStatus("開始日を保存しました。", "success");
    renderWeekLabel();
    await loadRecords();
  } catch (error) {
    console.error(error);
    showStartDateStatus("開始日の保存に失敗しました。", "error");
  } finally {
    saveStartDateButton.disabled = false;
  }
});

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

async function loadRecords() {
  const currentRequestId = requestId + 1;
  requestId = currentRequestId;
  instaList.innerHTML = `<p class="food-info-loading">読み込んでいます...</p>`;

  try {
    const data = await getInstaRecords({
      week: searchTerm ? "" : selectedWeek, // 検索中は週を無視して全体から検索する
      keyword: searchTerm,
    });

    if (currentRequestId !== requestId) {
      return;
    }

    renderRecords(data.records);
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
