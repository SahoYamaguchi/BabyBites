export const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyY32HRJlPQf8Kyx4Uobn8XD7LGyYwKTdGoQL2u9RZEgZY_fvyp-tqPH1nM-VZ_uo1k/exec";

function ensureApiUrl() {
  if (!GAS_API_URL) {
    throw new Error("GAS_API_URL is not configured. js/api.js の先頭でURLを設定してください。");
  }
}

function buildApiUrl(action, params = {}) {
  ensureApiUrl();
  const url = new URL(GAS_API_URL);
  const searchParams = new URLSearchParams({ action });

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  });

  url.search = searchParams.toString();
  return url.toString();
}

async function requestJson(url, options = {}) {
  ensureApiUrl();

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error("API returned an unsuccessful response.");
  }

  return data;
}

export function getRecords() {
  return requestJson(buildApiUrl("getRecords"));
}

export function getFoodList() {
  return requestJson(buildApiUrl("getFoodList"));
}

export function addFood(foodName) {
  return requestJson(buildApiUrl("addFood", { foodName }));
}

export function getFoodInfo(foodName) {
  return requestJson(buildApiUrl("getFoodInfo", { foodName }));
}

export function getAllFoodNames() {
  return requestJson(buildApiUrl("getAllFoodNames"));
}

export function addRecord({ date, foodName, amountLabel, amountGram, spoonCount, mealType, reaction, memo }) {
  return requestJson(buildApiUrl("addRecord", {
    date,
    foodName,
    amountLabel,
    amountGram,
    spoonCount,
    mealType,
    reaction,
    memo,
  }));
}
