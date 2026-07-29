const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = 'c:\\Users\\jinesh mehta\\Downloads\\master-moves-os\\public';
const studentFile = path.join(publicDir, 'student information.xlsx');
const packageFile = path.join(publicDir, 'All Student Packages-8.xlsx');
const attendanceFile = path.join(publicDir, 'All Attendance Records-5.xlsx');

const studentWorkbook = xlsx.readFile(studentFile);
const studentData = xlsx.utils.sheet_to_json(studentWorkbook.Sheets[studentWorkbook.SheetNames[0]]);

const packageWorkbook = xlsx.readFile(packageFile);
const packageData = xlsx.utils.sheet_to_json(packageWorkbook.Sheets[packageWorkbook.SheetNames[0]]);

const attendanceWorkbook = xlsx.readFile(attendanceFile);
const attendanceData = xlsx.utils.sheet_to_json(attendanceWorkbook.Sheets[attendanceWorkbook.SheetNames[0]]);

const cleanName = (name) => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const parseExcelDate = (val) => {
  if (!val) return null;
  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// 1. Get latest attendance date in system
let maxDate = new Date(0);
attendanceData.forEach(row => {
  const d = parseExcelDate(row['Date']);
  if (d && d > maxDate) maxDate = d;
});

function runBuggyTest() {
  const studentMap = new Map();
  const studentNameMap = new Map();
  const students = [];

  studentData.forEach((row, idx) => {
    const name = String(row['Name'] || '').trim();
    if (!name) return;
    const sId = `STUDENT_${idx}`;
    const refId = row['Student Id'] ? String(row['Student Id']).trim() : `MM-${1000 + idx}`;
    studentMap.set(refId.toLowerCase(), sId);
    studentNameMap.set(cleanName(name), sId);
    students.push({
      id: sId,
      name,
      refId,
      status: 'inactive',
      centre: row['Assigned Primary center'] || row['Assigned center'] || 'Bay Avenue',
      lastAttended: null
    });
  });

  const findStudentId = (ref, name) => {
    // BUGGY: Ref-First
    if (ref && studentMap.has(ref.trim().toLowerCase())) {
      return studentMap.get(ref.trim().toLowerCase());
    }
    const clean = cleanName(name);
    if (clean && studentNameMap.has(clean)) {
      return studentNameMap.get(clean);
    }
    return null;
  };

  const studentRecentRates = new Map();
  const studentPackageCounts = new Map();
  let dynamicCount = 0;

  // Process packages (unsorted)
  packageData.forEach(row => {
    const studentName = String(row['Student'] || '').trim();
    if (!studentName) return;
    const ref = row['Student Id'] ? String(row['Student Id']).trim() : '';
    let studentId = findStudentId(ref, studentName);
    
    if (!studentId) {
      studentId = `DYNAMIC_PKG_${dynamicCount++}`;
      const clean = cleanName(studentName);
      studentMap.set(ref.toLowerCase() || studentName.toLowerCase(), studentId);
      studentNameMap.set(clean, studentId);
      students.push({
        id: studentId,
        name: studentName,
        refId: ref,
        status: 'inactive',
        centre: row['Assigned center'] || 'Bay Avenue',
        lastAttended: null
      });
    }

    const rawClasses = row['No of classes'];
    const totalClasses = (rawClasses !== undefined && rawClasses !== null && rawClasses !== '') ? Number(rawClasses) : 0;
    const price = Number(row['Price']) || 0;
    const rawKind = String(row['New/Renewal'] || 'new').toLowerCase();
    const kind = rawKind.includes('tournament') ? 'tournament' : (rawKind.includes('renewal') ? 'renewal' : 'new');

    studentPackageCounts.set(studentId, (studentPackageCounts.get(studentId) || 0) + totalClasses);
    if (kind !== 'tournament') {
      const rate = totalClasses > 0 ? (price / totalClasses) : 125;
      studentRecentRates.set(studentId, rate);
    }
  });

  const studentAttendanceCounts = new Map();
  attendanceData.forEach(row => {
    const studentName = String(row['Student'] || '').trim();
    if (!studentName) return;
    let studentId = findStudentId('', studentName);
    if (!studentId) {
      studentId = `DYNAMIC_ATT_${dynamicCount++}`;
      const clean = cleanName(studentName);
      studentNameMap.set(clean, studentId);
      students.push({
        id: studentId,
        name: studentName,
        refId: '',
        status: 'inactive',
        centre: row['Assigned center'] || 'Bay Avenue',
        lastAttended: null
      });
    }

    const status = String(row['Attendance'] || 'present').trim().toLowerCase();
    const duration = Number(row['Class duration']) || 2;
    const date = parseExcelDate(row['Date']);
    
    const stu = students.find(s => s.id === studentId);
    if (stu && date) {
      if (!stu.lastAttended || date > stu.lastAttended) {
        stu.lastAttended = date;
      }
    }

    if (status === 'present' || status === 'makeup') {
      studentAttendanceCounts.set(studentId, (studentAttendanceCounts.get(studentId) || 0) + duration);
    }
  });

  // Update status to active if they attended in the last 120 days of the max date
  students.forEach(student => {
    if (student.lastAttended) {
      const diffMs = maxDate.getTime() - student.lastAttended.getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (days <= 120) {
        student.status = 'active';
      }
    }
  });

  let activeCount = 0;
  let inactiveCount = 0;
  let totalActiveUnbilled = 0;
  let totalInactiveUnbilled = 0;

  let bayStudents = 0, bayActive = 0, bayInactive = 0, bayUnbilled = 0;
  let jltStudents = 0, jltActive = 0, jltInactive = 0, jltUnbilled = 0;

  students.forEach(student => {
    const isBay = student.centre.toLowerCase().includes('bay');
    if (isBay) bayStudents++;
    else jltStudents++;

    if (student.status === 'active') {
      activeCount++;
      if (isBay) bayActive++; else jltActive++;
    } else {
      inactiveCount++;
      if (isBay) bayInactive++; else jltInactive++;
    }

    const totalClasses = studentPackageCounts.get(student.id) || 0;
    const attendedCount = studentAttendanceCounts.get(student.id) || 0;
    const unpaidClasses = Math.max(0, attendedCount - totalClasses);
    const rate = studentRecentRates.get(student.id) || 125;
    const unpaidValue = unpaidClasses * rate;
    
    if (unpaidClasses > 0) {
      if (student.status === 'active') {
        totalActiveUnbilled += unpaidValue;
        if (isBay) bayUnbilled += unpaidValue; else jltUnbilled += unpaidValue;
      } else {
        totalInactiveUnbilled += unpaidValue;
        if (isBay) bayUnbilled += unpaidValue; else jltUnbilled += unpaidValue;
      }
    }
  });

  console.log('--- Buggy Ref-First Results ---');
  console.log(`Total Students: ${students.length} (Active: ${activeCount}, Inactive: ${inactiveCount})`);
  console.log(`Total Unbilled: AED ${(totalActiveUnbilled + totalInactiveUnbilled).toLocaleString()}`);
  console.log(`  Active - Unbilled: AED ${totalActiveUnbilled.toLocaleString()}`);
  console.log(`  Inactive - Unbilled: AED ${totalInactiveUnbilled.toLocaleString()}`);
  console.log('\nBreakdown by centre:');
  console.log(`Bay Avenue: Students=${bayStudents}, Active=${bayActive}, Inactive=${bayInactive}, Unbilled=${bayUnbilled.toLocaleString()}`);
  console.log(`JLT: Students=${jltStudents}, Active=${jltActive}, Inactive=${jltInactive}, Unbilled=${jltUnbilled.toLocaleString()}`);
}

runBuggyTest();
