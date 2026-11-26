import { TestingEngine } from '../modules/testingEngine';

const results = TestingEngine.runAllTests();

console.log(`\n=== REAG V1 — Suite de tests automatisés (${results.executedAt}) ===`);
for (const testCase of results.cases) {
  const badge = testCase.passed ? 'PASS' : 'FAIL';
  console.log(`[${badge}] (${testCase.module}) ${testCase.name} — ${testCase.durationMs} ms`);
  console.log(`       ${testCase.details}`);
  if (testCase.error) {
    console.error(`       Erreur : ${testCase.error}`);
  }
}

console.log(
  `\nRésumé : ${results.passed}/${results.total} réussis, ${results.failed} échec(s) en ${results.totalDurationMs} ms.\n`
);

if (results.failed > 0) {
  process.exit(1);
}
