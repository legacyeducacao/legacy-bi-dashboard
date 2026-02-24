/**
 * Robust CSV Parser for the BI Project
 * Handles quoted fields and commas within values.
 */
export const parseCSV = <T>(csvText: string): T[] => {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const splitLine = (line: string) => {
    const result: string[] = [];
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

  const headers = splitLine(lines[0]);
  const results: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    const obj: any = {};

    headers.forEach((header, index) => {
      let value: any = values[index];

      // Auto-convert to numbers IF it's a simple number (no comma/thousands)
      // Complexity here: "3.433,05" vs "3433.05"
      // We'll keep it as string if it looks complex and handle conversion in the specific sector logic
      if (value !== undefined && value !== '' && !isNaN(Number(value))) {
        value = Number(value);
      }

      obj[header] = value;
    });

    results.push(obj as T);
  }

  return results;
};
