
const { parseCSV } = require('../utils/csvParser');
const fs = require('fs');

const safeNumber = (val) => {
   if (typeof val === 'number') return val;
   if (!val || typeof val !== 'string') return 0;
   // Handle format like "3.433,05" or "3433,05"
   const clean = val
      .replace(/[^\d,.-]/g, '') // Remove symbols
      .replace(/\.(?=\d{3}(,|$))/g, '') // Remove thousands separator if it's followed by 3 digits and a decimal comma or end
      .replace(',', '.'); // Convert decimal comma to dot
   const num = Number(clean);
   return isNaN(num) ? 0 : num;
};

// Mocking the parseCSV function if it's not easily imported (it's TS)
// I'll just paste the logic here to test.
const splitLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
};

const testParse = (csvText) => {
    const lines = csvText.trim().split(/\r?\n/);
    const headers = splitLine(lines[0]);
    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const values = splitLine(lines[i]);
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index];
        });
        results.push(obj);
    }
    return results;
};

const main = () => {
    const csvContent = fs.readFileSync('templates/setores/marketing.csv', 'utf8');
    const parsed = testParse(csvContent);
    
    console.log(`Parsed ${parsed.length} rows.`);
    
    const firstRow = parsed[0];
    console.log('Sample Row:', firstRow);
    
    const investmentRaw = firstRow['Investimento'];
    const investmentParsed = safeNumber(investmentRaw);
    
    console.log(`Raw Investment: ${investmentRaw}`);
    console.log(`Parsed Investment: ${investmentParsed}`);
    
    if (investmentParsed === 3433.05) {
        console.log('✅ Success: Number parsed correctly.');
    } else {
        console.log('❌ Failure: Number parsing failed.');
    }
    
    if (Object.keys(firstRow).length === 8) {
        console.log('✅ Success: Column count correct.');
    } else {
        console.log('❌ Failure: Column count incorrect.');
    }
};

main();
