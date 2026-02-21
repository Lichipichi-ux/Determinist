/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG MONITOR — Core Type Definitions
 * ═══════════════════════════════════════════════════════════════════════
 *  Centralized types for the Watchdog surveillance module.
 *  These types are used across all sub-engines (Normalization, Duplicate
 *  Detection, Reputation Scoring, Anomaly Detection, Audit Log).
 *
 *  DESIGN PRINCIPLE: Every type is deterministic and serializable.
 *  No external dependencies. No runtime inference.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Risk Classification ──────────────────────────────────────────────

export type RiskLevel = 'NORMAL' | 'OBSERVATION' | 'HIGH' | 'CRITICAL';

export const RISK_THRESHOLDS = {
    CRITICAL: 0.85,  // Bloqueo preventivo
    HIGH: 0.60,  // Alerta roja
    OBSERVATION: 0.40,  // Observación
    NORMAL: 0.00,  // Normal
} as const;

/**
 * Classifies a numeric risk score [0..1] into a `RiskLevel`.
 */
export const classifyRisk = (score: number): RiskLevel => {
    if (score >= RISK_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (score >= RISK_THRESHOLDS.HIGH) return 'HIGH';
    if (score >= RISK_THRESHOLDS.OBSERVATION) return 'OBSERVATION';
    return 'NORMAL';
};

// ─── Alert Structure ──────────────────────────────────────────────────

export type AlertCategory =
    | 'EXACT_DUPLICATE'
    | 'SEMANTIC_DUPLICATE'
    | 'REPUTATION_RISK'
    | 'BALANCE_ANOMALY'
    | 'DICTIONARY_CONFLICT'
    | 'ANTI_FRAUD'
    | 'GLOSA_DETECTED';

export interface WatchdogMonitorAlert {
    /** Unique alert ID — immutable once created */
    id: string;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Category of the detection */
    category: AlertCategory;
    /** Risk level (NORMAL, OBSERVATION, HIGH, CRITICAL) */
    riskLevel: RiskLevel;
    /** Numeric risk score [0..1] */
    riskScore: number;
    /** Primary account involved */
    accountCode: string;
    accountName: string;
    /** Secondary account (for duplicate comparisons) */
    relatedAccountCode?: string;
    relatedAccountName?: string;
    /** Human-readable message */
    message: string;
    /** Detailed technical explanation */
    details: string;
    /** Proposed corrective action (never auto-executed) */
    proposedAction?: CorrectiveAction;
    /** Whether the alert has been acknowledged by a human */
    acknowledged: boolean;
    /** Cycle ID — links this alert to a specific monitoring cycle */
    cycleId: string;
}

// ─── Corrective Actions ───────────────────────────────────────────────

export type ActionType =
    | 'MERGE_ACCOUNTS'
    | 'RENAME_ACCOUNT'
    | 'FLAG_FOR_REVIEW'
    | 'QUARANTINE_ACCOUNT'
    | 'BLOCK_CREATION';

export interface CorrectiveAction {
    type: ActionType;
    description: string;
    /** Accounts affected */
    targetAccounts: string[];
    /** Suggested new name (for RENAME) or surviving account (for MERGE) */
    suggestedValue?: string;
    /** Has a human confirmed this action? */
    confirmed: boolean;
}

// ─── Risk Scoring ─────────────────────────────────────────────────────

export interface RiskScoreBreakdown {
    /** Probability of being a duplicate [0..1] */
    duplicateProbability: number;
    /** Anomaly score from balance analysis [0..1] */
    anomalyScore: number;
    /** Dictionary conflict score [0..1] */
    dictionaryConflict: number;
    /** Final weighted score [0..1] */
    finalScore: number;
    /** Weights used */
    weights: RiskWeights;
}

export interface RiskWeights {
    similarity: number;
    balance: number;
    dictionary: number;
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
    similarity: 0.45,
    balance: 0.30,
    dictionary: 0.25,
};

// ─── Normalized Account ───────────────────────────────────────────────

export interface NormalizedAccount {
    /** Original account code (untouched) */
    originalCode: string;
    /** Original account name (untouched) */
    originalName: string;
    /** Normalized code (lowercase, trimmed, cleaned) */
    normalizedCode: string;
    /** Normalized name (lowercase, trimmed, cleaned, abbreviations expanded) */
    normalizedName: string;
    /** Canonical tokens (sorted, deduplicated) */
    tokens: string[];
    /** Total debit across all movements */
    totalDebit: number;
    /** Total credit across all movements */
    totalCredit: number;
    /** Final balance */
    finalBalance: number;
    /** Number of transactions */
    transactionCount: number;
    /** First appearance line */
    firstLine: number;
}

// ─── Reputation Profile ───────────────────────────────────────────────

export interface ReputationProfile {
    accountCode: string;
    accountName: string;
    /** Overall reputation score [0..1] — 0 = suspicious, 1 = clean */
    reputationScore: number;
    /** Individual risk factors */
    factors: ReputationFactor[];
    /** Summary risk level */
    riskLevel: RiskLevel;
    /** Last evaluation timestamp */
    lastEvaluated: string;
}

export interface ReputationFactor {
    name: string;
    description: string;
    /** Contribution to risk [0..1] — higher = riskier */
    score: number;
    /** Weight of this factor in final score */
    weight: number;
}

// ─── Immutable Audit Entry ────────────────────────────────────────────

export type AuditAction =
    | 'CYCLE_STARTED'
    | 'CYCLE_COMPLETED'
    | 'DUPLICATE_DETECTED'
    | 'SEMANTIC_DUPLICATE_DETECTED'
    | 'REPUTATION_EVALUATED'
    | 'ANOMALY_DETECTED'
    | 'ALERT_GENERATED'
    | 'ACTION_PROPOSED'
    | 'ACTION_CONFIRMED'
    | 'ACTION_REJECTED'
    | 'DICTIONARY_CONFLICT'
    | 'ACCOUNT_BLOCKED'
    | 'MANUAL_OVERRIDE';

export interface AuditEntry {
    /** Sequential, monotonically increasing ID */
    sequenceId: number;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Type of action recorded */
    action: AuditAction;
    /** Cycle this entry belongs to */
    cycleId: string;
    /** Structured payload — varies by action type */
    payload: Record<string, unknown>;
    /** SHA-256 hash of the previous entry (blockchain-style chain) */
    previousHash: string;
    /** SHA-256 hash of this entry */
    hash: string;
}

// ─── Monitoring Cycle ─────────────────────────────────────────────────

export type CycleMode = 'SYNC' | 'ASYNC';

export interface MonitoringCycleResult {
    cycleId: string;
    mode: CycleMode;
    startedAt: string;
    completedAt: string;
    /** Total accounts analyzed */
    accountsAnalyzed: number;
    /** Alerts generated in this cycle */
    alerts: WatchdogMonitorAlert[];
    /** Summary counts by category */
    summary: Record<AlertCategory, number>;
    /** Summary counts by risk level */
    riskSummary: Record<RiskLevel, number>;
}

// ─── Configuration ────────────────────────────────────────────────────

export interface WatchdogConfig {
    /** Risk score weights */
    weights: RiskWeights;
    /** Similarity threshold for duplicate detection */
    similarityThreshold: number;
    /** Minimum transaction count to evaluate anomalies */
    minTransactionsForAnomaly: number;
    /** Balance-to-transaction ratio threshold */
    balanceRatioThreshold: number;
    /** Zero-balance days threshold to flag inactivity */
    zeroBalanceDaysThreshold: number;
    /** Enable anti-fraud rules */
    antiFraudEnabled: boolean;
    /** Monitoring interval in milliseconds (for scheduler) */
    monitoringIntervalMs: number;
    /** Enable synchronous interception on account creation */
    syncInterceptionEnabled: boolean;
}

export const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
    weights: DEFAULT_RISK_WEIGHTS,
    similarityThreshold: 0.75,
    minTransactionsForAnomaly: 3,
    balanceRatioThreshold: 0.01,
    zeroBalanceDaysThreshold: 30,
    antiFraudEnabled: true,
    monitoringIntervalMs: 60_000, // 1 minute
    syncInterceptionEnabled: true,
};
