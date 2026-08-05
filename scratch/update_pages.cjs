const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'app', '(dashboard)');

function processDir(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (file === 'page.tsx') {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('currentUser.centre_id || "All"') && !content.includes('useCentre')) {
        console.log(`Updating ${fullPath}`);
        // Add import
        content = content.replace(
          /import \{([^}]+)\} from "\.\.\/\.\.\/\.\.\/components\/([^"]+)";/,
          (match) => {
            return match + '\nimport { useCentre } from "../../../context/CentreContext";';
          }
        );
        // Add hook call
        content = content.replace(
          /const \{\s*data:\s*session,\s*status\s*\} = useSession\(\);/,
          'const { data: session, status } = useSession();\n  const { activeCentre } = useCentre();'
        );
        // Remove local activeCentre declaration
        content = content.replace(
          /const activeCentre = currentUser\.centre_id \|\| "All";\r?\n/,
          ''
        );
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

processDir(dir);
console.log("Pages update completed.");
