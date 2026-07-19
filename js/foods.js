import { getFoodInfo, getFoodList } from "./api.js";

const foodButtons = document.querySelector("#food-buttons");
const foodInfoPanel = document.querySelector("#food-info-panel");
const foodSearchInput = document.querySelector("#food-search");

let allFoods = [];
let selectedFood = "";
let foodInfoRequestId = 0;
let searchTerm = "";

function normalizeFoods(foodList) {
  return [...new Set(foodList.map((food) => String(food).trim()).filter(Boolean))];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
    return entities[character];
  });
}

function getFilteredFoods() {
  if (!searchTerm) {
    return allFoods;
  }
  return allFoods.filter((food) => food.includes(searchTerm));
}

function renderFoods() {
  const filteredFoods = getFilteredFoods();
  foodButtons.innerHTML = "";

  if (filteredFoods.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "food-info-empty";
    emptyMessage.textContent = "該当する食材が見つかりません。";
    foodButtons.append(emptyMessage);
    return;
  }

  filteredFoods.forEach((food) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "food-button";
    button.textContent = food;
    button.setAttribute("aria-pressed", String(food === selectedFood));

    button.addEventListener("click", () => {
      selectedFood = food;
      renderFoods();
      loadFoodInfo(food);
    });

    foodButtons.append(button);
  });
}

async function loadFoods() {
  foodButtons.innerHTML = `<p class="food-info-loading">食材リストを読み込んでいます...</p>`;

  try {
    const data = await getFoodList();
    allFoods = normalizeFoods(Array.isArray(data.foods) ? data.foods : []);
    renderFoods();
  } catch (error) {
    console.warn(error);
    foodButtons.innerHTML = `<p class="food-info-empty">食材リストの取得に失敗しました。時間をおいて再度お試しください。</p>`;
  }
}

function renderFoodInfoList(title, items) {
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
    return `<li>${escapeHtml(item.text)}${source}</li>`;
  }).join("");

  return `
    <section class="food-info-section">
      <h4>${title}</h4>
      <ul>${listItems}</ul>
    </section>
  `;
}

async function loadFoodInfo(foodName) {
  const requestId = foodInfoRequestId + 1;
  foodInfoRequestId = requestId;
  foodInfoPanel.hidden = false;
  foodInfoPanel.innerHTML = `<p class="food-info-loading">${escapeHtml(foodName)} の情報を読み込んでいます...</p>`;

  try {
    const data = await getFoodInfo(foodName);

    if (requestId !== foodInfoRequestId || selectedFood !== foodName) {
      return;
    }

    foodInfoPanel.innerHTML = `
      <div class="food-info-heading">
        <h3>${escapeHtml(foodName)} のメモ</h3>
        <p>注意点が複数ある場合は箇条書きで表示します。</p>
      </div>
      ${renderFoodInfoList("注意点", data.cautions)}
      ${renderFoodInfoList("調理法", data.cookingMethods)}
    `;
  } catch (error) {
    console.warn(error);

    if (requestId !== foodInfoRequestId || selectedFood !== foodName) {
      return;
    }

    foodInfoPanel.innerHTML = `
      <div class="food-info-heading">
        <h3>${escapeHtml(foodName)} のメモ</h3>
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
