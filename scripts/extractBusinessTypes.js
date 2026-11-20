// extractBusinessTypes.js
// Reads the extracted DOCX XML and generates businessTypes.json
// Usage: node scripts/extractBusinessTypes.js
const fs = require('fs');
const path = require('path');

const xmlPath = path.join(__dirname, '..', 'tmp_docx', 'word', 'document.xml');
const outPath = path.join(__dirname, '..', 'app', 'data', 'businessTypes.json');

if (!fs.existsSync(xmlPath)) {
  console.error('XML file not found:', xmlPath);
  process.exit(1);
}
const xml = fs.readFileSync(xmlPath, 'utf8');

// Simple regex to extract rows of the table after the header row.
// Each row <w:tr>...</w:tr> contains multiple <w:t> elements.
const rowRegex = /<w:tr[\s\S]*?<\/w:tr>/g;
const rows = xml.match(rowRegex) || [];

const businessTypes = [];
for (const row of rows) {
  // Extract all text values within <w:t> tags in order.
  const texts = [];
  const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = textRegex.exec(row)) !== null) {
    texts.push(m[1].trim());
  }
  // Expect at least two texts: name and description.
  if (texts.length >= 2) {
    const name = texts[0];
    const description = texts.slice(1).join(' ');
    // Skip rows where name looks like a number or is empty.
    if (name && !/^\d+$/.test(name)) {
      businessTypes.push({ name, description });
    }
  }
}

// Write pretty JSON.
fs.writeFileSync(outPath, JSON.stringify(businessTypes, null, 2), 'utf8');
console.log('Extracted', businessTypes.length, 'business types to', outPath);
