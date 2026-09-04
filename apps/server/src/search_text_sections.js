import fs from 'fs';
const content = fs.readFileSync('C:/Users/Gagan/Desktop/all in one/apps/client/src/pages/OnboardingPage.jsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('Choose') || line.includes('Submit Your') || line.includes('Plan') || line.includes('Question')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
