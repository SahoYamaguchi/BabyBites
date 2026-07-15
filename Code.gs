/**
 * BabyBites Google Apps Script backend API.
 *
 * Spreadsheet sheets are created automatically when missing:
 * - 記録: 日時 | 食材名 | 量ラベル | グラム数 | メモ | 初回フラグ
 * - 食材マスタ: 食材名 | 登録日
 */
var SHEET_NAMES = {
  records: '記録',
  foods: '食材マスタ'
};

var HEADERS = {
  records: ['日時', '食材名', '量ラベル', 'グラム数', 'メモ', '初回フラグ'],
  foods: ['食材名', '登録日']
};

/**
 * Handles GET requests from the published web app.
 *
 * @param {GoogleAppsScript.Events.DoGet} e Request event.
 * @return {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : '';

    if (action === 'getRecords') {
      return jsonResponse({ success: true, records: getRecords() });
    }

    if (action === 'getFoodList') {
      return jsonResponse({ success: true, foods: getFoodList() });
    }

    return errorResponse('Unsupported action: ' + action);
  } catch (error) {
    return errorResponse(error.message || String(error));
  }
}

/**
 * Handles POST requests from the published web app.
 *
 * @param {GoogleAppsScript.Events.DoPost} e Request event.
 * @return {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return errorResponse('Request body is required.');
    }

    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if (action === 'addRecord') {
      var result = addRecord(body);
      return jsonResponse({ success: true, isFirstTime: result.isFirstTime });
    }

    if (action === 'addFood') {
      addFood(body.foodName);
      return jsonResponse({ success: true });
    }

    return errorResponse('Unsupported action: ' + action);
  } catch (error) {
    return errorResponse(error.message || String(error));
  }
}

/**
 * Adds a feeding record and marks whether it is the first record for the food.
 *
 * @param {Object} payload Request body.
 * @return {{isFirstTime: boolean}} Add result.
 */
function addRecord(payload) {
  var foodName = normalizeFoodName(payload.foodName);
  if (!foodName) {
    throw new Error('foodName is required.');
  }

  if (!payload.date) {
    throw new Error('date is required.');
  }

  if (!payload.amountLabel) {
    throw new Error('amountLabel is required.');
  }

  var recordsSheet = getOrCreateSheet(SHEET_NAMES.records, HEADERS.records);
  var isFirstTime = !foodExistsInRecords(recordsSheet, foodName);
  var amountGram = payload.amountGram === '' || payload.amountGram === null || typeof payload.amountGram === 'undefined'
    ? ''
    : Number(payload.amountGram);

  if (amountGram !== '' && isNaN(amountGram)) {
    throw new Error('amountGram must be a number or empty string.');
  }

  recordsSheet.appendRow([
    payload.date,
    foodName,
    payload.amountLabel,
    amountGram,
    payload.memo || '',
    isFirstTime
  ]);

  return { isFirstTime: isFirstTime };
}

/**
 * Returns all feeding records sorted by newest date first.
 *
 * @return {Object[]} Records.
 */
function getRecords() {
  var sheet = getOrCreateSheet(SHEET_NAMES.records, HEADERS.records);
  var values = getDataRows(sheet, HEADERS.records.length);
  var records = values.map(function(row) {
    return {
      date: toIsoString(row[0]),
      foodName: row[1] || '',
      amountLabel: row[2] || '',
      amountGram: row[3] === '' ? '' : row[3],
      memo: row[4] || '',
      isFirstTime: toBoolean(row[5])
    };
  });

  records.sort(function(a, b) {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return records;
}

/**
 * Returns food names registered in the food master sheet.
 *
 * @return {string[]} Food names.
 */
function getFoodList() {
  var sheet = getOrCreateSheet(SHEET_NAMES.foods, HEADERS.foods);
  var values = getDataRows(sheet, HEADERS.foods.length);
  return values
    .map(function(row) { return normalizeFoodName(row[0]); })
    .filter(function(foodName) { return foodName !== ''; });
}

/**
 * Adds a food to the master sheet when it does not already exist.
 *
 * @param {string} foodNameInput Food name.
 */
function addFood(foodNameInput) {
  var foodName = normalizeFoodName(foodNameInput);
  if (!foodName) {
    throw new Error('foodName is required.');
  }

  var sheet = getOrCreateSheet(SHEET_NAMES.foods, HEADERS.foods);
  var foods = getFoodList();
  if (foods.indexOf(foodName) === -1) {
    sheet.appendRow([foodName, new Date()]);
  }
}

/**
 * Returns the active spreadsheet sheet, creating it and its header row if needed.
 *
 * @param {string} sheetName Sheet name.
 * @param {string[]} headers Header values.
 * @return {GoogleAppsScript.Spreadsheet.Sheet} Sheet.
 */
function getOrCreateSheet(sheetName, headers) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  ensureHeaders(sheet, headers);
  return sheet;
}

/**
 * Ensures the first row contains the expected headers.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Sheet.
 * @param {string[]} headers Header values.
 */
function ensureHeaders(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  var currentHeaders = headerRange.getValues()[0];
  var hasAnyHeader = currentHeaders.some(function(value) { return value !== ''; });
  var matches = currentHeaders.every(function(value, index) { return value === headers[index]; });

  if (!hasAnyHeader || !matches) {
    headerRange.setValues([headers]);
  }
}

/**
 * Returns data rows below the header row.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Sheet.
 * @param {number} columnCount Number of columns to read.
 * @return {Array[]} Data rows.
 */
function getDataRows(sheet, columnCount) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, columnCount).getValues();
}

/**
 * Checks whether a food name already appears in the records sheet.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} recordsSheet Records sheet.
 * @param {string} foodName Food name.
 * @return {boolean} True if found.
 */
function foodExistsInRecords(recordsSheet, foodName) {
  var rows = getDataRows(recordsSheet, HEADERS.records.length);
  return rows.some(function(row) {
    return normalizeFoodName(row[1]) === foodName;
  });
}

/**
 * Creates a JSON ContentService response.
 *
 * @param {Object} payload Response payload.
 * @return {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Creates a JSON error response.
 *
 * @param {string} message Error message.
 * @return {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function errorResponse(message) {
  return jsonResponse({ success: false, error: message });
}

/**
 * Normalizes a food name for comparison and storage.
 *
 * @param {*} value Input value.
 * @return {string} Normalized food name.
 */
function normalizeFoodName(value) {
  return String(value || '').trim();
}

/**
 * Converts spreadsheet date values to ISO 8601 strings when possible.
 *
 * @param {*} value Spreadsheet value.
 * @return {*} ISO date string or original value.
 */
function toIsoString(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }

  return value;
}

/**
 * Converts spreadsheet values to boolean.
 *
 * @param {*} value Spreadsheet value.
 * @return {boolean} Boolean value.
 */
function toBoolean(value) {
  return value === true || value === 'true' || value === 'TRUE';
}
