const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = 'c:\\Users\\jinesh mehta\\Downloads\\master-moves-os\\public';
const studentFile = path.join(publicDir, 'student information.xlsx');

const studentWorkbook = xlsx.readFile(studentFile);
const studentData = xlsx.utils.sheet_to_json(studentWorkbook.Sheets[studentWorkbook.SheetNames[0]]);

const searchNames = ['bodhi', 'chokdia', 'maya', 'ozornek', 'myra', 'tulshyan', 'samraie'];
searchNames.forEach(q => {
  const matches = studentData.filter(s => s.Name && s.Name.toLowerCase().includes(q));
  console.log(`Matches for "${q}":`, matches.map(m => m.Name));
});
