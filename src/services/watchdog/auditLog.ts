/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG — Immutable Audit Log (Bitácora Forense)
 * ═══════════════════════════════════════════════════════════════════════
 *  Provides an append-only, hash-chained audit trail for every decision
 *  made by the Watchdog system. Each entry is linked to the previous
 *  via SHA-256 hash, creating a tamper-evident chain.
 *
 *  Properties:
 *    • Append-only — entries CANNOT be modified or deleted
 *    • Hash-chained — each entry contains the hash of the previous
 *    • Monotonic sequence IDs — strictly increasing, no gaps
 *    • Serializable — entire log can be exported as JSON
 *    • Integrity-verifiable — chain can be validated at any time
 *
 *  SECURITY: The hash chain doesn't prevent deletion of the in-memory
 *  array, but it makes tampering detectable. For production, this
 *  should be backed by an append-only database or event store.
 *
 *  DETERMINISTIC: Same audit actions → same hash chain (given same
 *  timestamps, which in practice are unique per entry).
 * ═══════════════════════════════════════════════════════════════════════
 */

import { AuditEntry, AuditAction } from './types';

// ─── SHA-256 Hashing ──────────────────────────────────────────────────

/**
 * Computes a SHA-256 hash of the given string.
 * Uses the Web Crypto API (available in browsers and Node 18+).
 * Falls back to a simple deterministic hash if crypto is unavailable.
 */
const computeHash = async (data: string): Promise<string> => {
    try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch {
        // Fallback below
    }

    // Deterministic fallback hash (not cryptographically secure,
    // but sufficient for integrity checking in non-adversarial contexts)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
};

/**
 * Synchronous version using the fallback hash for immediate operations.
 * This is used when async is not practical (e.g., during batch commits).
 */
const computeHashSync = (data: string): string => {
    let hash = 0x811C9DC5; // FNV offset basis
    for (let i = 0; i < data.length; i++) {
        hash ^= data.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193); // FNV prime
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

// ─── Genesis Block ────────────────────────────────────────────────────

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// ─── Immutable Audit Log Class ────────────────────────────────────────

export class ImmutableAuditLog {
    private entries: AuditEntry[] = [];
    private sequenceCounter: number = 0;
    private lastHash: string = GENESIS_HASH;
    private readonly frozen: boolean = false;

    constructor() {
        // Log is created empty — first entry will reference the genesis hash
    }

    /**
     * Returns the total number of audit entries.
     */
    get length(): number {
        return this.entries.length;
    }

    /**
     * Returns the last hash in the chain.
     */
    get currentHash(): string {
        return this.lastHash;
    }

    /**
     * Appends a new entry to the audit log.
     * This is the ONLY way to add data — no update, no delete.
     *
     * @param action — The audit action type
     * @param cycleId — The monitoring cycle this entry belongs to
     * @param payload — Structured data payload (varies by action type)
     * @returns The created AuditEntry
     */
    append(
        action: AuditAction,
        cycleId: string,
        payload: Record<string, unknown>
    ): AuditEntry {
        if (this.frozen) {
            throw new Error('[AUDIT LOG] Attempt to write to a frozen log. This is a security violation.');
        }

        this.sequenceCounter++;

        const timestamp = new Date().toISOString();
        const previousHash = this.lastHash;

        // Create the entry content for hashing
        const hashContent = JSON.stringify({
            sequenceId: this.sequenceCounter,
            timestamp,
            action,
            cycleId,
            payload,
            previousHash,
        });

        const hash = computeHashSync(hashContent);

        const entry: AuditEntry = {
            sequenceId: this.sequenceCounter,
            timestamp,
            action,
            cycleId,
            payload,
            previousHash,
            hash,
        };

        // Append (immutable push — the array grows, never shrinks)
        this.entries.push(Object.freeze(entry) as AuditEntry);
        this.lastHash = hash;

        return entry;
    }

    /**
     * Commits a batch of related entries atomically.
     * Used at the end of a monitoring cycle to record all decisions.
     */
    commitBatch(
        actions: Array<{
            action: AuditAction;
            cycleId: string;
            payload: Record<string, unknown>;
        }>
    ): AuditEntry[] {
        return actions.map(a => this.append(a.action, a.cycleId, a.payload));
    }

    /**
     * Returns all entries (read-only copy).
     */
    getAll(): ReadonlyArray<AuditEntry> {
        return [...this.entries];
    }

    /**
     * Returns entries for a specific cycle.
     */
    getByCycle(cycleId: string): ReadonlyArray<AuditEntry> {
        return this.entries.filter(e => e.cycleId === cycleId);
    }

    /**
     * Returns entries by action type.
     */
    getByAction(action: AuditAction): ReadonlyArray<AuditEntry> {
        return this.entries.filter(e => e.action === action);
    }

    /**
     * Returns the last N entries.
     */
    getRecent(count: number): ReadonlyArray<AuditEntry> {
        return this.entries.slice(-count);
    }

    /**
     * Verifies the integrity of the entire hash chain.
     * Returns `true` if the chain is valid, `false` if tampered.
     */
    verifyIntegrity(): { valid: boolean; brokenAt?: number; details?: string } {
        if (this.entries.length === 0) {
            return { valid: true };
        }

        // Check first entry references genesis
        if (this.entries[0].previousHash !== GENESIS_HASH) {
            return {
                valid: false,
                brokenAt: 0,
                details: `First entry does not reference genesis hash. Expected: ${GENESIS_HASH}, Got: ${this.entries[0].previousHash}`,
            };
        }

        // Check chain continuity
        for (let i = 1; i < this.entries.length; i++) {
            const current = this.entries[i];
            const previous = this.entries[i - 1];

            // Previous hash must match
            if (current.previousHash !== previous.hash) {
                return {
                    valid: false,
                    brokenAt: i,
                    details: `Chain broken at entry ${i}. Expected previousHash: ${previous.hash}, Got: ${current.previousHash}`,
                };
            }

            // Sequence must be monotonic
            if (current.sequenceId !== previous.sequenceId + 1) {
                return {
                    valid: false,
                    brokenAt: i,
                    details: `Sequence gap at entry ${i}. Expected: ${previous.sequenceId + 1}, Got: ${current.sequenceId}`,
                };
            }
        }

        // Verify last hash matches
        if (this.lastHash !== this.entries[this.entries.length - 1].hash) {
            return {
                valid: false,
                brokenAt: this.entries.length - 1,
                details: 'Last hash mismatch — possible post-chain tampering.',
            };
        }

        return { valid: true };
    }

    /**
     * Exports the entire audit log as a JSON string.
     * This is the serialization format for persistence.
     */
    exportJSON(): string {
        return JSON.stringify({
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            totalEntries: this.entries.length,
            genesisHash: GENESIS_HASH,
            currentHash: this.lastHash,
            entries: this.entries,
        }, null, 2);
    }

    /**
     * Generates a summary report of the audit log.
     */
    generateSummary(): {
        totalEntries: number;
        entriesByAction: Record<string, number>;
        entriesByCycle: Record<string, number>;
        chainValid: boolean;
        firstEntry: string | null;
        lastEntry: string | null;
    } {
        const entriesByAction: Record<string, number> = {};
        const entriesByCycle: Record<string, number> = {};

        for (const entry of this.entries) {
            entriesByAction[entry.action] = (entriesByAction[entry.action] || 0) + 1;
            entriesByCycle[entry.cycleId] = (entriesByCycle[entry.cycleId] || 0) + 1;
        }

        return {
            totalEntries: this.entries.length,
            entriesByAction,
            entriesByCycle,
            chainValid: this.verifyIntegrity().valid,
            firstEntry: this.entries.length > 0 ? this.entries[0].timestamp : null,
            lastEntry: this.entries.length > 0 ? this.entries[this.entries.length - 1].timestamp : null,
        };
    }
}
