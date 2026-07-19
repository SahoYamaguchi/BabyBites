import { addFood, addRecord, getFoodInfo, getFoodList } from "./api.js";

const DEFAULT_FOODS = ["10倍がゆ", "にんじん", "かぼちゃ", "りんご", "しらす", "豆腐"];

const foodButtons = document.querySelector("#food-buttons");
const foodInfoPanel = document.querySelector("#food-info-panel");
const addFoodButton = document.querySelector("#add-food-button");
const form = document.querySelector("#record-form");
const amountGramInput = document.querySelector("#amount-gram");
const spoonCountInput = document.querySelector("#spoon-count");
const mealTypeInput = document.querySelector("#meal-type");
const mealTypeButtons = document.querySelectorAll(".meal-type-button");
const reactionInput = document.querySelector("#reaction");
const reactionButtons = document.querySelectorAll(".reaction-button");
const dateTimeInput = document.querySelector("#date-time");
const memoInput = document.querySelector("#memo");
const statusMessage = document.querySelector("#status-message");
const submitButton = document.querySelector("#submit-button");

let foods = [...DEFAULT_FOODS];
let selectedFood = "";
let selectedMealType = "";
let selectedReaction = "";
let messageTimer;
let foodInfoRequestId = 0;

function formatDateTimeLocal(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function showMessage(message, type = "info", autoHide = false) {
  window.clearTimeout(messageTimer);
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;

  if (autoHide) {
    messageTimer = window.setTimeout(() => {
      statusMessage.textContent = "";
      statusMessage.className = "status-message";
    }, 4000);
  }
}

function normalizeFoods(foodList) {
  return [...new Set(foodList.map((food) => String(food).trim()).filter(Boolean))];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
    return entities[character];
  });
}

function renderFoods() {
  foodButtons.innerHTML = "";

  foods.forEach((food) => {
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
  renderFoods();

  try {
    const data = await getFoodList();
    if (Array.isArray(data.foods) && data.foods.length > 0) {
      const apiFoods = normalizeFoods(data.foods);
      foods = normalizeFoods([...DEFAULT_FOODS, ...apiFoods]);
      if (!foods.includes(selectedFood)) {
        selectedFood = "";
      }
      renderFoods();
    }
  } catch (error) {
    console.warn(error);
    showMessage("食材リストの取得に失敗しました。初期リストを表示しています。", "warning");
  }
}

function hideFoodInfo() {
  foodInfoRequestId += 1;
  foodInfoPanel.hidden = true;
  foodInfoPanel.innerHTML = "";
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

function renderMealTypes() {
  mealTypeInput.value = selectedMealType;
  mealTypeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mealType === selectedMealType));
  });
}

function renderReactions() {
  reactionInput.value = selectedReaction;
  reactionButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.reaction === selectedReaction));
  });
}

function resetForm() {
  form.reset();
  selectedFood = "";
  selectedMealType = "";
  selectedReaction = "";
  dateTimeInput.value = formatDateTimeLocal();
  renderFoods();
  hideFoodInfo();
  renderMealTypes();
  renderReactions();
}

mealTypeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mealType = button.dataset.mealType;
    selectedMealType = selectedMealType === mealType ? "" : mealType;
    renderMealTypes();
  });
});

reactionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const reaction = button.dataset.reaction;
    selectedReaction = selectedReaction === reaction ? "" : reaction;
    renderReactions();
  });
});

addFoodButton.addEventListener("click", async () => {
  const foodName = window.prompt("追加する食材名を入力してください");
  const trimmedFoodName = foodName?.trim();

  if (!trimmedFoodName) {
    return;
  }

  try {
    addFoodButton.disabled = true;
    await addFood(trimmedFoodName);
    foods = [...new Set([...foods, trimmedFoodName])];
    selectedFood = trimmedFoodName;
    renderFoods();
    loadFoodInfo(trimmedFoodName);
    showMessage("食材を追加しました。", "success", true);
  } catch (error) {
    console.error(error);
    showMessage("食材の追加に失敗しました。時間をおいて再度お試しください。", "error");
  } finally {
    addFoodButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedFood) {
    showMessage("食材を選択してください。", "error");
    return;
  }

  const amountLabel = new FormData(form).get("amountLabel");
  const amountGram = amountGramInput.value ? Number(amountGramInput.value) : "";

  try {
    submitButton.disabled = true;
    showMessage("記録しています...", "info");
    const data = await addRecord({
      date: dateTimeInput.value,
      foodName: selectedFood,
      amountLabel,
      amountGram,
      spoonCount: spoonCountInput.value,
      mealType: mealTypeInput.value,
      reaction: reactionInput.value,
      memo: memoInput.value.trim(),
    });

    resetForm();
    showMessage(data.isFirstTime ? "初めての食材です!🎉" : "記録しました。", "success", true);
  } catch (error) {
    console.error(error);
    showMessage("記録に失敗しました。入力内容を確認して再度お試しください。", "error");
  } finally {
    submitButton.disabled = false;
  }
});

dateTimeInput.value = formatDateTimeLocal();
renderMealTypes();
renderReactions();
loadFoods();
