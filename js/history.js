import { getRecords } from "./api.js";

const historyList = document.querySelector("#history-list");
const statusMessage = document.querySelector("#status-message");
const reloadButton = document.querySelector("#reload-button");

const MEAL_TYPE_EMOJIS = {
  "朝ごはん": "🌅",
  "昼ごはん": "☀️",
  "おやつ": "🍪",
  "夜ごはん": "🌙",
};

const REACTION_EMOJIS = {
  "美味しい": "😋",
  "普通": "😐",
  "いまいち": "😖",
};

function showMessage(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function formatDateHeading(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// スプレッドシートが "20%" のような文字列を自動で 0.2 のような数値に
// 変換してしまうことがあるため、表示直前に %表記へ正規化する。
function formatPercentage(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const strValue = String(value).trim();
  if (strValue.endsWith("%")) {
    return strValue;
  }
  const numValue = Number(strValue);
  if (Number.isNaN(numValue)) {
    return strValue;
  }
  const percentValue = Math.abs(numValue) <= 1 ? numValue * 100 : numValue;
  return `${Math.round(percentValue)}%`;
}

function normalizeRecord(record) {
  const date = new Date(record.date);
  return {
    ...record,
    parsedDate: Number.isNaN(date.getTime()) ? new Date() : date,
  };
}

function groupRecordsByDate(records) {
  return records.reduce((groups, record) => {
    const dateKey = record.parsedDate.toISOString().slice(0, 10);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey).push(record);
    return groups;
  }, new Map());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
    return entities[character];
  });
}

function createRecordItem(record) {
  const item = document.createElement("article");
  item.className = "history-item";

  // index.htmlの入力順序(さじ→g→割合→反応→区分→メモ→日時)に合わせて表示する
  const spoonText = record.spoonCount ? `さじ${escapeHtml(record.spoonCount)}杯` : "";
  const gramText = record.amountGram ? `${escapeHtml(record.amountGram)}g` : "";
  const percentageText = formatPercentage(record.amountLabel);
  const amountParts = [spoonText, gramText, percentageText].filter(Boolean);

  const reactionDisplay = record.reaction ? (REACTION_EMOJIS[record.reaction] || escapeHtml(record.reaction)) : "";
  const mealTypeDisplay = record.mealType ? (MEAL_TYPE_EMOJIS[record.mealType] || escapeHtml(record.mealType)) : "";
  const memo = record.memo ? `<p class="history-memo">${escapeHtml(record.memo)}</p>` : "";

  item.innerHTML = `
    <div class="history-item-main">
      <div>
        <h3>${record.isFirstTime ? "🎉 " : ""}${escapeHtml(record.foodName || "未入力")}</h3>
        <p class="history-amount">${escapeHtml(amountParts.join(" / ") || "量未入力")}</p>
        ${reactionDisplay ? `<p class="history-reaction-line"><span class="history-reaction" aria-label="反応: ${escapeHtml(record.reaction)}">${reactionDisplay}</span></p>` : ""}
        ${mealTypeDisplay ? `<p class="history-meal-type">${mealTypeDisplay} ${escapeHtml(record.mealType)}</p>` : ""}
        ${memo}
        <time class="history-time" datetime="${record.parsedDate.toISOString()}">${formatTime(record.parsedDate)}</time>
      </div>
    </div>
  `;

  return item;
}

function renderHistory(records) {
  historyList.innerHTML = "";

  if (records.length === 0) {
    historyList.innerHTML = '<p class="empty-state">まだ記録がありません。</p>';
    return;
  }

  const normalizedRecords = records
    .map(normalizeRecord)
    .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
  const groupedRecords = groupRecordsByDate(normalizedRecords);

  [...groupedRecords.entries()]
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .forEach(([, dateRecords]) => {
      dateRecords.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

      const section = document.createElement("section");
      section.className = "history-day";

      const heading = document.createElement("h2");
      heading.textContent = formatDateHeading(dateRecords[0].parsedDate);
      section.append(heading);

      dateRecords.forEach((record) => section.append(createRecordItem(record)));
      historyList.append(section);
    });
}

async function loadRecords() {
  try {
    reloadButton.disabled = true;
    showMessage("履歴を読み込んでいます...", "info");
    const data = await getRecords();
    renderHistory(Array.isArray(data.records) ? data.records : []);
    showMessage("", "info");
  } catch (error) {
    console.error(error);
    showMessage("履歴の取得に失敗しました。API URLの設定や通信状況を確認してください。", "error");
  } finally {
    reloadButton.disabled = false;
  }
}

reloadButton.addEventListener("click", loadRecords);
loadRecords();
