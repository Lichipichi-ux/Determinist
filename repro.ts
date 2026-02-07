import { areStringsSimilar } from './src/utils/stringSimilarity';

const s1 = 'ISR retenido por pagar sobre compras';
const s2 = 'ISR retenido por pagar sobre renta';

console.log(`String 1: "${s1}"`);
console.log(`String 2: "${s2}"`);
console.log(`Similarity (threshold 0.75): ${areStringsSimilar(s1, s2, 0.75)}`);
console.log(`Similarity (threshold 0.85): ${areStringsSimilar(s1, s2, 0.85)}`);
console.log(`Similarity (threshold 0.90): ${areStringsSimilar(s1, s2, 0.90)}`);
