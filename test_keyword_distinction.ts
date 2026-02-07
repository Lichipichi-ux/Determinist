import { areStringsSimilar } from './src/utils/stringSimilarity';

console.log('=== Testing Account Keyword Distinction ===\n');

// TEST 1: The problematic case - should be FALSE
const test1a = 'ISR Retenido por Acreditar sobre Ventas';
const test1b = 'ISR Retenido por pagar sobre Ventas';
const result1 = areStringsSimilar(test1a, test1b);
console.log(`TEST 1: Different keywords (Acreditar vs pagar)`);
console.log(`  "${test1a}"`);
console.log(`  "${test1b}"`);
console.log(`  Result: ${result1} (Expected: false) ${result1 === false ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 2: Same account with typo - should be TRUE
const test2a = 'ISR Retenido por pagar sobre Ventas';
const test2b = 'ISR Retenido por Pagar sobre Ventas';
const result2 = areStringsSimilar(test2a, test2b);
console.log(`TEST 2: Same keywords, case difference`);
console.log(`  "${test2a}"`);
console.log(`  "${test2b}"`);
console.log(`  Result: ${result2} (Expected: true) ${result2 === true ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 3: Different transaction types - should be FALSE
const test3a = 'ISR Retenido por pagar sobre Compras';
const test3b = 'ISR Retenido por pagar sobre Ventas';
const result3 = areStringsSimilar(test3a, test3b);
console.log(`TEST 3: Different transaction types (Compras vs Ventas)`);
console.log(`  "${test3a}"`);
console.log(`  "${test3b}"`);
console.log(`  Result: ${result3} (Expected: false) ${result3 === false ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 4: Typo tolerance still works - should be TRUE
const test4a = 'Intereses';
const test4b = 'Interezez';
const result4 = areStringsSimilar(test4a, test4b);
console.log(`TEST 4: Typo tolerance (no critical keywords)`);
console.log(`  "${test4a}"`);
console.log(`  "${test4b}"`);
console.log(`  Result: ${result4} (Expected: true) ${result4 === true ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 5: Cobrar vs Pagar - should be FALSE
const test5a = 'IVA por Cobrar';
const test5b = 'IVA por Pagar';
const result5 = areStringsSimilar(test5a, test5b);
console.log(`TEST 5: Different payment status (Cobrar vs Pagar)`);
console.log(`  "${test5a}"`);
console.log(`  "${test5b}"`);
console.log(`  Result: ${result5} (Expected: false) ${result5 === false ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 6: IGSS vs IVA - should be FALSE
const test6a = 'IGSS por pagar';
const test6b = 'IVA por pagar';
const result6 = areStringsSimilar(test6a, test6b);
console.log(`TEST 6: Different tax types (IGSS vs IVA)`);
console.log(`  "${test6a}"`);
console.log(`  "${test6b}"`);
console.log(`  Result: ${result6} (Expected: false) ${result6 === false ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 7: IVA vs ISR - should be FALSE
const test7a = 'IVA por pagar';
const test7b = 'ISR por pagar';
const result7 = areStringsSimilar(test7a, test7b);
console.log(`TEST 7: Different tax types (IVA vs ISR)`);
console.log(`  "${test7a}"`);
console.log(`  "${test7b}"`);
console.log(`  Result: ${result7} (Expected: false) ${result7 === false ? '✅ PASS' : '❌ FAIL'}\n`);

// TEST 8: IGSS vs ISR - should be FALSE
const test8a = 'IGSS por pagar';
const test8b = 'ISR por pagar';
const result8 = areStringsSimilar(test8a, test8b);
console.log(`TEST 8: Different tax types (IGSS vs ISR)`);
console.log(`  "${test8a}"`);
console.log(`  "${test8b}"`);
console.log(`  Result: ${result8} (Expected: false) ${result8 === false ? '✅ PASS' : '❌ FAIL'}\n`);

// Summary
const allPassed = !result1 && result2 && !result3 && result4 && !result5 && !result6 && !result7 && !result8;
console.log('===========================================');
console.log(`Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log('===========================================');
