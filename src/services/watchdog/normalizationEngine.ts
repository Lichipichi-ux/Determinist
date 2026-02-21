/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG — Normalization Engine
 * ═══════════════════════════════════════════════════════════════════════
 *  Transforms raw account names/codes into canonical, comparable forms.
 *
 *  Pipeline:
 *    1. Trim whitespace (leading, trailing, double spaces)
 *    2. Remove invisible/zero-width characters
 *    3. Lowercase
 *    4. Remove diacritics (tildes, accents)
 *    5. Expand known abbreviations
 *    6. Tokenize and sort
 *
 *  DETERMINISTIC: Same input → always same output. No ML, no randomness.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { NormalizedAccount } from './types';
import { AccountLedger } from '../../types';

// ─── Invisible Character Removal ──────────────────────────────────────

/**
 * Regex matching zero-width and invisible Unicode characters.
 * Covers: Zero-Width Space, Zero-Width Non-Joiner, Zero-Width Joiner,
 * Left-to-Right Mark, Right-to-Left Mark, Soft Hyphen, BOM, etc.
 */
const INVISIBLE_CHARS = /[\u200B\u200C\u200D\u200E\u200F\u00AD\uFEFF\u2060\u2061\u2062\u2063\u2064\u180E\u034F\u17B4\u17B5\u2028\u2029]/g;

/**
 * Regex for multiple consecutive whitespace characters (spaces, tabs).
 */
const MULTI_WHITESPACE = /\s{2,}/g;

// ─── Abbreviation Dictionary ──────────────────────────────────────────
// Key = abbreviated form (lowercase), Value = canonical expansion.
// This is a deterministic, rule-based dictionary — no inference.

const ABBREVIATION_MAP: Record<string, string> = {
    // Common accounting abbreviations (Spanish/Guatemala)
    'ctas': 'cuentas',
    'cta': 'cuenta',
    'cxc': 'cuentas por cobrar',
    'cxp': 'cuentas por pagar',
    'dep': 'depreciacion',
    'depr': 'depreciacion',
    'acum': 'acumulada',
    'admin': 'administracion',
    'admón': 'administracion',
    'admón.': 'administracion',
    'gtos': 'gastos',
    'gto': 'gasto',
    'inv': 'inventario',
    'merc': 'mercaderia',
    'merc.': 'mercaderia',
    'prov': 'proveedores',
    'prov.': 'proveedores',
    'doc': 'documentos',
    'docs': 'documentos',
    'cap': 'capital',
    'imp': 'impuesto',
    'imps': 'impuestos',
    'ret': 'retencion',
    'util': 'utilidad',
    'utils': 'utilidades',
    'serv': 'servicios',
    'srv': 'servicios',
    'alq': 'alquileres',
    'tel': 'telefono',
    'telef': 'telefono',
    's.a.': 'sociedad anonima',
    's.r.l.': 'sociedad de responsabilidad limitada',
    'ltda': 'limitada',
    'ltda.': 'limitada',
    'sr': 'senor',
    'sr.': 'senor',
    'sra': 'senora',
    'sra.': 'senora',
    'lic': 'licenciado',
    'lic.': 'licenciado',
    'ing': 'ingeniero',
    'ing.': 'ingeniero',
    'dr': 'doctor',
    'dr.': 'doctor',
    'no.': 'numero',
    'no': 'numero',
    'núm': 'numero',
    'num': 'numero',
};

// ─── Diacritics Removal ───────────────────────────────────────────────

/**
 * Removes diacritical marks (accents, tildes) from text.
 * "depreciación" → "depreciacion", "fábrica" → "fabrica"
 */
const removeDiacritics = (text: string): string => {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

// ─── Core Normalization Function ──────────────────────────────────────

/**
 * Normalizes a single string through the full pipeline.
 *
 * @param raw — The raw, untouched input string.
 * @returns The normalized string (fully canonical form).
 */
export const normalizeText = (raw: string): string => {
    if (!raw) return '';

    let text = raw;

    // Step 1: Remove invisible characters
    text = text.replace(INVISIBLE_CHARS, '');

    // Step 2: Trim and collapse whitespace
    text = text.trim().replace(MULTI_WHITESPACE, ' ');

    // Step 3: Lowercase
    text = text.toLowerCase();

    // Step 4: Remove diacritics
    text = removeDiacritics(text);

    // Step 5: Expand abbreviations (word-level)
    const words = text.split(/\s+/);
    const expanded = words.map(word => {
        const stripped = word.replace(/[.,;:()[\]{}]/g, '');
        return ABBREVIATION_MAP[stripped] || ABBREVIATION_MAP[word] || word;
    });

    text = expanded.join(' ');

    // Step 6: Remove residual punctuation for comparison
    text = text.replace(/[.,;:()[\]{}"']/g, '').trim();

    // Step 7: Final whitespace collapse
    text = text.replace(MULTI_WHITESPACE, ' ');

    return text;
};

// ─── Tokenization ─────────────────────────────────────────────────────

/**
 * Tokenizes a normalized string into sorted, unique tokens.
 * Used for Jaccard similarity and set-based comparisons.
 */
export const tokenize = (normalizedText: string): string[] => {
    if (!normalizedText) return [];

    const tokens = normalizedText
        .split(/\s+/)
        .filter(t => t.length > 0);

    // Deduplicate and sort for deterministic comparison
    return [...new Set(tokens)].sort();
};

// ─── Account Normalization ────────────────────────────────────────────

/**
 * Converts an `AccountLedger` into a `NormalizedAccount`.
 * Aggregates all financial data from the ledger entries.
 */
export const normalizeAccount = (ledger: AccountLedger): NormalizedAccount => {
    const normalizedCode = normalizeText(ledger.accountCode);
    const normalizedName = normalizeText(ledger.accountName);
    const tokens = tokenize(normalizedName);

    let totalDebit = 0;
    let totalCredit = 0;

    for (const entry of ledger.entries) {
        totalDebit += entry.debit;
        totalCredit += entry.credit;
    }

    return {
        originalCode: ledger.accountCode,
        originalName: ledger.accountName,
        normalizedCode,
        normalizedName,
        tokens,
        totalDebit,
        totalCredit,
        finalBalance: ledger.finalBalance,
        transactionCount: ledger.entries.length,
        firstLine: ledger.firstLine,
    };
};

/**
 * Batch-normalizes all accounts from a ledger map.
 */
export const normalizeAllAccounts = (
    ledgerMap: Record<string, AccountLedger>
): NormalizedAccount[] => {
    return Object.values(ledgerMap).map(normalizeAccount);
};

// ─── Character Forensics ──────────────────────────────────────────────

/**
 * Detects invisible or suspicious characters in a string.
 * Returns an array of findings for the audit log.
 */
export const detectInvisibleCharacters = (text: string): Array<{
    char: string;
    codePoint: number;
    position: number;
    description: string;
}> => {
    const findings: Array<{
        char: string;
        codePoint: number;
        position: number;
        description: string;
    }> = [];

    const INVISIBLE_MAP: Record<number, string> = {
        0x200B: 'Zero-Width Space',
        0x200C: 'Zero-Width Non-Joiner',
        0x200D: 'Zero-Width Joiner',
        0x200E: 'Left-to-Right Mark',
        0x200F: 'Right-to-Left Mark',
        0x00AD: 'Soft Hyphen',
        0xFEFF: 'Byte Order Mark (BOM)',
        0x2060: 'Word Joiner',
        0x180E: 'Mongolian Vowel Separator',
        0x2028: 'Line Separator',
        0x2029: 'Paragraph Separator',
    };

    for (let i = 0; i < text.length; i++) {
        const codePoint = text.codePointAt(i)!;
        if (INVISIBLE_MAP[codePoint]) {
            findings.push({
                char: text[i],
                codePoint,
                position: i,
                description: INVISIBLE_MAP[codePoint],
            });
        }
    }

    return findings;
};
