// CSV export utilities
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");
const path = require("path");

async function writeCSV(filePath, headers, records) {
  // Create directory if it doesn't exist
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const csvWriter = createCsvWriter({
    path: filePath,
    header: headers.map(h => ({ id: h.id, title: h.title })),
  });

  await csvWriter.writeRecords(records);
  console.log(`✅ CSV written to ${filePath}`);
}

module.exports = {
  writeCSV,
};
