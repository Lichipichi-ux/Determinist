/**
 * Critical accounting keywords that must match exactly.
 * If two account names differ in any of these keywords, they should NOT be considered similar.
 */
const CRITICAL_KEYWORDS = [
    // Payment/Credit status - mutually exclusive
    ['ACREDITAR', 'PAGAR', 'COBRAR', 'PAGADO', 'COBRADO', 'PAGADA', 'COBRADA'],

    // Transaction types - mutually exclusive
    ['COMPRAS', 'VENTAS', 'RENTA', 'HONORARIOS', 'SERVICIOS', 'ALQUILERES', 'ALQUILER'],

    // Account nature - mutually exclusive
    ['ACTIVO', 'PASIVO', 'CAPITAL', 'INGRESO', 'EGRESO', 'GASTO'],

    // Time status - mutually exclusive
    ['ANTICIPADO', 'ANTICIPADA', 'DIFERIDO', 'DIFERIDA', 'CORRIENTE', 'CORTO PLAZO', 'LARGO PLAZO', 'ACUMULADO', 'ACUMULADA', 'ACUM'],

    // Tax and contribution types - mutually exclusive
    ['IGSS', 'IVA', 'ISR', 'IUSI', 'ISO'],

    // Departments - mutually exclusive
    ['ADMINISTRACION', 'ADMIN', 'VENTAS', 'SALA DE VENTAS', 'FABRICA', 'FÁBRICA', 'OFICINA', 'PRODUCCION'],

    // Debit/Credit nature - mutually exclusive
    ['DEBITO', 'CREDITO', 'DÉBITO', 'CRÉDITO', 'DEUDOR', 'ACREEDOR'],

    // Commercial nature - mutually exclusive
    // Note: 'NO COMERCIAL' will be tested carefully below
    ['COMERCIAL', 'COMERCIALES', 'NO COMERCIAL', 'NO COMERCIALES']
];

/**
 * Titles that precede proper names (surnames, company names, etc.)
 * Used to extract and compare proper names in account descriptions.
 */
const PROPER_NAME_TITLES = [
    'SEÑOR', 'SEÑORA', 'SR', 'SRA', 'SRTA', 'SEÑORITA',
    'DON', 'DOÑA', 'DR', 'DRA', 'DOCTOR', 'DOCTORA',
    'ING', 'INGENIERO', 'INGENIERA', 'LIC', 'LICENCIADO', 'LICENCIADA',
    'EMPRESA', 'COMPAÑÍA', 'SOCIEDAD', 'S.A.', 'S.R.L.', 'LTDA',
    'SOCIO', 'SOCIA', 'ACCIONISTA', 'PROPIETARIO', 'PROPIETARIA'
];

/**
 * Extracts proper names (surnames, company names) from an account name.
 * Looks for words that follow titles like "Señor", "Empresa", etc.
 */
const extractProperNames = (accountName: string): Set<string> => {
    const normalized = accountName.trim().toUpperCase();
    const properNames = new Set<string>();

    // For each title, find what comes after it
    PROPER_NAME_TITLES.forEach(title => {
        // Match the title followed by one or more capitalized words
        const regex = new RegExp(`\\b${title}\\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]+)*)`, 'g');
        let match;

        while ((match = regex.exec(normalized)) !== null) {
            // Extract the proper name (group 1)
            const properName = match[1].trim();
            if (properName) {
                properNames.add(properName);
            }
        }
    });

    return properNames;
};

/**
 * Extracts critical keywords from an account name.
 */
const extractCriticalKeywords = (accountName: string): Set<string> => {
    const normalized = accountName.trim().toUpperCase();
    const found = new Set<string>();

    CRITICAL_KEYWORDS.forEach(group => {
        group.forEach(keyword => {
            // Use word boundary matching to avoid partial matches
            const regex = new RegExp(`\\b${keyword}\\b`);
            if (regex.test(normalized)) {
                found.add(keyword);
            }
        });
    });

    return found;
};

/**
 * Checks if two account names have conflicting critical keywords.
 * Returns true if they have different keywords from the same category.
 */
export const hasKeywordConflict = (a: string, b: string): boolean => {
    const keywordsA = extractCriticalKeywords(a);
    const keywordsB = extractCriticalKeywords(b);

    // Check each keyword group for conflicts
    for (const group of CRITICAL_KEYWORDS) {
        const foundInA = group.filter(kw => keywordsA.has(kw));
        const foundInB = group.filter(kw => keywordsB.has(kw));

        // If both have keywords from this group, they must match
        if (foundInA.length > 0 && foundInB.length > 0) {
            // Check if they're different
            const setA = new Set(foundInA);
            const setB = new Set(foundInB);

            // Special case: ACUM and ACUMULADA are synonyms
            const isAcumA = setA.has('ACUM') || setA.has('ACUMULADA') || setA.has('ACUMULADO');
            const isAcumB = setB.has('ACUM') || setB.has('ACUMULADA') || setB.has('ACUMULADO');

            if (isAcumA && isAcumB) {
                // They both refer to accumulated, so no conflict between them
                continue;
            }

            // If the sets don't match, there's a conflict
            const hasConflict = foundInA.some(kw => !setB.has(kw)) ||
                foundInB.some(kw => !setA.has(kw));

            if (hasConflict) {
                return true;
            }
        }

        // NEW: If one has 'ACUMULADA/ACUM' and the other doesn't, they are DIFFERENT
        const isAcumA = foundInA.some(kw => ['ACUMULADA', 'ACUMULADO', 'ACUM'].includes(kw));
        const isAcumB = foundInB.some(kw => ['ACUMULADA', 'ACUMULADO', 'ACUM'].includes(kw));

        if (isAcumA !== isAcumB) {
            return true; // Presence mismatch for accumulated status
        }
    }

    return false;
};

/**
 * Calculates the Levenshtein distance between two strings.
 * This is the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to change one word into the other.
 */
export const levenshteinDistance = (a: string, b: string): number => {
    const matrix: number[][] = [];

    // 1. Initialize matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // 2. Populate matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

/**
 * Checks if two strings are similar based on a threshold.
 * @param a First string
 * @param b Second string
 * @param threshold Similarity threshold (0.0 to 1.0, default 0.85)
 */
export const areStringsSimilar = (a: string, b: string, threshold = 0.75): boolean => {
    if (!a || !b) return false;

    // Normalize for comparison
    const strA = a.trim().toUpperCase();
    const strB = b.trim().toUpperCase();

    if (strA === strB) return true;

    // CRITICAL: Check for proper name conflicts FIRST
    // If accounts have different proper names (e.g., "Señor Moscoso" vs "Señor Morataya"), they are NOT similar
    const properNamesA = extractProperNames(strA);
    const properNamesB = extractProperNames(strB);

    // If both have proper names, they must match exactly
    if (properNamesA.size > 0 && properNamesB.size > 0) {
        // Check if the sets are different
        const hasConflict =
            Array.from(properNamesA).some(name => !properNamesB.has(name)) ||
            Array.from(properNamesB).some(name => !properNamesA.has(name));

        if (hasConflict) {
            return false; // Different proper names = different accounts
        }
    }

    // CRITICAL: Check for keyword conflicts
    // If accounts differ in critical keywords (e.g., "ACREDITAR" vs "PAGAR"), they are NOT similar
    if (hasKeywordConflict(strA, strB)) {
        return false;
    }

    const longer = strA.length > strB.length ? strA : strB;
    const shorter = strA.length > strB.length ? strB : strA;

    if (longer.length === 0) return true;

    // SAFETY: For short words (e.g. "Caja" vs "Casa"), we require exact match or extremely high similarity
    // to avoid dangerous false positives.
    if (longer.length <= 4) {
        return false;
    }

    const distance = levenshteinDistance(longer, shorter);
    const similarity = (longer.length - distance) / longer.length;


    return similarity >= threshold;
};

/**
 * Normalizes specific account names to standard keys to force grouping.
 * Allows handling aliases like "CAJA Y BANCOS" -> "BANCOS"
 */
export const normalizeSpecificAccounts = (accountName: string): string => {
    let upper = accountName.trim().toUpperCase();

    // Specific Aliases
    if (upper === 'CAJA Y BANCOS') return 'BANCOS';

    // Normalize "AL PERSONAL" / "DEL PERSONAL" 
    // e.g., "Prestamos al personal" -> "PRESTAMOS", "Gastos de consumo del personal" -> "GASTOS DE CONSUMO"
    upper = upper.replace(/\s+(AL|DEL|A)\s+PERSONAL$/i, '').trim();

    return upper;
};
