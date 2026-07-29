const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = 'c:\\Users\\jinesh mehta\\Downloads\\master-moves-os\\public';
const studentFile = path.join(publicDir, 'student information.xlsx');
const packageFile = path.join(publicDir, 'All Student Packages-8.xlsx');

const studentWorkbook = xlsx.readFile(studentFile);
const studentData = xlsx.utils.sheet_to_json(studentWorkbook.Sheets[studentWorkbook.SheetNames[0]]);

const packageWorkbook = xlsx.readFile(packageFile);
const packageData = xlsx.utils.sheet_to_json(packageWorkbook.Sheets[packageWorkbook.SheetNames[0]]);

const cleanName = (name) => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const studentNameMap = new Map();
studentData.forEach(row => {
  const name = String(row['Name'] || '').trim();
  if (name) {
    studentNameMap.set(cleanName(name), row);
  }
});

// Let's see what status is associated with each unique student name in packages
const studentPackageStatus = new Map();
packageData.forEach(row => {
  const name = String(row['Student'] || '').trim();
  if (!name) return;
  const status = String(row['Status'] || '').trim();
  studentPackageStatus.set(cleanName(name), status);
});

const statuses = {};
studentPackageStatus.forEach(status => {
  statuses[status] = (statuses[status] || 0) + 1;
});
console.log('Unique student statuses in Packages sheet:', statuses);
