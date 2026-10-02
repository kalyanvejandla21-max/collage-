const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

console.log("--- SINGLE-DIRECTION ANIMATION VERIFICATION ---");

// Check 1: animate('input', { value: 100, modifier: utils.round(0) }) present
const animCallPattern = /animate\('input',\s*\{\s*value:\s*100,\s*modifier:\s*utils\.round\(0\),?\s*\}\)/;
const hasCorrectAnimCall = animCallPattern.test(appJs);

console.log("Single-direction animate call configured:", hasCorrectAnimCall ? "PASS" : "FAIL");

// Check 2: alternate and loop absent from animation call
const hasAlternateInCall = appJs.includes("alternate: true");
const hasLoopInCall = appJs.includes("loop: true");

console.log("alternate: true removed:", !hasAlternateInCall ? "PASS" : "FAIL");
console.log("loop: true removed:", !hasLoopInCall ? "PASS" : "FAIL");

if (hasCorrectAnimCall && !hasAlternateInCall && !hasLoopInCall) {
  console.log("\nSINGLE-DIRECTION ANIMATION VERIFICATION PASSED!");
} else {
  console.error("\nVERIFICATION FAILED!");
  process.exit(1);
}
