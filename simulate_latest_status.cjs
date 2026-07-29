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

const parseExcelDate = (val) => {
  if (!val) return new Date(0);
  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date(0) : d;
};

// Map each unique student to their latest package row status
const latestPkgStatus = new Map();
const sortedPkgs = [...packageData].sort((a, b) => {
  return parseExcelDate(a['Date of payment']).getTime() - parseExcelDate(b['Date of payment']).getTime();
});

sortedPkgs.forEach(row => {
  const name = String(row['Student'] || '').trim();
  if (!name) return;
  const status = String(row['Status'] || '').trim().toLowerCase();
  if (status) {
    latestPkgStatus.set(cleanName(name), status);
  }
});

let activeCount = 0;
let inactiveCount = 0;

// Roster status
const rosterStatuses = new Map();
studentData.forEach(row => {
  const name = String(row['Name'] || '').trim();
  if (!name) return;
  const status = String(row['Status'] || 'Active').trim().toLowerCase() === 'active' ? 'active' : 'inactive';
  rosterStatuses.set(cleanName(name), status);
});

// All unique names across roster, packages, attendance
const rosterNames = new Set(studentData.map(s => cleanName(s.Name)).filter(Boolean));
const packageNames = new Set(packageData.map(p => cleanName(p.Student)).filter(Boolean));
const attendanceNames = new Set(attendanceData.map(a => cleanName(a.Student)).filter(Boolean));
const allNames = new Set([...rosterNames, ...packageNames, ...attendanceNames]);

allNames.forEach(name => {
  // If in roster, prioritize roster status. If not, use latest package status.
  let status = 'active';
  if (rosterStatuses.has(name)) {
    status = rosterStatuses.get(name);
  } else if (latestPkgStatus.has(name)) {
    status = latestPkgStatus.get(name) === 'active' ? 'active' : 'inactive';
  }
  
  if (status === 'active') activeCount++;
  else inactiveCount++;
});

console.log('Using Roster status, fallback to Latest Package Status:');
console.log('Total Students:', allNames.size);
console.log('Active:', activeCount, 'Inactive:', inactiveCount);
