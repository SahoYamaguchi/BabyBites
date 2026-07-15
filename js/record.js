import { addFood, addRecord, getFoodList } from "./api.js";

const DEFAULT_FOODS = ["10倍がゆ", "にんじん", "かぼちゃ", "りんご", "しらす", "豆腐"];

const foodButtons = document.querySelector("#food-buttons");
const addFoodButton = document.querySelector("#add-food-button");
const form = document.querySelector("#record-form");
const amountGramInput = document.querySelector("#amount-gram");
const spoonCountInput = document.querySelector("#spoon-count");
const mealTypeInput = document.querySelector("#meal-type");
const dateTimeInput = document.querySelector("#date-time");
const memoInput = document.querySelector("#memo");
const statusMessage = document.querySelector("#status-message");
const submitButton = document.querySelector("#submit-button");

let foods = [...DEFAULT_FOODS];
let selectedFood = "";
let messageTimer;

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
    });

    foodButtons.append(button);
  });
}

async function loadFoods() {
  renderFoods();

  try {
    const data = await getFoodList();
    if (Array.isArray(data.foods) && data.foods.length > 0) {
      foods = [...new Set(data.foods.map((food) => String(food).trim()).filter(Boolean))];
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

function resetForm() {
  form.reset();
  selectedFood = "";
  dateTimeInput.value = formatDateTimeLocal();
  renderFoods();
}

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
loadFoods();
