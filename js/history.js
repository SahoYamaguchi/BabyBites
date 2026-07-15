import { getRecords } from "./api.js";

const historyList = document.querySelector("#history-list");
const statusMessage = document.querySelector("#status-message");
const reloadButton = document.querySelector("#reload-button");

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

function createRecordItem(record) {
  const item = document.createElement("article");
  item.className = "history-item";

  const amountParts = [record.amountLabel, record.amountGram ? `${record.amountGram}g` : ""].filter(Boolean);
  const memo = record.memo ? `<p class="history-memo">${escapeHtml(record.memo)}</p>` : "";

  item.innerHTML = `
    <div class="history-item-main">
      <time class="history-time" datetime="${record.parsedDate.toISOString()}">${formatTime(record.parsedDate)}</time>
      <div>
        <h3>${record.isFirstTime ? "🎉 " : ""}${escapeHtml(record.foodName || "未入力")}</h3>
        <p class="history-amount">${escapeHtml(amountParts.join(" / ") || "量未入力")}</p>
        ${memo}
      </div>
    </div>
  `;

  return item;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
    return entities[character];
  });
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

  groupedRecords.forEach((dateRecords) => {
    dateRecords.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

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
