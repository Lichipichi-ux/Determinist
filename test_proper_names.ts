import { areStringsSimilar } from './src/utils/stringSimilarity';

console.log('=== Testing Proper Name Distinction ===\n');

// TEST 1: The reported issue - Moscoso vs Morataya - should be FALSE
const test1a = 'Aportación del Señor Moscoso';
const test1b = 'Aportación del Señor Morataya';
const result1 = areStringsSimilar(test1a, test1b);
console.log(`TEST 1: Different partner surnames (Moscoso vs Morataya)`);
console.log(`  "${test1a}"`);
console.log(`  "${test1b}"`);
console.log(`  Result: ${result1} (Expected: false) ${result1 === false ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 2: Same partner name with typo - should be TRUE
const test2a = 'Aportación del Señor Moscoso';
const test2b = 'Aportacion del Señor Moscoso';
const result2 = areStringsSimilar(test2a, test2b);
console.log(`TEST 2: Same partner, typo tolerance`);
console.log(`  "${test2a}"`);
console.log(`  "${test2b}"`);
console.log(`  Result: ${result2} (Expected: true) ${result2 === true ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 3: Different company names - should be FALSE
const test3a = 'Cuenta por Cobrar Empresa García';
const test3b = 'Cuenta por Cobrar Empresa López';
const result3 = areStringsSimilar(test3a, test3b);
console.log(`TEST 3: Different company names (García vs López)`);
console.log(`  "${test3a}"`);
console.log(`  "${test3b}"`);
console.log(`  Result: ${result3} (Expected: false) ${result3 === false ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 4: Different titles with different names - should be FALSE
const test4a = 'Aportación del Señor Ramírez';
const test4b = 'Aportación de la Señora Martínez';
const result4 = areStringsSimilar(test4a, test4b);
console.log(`TEST 4: Different titles and surnames (Señor Ramírez vs Señora Martínez)`);
console.log(`  "${test4a}"`);
console.log(`  "${test4b}"`);
console.log(`  Result: ${result4} (Expected: false) ${result4 === false ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 5: Accounts without proper names should still work - should be TRUE
const test5a = 'Gastos de Administración';
const test5b = 'Gastos de Administracion';
const result5 = areStringsSimilar(test5a, test5b);
console.log(`TEST 5: No proper names, typo tolerance`);
console.log(`  "${test5a}"`);
console.log(`  "${test5b}"`);
console.log(`  Result: ${result5} (Expected: true) ${result5 === true ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 6: Multiple word surnames - should be FALSE
const test6a = 'Socio Don Juan Carlos Pérez';
const test6b = 'Socio Don Juan Carlos González';
const result6 = areStringsSimilar(test6a, test6b);
console.log(`TEST 6: Different multi-word surnames (Pérez vs González)`);
console.log(`  "${test6a}"`);
console.log(`  "${test6b}"`);
console.log(`  Result: ${result6} (Expected: false) ${result6 === false ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 7: Same person, different title format - should be TRUE
const test7a = 'Aportación del Sr. Moscoso';
const test7b = 'Aportación del Señor Moscoso';
const result7 = areStringsSimilar(test7a, test7b);
console.log(`TEST 7: Same surname, different title format (Sr. vs Señor)`);
console.log(`  "${test7a}"`);
console.log(`  "${test7b}"`);
console.log(`  Result: ${result7} (Expected: true) ${result7 === true ? '✅ PASS' : '❌ FAIL'}\n`);

// Summary
const allPassed = !result1 && result2 && !result3 && !result4 && result5 && !result6 && result7;
console.log('===========================================');
console.log(`Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log('===========================================');
