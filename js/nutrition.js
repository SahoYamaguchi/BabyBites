import { getNutrientStatus, getSettings, saveSetting } from "./api.js";

const birthDateInput = document.querySelector("#birth-date-input");
const absorptionRateInput = document.querySelector("#absorption-rate-input");
const saveBabySettingsButton = document.querySelector("#save-baby-settings-button");
const babySettingsStatus = document.querySelector("#baby-settings-status");
const periodInputs = document.querySelectorAll('input[name="period"]');
const nutritionStatus = document.querySelector("#nutrition-status");

const DEFAULT_ABSORPTION_RATE = 10;

let selectedPeriod = "day";

function todayString() {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function showBabySettingsStatus(message, type = "info") {
  babySettingsStatus.textContent = message;
  babySettingsStatus.className = `status-message ${type}`;
}

async function loadBabySettings() {
  try {
    const data = await getSettings();
    const birthDate = data.settings?.["生年月日"] || "";
    const absorptionRate = data.settings?.["鉄吸収率"] || String(DEFAULT_ABSORPTION_RATE);
    birthDateInput.value = birthDate;
    absorptionRateInput.value = absorptionRate;
  } catch (error) {
    console.warn(error);
    showBabySettingsStatus("設定の取得に失敗しました。", "error");
  }
}

saveBabySettingsButton.addEventListener("click", async () => {
  const birthDate = birthDateInput.value;
  const absorptionRate = absorptionRateInput.value || String(DEFAULT_ABSORPTION_RATE);

  if (!birthDate) {
    showBabySettingsStatus("生年月日を選択してください。", "error");
    return;
  }

  try {
    saveBabySettingsButton.disabled = true;
    await saveSetting("生年月日", birthDate);
    await saveSetting("鉄吸収率", absorptionRate);
    showBabySettingsStatus("設定を保存しました。", "success");
    await loadStatus();
  } catch (error) {
    console.error(error);
    showBabySettingsStatus("設定の保存に失敗しました。", "error");
  } finally {
    saveBabySettingsButton.disabled = false;
  }
});

periodInputs.forEach((input) => {
  input.addEventListener("change", () => {
    selectedPeriod = input.value;
    loadStatus();
  });
});

function renderNutrientCard(label, unit, data) {
  if (!data || data.target === null || data.target === undefined) {
    return `
      <div class="nutrient-card">
        <h3>${label}</h3>
        <p class="food-info-empty">計算できませんでした。</p>
      </div>
    `;
  }

  const percentage = data.percentage ?? 0;
  const isOver = percentage >= 100;

  return `
    <div class="nutrient-card">
      <h3>${label}</h3>
      <p class="nutrient-values">
        <span class="nutrient-intake">${data.intake}${unit}</span>
        <span class="nutrient-target"> / 目標 ${data.target}${unit}</span>
      </p>
      <div class="nutrient-bar-track">
        <div class="nutrient-bar-fill ${isOver ? "is-over" : ""}" style="width: ${Math.min(percentage, 100)}%"></div>
      </div>
      <p class="nutrient-percentage ${isOver ? "is-over" : ""}">${percentage}%</p>
    </div>
  `;
}

async function loadStatus() {
  nutritionStatus.innerHTML = `<p class="food-info-loading">読み込んでいます...</p>`;

  try {
    const data = await getNutrientStatus({
      period: selectedPeriod,
      date: todayString(),
    });

    if (!data.success) {
      nutritionStatus.innerHTML = `<p class="food-info-empty">${data.message || "計算できませんでした。設定を確認してください。"}</p>`;
      return;
    }

    const unmeasuredNote = data.unmeasuredCount > 0
      ? `<p class="helper-text">グラム数・さじ杯数が未入力の記録が${data.unmeasuredCount}件あり、集計に含まれていません。</p>`
      : "";

    nutritionStatus.innerHTML = `
      <p class="helper-text">対象月齢帯: ${data.ageBand}か月</p>
      <div class="nutrient-grid">
        ${renderNutrientCard("エネルギー", "kcal", data.energy)}
        ${renderNutrientCard("鉄(吸収量換算)", "mg", data.iron)}
      </div>
      ${unmeasuredNote}
    `;
  } catch (error) {
    console.warn(error);
    nutritionStatus.innerHTML = `<p class="food-info-empty">栄養素状況の取得に失敗しました。時間をおいて再度お試しください。</p>`;
  }
}

async function init() {
  await loadBabySettings();
  await loadStatus();
}

init();
