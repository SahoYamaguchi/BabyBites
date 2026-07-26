import { getNutrientStatus } from "./api.js";

const periodInputs = document.querySelectorAll('input[name="period"]');
const nutritionStatus = document.querySelector("#nutrition-status");

const NUTRIENT_ORDER = ["energy", "iron", "protein", "zinc", "calcium", "vitaminD"];

let selectedPeriod = "day";

function todayString() {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

periodInputs.forEach((input) => {
  input.addEventListener("change", () => {
    selectedPeriod = input.value;
    loadStatus();
  });
});

function renderNutrientCard(data) {
  if (!data) {
    return "";
  }

  if (data.target === null || data.target === undefined) {
    return `
      <div class="nutrient-card">
        <h3>${data.label}</h3>
        <p class="food-info-empty">まだデータが揃っていません。</p>
      </div>
    `;
  }

  const percentage = data.percentage ?? 0;
  const isOver = percentage >= 100;

  return `
    <div class="nutrient-card">
      <h3>${data.label}</h3>
      <p class="nutrient-values">
        <span class="nutrient-intake">${data.intake}${data.unit}</span>
        <span class="nutrient-target"> / 目標 ${data.target}${data.unit}</span>
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
      nutritionStatus.innerHTML = `<p class="food-info-empty">${data.message || "計算できませんでした。設定画面で生年月日を登録してください。"}</p>`;
      return;
    }

    const unmeasuredNote = data.unmeasuredCount > 0
      ? `<p class="helper-text">グラム数・さじ杯数が未入力の記録が${data.unmeasuredCount}件あり、集計に含まれていません。</p>`
      : "";

    const cards = NUTRIENT_ORDER.map((key) => renderNutrientCard(data[key])).join("");

    nutritionStatus.innerHTML = `
      <p class="helper-text">対象月齢帯: ${data.ageBand}か月</p>
      <div class="nutrient-grid">
        ${cards}
      </div>
      ${unmeasuredNote}
    `;
  } catch (error) {
    console.warn(error);
    nutritionStatus.innerHTML = `<p class="food-info-empty">栄養素状況の取得に失敗しました。時間をおいて再度お試しください。</p>`;
  }
}

loadStatus();
