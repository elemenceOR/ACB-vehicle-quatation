function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
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
