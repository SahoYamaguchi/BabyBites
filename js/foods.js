import { getFoodInfo, getFoodMaster } from "./api.js";

const CATEGORY_ORDER = ["炭水化物", "野菜", "果物", "タンパク質", "乳製品", "その他"];

const foodButtons = document.querySelector("#food-buttons");
const foodInfoPanel = document.querySelector("#food-info-panel");
const foodSearchInput = document.querySelector("#food-search");

let allFoods = []; // [{ name, category, displayGroup }]
let selectedGroup = "";
let foodInfoRequestId = 0;
let searchTerm = "";
const openCategories = new Set();

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
    return entities[character];
  });
}

function scrollFoodInfoIntoView() {
  window.requestAnimationFrame(() => {
    foodInfoPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function normalizeFoodMaster(foods) {
  const seen = new Set();
  return foods.reduce((items, food) => {
    const name = String(food?.name || "").trim();
    if (!name || seen.has(name)) {
      return items;
    }
    seen.add(name);
    const category = String(food?.category || "").trim() || "その他";
    const displayGroup = String(food?.displayGroup || "").trim() || name;
    items.push({ name, category, displayGroup });
    return items;
  }, []);
}

// 表示グループ単位でまとめる。1グループに複数の食材名マスタが含まれる場合、
// カテゴリはグループ内最初の食材のものを採用する(通常は同じカテゴリのはず)。
function buildDisplayGroups(foods) {
  const groupMap = new Map(); // displayGroup -> { category, names: [] }

  foods.forEach((food) => {
    if (!groupMap.has(food.displayGroup)) {
      groupMap.set(food.displayGroup, { category: food.category, names: [] });
    }
    groupMap.get(food.displayGroup).names.push(food.name);
  });

  return [...groupMap.entries()].map(([displayGroup, { category, names }]) => ({
    displayGroup,
    category,
    names,
  }));
}

function groupByCategory(displayGroups) {
  const groups = new Map();

  displayGroups.forEach((group) => {
    if (!groups.has(group.category)) {
      groups.set(group.category, []);
    }
    groups.get(group.category).push(group);
  });

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((category) => groups.has(category)),
    ...[...groups.keys()].filter((category) => !CATEGORY_ORDER.includes(category)),
  ];

  return orderedCategories.map((category) => ({ category, groups: groups.get(category) }));
}

function getFilteredDisplayGroups() {
  const displayGroups = buildDisplayGroups(allFoods);
  if (!searchTerm) {
    return displayGroups;
  }
  // 表示グループ名、またはグループ内のいずれかの食材名マスタに一致したら表示する
  return displayGroups.filter((group) =>
    group.displayGroup.includes(searchTerm) || group.names.some((name) => name.includes(searchTerm))
  );
}

function renderFoods() {
  const filteredGroups = getFilteredDisplayGroups();
  foodButtons.innerHTML = "";

  if (filteredGroups.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "food-info-empty";
    emptyMessage.textContent = "該当する食材が見つかりません。";
    foodButtons.append(emptyMessage);
    return;
  }

  const groupedByCategory = groupByCategory(filteredGroups);

  groupedByCategory.forEach(({ category, groups }) => {
    const details = document.createElement("details");
    details.className = "food-category";
    details.open = searchTerm ? true : openCategories.has(category);

    details.addEventListener("toggle", () => {
      if (details.open) {
        openCategories.add(category);
      } else {
        openCategories.delete(category);
      }
    });

    const summary = document.createElement("summary");
    summary.className = "food-category-summary";
    summary.textContent = `${category}(${groups.length})`;
    details.append(summary);

    const grid = document.createElement("div");
    grid.className = "food-grid";

    groups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "food-button";
      button.textContent = group.displayGroup;
      button.setAttribute("aria-pressed", String(group.displayGroup === selectedGroup));

      button.addEventListener("click", () => {
        selectedGroup = group.displayGroup;
        renderFoods();
        loadFoodInfo(group.displayGroup, group.names);
        scrollFoodInfoIntoView();
      });

      grid.append(button);
    });

    details.append(grid);
    foodButtons.append(details);
  });
}

async function loadFoods() {
  foodButtons.innerHTML = `<p class="food-info-loading">食材リストを読み込んでいます...</p>`;

  try {
    const data = await getFoodMaster();
    allFoods = normalizeFoodMaster(Array.isArray(data.foods) ? data.foods : []);
    renderFoods();
  } catch (error) {
    console.warn(error);
    foodButtons.innerHTML = `<p class="food-info-empty">食材リストの取得に失敗しました。時間をおいて再度お試しください。</p>`;
  }
}

function renderFoodInfoList(title, items, displayGroup) {
  if (!Array.isArray(items) || items.length === 0) {
    return `
      <section class="food-info-section">
        <h4>${title}</h4>
        <p class="food-info-empty">登録された情報はまだありません。</p>
      </section>
    `;
  }

  const listItems = items.map((item) => {
    const source = item.source ? ` <span class="food-info-source">${escapeHtml(item.source)}</span>` : "";
    const showFoodName = item.foodName && item.foodName !== displayGroup;
    const prefix = showFoodName ? `<strong class="food-info-item-name">${escapeHtml(item.foodName)}</strong>: ` : "";
    return `<li>${prefix}${escapeHtml(item.text)}${source}</li>`;
  }).join("");

  return `
    <section class="food-info-section">
      <h4>${title}</h4>
      <ul>${listItems}</ul>
    </section>
  `;
}

// 表示グループ内の全食材名マスタについてgetFoodInfoを呼び、結果をまとめて重複排除する
function dedupeInfoItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.foodName || ""}__${item.text}__${item.source || ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function loadFoodInfo(displayGroup, foodNames) {
  const requestId = foodInfoRequestId + 1;
  foodInfoRequestId = requestId;
  foodInfoPanel.hidden = false;
  foodInfoPanel.innerHTML = `<p class="food-info-loading">${escapeHtml(displayGroup)} の情報を読み込んでいます...</p>`;

  try {
    const results = await Promise.all(foodNames.map((name) => getFoodInfo(name)));

    if (requestId !== foodInfoRequestId || selectedGroup !== displayGroup) {
      return;
    }

    const allCautions = dedupeInfoItems(
      results.flatMap((r, index) =>
        (Array.isArray(r.cautions) ? r.cautions.map((item) => ({ ...item, foodName: foodNames[index] })) : [])
      )
    );
    const allCookingMethods = dedupeInfoItems(
      results.flatMap((r, index) =>
        (Array.isArray(r.cookingMethods) ? r.cookingMethods.map((item) => ({ ...item, foodName: foodNames[index] })) : [])
      )
    );

    foodInfoPanel.innerHTML = `
      <div class="food-info-heading">
        <h3>${escapeHtml(displayGroup)} のメモ</h3>
        <p>注意点が複数ある場合は箇条書きで表示します。</p>
      </div>
      ${renderFoodInfoList("注意点", allCautions, displayGroup)}
      ${renderFoodInfoList("調理法", allCookingMethods, displayGroup)}
    `;
  } catch (error) {
    console.warn(error);

    if (requestId !== foodInfoRequestId || selectedGroup !== displayGroup) {
      return;
    }

    foodInfoPanel.innerHTML = `
      <div class="food-info-heading">
        <h3>${escapeHtml(displayGroup)} のメモ</h3>
        <p class="food-info-empty">注意点・調理法を取得できませんでした。</p>
      </div>
    `;
  }
}

foodSearchInput.addEventListener("input", () => {
  searchTerm = foodSearchInput.value.trim();
  renderFoods();
});

loadFoods();
