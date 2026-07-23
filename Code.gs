const SHEET_NAMES = {
  records: '記録',
  foods: '食材',
  cautions: '注意点',
  cookingMethods: '調理法',
  masterFoods: '食材マスタ',
  settings: '設定',
  instaRecords: 'インスタ記録',
};

const HEADERS = {
  records: ['日時', '食材名', '量ラベル', 'グラム数', 'さじ杯数', '食事区分', '反応', 'メモ', '初回'],
  foods: ['食材名'],
  cautions: ['食材名', '注意点', '参照元'],
  cookingMethods: ['食材名', '調理法', '参照元'],
  masterFoods: ['食材マスタ','登録日','カテゴリ'],
  settings: ['項目', '値'],
  instaRecords: ['日目', '食目', '材料', '要約'],
};

function doGet(e) {
  return handleRequest(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  const params = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  return handleRequest(params);
}

function handleRequest(params) {
  try {
    switch (params.action) {
      case 'addRecord':
        return jsonResponse(addRecord(params));
      case 'getRecords':
        return jsonResponse(getRecords());
      case 'getFoodList':
        return jsonResponse(getFoodList());
      case 'addFood':
        return jsonResponse(addFood(params));
      case 'getFoodInfo':
        return jsonResponse(getFoodInfo(params));
      case 'getFoodMaster':
        return jsonResponse(getFoodMaster());
      case 'getSettings':
        return jsonResponse(getSettings());
      case 'saveSetting':
        return jsonResponse(saveSetting(params));
      case 'getInstaRecords':
        return jsonResponse(getInstaRecords(params));
      default:
        return jsonResponse({ success: false, message: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  }
}

function addRecord(params) {
  const sheet = getOrCreateSheet(SHEET_NAMES.records, HEADERS.records);
  const foodName = String(params.foodName || '').trim();
  const isFirstTime = !hasRecordedFood(foodName);

  sheet.appendRow([
    params.date || '',
    foodName,
    params.amountLabel || '',
    params.amountGram || '',
    params.spoonCount || '',
    params.mealType || '',
    params.reaction || '',
    params.memo || '',
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
  const records = rows.map((row) => ({
    date: row[0] || '',
    foodName: row[1] || '',
    amountLabel: row[2] || '',
    amountGram: row[3] || '',
    spoonCount: row[4] || '',
    mealType: row[5] || '',
    reaction: row[6] || '',
    memo: row[7] || '',
    isFirstTime: row[8] === true || row[8] === 'TRUE' || row[8] === 'true',
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { success: true, records };
}

function addFood(params) {
  const sheet = getOrCreateSheet(SHEET_NAMES.foods, HEADERS.foods);
  const foodName = String(params.foodName || '').trim();

  if (!foodName) {
    return { success: false, message: 'foodName is required' };
  }

  const foods = getFoodNames(sheet);
  if (!foods.includes(foodName)) {
    sheet.appendRow([foodName]);
  }

  return { success: true };
}

function getFoodList() {
  const sheet = getOrCreateSheet(SHEET_NAMES.foods, HEADERS.foods);
  return { success: true, foods: getFoodNames(sheet) };
}


function getFoodInfo(params) {
  const foodName = String(params.foodName || '').trim();

  if (!foodName) {
    return { success: false, message: 'foodName is required' };
  }

  return {
    success: true,
    foodName,
    cautions: getFoodInfoRows(SHEET_NAMES.cautions, HEADERS.cautions, foodName, ['注意点', '内容', '要約', 'メモ']),
    cookingMethods: getFoodInfoRows(SHEET_NAMES.cookingMethods, HEADERS.cookingMethods, foodName, ['調理法', '内容', '要約', 'メモ']),
  };
}

function getFoodInfoRows(sheetName, headers, foodName, contentHeaderCandidates) {
  const sheet = getOrCreateInfoSheet(sheetName, headers);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headerRow = values[0].map((header) => String(header || '').trim());
  const foodNameIndex = findHeaderIndex(headerRow, ['食材名', '食材', '材料']);
  const contentIndex = findHeaderIndex(headerRow, contentHeaderCandidates);
  const sourceIndex = findHeaderIndex(headerRow, ['参照元', '出典', '日目', '食目']);

  if (foodNameIndex === -1 || contentIndex === -1) {
    return [];
  }

  return values.slice(1).reduce((items, row) => {
    const rowFoodName = String(row[foodNameIndex] || '').trim();
    const content = String(row[contentIndex] || '').trim();

    if (normalizeFoodName(rowFoodName) !== normalizeFoodName(foodName) || !content) {
      return items;
    }

    items.push({
      text: content,
      source: sourceIndex === -1 ? '' : String(row[sourceIndex] || '').trim(),
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
  return getDataRows(sheet).map((row) => String(row[0] || '').trim()).filter(Boolean);
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
  let currentHeaders = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];

  if (headers.includes('反応') && !currentHeaders.includes('反応') && currentHeaders[6] === 'メモ') {
    sheet.insertColumnBefore(7);
    sheet.getRange(1, 7).setValue('反応');
    currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  headers.forEach((header, index) => {
    if (currentHeaders[index] !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeFoodName(name) {
  return String(name || '')
    .trim()
    .replace(/[\s　]+/g, '')        // 空白除去
    .replace(/[()（）].*$/, '');    // 末尾のカッコ書き除去(例:「しらす(生)」→「しらす」)
}

function getFoodMaster() {
  const sheet = getOrCreateSheet(SHEET_NAMES.masterFoods, HEADERS.masterFoods);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return { success: true, foods: [] };
  }

  const headerRow = values[0].map((header) => String(header || '').trim());
  const nameIndex = findHeaderIndex(headerRow, ['食材名マスタ', '食材名', '食材']);
  const categoryIndex = findHeaderIndex(headerRow, ['カテゴリ']);

  if (nameIndex === -1) {
    return { success: true, foods: [] };
  }

  const foods = values.slice(1).reduce((items, row) => {
    const name = String(row[nameIndex] || '').trim();
    if (!name) {
      return items;
    }
    const category = categoryIndex === -1 ? 'その他' : (String(row[categoryIndex] || '').trim() || 'その他');
    items.push({ name, category });
    return items;
  }, []);

  return { success: true, foods };
}

// 表記揺れ検知
function findUnmatchedFoodNames() {
  const masterNames = new Set(getFoodNames(getOrCreateSheet(SHEET_NAMES.foods, HEADERS.foods)));
  const sheets = [SHEET_NAMES.cautions, SHEET_NAMES.cookingMethods];
  const unmatched = [];

  sheets.forEach((sheetName) => {
    const sheet = getOrCreateInfoSheet(sheetName, HEADERS[sheetName]);
    const values = sheet.getDataRange().getValues();
    const headerRow = values[0].map((h) => String(h || '').trim());
    const foodNameIndex = findHeaderIndex(headerRow, ['食材名', '食材', '材料']);

    values.slice(1).forEach((row) => {
      const name = String(row[foodNameIndex] || '').trim();
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
    const headerRow = values[0].map((h) => String(h || '').trim());
    const keyIndex = findHeaderIndex(headerRow, ['項目']);
    const valueIndex = findHeaderIndex(headerRow, ['値']);

    if (keyIndex !== -1 && valueIndex !== -1) {
      values.slice(1).forEach((row) => {
        const key = String(row[keyIndex] || '').trim();
        if (key) {
          settings[key] = row[valueIndex] instanceof Date
            ? Utilities.formatDate(row[valueIndex], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(row[valueIndex] || '').trim();
        }
      });
    }
  }

  return { success: true, settings };
}

function saveSetting(params) {
  const key = String(params.key || '').trim();
  const value = String(params.value || '').trim();

  if (!key) {
    return { success: false, message: 'key is required' };
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.settings, HEADERS.settings);
  const values = sheet.getDataRange().getValues();
  const headerRow = values.length > 0 ? values[0].map((h) => String(h || '').trim()) : HEADERS.settings;
  const keyIndex = findHeaderIndex(headerRow, ['項目']);
  const valueIndex = findHeaderIndex(headerRow, ['値']);

  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][keyIndex] || '').trim() === key) {
      sheet.getRange(i + 1, valueIndex + 1).setValue(value);
      return { success: true };
    }
  }

  sheet.appendRow([key, value]);
  return { success: true };
}

function getInstaRecords(params) {
  const week = params.week ? Number(params.week) : null;
  const keyword = String(params.keyword || '').trim();

  const sheet = getOrCreateSheet(SHEET_NAMES.instaRecords, HEADERS.instaRecords);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return { success: true, records: [], availableWeeks: [] };
  }

  const headerRow = values[0].map((h) => String(h || '').trim());
  const dayIndex = findHeaderIndex(headerRow, ['日目']);
  const mealIndex = findHeaderIndex(headerRow, ['食目']);
  const ingredientIndex = findHeaderIndex(headerRow, ['材料']);
  const summaryIndex = findHeaderIndex(headerRow, ['要約']);

  const allRecords = values.slice(1).reduce((items, row) => {
    const day = Number(row[dayIndex]);
    if (!day) {
      return items;
    }
    items.push({
      day,
      week: Math.ceil(day / 7),
      meal: mealIndex === -1 ? '' : String(row[mealIndex] || '').trim(),
      ingredient: ingredientIndex === -1 ? '' : String(row[ingredientIndex] || '').trim(),
      summary: summaryIndex === -1 ? '' : String(row[summaryIndex] || '').trim(),
    });
    return items;
  }, []);

  const availableWeeks = [...new Set(allRecords.map((r) => r.week))].sort((a, b) => a - b);

  const filtered = allRecords.filter((record) => {
    const matchesWeek = week ? record.week === week : true;
    const matchesKeyword = keyword
      ? record.ingredient.includes(keyword) || record.summary.includes(keyword)
      : true;
    return matchesWeek && matchesKeyword;
  });

  filtered.sort((a, b) => a.day - b.day || a.meal.localeCompare(b.meal, 'ja'));

  return { success: true, records: filtered, availableWeeks };
}
