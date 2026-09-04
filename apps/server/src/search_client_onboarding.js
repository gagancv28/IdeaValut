import fs from 'fs';
import path from 'path';

function searchFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && !file.startsWith('.')) {
        results = results.concat(searchFiles(filePath));
      }
    } else if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('Choose Your Listing Plan') || content.includes('Submit Your Startup') || content.includes('onboarding')) {
        results.push({ path: filePath });
      }
    }
  });
  return results;
}

const matches = searchFiles('C:/Users/Gagan/Desktop/all in one/apps/client/src');
console.log("Found onboarding files:", matches.map(m => m.path));
