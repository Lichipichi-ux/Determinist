/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG MODULE — Public API
 * ═══════════════════════════════════════════════════════════════════════
 *  Barrel export for the Watchdog surveillance module.
 *
 *  Module Structure:
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  watchdog/                                              │
 *  │  ├── index.ts              ← This file (public API)    │
 *  │  ├── types.ts              ← Core type definitions     │
 *  │  ├── WatchdogMonitor.ts    ← Main orchestrator         │
 *  │  ├── normalizationEngine.ts ← Text normalization       │
 *  │  ├── duplicateEngine.ts    ← Duplicate detection       │
 *  │  ├── reputationEngine.ts   ← Reputation scoring        │
 *  │  ├── anomalyEngine.ts      ← Balance anomaly detector  │
 *  │  ├── riskScoring.ts        ← Composite risk scoring    │
 *  │  └── auditLog.ts           ← Immutable audit trail     │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  Usage:
 *    import { getWatchdogMonitor } from './services/watchdog';
 *    const monitor = getWatchdogMonitor();
 *    const result = monitor.runCycle(ledgerMap, 'SYNC');
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Types ────────────────────────────────────────────────────────────
export type {
    RiskLevel,
    AlertCategory,
    WatchdogMonitorAlert,
    ActionType,
    CorrectiveAction,
    RiskScoreBreakdown,
    RiskWeights,
    NormalizedAccount,
    ReputationProfile,
    ReputationFactor,
    AuditAction,
    AuditEntry,
    CycleMode,
    MonitoringCycleResult,
    WatchdogConfig,
} from './types';

export {
    RISK_THRESHOLDS,
    classifyRisk,
    DEFAULT_RISK_WEIGHTS,
    DEFAULT_WATCHDOG_CONFIG,
} from './types';

// ─── Monitor (Main Class) ────────────────────────────────────────────
export {
    WatchdogMonitor,
    getWatchdogMonitor,
    resetWatchdogMonitor,
} from './WatchdogMonitor';

// ─── Normalization Engine ─────────────────────────────────────────────
export {
    normalizeText,
    tokenize,
    normalizeAccount,
    normalizeAllAccounts,
    detectInvisibleCharacters,
} from './normalizationEngine';

// ─── Duplicate Engine ─────────────────────────────────────────────────
export type { DuplicatePair } from './duplicateEngine';
export {
    jaccardSimilarity,
    levenshteinSimilarity,
    combinedSimilarity,
    detectExactDuplicates,
    detectSemanticDuplicates,
    createDuplicateAlert,
} from './duplicateEngine';

// ─── Reputation Engine ───────────────────────────────────────────────
export {
    evaluateReputation,
    evaluateAllReputations,
    createReputationAlerts,
} from './reputationEngine';

// ─── Anomaly Engine ──────────────────────────────────────────────────
export type { AnomalyFinding } from './anomalyEngine';
export {
    detectAnomalies,
    detectAllAnomalies,
    createAnomalyAlerts,
} from './anomalyEngine';

// ─── Risk Scoring ────────────────────────────────────────────────────
export type { CompositeRiskProfile, RiskSignal } from './riskScoring';
export {
    computeCompositeRisk,
    computeAllCompositeRisks,
    filterByRiskLevel,
} from './riskScoring';

// ─── Audit Log ───────────────────────────────────────────────────────
export { ImmutableAuditLog } from './auditLog';

// ─── Glosa Engine ────────────────────────────────────────────────────
export {
    GLOSA_PATTERNS,
    isGlosa,
    getGlosaPatternLabel,
    createWatchdogAlert,
    createBlockedOperationAlert,
    filterGlosaEntries,
    guardEntry,
} from './glosaEngine';
export type { FilterResult } from './glosaEngine';
