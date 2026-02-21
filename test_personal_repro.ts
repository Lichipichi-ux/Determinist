import { areStringsSimilar, normalizeSpecificAccounts } from './src/utils/stringSimilarity';

console.log('=== Testing "AL PERSONAL" Normalization Repro ===\n');

const test1a = 'Prestamos al personal';
const test1b = 'Prestamos';
const norm1a = normalizeSpecificAccounts(test1a);
const norm1b = normalizeSpecificAccounts(test1b);
const similar1 = areStringsSimilar(norm1a, norm1b);

console.log(`TEST 1: "Prestamos al personal" vs "Prestamos"`);
console.log(`  Normalized A: "${norm1a}"`);
console.log(`  Normalized B: "${norm1b}"`);
console.log(`  Are similar: ${similar1} (Expected: true)`);

const test2a = 'Descuentos al personal';
const test2b = 'Descuentos';
const norm2a = normalizeSpecificAccounts(test2a);
const norm2b = normalizeSpecificAccounts(test2b);
const similar2 = areStringsSimilar(norm2a, norm2b);

console.log(`\nTEST 2: "Descuentos al personal" vs "Descuentos"`);
console.log(`  Normalized A: "${norm2a}"`);
console.log(`  Normalized B: "${norm2b}"`);
console.log(`  Are similar: ${similar2} (Expected: true)`);

const test3a = 'Bonificaciones al personal';
const test3b = 'Bonificaciones';
const norm3a = normalizeSpecificAccounts(test3a);
const norm3b = normalizeSpecificAccounts(test3b);
const similar3 = areStringsSimilar(norm3a, norm3b);

console.log(`\nTEST 3: "Bonificaciones al personal" vs "Bonificaciones"`);
console.log(`  Normalized A: "${norm3a}"`);
console.log(`  Normalized B: "${norm3b}"`);
console.log(`  Are similar: ${similar3} (Expected: true)`);
