const XLSX = require('xlsx');

const workbook = XLSX.readFile('public/MMCC_Siblings_Data_Brief.xlsx');
console.log("# Excel Workbook Analysis: MMCC_Siblings_Data_Brief.xlsx\n");

workbook.SheetNames.forEach((name) => {
  const sheet = workbook.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`## Sheet: ${name}`);
  console.log(`- **Total Rows**: ${data.length}`);
  
  if (data.length > 0) {
    const keys = Object.keys(data[0]);
    console.log(`- **Columns**: ${keys.map(k => `\`${k}\``).join(', ')}`);
    console.log(`- **Sample Row**:`);
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log(`- **Columns**: None / Empty`);
  }
  console.log("\n---\n");
});
