const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.next')) {
        results = results.concat(walk(file));
      }
    } else {
      if (file.toLowerCase().endsWith('.xlsx') || file.toLowerCase().endsWith('.xlsv') || file.toLowerCase().includes('mmcc')) {
        results.push(file);
      }
    }
  });
  return results;
}

const matches = walk('.');
console.log("Workspace matches:", matches);
