const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = 'c:\\Users\\jinesh mehta\\Downloads\\master-moves-os\\public';
const studentWorkbook = xlsx.readFile(path.join(publicDir, 'student information.xlsx'));
const studentData = xlsx.utils.sheet_to_json(studentWorkbook.Sheets[studentWorkbook.SheetNames[0]]);

const packageWorkbook = xlsx.readFile(path.join(publicDir, 'All Student Packages-8.xlsx'));
const packageData = xlsx.utils.sheet_to_json(packageWorkbook.Sheets[packageWorkbook.SheetNames[0]]);

const attendanceWorkbook = xlsx.readFile(path.join(publicDir, 'All Attendance Records-5.xlsx'));
const attendanceData = xlsx.utils.sheet_to_json(attendanceWorkbook.Sheets[attendanceWorkbook.SheetNames[0]]);

const cleanName = (name) => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const rosterNames = new Set(studentData.map(s => cleanName(s.Name)).filter(Boolean));
const packageNames = new Set(packageData.map(p => cleanName(p.Student)).filter(Boolean));
const attendanceNames = new Set(attendanceData.map(a => cleanName(a.Student)).filter(Boolean));

console.log('Roster unique names count:', rosterNames.size);
console.log('Package unique names count:', packageNames.size);
console.log('Attendance unique names count:', attendanceNames.size);

// Union of all names
const allNames = new Set([...rosterNames, ...packageNames, ...attendanceNames]);
console.log('Total unique names (union):', allNames.size);

// Let's see how many names in package/attendance are not in roster
const pkgOnly = [...packageNames].filter(n => !rosterNames.has(n));
console.log('Names in package but not roster:', pkgOnly.length);

const attOnly = [...attendanceNames].filter(n => !rosterNames.has(n));
console.log('Names in attendance but not roster:', attOnly.length);

// Let's count how many students are active/inactive in roster
let rosterActive = 0;
let rosterInactive = 0;
studentData.forEach(s => {
  const status = String(s.Status || '').trim().toLowerCase();
  if (status === 'active') rosterActive++;
  else rosterInactive++;
});
console.log('Roster Active:', rosterActive, 'Inactive:', rosterInactive);
