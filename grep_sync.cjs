const fs = require('fs');

function checkFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('syncDatabaseToClient') || line.includes('syncFromNeon')) {
      console.log(`${filepath}:${idx + 1}: ${line.trim()}`);
    }
  });
}

checkFile('src/components/Students.tsx');
checkFile('src/components/StudentDashboard.tsx');
checkFile('src/components/Sidebar.tsx');
checkFile('src/components/Progress.tsx');
