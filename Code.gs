const SHEET_NAMES = {
  records: "記録",
  foods: "食材",
  cautions: "注意点",
  cookingMethods: "調理法",
  masterFoods: "食材マスタ",
  settings: "設定",
  instaRecords: "インスタ記録",
  nutrients: "栄養素マスタ",
  nutrientTargets: "摂取基準マスタ",
  recipes: "レシピ",
};

const HEADERS = {
  records: [
    "日時",
    "食材名",
    "量ラベル",
    "グラム数",
    "さじ杯数",
    "食事区分",
    "反応",
    "メモ",
    "初回",
  ],
  foods: ["食材名"],
  cautions: ["食材名", "注意点", "参照元"],
  cookingMethods: ["食材名", "調理法", "参照元"],
  masterFoods: ["食材マスタ", "登録日", "カテゴリ", "表示グループ"],
  settings: ["項目", "値"],
  instaRecords: ["日目", "食目", "材料", "使用食材", "要約"],
  nutrients: [
    "食材名マスタ",
    "エネルギー(kcal/100g)",
    "鉄(mg/100g)",
    "たんぱく質(g/100g)",
    "ビタミンC(mg)",
    "亜鉛(mg/100g)",
    "ビタミンA(μgRE/100g)",
    "カルシウム(mg/100g)",
    "ビタミンD(μg/100g)",
    "調理法",
    "出典",
  ],
  nutrientTargets: [
    "月齢帯",
    "必要エネルギー(kcal)",
    "母乳エネルギー(kcal)",
    "必要吸収鉄(mg)",
    "母乳吸収鉄(mg)",
    "必要亜鉛(mg)",
    "母乳亜鉛(mg)",
    "必要カルシウム(mg)",
    "母乳カルシウム(mg)",
    "必要ビタミンD(μg)",
    "母乳ビタミンD(μg)",
    "必要タンパク質(g)",
    "母乳タンパク質(g)",
  ],
  recipes: ["日目", "食目", "レシピ名", "材料", "使用食材"],
};

function doGet(e) {
  return handleRequest(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  const params =
    e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};
  return handleRequest(params);
}

function handleRequest(params) {
  try {
    checkRateLimit();

    if (WRITE_ACTIONS.includes(params.action) && params.token !== API_TOKEN) {
      return jsonResponse({ success: false, message: "Unauthorized" });
    }

    switch (params.action) {
      case "addRecord":
        return jsonResponse(addRecord(params));
      case "addRecords":
        return jsonResponse(addRecords(params));
      case "getRecords":
        return jsonResponse(getRecords());
      case "getFoodList":
        return jsonResponse(getFoodList());
      case "addFood":
        return jsonResponse(addFood(params));
      case "addMasterFood":
        return jsonResponse(addMasterFood(params));
      case "getFoodInfo":
        return jsonResponse(getFoodInfo(params));
      case "getFoodMaster":
        return jsonResponse(getFoodMaster());
      case "getSettings":
        return jsonResponse(getSettings());
      case "saveSetting":
        return jsonResponse(saveSetting(params));
      case "getInstaRecords":
        return jsonResponse(getInstaRecords(params));
      case "getNutrientStatus":
        return jsonResponse(getNutrientStatus(params));
      case "getDailyEnergy":
        return jsonResponse(getDailyEnergy(params));
      case "getRecipes":
        return jsonResponse(getRecipes(params));
      default:
        return jsonResponse({ success: false, message: "Unknown action" });
    }
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  }
}

function addRecord(params) {
  const sheet = getOrCreateSheet(SHEET_NAMES.records, HEADERS.records);
  const foodName = String(params.foodName || "").trim();
  const isFirstTime = !hasRecordedFood(foodName);

  sheet.appendRow([
    params.date || "",
    foodName,
    params.amountLabel || "",
    params.amountGram || "",
    params.spoonCount || "",
    params.mealType || "",
    params.reaction || "",
    params.memo || "",
    isFirstTime,
  ]);

  if (foodName) {
    addFood({ foodName });
  }

  return { success: true, isFirstTime };
}

function getRecords() {
  const sheet = getOrCreateSheet(SHEET_NAMES.records, HEADERS.records);
  const rows = getDataRows(sheet);
  const energyMap = getEnergyPer100gMap();

  const records = rows
    .map((row) => {
      const foodName = String(row[1] || "").trim();
      const grams = estimateGrams({
        amountGram: row[3],
        spoonCount: row[4],
        amountLabel: row[2],
      });
      const per100 = energyMap[foodName];
      const energy =
        per100 && grams > 0 ? Math.round((grams / 100) * per100) : null;

      return {
        date: row[0] || "",
        foodName: row[1] || "",
        amountLabel: row[2] || "",
        amountGram: row[3] || "",
        spoonCount: row[4] || "",
        mealType: row[5] || "",
        reaction: row[6] || "",
        memo: row[7] || "",
        isFirstTime: row[8] === true || row[8] === "TRUE" || row[8] === "true",
        energy,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { success: true, records };
}

function addFood(params) {
  const sheet = getOrCreateSheet(SHEET_NAMES.foods, HEADERS.foods);
  const foodName = String(params.foodName || "").trim();

  if (!foodName) {
    return { success: false, message: "foodName is required" };
  }

  let foods = getFoodNames(sheet); // 上から順(=新しい順になる想定)
  foods = foods.filter((name) => name !== foodName); // 既存のものは一旦除去
  foods.unshift(foodName); // 先頭に追加
  foods = foods.slice(0, 12); // 最新12件だけ残す

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
  foods.forEach((name, index) => {
    sheet.getRange(2 + index, 1).setValue(name);
  });

  return { success: true };
}

function getFoodList() {
  const sheet = getOrCreateSheet(SHEET_NAMES.foods, HEADERS.foods);
  return { success: true, foods: getFoodNames(sheet) };
}

function getFoodInfo(params) {
  const foodName = String(params.foodName || "").trim();

  if (!foodName) {
    return { success: false, message: "foodName is required" };
  }

  return {
    success: true,
    foodName,
    cautions: getFoodInfoRows(
      SHEET_NAMES.cautions,
      HEADERS.cautions,
      foodName,
      ["注意点", "内容", "要約", "メモ"],
    ),
    cookingMethods: getFoodInfoRows(
      SHEET_NAMES.cookingMethods,
      HEADERS.cookingMethods,
      foodName,
      ["調理法", "内容", "要約", "メモ"],
    ),
  };
}

function getFoodInfoRows(
  sheetName,
  headers,
  foodName,
  contentHeaderCandidates,
) {
  const sheet = getOrCreateInfoSheet(sheetName, headers);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headerRow = values[0].map((header) => String(header || "").trim());
  const foodNameIndex = findHeaderIndex(headerRow, ["食材名", "食材", "材料"]);
  const contentIndex = findHeaderIndex(headerRow, contentHeaderCandidates);
  const sourceIndex = findHeaderIndex(headerRow, [
    "参照元",
    "出典",
    "日目",
    "食目",
  ]);

  if (foodNameIndex === -1 || contentIndex === -1) {
    return [];
  }

  return values.slice(1).reduce((items, row) => {
    const rowFoodName = String(row[foodNameIndex] || "").trim();
    const content = String(row[contentIndex] || "").trim();

    if (
      normalizeFoodName(rowFoodName) !== normalizeFoodName(foodName) ||
      !content
    ) {
      return items;
    }

    items.push({
      text: content,
      source: sourceIndex === -1 ? "" : String(row[sourceIndex] || "").trim(),
    });
    return items;
  }, []);
}

function findHeaderIndex(headers, candidates) {
  return candidates.reduce((foundIndex, candidate) => {
    if (foundIndex !== -1) {
      return foundIndex;
    }
    return headers.findIndex((header) => header.includes(candidate));
  }, -1);
}

function hasRecordedFood(foodName) {
  if (!foodName) {
    return false;
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.records, HEADERS.records);
  return getDataRows(sheet).some((row) => row[1] === foodName);
}

function getFoodNames(sheet) {
  return getDataRows(sheet)
    .map((row) => String(row[0] || "").trim())
    .filter(Boolean);
}

function getDataRows(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
}

function getOrCreateInfoSheet(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    ensureHeaders(sheet, headers);
    return sheet;
  }

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    ensureHeaders(sheet, headers);
  }

  return sheet;
}

function getOrCreateSheet(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  ensureHeaders(sheet, headers);
  return sheet;
}

function ensureHeaders(sheet, headers) {
  let currentHeaders =
    sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];

  if (
    headers.includes("反応") &&
    !currentHeaders.includes("反応") &&
    currentHeaders[6] === "メモ"
  ) {
    sheet.insertColumnBefore(7);
    sheet.getRange(1, 7).setValue("反応");
    currentHeaders = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
  }

  headers.forEach((header, index) => {
    if (currentHeaders[index] !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function normalizeFoodName(name) {
  return String(name || "")
    .trim()
    .replace(/[\s　]+/g, "") // 空白除去
    .replace(/[()（）].*$/, ""); // 末尾のカッコ書き除去(例:「しらす(生)」→「しらす」)
}

function getFoodMaster() {
  const sheet = getOrCreateSheet(SHEET_NAMES.masterFoods, HEADERS.masterFoods);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return { success: true, foods: [] };
  }

  const headerRow = values[0].map((header) => String(header || "").trim());
  const nameIndex = findHeaderIndex(headerRow, [
    "食材名マスタ",
    "食材名",
    "食材",
  ]);
  const categoryIndex = findHeaderIndex(headerRow, ["カテゴリ"]);
  const displayGroupIndex = findHeaderIndex(headerRow, ["表示グループ"]);

  if (nameIndex === -1) {
    return { success: true, foods: [] };
  }

  const foods = values.slice(1).reduce((items, row) => {
    const name = String(row[nameIndex] || "").trim();
    if (!name) {
      return items;
    }
    const category =
      categoryIndex === -1
        ? "その他"
        : String(row[categoryIndex] || "").trim() || "その他";
    const displayGroupRaw =
      displayGroupIndex === -1
        ? ""
        : String(row[displayGroupIndex] || "").trim();
    items.push({ name, category, displayGroup: displayGroupRaw || name });
    return items;
  }, []);

  return { success: true, foods };
}

// 表記揺れ検知
function findUnmatchedFoodNames() {
  const masterNames = new Set(
    getFoodNames(getOrCreateSheet(SHEET_NAMES.foods, HEADERS.foods)),
  );
  const sheets = [SHEET_NAMES.cautions, SHEET_NAMES.cookingMethods];
  const unmatched = [];

  sheets.forEach((sheetName) => {
    const sheet = getOrCreateInfoSheet(sheetName, HEADERS[sheetName]);
    const values = sheet.getDataRange().getValues();
    const headerRow = values[0].map((h) => String(h || "").trim());
    const foodNameIndex = findHeaderIndex(headerRow, [
      "食材名",
      "食材",
      "材料",
    ]);

    values.slice(1).forEach((row) => {
      const name = String(row[foodNameIndex] || "").trim();
      if (name && !masterNames.has(name)) {
        unmatched.push({ sheet: sheetName, name });
      }
    });
  });

  return unmatched;
}

function getSettings() {
  const sheet = getOrCreateSheet(SHEET_NAMES.settings, HEADERS.settings);
  const values = sheet.getDataRange().getValues();
  const settings = {};

  if (values.length >= 2) {
    const headerRow = values[0].map((h) => String(h || "").trim());
    const keyIndex = findHeaderIndex(headerRow, ["項目"]);
    const valueIndex = findHeaderIndex(headerRow, ["値"]);

    if (keyIndex !== -1 && valueIndex !== -1) {
      values.slice(1).forEach((row) => {
        const key = String(row[keyIndex] || "").trim();
        if (key) {
          settings[key] =
            row[valueIndex] instanceof Date
              ? Utilities.formatDate(
                  row[valueIndex],
                  Session.getScriptTimeZone(),
                  "yyyy-MM-dd",
                )
              : String(row[valueIndex] || "").trim();
        }
      });
    }
  }

  return { success: true, settings };
}

function saveSetting(params) {
  const key = String(params.key || "").trim();
  const value = String(params.value || "").trim();

  if (!key) {
    return { success: false, message: "key is required" };
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.settings, HEADERS.settings);
  const values = sheet.getDataRange().getValues();
  const headerRow =
    values.length > 0
      ? values[0].map((h) => String(h || "").trim())
      : HEADERS.settings;
  const keyIndex = findHeaderIndex(headerRow, ["項目"]);
  const valueIndex = findHeaderIndex(headerRow, ["値"]);

  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][keyIndex] || "").trim() === key) {
      sheet.getRange(i + 1, valueIndex + 1).setValue(value);
      return { success: true };
    }
  }

  sheet.appendRow([key, value]);
  return { success: true };
}

function getInstaRecords(params) {
  const week = params.week ? Number(params.week) : null;
  const day = params.day ? Number(params.day) : null;
  const keyword = String(params.keyword || "").trim();

  const sheet = getOrCreateSheet(
    SHEET_NAMES.instaRecords,
    HEADERS.instaRecords,
  );
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return { success: true, records: [], availableWeeks: [] };
  }

  const headerRow = values[0].map((h) => String(h || "").trim());
  const dayIndex = findHeaderIndex(headerRow, ["日目"]);
  const mealIndex = findHeaderIndex(headerRow, ["食目"]);
  const ingredientIndex = findHeaderIndex(headerRow, ["材料"]);
  const usedFoodsIndex = findHeaderIndex(headerRow, ["使用食材"]);
  const summaryIndex = findHeaderIndex(headerRow, ["要約"]);

  const allRecords = values.slice(1).reduce((items, row) => {
    const recordDay = Number(row[dayIndex]);
    if (!recordDay) {
      return items;
    }
    const usedFoods =
      usedFoodsIndex === -1
        ? []
        : String(row[usedFoodsIndex] || "")
            .split(",")
            .map((food) => food.trim())
            .filter(Boolean);

    items.push({
      day: recordDay,
      week: Math.ceil(recordDay / 7),
      meal: mealIndex === -1 ? "" : String(row[mealIndex] || "").trim(),
      ingredient:
        ingredientIndex === -1 ? "" : String(row[ingredientIndex] || "").trim(),
      usedFoods,
      summary:
        summaryIndex === -1 ? "" : String(row[summaryIndex] || "").trim(),
    });
    return items;
  }, []);

  const availableWeeks = [...new Set(allRecords.map((r) => r.week))].sort(
    (a, b) => a - b,
  );

  const filtered = allRecords.filter((record) => {
    const matchesDay = day ? record.day === day : true;
    const matchesWeek = week ? record.week === week : true;
    const matchesKeyword = keyword
      ? record.ingredient.includes(keyword) ||
        record.summary.includes(keyword) ||
        record.usedFoods.includes(keyword)
      : true;
    return matchesDay && matchesWeek && matchesKeyword;
  });

  filtered.sort((a, b) => a.day - b.day || a.meal.localeCompare(b.meal, "ja"));

  return { success: true, records: filtered, availableWeeks };
}

function getMonthsOld(birthDateStr, targetDateStr) {
  const birth = new Date(`${birthDateStr}T00:00:00`);
  const target = new Date(`${targetDateStr}T00:00:00`);
  const yearsDiff = target.getFullYear() - birth.getFullYear();
  const monthsDiff = target.getMonth() - birth.getMonth();
  let months = yearsDiff * 12 + monthsDiff;
  if (target.getDate() < birth.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

function getAgeBand(months) {
  if (months < 5) return null; // 補完食開始前は対象外
  if (months <= 6) return "5-6";
  if (months <= 8) return "7-8";
  if (months <= 11) return "9-11";
  return "12-23";
}

// ----- 栄養素計算(6栄養素対応の汎用ロジック) -----

const NUTRIENT_DEFINITIONS = [
  {
    key: "energy",
    label: "エネルギー",
    unit: "kcal",
    needHeader: "必要エネルギー",
    milkHeader: "母乳エネルギー",
    masterHeader: "エネルギー",
    usesAbsorptionRate: false,
  },
  {
    key: "iron",
    label: "鉄(吸収量換算)",
    unit: "mg",
    needHeader: "必要吸収鉄",
    milkHeader: "母乳吸収鉄",
    masterHeader: "鉄",
    usesAbsorptionRate: true,
  },
  {
    key: "protein",
    label: "たんぱく質",
    unit: "g",
    needHeader: "必要タンパク質",
    milkHeader: "母乳タンパク質",
    masterHeader: "たんぱく質",
    usesAbsorptionRate: false,
  },
  {
    key: "zinc",
    label: "亜鉛",
    unit: "mg",
    needHeader: "必要亜鉛",
    milkHeader: "母乳亜鉛",
    masterHeader: "亜鉛",
    usesAbsorptionRate: false,
  },
  {
    key: "calcium",
    label: "カルシウム",
    unit: "mg",
    needHeader: "必要カルシウム",
    milkHeader: "母乳カルシウム",
    masterHeader: "カルシウム",
    usesAbsorptionRate: false,
  },
  {
    key: "vitaminD",
    label: "ビタミンD",
    unit: "μg",
    needHeader: "必要ビタミンD",
    milkHeader: "母乳ビタミンD",
    masterHeader: "ビタミンD",
    usesAbsorptionRate: false,
  },
];

function getNutrientTargetGaps(ageBand) {
  const sheet = getOrCreateSheet(
    SHEET_NAMES.nutrientTargets,
    HEADERS.nutrientTargets,
  );
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }
  const headerRow = values[0].map((h) => String(h || "").trim());
  const bandIndex = findHeaderIndex(headerRow, ["月齢帯"]);

  const row = values
    .slice(1)
    .find((r) => String(r[bandIndex] || "").trim() === ageBand);
  if (!row) {
    return null;
  }

  const gaps = {};
  NUTRIENT_DEFINITIONS.forEach((def) => {
    const needIndex = findHeaderIndex(headerRow, [def.needHeader]);
    const milkIndex = findHeaderIndex(headerRow, [def.milkHeader]);
    if (needIndex === -1 || milkIndex === -1) {
      gaps[def.key] = null;
      return;
    }
    const need = Number(row[needIndex]);
    const milk = Number(row[milkIndex]);
    gaps[def.key] =
      Number.isNaN(need) || Number.isNaN(milk) ? null : need - milk;
  });

  return gaps;
}

function getNutrientPer100g(foodName) {
  const sheet = getOrCreateSheet(SHEET_NAMES.nutrients, HEADERS.nutrients);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }
  const headerRow = values[0].map((h) => String(h || "").trim());
  const nameIndex = findHeaderIndex(headerRow, ["食材名マスタ", "食材名"]);

  const row = values
    .slice(1)
    .find((r) => String(r[nameIndex] || "").trim() === foodName);
  if (!row) {
    return null;
  }

  const perNutrient = {};
  NUTRIENT_DEFINITIONS.forEach((def) => {
    const index = findHeaderIndex(headerRow, [def.masterHeader]);
    perNutrient[def.key] = index === -1 ? 0 : Number(row[index]) || 0;
  });
  return perNutrient;
}

function getDateRangeForPeriod(dateStr, period) {
  const baseDate = new Date(`${dateStr}T00:00:00`);
  if (period === "week") {
    const dayOfWeek = baseDate.getDay(); // 0=日曜
    const start = new Date(baseDate);
    start.setDate(start.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end, days: 7 };
  }
  const start = new Date(baseDate);
  const end = new Date(baseDate);
  end.setDate(end.getDate() + 1);
  return { start, end, days: 1 };
}

function parsePercentage(value) {
  const str = String(value || "").trim();
  if (!str) {
    return null;
  }
  if (str.endsWith("%")) {
    const num = Number(str.replace("%", ""));
    return Number.isNaN(num) ? null : num / 100;
  }
  // スプレッドシート側で自動的に数値化されているケース(例: "80%" → 0.8)
  const num = Number(str);
  if (Number.isNaN(num)) {
    return null;
  }
  return Math.abs(num) <= 1 ? num : num / 100;
}

function estimateGrams(record) {
  const preparedGrams = record.amountGram
    ? Number(record.amountGram)
    : record.spoonCount
      ? Number(record.spoonCount) * 5
      : 0;

  const percentage = parsePercentage(record.amountLabel);
  return preparedGrams * (percentage === null ? 1 : percentage);
}

function getNutrientStatus(params) {
  const period = params.period === "week" ? "week" : "day";
  const dateStr =
    params.date ||
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  const settingsResult = getSettings();
  const birthDate = settingsResult.settings["生年月日"];
  const absorptionRate =
    Number(settingsResult.settings["鉄吸収率"] || 10) / 100;

  if (!birthDate) {
    return { success: false, message: "生年月日が設定されていません" };
  }

  const months = getMonthsOld(birthDate, dateStr);
  const ageBand = getAgeBand(months);

  if (!ageBand) {
    return {
      success: false,
      message: "まだ補完食の対象月齢(5ヶ月)に達していません",
    };
  }

  const gaps = getNutrientTargetGaps(ageBand);
  if (!gaps) {
    return {
      success: false,
      message: "該当する月齢帯の摂取基準が見つかりません",
    };
  }

  const { start, end, days } = getDateRangeForPeriod(dateStr, period);

  const recordSheet = getOrCreateSheet(SHEET_NAMES.records, HEADERS.records);
  const values = recordSheet.getDataRange().getValues();
  const headerRow = values[0].map((h) => String(h || "").trim());
  const dateIndex = findHeaderIndex(headerRow, ["日時"]);
  const foodIndex = findHeaderIndex(headerRow, ["食材名"]);
  const gramIndex = findHeaderIndex(headerRow, ["グラム数"]);
  const spoonIndex = findHeaderIndex(headerRow, ["さじ杯数"]);
  const amountLabelIndex = findHeaderIndex(headerRow, ["量ラベル"]);

  const totals = {};
  NUTRIENT_DEFINITIONS.forEach((def) => {
    totals[def.key] = 0;
  });
  let unmeasuredCount = 0;

  values.slice(1).forEach((row) => {
    const recordDate = new Date(row[dateIndex]);
    if (recordDate < start || recordDate >= end) {
      return;
    }

    const foodName = String(row[foodIndex] || "").trim();
    const grams = estimateGrams({
      amountGram: row[gramIndex],
      spoonCount: spoonIndex === -1 ? "" : row[spoonIndex],
      amountLabel: amountLabelIndex === -1 ? "" : row[amountLabelIndex],
    });

    if (!grams) {
      unmeasuredCount += 1;
      return;
    }

    const nutrientPer100g = getNutrientPer100g(foodName);
    if (!nutrientPer100g) {
      return;
    }

    NUTRIENT_DEFINITIONS.forEach((def) => {
      totals[def.key] += (grams / 100) * nutrientPer100g[def.key];
    });
  });

  const result = { success: true, period, ageBand, unmeasuredCount };

  NUTRIENT_DEFINITIONS.forEach((def) => {
    const gap = gaps[def.key];
    if (gap === null || gap === undefined) {
      result[def.key] = null;
      return;
    }

    const rawIntake = def.usesAbsorptionRate
      ? totals[def.key] * absorptionRate
      : totals[def.key];
    const target = gap * days;

    result[def.key] = {
      label: def.label,
      unit: def.unit,
      intake: Math.round(rawIntake * 100) / 100,
      target: Math.round(target * 100) / 100,
      percentage: target > 0 ? Math.round((rawIntake / target) * 100) : null,
    };
  });

  return result;
}

function testEstimateGrams() {
  Logger.log(
    estimateGrams({ amountGram: 10, spoonCount: "", amountLabel: "80%" }),
  ); // → 8
  Logger.log(
    estimateGrams({ amountGram: "", spoonCount: 2, amountLabel: "50%" }),
  ); // → 5 (2杯×5g×50%)
  Logger.log(
    estimateGrams({ amountGram: 10, spoonCount: "", amountLabel: "普通" }),
  ); // → 10 (割合不明なので100%扱い)
}

function testGetNutrientStatus() {
  const result = getNutrientStatus({
    period: "day",
    date: Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd",
    ),
  });
  Logger.log(JSON.stringify(result, null, 2));
}

const WRITE_ACTIONS = [
  "addRecord",
  "addRecords",
  "addFood",
  "addMasterFood",
  "saveSetting",
];
const API_TOKEN = "xxx"; // 例: 'babybites-9f3k2x'

function checkRateLimit() {
  const cache = CacheService.getScriptCache();
  const key = "request_count";
  const count = Number(cache.get(key) || 0);
  if (count > 60) {
    // 60秒間に60回まで
    throw new Error(
      "リクエストが多すぎます。しばらく待ってから再度お試しください。",
    );
  }
  cache.put(key, String(count + 1), 60);
}

function checkMasterConsistency() {
  const masterFoodNames = new Set(
    getDataRows(getOrCreateSheet(SHEET_NAMES.masterFoods, HEADERS.masterFoods))
      .map((row) => String(row[0] || "").trim())
      .filter(Boolean),
  );

  const nutrientFoodNames = new Set(
    getDataRows(getOrCreateSheet(SHEET_NAMES.nutrients, HEADERS.nutrients))
      .map((row) => String(row[0] || "").trim())
      .filter(Boolean),
  );

  const result = {
    masterVsNutrients: {
      inMasterNotInNutrients: [...masterFoodNames].filter(
        (name) => !nutrientFoodNames.has(name),
      ),
      inNutrientsNotInMaster: [...nutrientFoodNames].filter(
        (name) => !masterFoodNames.has(name),
      ),
    },
    unmatchedByLocation: [],
  };

  const checks = [
    {
      label: "調理法",
      sheetName: SHEET_NAMES.cookingMethods,
      headers: HEADERS.cookingMethods,
      nameHeaders: ["食材名", "食材", "材料"],
      splitComma: false,
    },
    {
      label: "注意点",
      sheetName: SHEET_NAMES.cautions,
      headers: HEADERS.cautions,
      nameHeaders: ["食材名", "食材", "材料"],
      splitComma: false,
    },
    {
      label: "インスタ記録(使用食材)",
      sheetName: SHEET_NAMES.instaRecords,
      headers: HEADERS.instaRecords,
      nameHeaders: ["使用食材"],
      splitComma: true,
    },
  ];

  checks.forEach(({ label, sheetName, headers, nameHeaders, splitComma }) => {
    const sheet = getOrCreateInfoSheet(sheetName, headers);
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return;
    }
    const headerRow = values[0].map((h) => String(h || "").trim());
    const nameIndex = findHeaderIndex(headerRow, nameHeaders);
    if (nameIndex === -1) {
      return;
    }

    values.slice(1).forEach((row) => {
      const rawValue = String(row[nameIndex] || "").trim();
      if (!rawValue) {
        return;
      }
      const names = splitComma
        ? rawValue
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean)
        : [rawValue];

      names.forEach((name) => {
        if (!masterFoodNames.has(name)) {
          result.unmatchedByLocation.push({ location: label, name });
        }
      });
    });
  });

  // レシピシートは列構成が確定しているので、使用食材列を突き合わせる
  const recipeSheet = getOrCreateSheet(SHEET_NAMES.recipes, HEADERS.recipes);
  const recipeValues = recipeSheet.getDataRange().getValues();
  if (recipeValues.length >= 2) {
    const headerRow = recipeValues[0].map((h) => String(h || "").trim());
    const nameIndex = findHeaderIndex(headerRow, ["使用食材"]);
    if (nameIndex !== -1) {
      recipeValues.slice(1).forEach((row) => {
        const rawValue = String(row[nameIndex] || "").trim();
        if (!rawValue) {
          return;
        }
        rawValue
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean)
          .forEach((name) => {
            if (!masterFoodNames.has(name)) {
              result.unmatchedByLocation.push({
                location: "レシピ(使用食材)",
                name,
              });
            }
          });
      });
    }
  }

  return result;
}

function testCheckMasterConsistency() {
  Logger.log(JSON.stringify(checkMasterConsistency(), null, 2));
}

function getRecipes(params) {
  const week = params.week ? Number(params.week) : null;
  const day = params.day ? Number(params.day) : null;
  const keyword = String(params.keyword || "").trim();

  const sheet = getOrCreateSheet(SHEET_NAMES.recipes, HEADERS.recipes);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return { success: true, records: [], availableWeeks: [] };
  }

  const headerRow = values[0].map((h) => String(h || "").trim());
  const dayIndex = findHeaderIndex(headerRow, ["日目"]);
  const mealIndex = findHeaderIndex(headerRow, ["食目"]);
  const nameIndex = findHeaderIndex(headerRow, ["レシピ名"]);
  const ingredientIndex = findHeaderIndex(headerRow, ["材料"]);
  const usedFoodsIndex = findHeaderIndex(headerRow, ["使用食材"]);

  const allRecords = values.slice(1).reduce((items, row) => {
    const recordDay = Number(row[dayIndex]);
    if (!recordDay) {
      return items;
    }
    const usedFoods =
      usedFoodsIndex === -1
        ? []
        : String(row[usedFoodsIndex] || "")
            .split(",")
            .map((food) => food.trim())
            .filter(Boolean);

    items.push({
      day: recordDay,
      week: Math.ceil(recordDay / 7),
      meal: mealIndex === -1 ? "" : String(row[mealIndex] || "").trim(),
      recipeName: nameIndex === -1 ? "" : String(row[nameIndex] || "").trim(),
      ingredients:
        ingredientIndex === -1 ? "" : String(row[ingredientIndex] || "").trim(),
      usedFoods,
    });
    return items;
  }, []);

  const availableWeeks = [...new Set(allRecords.map((r) => r.week))].sort(
    (a, b) => a - b,
  );

  const filtered = allRecords.filter((record) => {
    const matchesDay = day ? record.day === day : true;
    const matchesWeek = week ? record.week === week : true;
    const matchesKeyword = keyword
      ? record.recipeName.includes(keyword) ||
        record.ingredients.includes(keyword) ||
        record.usedFoods.includes(keyword)
      : true;
    return matchesDay && matchesWeek && matchesKeyword;
  });

  filtered.sort((a, b) => a.day - b.day || a.meal.localeCompare(b.meal, "ja"));

  return { success: true, records: filtered, availableWeeks };
}

// ---------------------------------------------------------------
// [追加 ①] 食材マスタに「食材名+カテゴリ」だけ追加
// 栄養素マスタには追加しない(栄養計算の対象外になるだけ)。
// すでに同じ食材(表記ゆれ含む)があれば追加せず、既存の名前を返す。
// ---------------------------------------------------------------
const MASTER_CATEGORIES = [
  "炭水化物",
  "野菜",
  "果物",
  "タンパク質",
  "乳製品",
  "ベビーフード",
  "その他",
];

function addMasterFood(params) {
  const name = String(params.name || "").trim();
  const category = String(params.category || "").trim();

  if (!name) {
    return { success: false, message: "name is required" };
  }
  if (!MASTER_CATEGORIES.includes(category)) {
    return { success: false, message: "invalid category" };
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.masterFoods, HEADERS.masterFoods);
  const values = sheet.getDataRange().getValues();
  const headerRow = values[0].map((h) => String(h || "").trim());
  const nameIndex = findHeaderIndex(headerRow, [
    "食材名マスタ",
    "食材名",
    "食材",
  ]);
  const dateIndex = findHeaderIndex(headerRow, ["登録日"]);
  const categoryIndex = findHeaderIndex(headerRow, ["カテゴリ"]);

  if (nameIndex === -1) {
    return { success: false, message: "食材マスタの見出しが見つかりません" };
  }

  const normalized = normalizeFoodName(name);
  const existing = values
    .slice(1)
    .map((row) => String(row[nameIndex] || "").trim())
    .find(
      (existingName) =>
        existingName === name || normalizeFoodName(existingName) === normalized,
    );

  if (existing) {
    return { success: true, added: false, name: existing };
  }

  const newRow = new Array(Math.max(headerRow.length, 1)).fill("");
  newRow[nameIndex] = name;
  if (dateIndex !== -1) {
    newRow[dateIndex] = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy/MM/dd",
    );
  }
  if (categoryIndex !== -1) {
    newRow[categoryIndex] = category;
  }
  sheet.appendRow(newRow);

  return { success: true, added: true, name, category };
}

// ---------------------------------------------------------------
// [追加 ③] 複数食材をまとめて記録
// params: date, mealType, reaction, memo(共通)
//         items = JSON文字列 [{foodName, amountLabel, amountGram, spoonCount}, ...]
// 「初回」はバッチ内の同じ食材が2つ以上あっても、最初の1件だけ true になる。
// ---------------------------------------------------------------
function addRecords(params) {
  let items;
  try {
    items = JSON.parse(params.items || "[]");
  } catch (e) {
    return { success: false, message: "items is not valid JSON" };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, message: "items is required" };
  }
  if (items.length > 20) {
    return { success: false, message: "too many items (max 20)" };
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.records, HEADERS.records);
  const recordedNames = new Set(
    getDataRows(sheet).map((row) => String(row[1] || "").trim()),
  );

  const rows = [];
  const results = [];

  items.forEach((item) => {
    const foodName = String(item.foodName || "").trim();
    if (!foodName) {
      return;
    }
    const isFirstTime = !recordedNames.has(foodName);
    recordedNames.add(foodName);

    rows.push([
      params.date || "",
      foodName,
      item.amountLabel || "",
      item.amountGram || "",
      item.spoonCount || "",
      params.mealType || "",
      params.reaction || "",
      params.memo || "",
      isFirstTime,
    ]);
    results.push({ foodName, isFirstTime });
  });

  if (rows.length === 0) {
    return { success: false, message: "no valid items" };
  }

  const startRow = sheet.getLastRow() + 1;
  sheet
    .getRange(startRow, 1, rows.length, HEADERS.records.length)
    .setValues(rows);

  // 履歴(MRU)は入力順に更新 → 最後に入れた食材が一番上に来る
  results.forEach((result) => addFood({ foodName: result.foodName }));

  return {
    success: true,
    count: rows.length,
    results,
    firstTimeFoods: results.filter((r) => r.isFirstTime).map((r) => r.foodName),
  };
}

// ---------------------------------------------------------------
// [追加 ②] 1日ごとの摂取エネルギー推移
// params: days(7/14/30 など。最大60), date(基準日 yyyy-MM-dd。省略時は今日)
// 戻り値: days = [{ date, energy, target, recordCount }]
//   target は「必要エネルギー − 母乳エネルギー」(月齢帯は日ごとに判定)
//   生年月日が未設定、または補完食開始前の日は target = null
// ---------------------------------------------------------------
function getEnergyPer100gMap() {
  const sheet = getOrCreateSheet(SHEET_NAMES.nutrients, HEADERS.nutrients);
  const values = sheet.getDataRange().getValues();
  const map = {};
  if (values.length < 2) {
    return map;
  }
  const headerRow = values[0].map((h) => String(h || "").trim());
  const nameIndex = findHeaderIndex(headerRow, ["食材名マスタ", "食材名"]);
  const energyIndex = findHeaderIndex(headerRow, ["エネルギー"]);
  if (nameIndex === -1 || energyIndex === -1) {
    return map;
  }
  values.slice(1).forEach((row) => {
    const name = String(row[nameIndex] || "").trim();
    if (name) {
      map[name] = Number(row[energyIndex]) || 0;
    }
  });
  return map;
}

function getDailyEnergy(params) {
  const tz = Session.getScriptTimeZone();
  const days = Math.min(Math.max(Number(params.days) || 14, 1), 60);
  const baseStr =
    params.date || Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  const baseDate = new Date(`${baseStr}T00:00:00`);

  const dateKeys = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    dateKeys.push(Utilities.formatDate(d, tz, "yyyy-MM-dd"));
  }

  const birthDate = getSettings().settings["生年月日"];
  const gapsByBand = {};
  const targetFor = (dateKey) => {
    if (!birthDate) {
      return null;
    }
    const band = getAgeBand(getMonthsOld(birthDate, dateKey));
    if (!band) {
      return null;
    }
    if (!(band in gapsByBand)) {
      const gaps = getNutrientTargetGaps(band);
      gapsByBand[band] = gaps && gaps.energy !== undefined ? gaps.energy : null;
    }
    return gapsByBand[band];
  };

  const energyMap = getEnergyPer100gMap();
  const totals = {};
  const counts = {};
  dateKeys.forEach((key) => {
    totals[key] = 0;
    counts[key] = 0;
  });

  const recordSheet = getOrCreateSheet(SHEET_NAMES.records, HEADERS.records);
  const values = recordSheet.getDataRange().getValues();

  if (values.length >= 2) {
    const headerRow = values[0].map((h) => String(h || "").trim());
    const dateIndex = findHeaderIndex(headerRow, ["日時"]);
    const foodIndex = findHeaderIndex(headerRow, ["食材名"]);
    const gramIndex = findHeaderIndex(headerRow, ["グラム数"]);
    const spoonIndex = findHeaderIndex(headerRow, ["さじ杯数"]);
    const labelIndex = findHeaderIndex(headerRow, ["量ラベル"]);

    values.slice(1).forEach((row) => {
      const recordDate = new Date(row[dateIndex]);
      if (Number.isNaN(recordDate.getTime())) {
        return;
      }
      const key = Utilities.formatDate(recordDate, tz, "yyyy-MM-dd");
      if (!(key in totals)) {
        return;
      }
      counts[key] += 1;

      const foodName = String(row[foodIndex] || "").trim();
      if (!(foodName in energyMap)) {
        return;
      }
      const grams = estimateGrams({
        amountGram: row[gramIndex],
        spoonCount: spoonIndex === -1 ? "" : row[spoonIndex],
        amountLabel: labelIndex === -1 ? "" : row[labelIndex],
      });
      totals[key] += (grams / 100) * energyMap[foodName];
    });
  }

  return {
    success: true,
    days: dateKeys.map((key) => {
      const target = targetFor(key);
      return {
        date: key,
        energy: Math.round(totals[key] * 10) / 10,
        target: target === null ? null : Math.round(target * 10) / 10,
        recordCount: counts[key],
      };
    }),
  };
}

function testGetDailyEnergy() {
  Logger.log(JSON.stringify(getDailyEnergy({ days: 7 }), null, 2));
}

function showConsistency() {
  Logger.log(JSON.stringify(checkMasterConsistency(), null, 2));
}
