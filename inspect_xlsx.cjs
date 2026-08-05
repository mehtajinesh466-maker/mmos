const XLSX = require('xlsx');

const workbook = XLSX.readFile('public/MMCC_Siblings_Data_Brief.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log("Sheet Name:", sheetName);
console.log("Total rows:", data.length);
console.log("Columns:", Object.keys(data[0] || {}));
console.log("First row:", data[0]);
