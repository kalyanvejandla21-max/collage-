const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');

// Verify all element IDs exist in index.html
const requiredIds = [
  'header-student-name',
  'header-student-dept',
  'header-student-reg',
  'dash-student-name',
  'dash-reg-no',
  'dash-student-year',
  'dash-student-sec',
  'student-id-preview',
  'student-preview-text'
];

console.log("--- VERIFYING DOM ELEMENT IDs IN INDEX.HTML ---");
for (const id of requiredIds) {
  const exists = indexHtml.includes(`id="${id}"`);
  console.log(`Element ID "${id}":`, exists ? "✅ EXISTS" : "❌ MISSING");
}
