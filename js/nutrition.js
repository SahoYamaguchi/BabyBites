import { getDailyEnergy, getNutrientStatus } from "./api.js";

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

// ----- 1日の摂取カロリー推移(SVG折れ線) -----

const trendRangeInputs = document.querySelectorAll('input[name="trend-range"]');
const energyChartEl = document.querySelector("#energy-chart");
let trendDays = 14;
let trendData = [];

trendRangeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    trendDays = Number(input.value);
    loadEnergyTrend();
  });
});

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function niceCeil(value) {
  if (value <= 0) {
    return 100;
  }
  const step = value <= 200 ? 50 : value <= 600 ? 100 : 200;
  return Math.ceil(value / step) * step;
}

function formatShortDate(dateKey) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function renderEnergyChart() {
  energyChartEl.innerHTML = "";

  if (trendData.length === 0) {
    return;
  }

  const width = Math.max(energyChartEl.clientWidth || 320, 280);
  const height = 240;
  const margin = { top: 16, right: 16, bottom: 28, left: 40 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const targets = trendData.map((d) => d.target).filter((t) => t !== null);
  const maxValue = niceCeil(Math.max(...trendData.map((d) => d.energy), ...targets, 0) * 1.1);

  const xAt = (index) => margin.left + (trendData.length === 1 ? plotWidth / 2 : (plotWidth * index) / (trendData.length - 1));
  const yAt = (value) => margin.top + plotHeight - (value / maxValue) * plotHeight;

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width, height, role: "img", "aria-label": `直近${trendDays}日の摂取エネルギー(kcal)の推移` });
  svg.classList.add("energy-svg");

  // 横罫線(4分割)と縦軸ラベル
  for (let i = 0; i <= 4; i += 1) {
    const value = (maxValue / 4) * i;
    const y = yAt(value);
    svg.append(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: "chart-grid" }));
    const label = svgEl("text", { x: margin.left - 6, y: y + 4, "text-anchor": "end", class: "chart-axis-text" });
    label.textContent = Math.round(value);
    svg.append(label);
  }

  // 横軸ラベル(混み合わないよう間引く)
  const labelEvery = Math.ceil(trendData.length / 7);
  trendData.forEach((d, index) => {
    if (index % labelEvery !== 0 && index !== trendData.length - 1) {
      return;
    }
    const label = svgEl("text", { x: xAt(index), y: height - 8, "text-anchor": "middle", class: "chart-axis-text" });
    label.textContent = formatShortDate(d.date);
    svg.append(label);
  });

  // 目標ライン
  const targetPoints = trendData
    .map((d, index) => (d.target === null ? null : `${xAt(index)},${yAt(d.target)}`))
    .filter(Boolean);
  if (targetPoints.length > 1) {
    svg.append(svgEl("polyline", { points: targetPoints.join(" "), class: "chart-target-line", fill: "none" }));
  }
  const lastTargetIndex = trendData.reduce((found, d, i) => (d.target === null ? found : i), -1);
  if (lastTargetIndex !== -1) {
    const targetLabel = svgEl("text", { x: width - margin.right, y: yAt(trendData[lastTargetIndex].target) - 6, "text-anchor": "end", class: "chart-axis-text" });
    targetLabel.textContent = `目標 ${trendData[lastTargetIndex].target}kcal`;
    svg.append(targetLabel);
  }

  // 折れ線(記録がない日は線を途切れさせる)
  const segments = [];
  let segment = [];
  trendData.forEach((d, index) => {
    if (d.recordCount > 0) {
      segment.push(`${xAt(index)},${yAt(d.energy)}`);
    } else if (segment.length > 0) {
      segments.push(segment);
      segment = [];
    }
  });
  if (segment.length > 0) {
    segments.push(segment);
  }
  segments.forEach((points) => {
    if (points.length > 1) {
      svg.append(svgEl("polyline", { points: points.join(" "), class: "chart-line", fill: "none" }));
    }
  });

  trendData.forEach((d, index) => {
    if (d.recordCount > 0) {
      svg.append(svgEl("circle", { cx: xAt(index), cy: yAt(d.energy), r: 4, class: "chart-dot" }));
    }
  });

  // ホバー: 十字線とツールチップ
  const crosshair = svgEl("line", { y1: margin.top, y2: margin.top + plotHeight, class: "chart-crosshair", visibility: "hidden" });
  svg.append(crosshair);

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.hidden = true;

  function showAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    trendData.forEach((_, index) => {
      if (Math.abs(xAt(index) - x) < Math.abs(xAt(nearest) - x)) {
        nearest = index;
      }
    });
    const d = trendData[nearest];
    crosshair.setAttribute("x1", xAt(nearest));
    crosshair.setAttribute("x2", xAt(nearest));
    crosshair.setAttribute("visibility", "visible");

    tooltip.innerHTML = "";
    const valueLine = document.createElement("div");
    valueLine.className = "chart-tooltip-value";
    valueLine.textContent = d.recordCount > 0 ? `${d.energy} kcal` : "記録なし";
    const dateLine = document.createElement("div");
    dateLine.className = "chart-tooltip-date";
    dateLine.textContent = formatShortDate(d.date);
    tooltip.append(valueLine, dateLine);
    if (d.target !== null) {
      const targetLine = document.createElement("div");
      targetLine.className = "chart-tooltip-date";
      targetLine.textContent = `目標 ${d.target} kcal`;
      tooltip.append(targetLine);
    }
    tooltip.hidden = false;
    const left = (xAt(nearest) / width) * rect.width;
    tooltip.style.left = `${Math.min(Math.max(left, 50), rect.width - 50)}px`;
  }

  function hide() {
    crosshair.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  }

  svg.addEventListener("pointermove", (event) => showAt(event.clientX));
  svg.addEventListener("pointerdown", (event) => showAt(event.clientX));
  svg.addEventListener("pointerleave", hide);

  const wrapper = document.createElement("div");
  wrapper.className = "energy-chart-plot";
  wrapper.append(svg, tooltip);
  energyChartEl.append(wrapper);

  const note = document.createElement("p");
  note.className = "helper-text";
  note.textContent = targets.length > 0
    ? "細い線は1日の目標(必要量−母乳)です。記録のない日は線をつなぎません。栄養素マスタに登録がない食材は含まれません。"
    : "生年月日を設定すると目標ラインが表示されます。記録のない日は線をつなぎません。";
  energyChartEl.append(note);

  // 表ビュー(ホバーできない環境・読み上げ用)
  const details = document.createElement("details");
  details.className = "chart-table-view";
  const summary = document.createElement("summary");
  summary.textContent = "数値を表で見る";
  const table = document.createElement("table");
  table.className = "chart-table";
  const headRow = document.createElement("tr");
  ["日付", "摂取(kcal)", "目標(kcal)"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    headRow.append(th);
  });
  table.append(headRow);
  [...trendData].reverse().forEach((d) => {
    const tr = document.createElement("tr");
    [formatShortDate(d.date), d.recordCount > 0 ? d.energy : "記録なし", d.target ?? "-"].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    });
    table.append(tr);
  });
  details.append(summary, table);
  energyChartEl.append(details);
}

async function loadEnergyTrend() {
  energyChartEl.style.opacity = "0.5";
  try {
    const data = await getDailyEnergy({ days: trendDays, date: todayString() });
    trendData = Array.isArray(data.days) ? data.days : [];
    energyChartEl.style.opacity = "";
    renderEnergyChart();
  } catch (error) {
    console.warn(error);
    energyChartEl.style.opacity = "";
    energyChartEl.innerHTML = `<p class="food-info-empty">カロリー推移の取得に失敗しました。時間をおいて再度お試しください。</p>`;
  }
}

let resizeTimer;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(renderEnergyChart, 150);
});

loadEnergyTrend();
