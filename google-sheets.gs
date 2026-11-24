function doGet() {
  return ContentService.createTextOutput(
    "Quotation recorder is deployed. Submit a POST request to save a quotation."
  );
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
