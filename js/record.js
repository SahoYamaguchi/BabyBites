import { addMasterFood, addRecords, getFoodList, getFoodMaster, getInstaRecords, getSettings } from "./api.js";

const CATEGORY_ORDER = ["炭水化物", "野菜", "果物", "タンパク質", "乳製品", "その他"];

const foodButtons = document.querySelector("#food-buttons");
const selectedItemsEl = document.querySelector("#selected-items");
const openFoodSearchButton = document.querySelector("#open-food-search-button");
const openFoodHistoryButton = document.querySelector("#open-food-history-button");
const form = document.querySelector("#record-form");
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

const quickAddDetails = document.querySelector("#quick-add");
const quickAddName = document.querySelector("#quick-add-name");
const quickAddCategory = document.querySelector("#quick-add-category");
const quickAddButton = document.querySelector("#quick-add-button");
const quickAddStatus = document.querySelector("#quick-add-status");

let todayFoods = []; // 今日のインスタ投稿から抽出した食材
let recordedFoods = []; // これまで記録した食材(履歴モーダル用)
let selectedItems = []; // [{ foodName, spoon, gram, ratio }] まとめて記録する食材
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
    button.setAttribute("aria-pressed", String(hasItem(food)));

    button.addEventListener("click", () => {
      handleFoodSelection(food, { toggle: true });
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

const RATIO_OPTIONS = ["20%", "50%", "80%", "100%"];
const SPOON_OPTIONS = ["0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4"];

function hasItem(foodName) {
  return selectedItems.some((item) => item.foodName === foodName);
}

function renderSelectedItems() {
  selectedItemsEl.innerHTML = "";

  if (selectedItems.length === 0) {
    const empty = document.createElement("p");
    empty.className = "food-info-empty";
    empty.textContent = "食材が選ばれていません。";
    selectedItemsEl.append(empty);
    return;
  }

  selectedItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item-row";

    const head = document.createElement("div");
    head.className = "item-row-head";
    const name = document.createElement("strong");
    name.textContent = item.foodName;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "item-remove-button";
    removeButton.setAttribute("aria-label", `${item.foodName}を外す`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => removeItem(item.foodName));
    head.append(name, removeButton);

    const fields = document.createElement("div");
    fields.className = "item-row-fields";

    const spoonSelect = document.createElement("select");
    spoonSelect.setAttribute("aria-label", `${item.foodName}のさじ杯数`);
    spoonSelect.append(new Option("さじ 未選択", ""));
    SPOON_OPTIONS.forEach((value) => spoonSelect.append(new Option(`${value}杯`, value)));
    spoonSelect.value = item.spoon;
    spoonSelect.addEventListener("change", () => { item.spoon = spoonSelect.value; });

    const gramInput = document.createElement("input");
    gramInput.type = "number";
    gramInput.inputMode = "decimal";
    gramInput.min = "0";
    gramInput.step = "0.1";
    gramInput.placeholder = "g";
    gramInput.setAttribute("aria-label", `${item.foodName}のグラム数`);
    gramInput.value = item.gram;
    gramInput.addEventListener("input", () => { item.gram = gramInput.value.trim(); });

    const ratioSelect = document.createElement("select");
    ratioSelect.setAttribute("aria-label", `${item.foodName}の食べた割合`);
    RATIO_OPTIONS.forEach((value) => ratioSelect.append(new Option(`食べた割合 ${value}`, value)));
    ratioSelect.value = item.ratio;
    ratioSelect.addEventListener("change", () => { item.ratio = ratioSelect.value; });

    fields.append(spoonSelect, gramInput, ratioSelect);
    row.append(head, fields);
    selectedItemsEl.append(row);
  });
}

function addItem(foodName) {
  if (!foodName || hasItem(foodName)) {
    return;
  }
  selectedItems.push({ foodName, spoon: "", gram: "", ratio: "100%" });
  renderTodayFoods();
  renderSelectedItems();
}

function removeItem(foodName) {
  selectedItems = selectedItems.filter((item) => item.foodName !== foodName);
  renderTodayFoods();
  renderSelectedItems();
}

// 選んだ食材を記録リストに追加する(追加済みなら何もしない)
function selectFood(foodName) {
  addItem(foodName);
}

// 選んだ食材の表示グループに複数の食材名(お粥の濃度違いなど)がある場合は、
// 「食材を探す」モーダルを濃度選択画面として開く。なければそのまま追加する。
// toggle: true のとき(今日の食材ボタン)は、追加済みの食材をもう一度押すと外す。
function handleFoodSelection(foodName, { toggle = false } = {}) {
  if (toggle && hasItem(foodName)) {
    removeItem(foodName);
    return;
  }

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
  selectedItems = [];
  selectedMealType = "";
  selectedReaction = "";
  dateTimeInput.value = formatDateTimeLocal();
  renderTodayFoods();
  renderSelectedItems();
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

// ----- 新しい食材の簡易追加(食材名+カテゴリだけ) -----

function showQuickAddStatus(message) {
  quickAddStatus.textContent = message;
}

quickAddButton.addEventListener("click", async () => {
  const name = quickAddName.value.trim();
  if (!name) {
    showQuickAddStatus("食材名を入力してください。");
    return;
  }

  try {
    quickAddButton.disabled = true;
    showQuickAddStatus("追加しています...");
    const data = await addMasterFood({ name, category: quickAddCategory.value });
    const addedName = data.name || name;

    if (!foodMaster.some((food) => food.name === addedName)) {
      foodMaster.push({ name: addedName, category: data.category || quickAddCategory.value, displayGroup: addedName });
    }

    quickAddName.value = "";
    showQuickAddStatus("");
    quickAddDetails.open = false;
    selectFoodFromMaster(addedName);
    showMessage(
      data.added === false ? `「${addedName}」はすでに登録されているので、そのまま選びました。` : `「${addedName}」を食材マスタに追加しました。`,
      "success",
      true,
    );
  } catch (error) {
    console.error(error);
    showQuickAddStatus("追加に失敗しました。時間をおいて再度お試しください。");
  } finally {
    quickAddButton.disabled = false;
  }
});

// ----- フォーム送信(複数食材をまとめて記録) -----

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (selectedItems.length === 0) {
    showMessage("食材を選択してください。", "error");
    return;
  }

  const missing = selectedItems.find((item) => !item.gram && !item.spoon);
  if (missing) {
    showMessage(`「${missing.foodName}」のグラム数かさじ杯数を入力してください。`, "error");
    return;
  }

  const items = selectedItems.map((item) => ({
    foodName: item.foodName,
    amountLabel: item.ratio,
    amountGram: item.gram ? Number(item.gram) : "",
    spoonCount: item.spoon,
  }));

  try {
    submitButton.disabled = true;
    showMessage("記録しています...", "info");
    const data = await addRecords({
      date: dateTimeInput.value,
      mealType: mealTypeInput.value,
      reaction: reactionInput.value,
      memo: memoInput.value.trim(),
      items: JSON.stringify(items),
    });

    resetForm();
    const firstFoods = data.firstTimeFoods || [];
    showMessage(
      firstFoods.length > 0 ? `初めての食材です!🎉 ${firstFoods.join("、")}` : `${items.length}品を記録しました。`,
      "success",
      true,
    );
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
renderSelectedItems();
loadTodayFoods();
loadFoodMasterIfNeeded();
