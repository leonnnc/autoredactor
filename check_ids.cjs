const fs = require('fs');
const js = fs.readFileSync('main.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const missing = [];
while ((match = regex.exec(js)) !== null) {
  if (!html.includes('id="' + match[1] + '"')) missing.push(match[1]);
}
console.log('MISSING IDS:', missing);
