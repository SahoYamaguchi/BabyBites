import { getRecipes, getSettings } from "./api.js";

const currentWeekLabel = document.querySelector("#current-week-label");
const prevWeekButton = document.querySelector("#prev-week-button");
const nextWeekButton = document.querySelector("#next-week-button");
const recipeSearchInput = document.querySelector("#recipe-search");
const recipeList = document.querySelector("#recipe-list");

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
    loadRecipes();
  }
});

nextWeekButton.addEventListener("click", () => {
  selectedWeek += 1;
  renderWeekLabel();
  loadRecipes();
});

recipeSearchInput.addEventListener("input", () => {
  searchTerm = recipeSearchInput.value.trim();
  loadRecipes();
});

function renderRecipes(records) {
  if (!Array.isArray(records) || records.length === 0) {
    recipeList.innerHTML = `<p class="food-info-empty">該当するレシピはありません。</p>`;
    return;
  }

  recipeList.innerHTML = records.map((record) => `
    <article class="recipe-item">
      <div class="recipe-item-meta">
        <span class="recipe-item-day">${escapeHtml(record.day)}日目</span>
        ${record.meal ? `<span class="recipe-item-meal">${escapeHtml(record.meal)}</span>` : ""}
      </div>
      <h3 class="recipe-item-name">${escapeHtml(record.recipeName || "名称未設定")}</h3>
      ${record.ingredients ? `<p class="recipe-item-ingredients">${escapeHtml(record.ingredients)}</p>` : ""}
      ${record.usedFoods && record.usedFoods.length > 0
        ? `<p class="recipe-item-used-foods">${record.usedFoods.map((food) => `<span class="recipe-food-tag">${escapeHtml(food)}</span>`).join("")}</p>`
        : ""}
    </article>
  `).join("");
}

async function loadRecipes() {
  const currentRequestId = requestId + 1;
  requestId = currentRequestId;
  recipeList.innerHTML = `<p class="food-info-loading">読み込んでいます...</p>`;

  try {
    const data = await getRecipes({
      week: searchTerm ? "" : selectedWeek, // 検索中は週を無視して全体から検索する
      keyword: searchTerm,
    });

    if (currentRequestId !== requestId) {
      return;
    }

    renderRecipes(data.records);
  } catch (error) {
    console.warn(error);
    if (currentRequestId !== requestId) {
      return;
    }
    recipeList.innerHTML = `<p class="food-info-empty">レシピの取得に失敗しました。時間をおいて再度お試しください。</p>`;
  }
}

async function init() {
  await loadSettings();
  renderWeekLabel();
  await loadRecipes();
}

init();
