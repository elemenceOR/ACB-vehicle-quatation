const INITIAL_LAST_QUOTE_NUMBER = 1023;
const QUOTE_HEADERS = [
  "Quotation number",
  "Date",
  "Customer name",
  "Phone",
  "Vehicle make/model",
  "Plate number",
  "Customer requirements",
  "Work items",
  "Estimated total (LKR)",
  "Reference photo count",
  "Reference photo links",
  "Photo upload status"
];

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
  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new Error("At least one work item is required.");
  }
  if (!Array.isArray(data.photos)) {
    throw new Error("Reference photos must be provided as an array.");
  }
  data.lines.forEach(line => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    if (!line.name || !Number.isInteger(quantity) || quantity < 1 ||
        !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("A work item has invalid name, quantity, or price.");
    }
  });

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("This Apps Script must be bound to the destination Google Sheet.");
  }
  const sheet = spreadsheet.getSheetByName("Quotes")
    || spreadsheet.insertSheet("Quotes");

  ensureQuoteSheetSchema(sheet, spreadsheet);

  const quoteValues = [
    data.quoteNumber,
    data.date,
    data.customerName,
    data.phone,
    data.vehicle,
    data.plate,
    data.requirements
  ];
  const workItems = data.lines.map((line, index) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    return formatWorkItem(
      line.category,
      line.name,
      quantity,
      line.colour,
      unitPrice,
      unitPrice * quantity,
      index
    );
  }).join("\n");
  const estimatedTotal = data.lines.reduce(
    (total, line) => total + Number(line.unitPrice) * Number(line.quantity),
    0
  );
  const row = quoteValues.concat([
    workItems,
    estimatedTotal,
    data.photos.length,
    "",
    data.photos.length ? "Pending" : "No photos attached"
  ]).map(safeSheetValue);
  const firstDataRow = sheet.getLastRow() + 1;
  sheet.getRange(firstDataRow, 1, 1, QUOTE_HEADERS.length).setValues([row]);
  sheet.setColumnWidth(8, 520);
  sheet.getRange(firstDataRow, 8).setWrap(true);
  sheet.autoResizeRows(firstDataRow, 1);

  if (data.photos.length > 0) {
    let photoLinks = [];
    let photoStatus;
    try {
      const result = saveReferencePhotos(data.quoteNumber, data.photos);
      photoLinks = result.links;
      photoStatus = result.errors.length
        ? "Partial: saved " + photoLinks.length + " of " + data.photos.length +
          "; " + result.errors.join("; ")
        : "Saved " + photoLinks.length + " of " + data.photos.length;
    } catch (error) {
      photoStatus = "Failed: " + (error.message || String(error));
      console.error("Reference photo upload failed.", error);
    }

    sheet.getRange(firstDataRow, 11, 1, 1)
      .setValues([[safeSheetValue(photoLinks.join("\n"))]]);
    sheet.getRange(firstDataRow, 12, 1, 1)
      .setValues([[safeSheetValue(photoStatus)]]);
  }
  return ContentService.createTextOutput("OK");
}

function ensureQuoteSheetSchema(sheet, spreadsheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(QUOTE_HEADERS);
    sheet.setColumnWidth(8, 520);
    return;
  }

  const lastColumn = sheet.getLastColumn();
  const oldHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  if (QUOTE_HEADERS.every((header, index) => oldHeaders[index] === header)) {
    sheet.setColumnWidth(8, 520);
    return;
  }

  const hasItemizedRows =
    oldHeaders[7] === "Work category" && oldHeaders[8] === "Requested work";
  const hasLegacyRows =
    oldHeaders[0] === "Quotation number" &&
    oldHeaders[6] === "Customer requirements" &&
    !oldHeaders[7];
  if (!hasItemizedRows && !hasLegacyRows) {
    throw new Error("The Quotes sheet has an unrecognized header format; it was not changed.");
  }

  const oldRows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getValues()
    : [];
  const migratedRows = collapseExistingQuotes(oldRows, hasItemizedRows);

  sheet.copyTo(spreadsheet).setName("Quotes backup " + Date.now());
  sheet.clearContents();
  const values = [QUOTE_HEADERS].concat(migratedRows);
  sheet.getRange(1, 1, values.length, QUOTE_HEADERS.length).setValues(values);
  sheet.setColumnWidth(8, 520);
  if (migratedRows.length > 0) {
    sheet.getRange(2, 8, migratedRows.length, 1).setWrap(true);
    sheet.autoResizeRows(2, migratedRows.length);
  }
}

function collapseExistingQuotes(rows, hasItemizedRows) {
  const groups = new Map();
  rows.forEach(row => {
    const quoteNumber = String(row[0] || "").trim();
    if (!quoteNumber) return;

    let quote = groups.get(quoteNumber);
    if (!quote) {
      quote = {
        values: row.slice(0, 7),
        workItems: [],
        estimatedTotal: 0,
        photoCount: 0,
        photoLinks: new Set(),
        photoStatuses: new Set()
      };
      groups.set(quoteNumber, quote);
    }

    if (hasItemizedRows && row[8]) {
      const quantity = Number(row[9]) || 0;
      const unitPrice = Number(row[11]) || 0;
      const lineTotal = Number(row[12]) || unitPrice * quantity;
      quote.workItems.push(formatWorkItem(
        row[7],
        row[8],
        quantity,
        row[10],
        unitPrice,
        lineTotal,
        quote.workItems.length
      ));
      quote.estimatedTotal += lineTotal;
    }
    quote.photoCount = Math.max(quote.photoCount, Number(row[13]) || 0);
    String(row[14] || "").split("\n").forEach(link => {
      if (link) quote.photoLinks.add(link);
    });
    if (row[15]) quote.photoStatuses.add(String(row[15]));
  });

  return Array.from(groups.values()).map(quote => quote.values.concat([
    quote.workItems.join("\n"),
    quote.estimatedTotal,
    quote.photoCount,
    Array.from(quote.photoLinks).join("\n"),
    Array.from(quote.photoStatuses).join("; ")
  ]).map(safeSheetValue));
}

function formatWorkItem(category, name, quantity, colour, unitPrice, lineTotal, index) {
  return (index + 1) + ". " + (category ? category + " - " : "") + name +
    " | Qty: " + quantity +
    (colour ? " | Colour: " + colour : "") +
    " | Unit price: LKR " + Number(unitPrice).toLocaleString("en-LK") +
    " | Line total: LKR " + Number(lineTotal).toLocaleString("en-LK");
}

function saveReferencePhotos(quoteNumber, photos) {
  if (photos.length === 0) return {links: [], errors: []};
  const folderName = "Quotation reference photos";
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  const result = {links: [], errors: []};
  photos.forEach((photo, index) => {
    try {
      const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(photo);
      if (!match) throw new Error("Unsupported image format.");
      const extension = match[1].split("/")[1].replace("jpeg", "jpg");
      const blob = Utilities.newBlob(
        Utilities.base64Decode(match[2]),
        match[1],
        quoteNumber + "-reference-" + (index + 1) + "." + extension
      );
      result.links.push(folder.createFile(blob).getUrl());
    } catch (error) {
      result.errors.push("photo " + (index + 1) + ": " + (error.message || String(error)));
      console.error("Could not save reference photo " + (index + 1) + ".", error);
    }
  });
  return result;
}

function authorizeDriveAccess() {
  DriveApp.getRootFolder().getId();
}

function safeSheetValue(value) {
  if (typeof value === "number") return value;
  const text = value == null ? "" : String(value);
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? "'" + text : text;
}
