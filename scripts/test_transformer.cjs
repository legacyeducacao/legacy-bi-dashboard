// test_transformer.cjs
function extractProductName(campaignName) {
  if (!campaignName) return 'Institucional';
  const mainPattern = /^\d+\s*[-\u2013]\s*\[([^\]]+)\]/;
  const mainMatch = campaignName.match(mainPattern);
  if (mainMatch) return mainMatch[1].trim();
  const anyBracket = /\[([^\]]+)\]/;
  const bracketMatch = campaignName.match(anyBracket);
  if (bracketMatch) {
    const val = bracketMatch[1].trim();
    if (val.length > 3) return val;
  }
  return 'Institucional';
}

const tests = [
  ['075 - [Legado] - [CAD] - [CBO] - Formulario Nativo Executoria [FLN]', 'Legado'],
  ['012 - [Impulsao] - [TOF] - Video', 'Impulsao'],
  ['023 - [Consultoria] - Remarketing [RMK]', 'Consultoria'],
  ['Campanha sem padrao', 'Institucional'],
  ['001 - [CAD] - campanha sem produto (sigla curta)', 'Institucional'],
  ['099 - [Mentoria Premium] - Leads', 'Mentoria Premium'],
  ['[Imersao] campanha sem numero', 'Imersao'],
];

let allPassed = true;
tests.forEach(([input, expected]) => {
  const result = extractProductName(input);
  const ok = result === expected;
  if (!ok) allPassed = false;
  console.log((ok ? 'OK' : 'FAIL') + ' | Input: "' + input.substring(0, 50) + '" => "' + result + '"' + (ok ? '' : ' (esperado: "' + expected + '")'));
});
console.log(allPassed ? '\nTodos os testes passaram!' : '\nAlguns testes falharam!');
