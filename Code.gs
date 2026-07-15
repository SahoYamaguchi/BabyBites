const SHEET_NAMES = {
  records: '記録',
  foods: '食材',
};

const HEADERS = {
  records: ['日時', '食材名', '量ラベル', 'グラム数', 'さじ杯数', '食事区分', 'メモ', '初回'],
  foods: ['食材名'],
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
    memo: row[6] || '',
    isFirstTime: row[7] === true || row[7] === 'TRUE' || row[7] === 'true',
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
  const currentHeaders = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];

  headers.forEach((header, index) => {
    if (currentHeaders[index] !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
