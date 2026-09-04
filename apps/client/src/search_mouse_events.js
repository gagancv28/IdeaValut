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
      if (content.toLowerCase().includes('mouse') || content.toLowerCase().includes('hover') || content.toLowerCase().includes('leave') || content.toLowerCase().includes('enter')) {
        results.push({ path: filePath, content });
      }
    }
  });
  return results;
}

const matches = searchFiles('C:/Users/Gagan/Desktop/all in one/apps/client/src');
matches.forEach(m => {
  const lines = m.content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('mouse') || line.toLowerCase().includes('leave') || line.toLowerCase().includes('enter') || line.toLowerCase().includes('hover')) {
      console.log(`${m.path}:${idx + 1}: ${line.trim()}`);
    }
  });
});
