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
