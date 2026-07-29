import { addFood, addRecord, getFoodList, getFoodMaster, getInstaRecords, getSettings } from "./api.js";

const CATEGORY_ORDER = ["炭水化物", "野菜", "果物", "タンパク質", "乳製品", "その他"];

const foodButtons = document.querySelector("#food-buttons");
const selectedFoodDisplay = document.querySelector("#selected-food-display");
const openFoodSearchButton = document.querySelector("#open-food-search-button");
const openFoodHistoryButton = document.querySelector("#open-food-history-button");
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

const foodSearchModal = document.querySelector("#food-search-modal");
const foodSearchModalClose = document.querySelector("#food-search-modal-close");
const foodSearchModalInput = document.querySelector("#food-search-modal-input");
const foodSearchModalList = document.querySelector("#food-search-modal-list");

const foodHistoryModal = document.querySelector("#food-history-modal");
const foodHistoryModalClose = document.querySelector("#food-history-modal-close");
const foodHistoryModalInput = document.querySelector("#food-history-modal-input");
const foodHistoryModalList = document.querySelector("#food-history-modal-list");

let todayFoods = []; // 今日のインスタ投稿から抽出した食材
let recordedFoods = []; // これまで記録した食材(履歴モーダル用)
let selectedFood = "";
let selectedMealType = "";
let selectedReaction = "";
let messageTimer;

let foodMaster = []; // [{ name, category, displayGroup }] (食材を探すモーダル用)
let foodMasterLoaded = false;
let modalSearchTerm = "";
let historySearchTerm = "";
let concentrationPickerGroup = null; // { displayGroup, category, names } (お粥などの濃度選択中に使う)

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

// ----- 今日の食材(1st view) -----

function calculateCurrentDay(startDateStr) {
  if (!startDateStr) {
    return null;
  }
  const start = new Date(`${startDateStr}T00:00:00`);
  const today = new Date();
  const diffDays = Math.floor((today.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) / 86_400_000);
  const dayNumber = diffDays + 1;
  return dayNumber < 1 ? null : dayNumber;
}

function renderTodayFoods() {
  foodButtons.innerHTML = "";

  if (todayFoods.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "food-info-empty";
    emptyMessage.textContent = "今日に該当する投稿の食材が見つかりません。「履歴」か「食材を探す」から選んでください。";
    foodButtons.append(emptyMessage);
    return;
  }

  todayFoods.forEach((food) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "food-button";
    button.textContent = food;
    button.setAttribute("aria-pressed", String(food === selectedFood));

    button.addEventListener("click", () => {
      handleFoodSelection(food);
    });

    foodButtons.append(button);
  });
}

async function loadTodayFoods() {
  foodButtons.innerHTML = `<p class="food-info-loading">今日の食材を読み込んでいます...</p>`;

  try {
    const settingsData = await getSettings();
    const startDate = settingsData.settings?.["開始日"] || "";
    const currentDay = calculateCurrentDay(startDate);

    if (!currentDay) {
      todayFoods = [];
      renderTodayFoods();
      return;
    }

    const data = await getInstaRecords({ day: currentDay });
    const usedFoodsSet = new Set();
    (data.records || []).forEach((record) => {
      (record.usedFoods || []).forEach((food) => usedFoodsSet.add(food));
    });
    todayFoods = [...usedFoodsSet];
    renderTodayFoods();
  } catch (error) {
    console.warn(error);
    todayFoods = [];
    renderTodayFoods();
  }
}

function renderSelectedFoodDisplay() {
  if (!selectedFood) {
    selectedFoodDisplay.hidden = true;
    selectedFoodDisplay.textContent = "";
    return;
  }
  selectedFoodDisplay.hidden = false;
  selectedFoodDisplay.textContent = `選択中の食材: ${selectedFood}`;
}

function selectFood(foodName) {
  selectedFood = foodName;
  renderTodayFoods();
  renderSelectedFoodDisplay();
}

// 選んだ食材の表示グループに複数の食材名(お粥の濃度違いなど)がある場合は、
// 「食材を探す」モーダルを濃度選択画面として開く。なければそのまま選択する。
function handleFoodSelection(foodName) {
  const entry = foodMaster.find((food) => food.name === foodName);

  if (entry) {
    const groupNames = foodMaster
      .filter((food) => food.displayGroup === entry.displayGroup)
      .map((food) => food.name);

    if (groupNames.length > 1) {
      concentrationPickerGroup = { displayGroup: entry.displayGroup, names: groupNames };
      modalSearchTerm = "";
      foodSearchModalInput.value = "";
      foodSearchModal.hidden = false;
      renderFoodSearchModalList();
      return;
    }
  }

  selectFood(foodName);
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
  renderTodayFoods();
  renderSelectedFoodDisplay();
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

// ----- 履歴モーダル(これまで記録した食材) -----

function getFilteredRecordedFoods() {
  if (!historySearchTerm) {
    return recordedFoods;
  }
  return recordedFoods.filter((food) => food.includes(historySearchTerm));
}

function renderFoodHistoryModalList() {
  const filtered = getFilteredRecordedFoods();
  foodHistoryModalList.innerHTML = "";

  if (filtered.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "food-info-empty";
    emptyMessage.textContent = "該当する食材が見つかりません。";
    foodHistoryModalList.append(emptyMessage);
    return;
  }

  filtered.forEach((food) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "food-button";
    button.textContent = food;
    button.addEventListener("click", () => {
      closeFoodHistoryModal();
      handleFoodSelection(food);
    });
    foodHistoryModalList.append(button);
  });
}

async function loadRecordedFoodsIfNeeded() {
  foodHistoryModalList.innerHTML = `<p class="food-info-loading">履歴を読み込んでいます...</p>`;

  try {
    const data = await getFoodList();
    recordedFoods = normalizeFoods(Array.isArray(data.foods) ? data.foods : []);
    renderFoodHistoryModalList();
  } catch (error) {
    console.warn(error);
    foodHistoryModalList.innerHTML = `<p class="food-info-empty">履歴の取得に失敗しました。時間をおいて再度お試しください。</p>`;
  }
}

function openFoodHistoryModal() {
  foodHistoryModal.hidden = false;
  historySearchTerm = "";
  foodHistoryModalInput.value = "";
  loadRecordedFoodsIfNeeded();
  window.setTimeout(() => foodHistoryModalInput.focus(), 0);
}

function closeFoodHistoryModal() {
  foodHistoryModal.hidden = true;
}

openFoodHistoryButton.addEventListener("click", openFoodHistoryModal);
foodHistoryModalClose.addEventListener("click", closeFoodHistoryModal);
foodHistoryModal.addEventListener("click", (event) => {
  if (event.target === foodHistoryModal) {
    closeFoodHistoryModal();
  }
});
foodHistoryModalInput.addEventListener("input", () => {
  historySearchTerm = foodHistoryModalInput.value.trim();
  renderFoodHistoryModalList();
});

// ----- 食材マスタ検索モーダル(全部の食材) -----

function normalizeFoodMaster(list) {
  const seen = new Set();
  return list.reduce((items, food) => {
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

function groupItemsByCategory(items) {
  const groups = new Map();

  items.forEach((item) => {
    if (!groups.has(item.category)) {
      groups.set(item.category, []);
    }
    groups.get(item.category).push(item);
  });

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((category) => groups.has(category)),
    ...[...groups.keys()].filter((category) => !CATEGORY_ORDER.includes(category)),
  ];

  return orderedCategories.map((category) => ({ category, items: groups.get(category) }));
}

// 表示グループ単位でまとめる。1グループに複数の食材名マスタが含まれる場合、
// お粥の濃度選択のようにサブ画面で個別の食材名を選ばせる対象になる。
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

function getFilteredFoodMaster() {
  if (!modalSearchTerm) {
    return foodMaster;
  }
  return foodMaster.filter((food) => food.name.includes(modalSearchTerm));
}

function selectFoodFromMaster(foodName) {
  selectFood(foodName);
  concentrationPickerGroup = null;
  closeFoodSearchModal();
}

// 表示グループのラベルとしては使うが、記録する具体的な食材としては
// 曖昧すぎるため濃度選択の候補からは除外したい食材名
const PICKER_EXCLUDED_NAMES = new Set(["つぶし粥"]);

function renderConcentrationPicker() {
  const { displayGroup, names } = concentrationPickerGroup;
  const selectableNames = names.filter((name) => !PICKER_EXCLUDED_NAMES.has(name));
  const namesToShow = selectableNames.length > 0 ? selectableNames : names;

  foodSearchModalList.innerHTML = "";

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "secondary-button food-picker-back-button";
  backButton.textContent = "← 戻る";
  backButton.addEventListener("click", () => {
    concentrationPickerGroup = null;
    renderFoodSearchModalList();
  });
  foodSearchModalList.append(backButton);

  const heading = document.createElement("p");
  heading.className = "helper-text";
  heading.textContent = `${displayGroup}の濃度を選んでください。`;
  foodSearchModalList.append(heading);

  const grid = document.createElement("div");
  grid.className = "food-grid";

  namesToShow.forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "food-button";
    button.textContent = name;
    button.addEventListener("click", () => selectFoodFromMaster(name));
    grid.append(button);
  });

  foodSearchModalList.append(grid);
}

function renderFoodSearchModalList() {
  if (concentrationPickerGroup) {
    renderConcentrationPicker();
    return;
  }

  const filtered = getFilteredFoodMaster();
  foodSearchModalList.innerHTML = "";

  if (filtered.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "food-info-empty";
    emptyMessage.textContent = "該当する食材が見つかりません。";
    foodSearchModalList.append(emptyMessage);
    return;
  }

  // 検索中は個別の食材名でそのままヒットさせたいので、表示グループでまとめない
  if (modalSearchTerm) {
    const grouped = groupItemsByCategory(filtered);
    grouped.forEach(({ category, items }) => {
      const details = document.createElement("details");
      details.className = "food-category";
      details.open = true;

      const summary = document.createElement("summary");
      summary.className = "food-category-summary";
      summary.textContent = `${category}(${items.length})`;
      details.append(summary);

      const grid = document.createElement("div");
      grid.className = "food-grid";

      items.forEach((food) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "food-button";
        button.textContent = food.name;
        button.addEventListener("click", () => selectFoodFromMaster(food.name));
        grid.append(button);
      });

      details.append(grid);
      foodSearchModalList.append(details);
    });
    return;
  }

  const displayGroups = buildDisplayGroups(filtered);
  const grouped = groupItemsByCategory(displayGroups.map((g) => ({ ...g })));

  grouped.forEach(({ category, items }) => {
    const details = document.createElement("details");
    details.className = "food-category";
    details.open = false;

    const summary = document.createElement("summary");
    summary.className = "food-category-summary";
    summary.textContent = `${category}(${items.length})`;
    details.append(summary);

    const grid = document.createElement("div");
    grid.className = "food-grid";

    items.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "food-button";
      button.textContent = group.displayGroup;
      button.addEventListener("click", () => {
        if (group.names.length > 1) {
          concentrationPickerGroup = group;
          renderFoodSearchModalList();
        } else {
          selectFoodFromMaster(group.names[0]);
        }
      });
      grid.append(button);
    });

    details.append(grid);
    foodSearchModalList.append(details);
  });
}

async function loadFoodMasterIfNeeded() {
  if (foodMasterLoaded) {
    return;
  }
  if (!foodSearchModal.hidden) {
    foodSearchModalList.innerHTML = `<p class="food-info-loading">食材マスタを読み込んでいます...</p>`;
  }

  try {
    const data = await getFoodMaster();
    foodMaster = normalizeFoodMaster(Array.isArray(data.foods) ? data.foods : []);
    foodMasterLoaded = true;
    if (!foodSearchModal.hidden) {
      renderFoodSearchModalList();
    }
  } catch (error) {
    console.warn(error);
    if (!foodSearchModal.hidden) {
      foodSearchModalList.innerHTML = `<p class="food-info-empty">食材マスタの取得に失敗しました。時間をおいて再度お試しください。</p>`;
    }
  }
}

function openFoodSearchModal() {
  foodSearchModal.hidden = false;
  modalSearchTerm = "";
  concentrationPickerGroup = null;
  foodSearchModalInput.value = "";
  loadFoodMasterIfNeeded().then(() => {
    if (foodMasterLoaded) {
      renderFoodSearchModalList();
    }
  });
  window.setTimeout(() => foodSearchModalInput.focus(), 0);
}

function closeFoodSearchModal() {
  foodSearchModal.hidden = true;
  concentrationPickerGroup = null;
}

openFoodSearchButton.addEventListener("click", openFoodSearchModal);
foodSearchModalClose.addEventListener("click", closeFoodSearchModal);
foodSearchModal.addEventListener("click", (event) => {
  if (event.target === foodSearchModal) {
    closeFoodSearchModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!foodSearchModal.hidden) {
      closeFoodSearchModal();
    }
    if (!foodHistoryModal.hidden) {
      closeFoodHistoryModal();
    }
  }
});
foodSearchModalInput.addEventListener("input", () => {
  modalSearchTerm = foodSearchModalInput.value.trim();
  renderFoodSearchModalList();
});

// ----- フォーム送信 -----

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedFood) {
    showMessage("食材を選択してください。", "error");
    return;
  }

  const amountGramValue = amountGramInput.value.trim();
  const spoonCountValue = spoonCountInput.value;

  if (!amountGramValue && !spoonCountValue) {
    showMessage("グラム数かさじ杯数のどちらかを入力してください。", "error");
    return;
  }

  const amountLabel = new FormData(form).get("amountLabel");
  const amountGram = amountGramValue ? Number(amountGramValue) : "";

  try {
    submitButton.disabled = true;
    showMessage("記録しています...", "info");
    const data = await addRecord({
      date: dateTimeInput.value,
      foodName: selectedFood,
      amountLabel,
      amountGram,
      spoonCount: spoonCountValue,
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
loadTodayFoods();
loadFoodMasterIfNeeded();
