import { areStringsSimilar } from './src/utils/stringSimilarity';

console.log('=== Testing Depreciation Distinction Repro ===\n');

const test1a = 'Depreciación Maquinaria';
const test1b = 'Depreciación Acum. Maquinaria';
const result1 = areStringsSimilar(test1a, test1b);
console.log(`TEST 1: Depreciación vs Depreciación Acum.`);
console.log(`  "${test1a}"`);
console.log(`  "${test1b}"`);
console.log(`  Result: ${result1} (Expected: false)`);

const test2a = 'Depreciacion';
const test2b = 'Deprec. Acum';
const result2 = areStringsSimilar(test2a, test2b);
console.log(`\nTEST 2: Depreciacion vs Deprec. Acum`);
console.log(`  "${test2a}"`);
console.log(`  "${test2b}"`);
console.log(`  Result: ${result2} (Expected: false)`);

const test3a = 'Depreciación Acumulada Maquinaria';
const test3b = 'Depreciación Acum. Maquinaria';
const result3 = areStringsSimilar(test3a, test3b);
console.log(`\nTEST 3: Acumulada vs Acum (Should match if treated as synonyms)`);
console.log(`  "${test3a}"`);
console.log(`  "${test3b}"`);
console.log(`  Result: ${result3} (Expected: true)`);
