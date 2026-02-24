
const fs = require('fs');

const safeNumber = (val) => {
   if (typeof val === 'number') return val;
   if (!val || typeof val !== 'string') return 0;
   const clean = val
      .replace(/[^\d,.-]/g, '') 
      .replace(/\.(?=\d{3}(,|$))/g, '') 
      .replace(',', '.');
   const num = Number(clean);
   return isNaN(num) ? 0 : num;
};

const splitLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else current += char;
    }
    result.push(current.trim());
    return result;
};

const testParse = (csvText) => {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
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
    
    // Row 1 (Index 0)
    const row0 = parsed[0];
    const inv0 = safeNumber(row0['Investimento']);
    console.log(`Row 1 - Raw: ${row0['Investimento']}, Parsed: ${inv0}`);
    
    // Row 23 (Index 22) - Last Legado row
    const row22 = parsed[22]; 
    const inv22 = safeNumber(row22['Investimento']);
    console.log(`Row 23 - Raw: ${row22['Investimento']}, Parsed: ${inv22}`);

    let success = true;
    if (inv0 !== 3433.05) { console.log('Fail row 0'); success = false; }
    if (inv22 !== 2894.47) { console.log('Fail row 22'); success = false; }
    if (Object.keys(row0).length !== 8) { console.log('Fail length'); success = false; }
    
    if (success) {
        console.log('✅ ALL TESTS PASSED');
    } else {
        console.log('❌ SOME TESTS FAILED');
        process.exit(1);
    }
};

main();
