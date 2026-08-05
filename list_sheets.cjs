const XLSX = require('xlsx');
const workbook = XLSX.readFile('public/MMCC_Siblings_Data_Brief.xlsx');
console.log("Sheet names:", workbook.SheetNames);
for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  const range = sheet['!ref'];
  console.log(`Sheet: "${name}", range: ${range}`);
}
