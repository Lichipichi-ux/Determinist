import { areStringsSimilar } from './src/utils/stringSimilarity';

const s1 = "ISR RETENIDO POR ACREDITAR SOBRE VENTAS";
const s2 = "ISR RETENIDO POR PAGAR SOBRE VENTAS";

console.log(`S1: ${s1}`);
console.log(`S2: ${s2}`);
console.log(`Are similar (default 0.75)? ${areStringsSimilar(s1, s2)}`);
console.log(`Are similar (0.85)? ${areStringsSimilar(s1, s2, 0.85)}`);
console.log(`Are similar (0.90)? ${areStringsSimilar(s1, s2, 0.90)}`);
