import { areStringsSimilar } from './src/utils/stringSimilarity';

console.log('=== Testing Mortgage Account Distinction ===\n');

// TEST: The critical case - should be FALSE
const testA = 'Hipotecas a Corto plazo';
const testB = 'Hipotecas a largo plazo';
const result = areStringsSimilar(testA, testB);

console.log(`TEST: Different time periods (Corto plazo vs largo plazo)`);
console.log(`  "${testA}"`);
console.log(`  "${testB}"`);
console.log(`  Result: ${result} (Expected: false) ${result === false ? '✅ PASS' : '❌ FAIL'}\n`);

if (result === true) {
    console.log('❌ CRITICAL ERROR: These accounts are being grouped together!');
} else {
    console.log('✅ SUCCESS: These accounts are correctly distinguished.');
}
