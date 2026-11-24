const INITIAL_LAST_QUOTE_NUMBER = 1023;

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  if (params.action !== "reserve") {
    return ContentService.createTextOutput(
      "Quotation recorder is deployed. Submit a POST request to save a quotation."
    );
  }

  const callback = params.callback || "";
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService.createTextOutput("Invalid callback.");
  }

  let result;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error("This Apps Script must be bound to the destination Google Sheet.");
    }

    const sheet = spreadsheet.getSheetByName("Quotes");
    const properties = PropertiesService.getScriptProperties();
    const storedNumber = Number(properties.getProperty("lastQuotationNumber"));
    const lastNumber = Math.max(
      Number.isFinite(storedNumber) ? storedNumber : INITIAL_LAST_QUOTE_NUMBER,
      getHighestRecordedQuoteNumber(sheet)
    );
    const quoteNumber = lastNumber + 1;
    properties.setProperty("lastQuotationNumber", String(quoteNumber));
    result = {ok: true, quoteNumber: quoteNumber};
  } catch (error) {
    result = {ok: false, message: error.message || "Could not reserve a quotation number."};
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }

  return ContentService.createTextOutput(callback + "(" + JSON.stringify(result) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getHighestRecordedQuoteNumber(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return INITIAL_LAST_QUOTE_NUMBER;
  const quoteNumbers = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  return quoteNumbers.reduce((highest, row) => {
    const match = /^QT-(\d+)$/.exec(String(row[0]).trim());
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, INITIAL_LAST_QUOTE_NUMBER);
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing quotation data in POST request.");
  }

  const data = JSON.parse(e.postData.contents);
  if (!data.quoteNumber || !data.date) {
    throw new Error("Quotation number and date are required.");
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("This Apps Script must be bound to the destination Google Sheet.");
  }
  const sheet = spreadsheet.getSheetByName("Quotes")
    || spreadsheet.insertSheet("Quotes");

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Quotation number",
      "Date",
      "Customer name",
      "Phone",
      "Vehicle make/model",
      "Plate number",
      "Customer requirements"
    ]);
  }

  const values = [
    data.quoteNumber,
    data.date,
    data.customerName,
    data.phone,
    data.vehicle,
    data.plate,
    data.requirements
  ].map(value => {
    const text = value == null ? "" : String(value);
    return /^[\t\r\n ]*[=+\-@]/.test(text) ? "'" + text : text;
  });

  sheet.appendRow(values);
  return ContentService.createTextOutput("OK");
}
