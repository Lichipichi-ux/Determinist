/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG MONITOR — Main Orchestrator
 * ═══════════════════════════════════════════════════════════════════════
 *  The central controller that coordinates all Watchdog sub-engines
 *  into a unified monitoring pipeline.
 *
 *  Architecture Flow:
 *
 *  [User Creates/Modifies Account]
 *          ↓
 *  [Core Deterministic Engine (parserService, ledgerService)]
 *          ↓
 *  [Watchdog Interceptor Layer]
 *          ↓
 *  [Normalization Engine]
 *          ↓
 *  [Duplicate + Semantic Detector]
 *          ↓
 *  [Reputation Scoring]
 *          ↓
 *  [Balance Anomaly Detector]
 *          ↓
 *  [Risk Score Composer]
 *          ↓
 *  [Alert Engine]
 *          ↓
 *  [Immutable Audit Log]
 *
 *  Operating Modes:
 *    SYNC  — Immediate validation on account creation/modification
 *    ASYNC — Deep audit cycle (scheduled or manual)
 *
 *  DESIGN: Observer pattern — the Monitor watches the ledger without
 *  modifying it. All proposed actions require human confirmation.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { AccountLedger } from '../../types';
import {
    WatchdogMonitorAlert,
    WatchdogConfig,
    DEFAULT_WATCHDOG_CONFIG,
    MonitoringCycleResult,
    AlertCategory,
    RiskLevel,
    CycleMode,
    NormalizedAccount,
    classifyRisk,
    ReputationProfile,
} from './types';
import { normalizeAllAccounts, normalizeText } from './normalizationEngine';
import {
    detectExactDuplicates,
    detectSemanticDuplicates,
    createDuplicateAlert,
    DuplicatePair,
} from './duplicateEngine';
import {
    evaluateAllReputations,
    createReputationAlerts,
} from './reputationEngine';
import {
    detectAllAnomalies,
    createAnomalyAlerts,
    AnomalyFinding,
} from './anomalyEngine';
import {
    computeAllCompositeRisks,
    CompositeRiskProfile,
} from './riskScoring';
import { ImmutableAuditLog } from './auditLog';

// ─── Watchdog Monitor Class ──────────────────────────────────────────

export class WatchdogMonitor {
    private config: WatchdogConfig;
    private auditLog: ImmutableAuditLog;
    private schedulerTimer: ReturnType<typeof setInterval> | null = null;
    private lastCycleResult: MonitoringCycleResult | null = null;
    private alertHistory: WatchdogMonitorAlert[] = [];
    private cycleCount: number = 0;

    // Cache for the last run's intermediate results
    private lastNormalized: NormalizedAccount[] = [];
    private lastDuplicates: DuplicatePair[] = [];
    private lastAnomalies: AnomalyFinding[] = [];
    private lastReputations: ReputationProfile[] = [];
    private lastCompositeRisks: CompositeRiskProfile[] = [];

    constructor(config: Partial<WatchdogConfig> = {}) {
        this.config = { ...DEFAULT_WATCHDOG_CONFIG, ...config };
        this.auditLog = new ImmutableAuditLog();
    }

    // ═══════════════════════════════════════════════════════════════
    //  MAIN MONITORING CYCLE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Executes a full monitoring cycle.
     *
     * This is the primary entry point. It:
     *  1. Normalizes all accounts
     *  2. Detects exact duplicates
     *  3. Detects semantic duplicates
     *  4. Evaluates reputational risk
     *  5. Detects balance anomalies
     *  6. Computes composite risk scores
     *  7. Generates alerts
     *  8. Records everything in the audit log
     *
     * @param ledgerMap — The current ledger state (READ-ONLY access)
     * @param mode — SYNC (immediate) or ASYNC (deep audit)
     * @returns MonitoringCycleResult with all findings
     */
    runCycle(
        ledgerMap: Record<string, AccountLedger>,
        mode: CycleMode = 'SYNC'
    ): MonitoringCycleResult {
        this.cycleCount++;
        const cycleId = `CYCLE-${this.cycleCount}-${Date.now()}`;
        const startedAt = new Date().toISOString();
        const allAlerts: WatchdogMonitorAlert[] = [];

        // ─── Audit: Cycle Start ───────────────────────────────────
        this.auditLog.append('CYCLE_STARTED', cycleId, {
            mode,
            accountCount: Object.keys(ledgerMap).length,
            timestamp: startedAt,
        });

        // ─── Step 1: Normalization ────────────────────────────────
        const normalizedAccounts = normalizeAllAccounts(ledgerMap);
        this.lastNormalized = normalizedAccounts;

        // ─── Step 2: Exact Duplicate Detection ────────────────────
        const exactDuplicates = detectExactDuplicates(normalizedAccounts);

        for (const pair of exactDuplicates) {
            const alert = createDuplicateAlert(pair, cycleId);
            allAlerts.push(alert);

            this.auditLog.append('DUPLICATE_DETECTED', cycleId, {
                type: 'EXACT',
                accountA: pair.accountA.originalCode,
                accountB: pair.accountB.originalCode,
                similarity: pair.similarity,
            });
        }

        // ─── Step 3: Semantic Duplicate Detection ─────────────────
        const semanticDuplicates = detectSemanticDuplicates(
            normalizedAccounts,
            this.config
        );

        for (const pair of semanticDuplicates) {
            const alert = createDuplicateAlert(pair, cycleId);
            allAlerts.push(alert);

            this.auditLog.append('SEMANTIC_DUPLICATE_DETECTED', cycleId, {
                type: 'SEMANTIC',
                accountA: pair.accountA.originalCode,
                accountB: pair.accountB.originalCode,
                similarity: pair.similarity,
                dictionaryAllowsCoexistence: pair.dictionaryAllowsCoexistence,
                levenshtein: pair.levenshteinScore,
                jaccard: pair.jaccardScore,
            });
        }

        const allDuplicates = [...exactDuplicates, ...semanticDuplicates];
        this.lastDuplicates = allDuplicates;

        // ─── Step 4: Reputation Evaluation ────────────────────────
        const reputationProfiles = evaluateAllReputations(normalizedAccounts, this.config);
        this.lastReputations = reputationProfiles;

        const reputationAlerts = createReputationAlerts(reputationProfiles, cycleId);
        allAlerts.push(...reputationAlerts);

        for (const profile of reputationProfiles) {
            if (profile.riskLevel !== 'NORMAL') {
                this.auditLog.append('REPUTATION_EVALUATED', cycleId, {
                    accountCode: profile.accountCode,
                    reputationScore: profile.reputationScore,
                    riskLevel: profile.riskLevel,
                    factors: profile.factors.map(f => ({ name: f.name, score: f.score })),
                });
            }
        }

        // ─── Step 5: Balance Anomaly Detection ────────────────────
        const anomalyFindings = detectAllAnomalies(
            ledgerMap,
            normalizedAccounts,
            this.config
        );
        this.lastAnomalies = anomalyFindings;

        const anomalyAlerts = createAnomalyAlerts(anomalyFindings, cycleId);
        allAlerts.push(...anomalyAlerts);

        for (const finding of anomalyFindings) {
            this.auditLog.append('ANOMALY_DETECTED', cycleId, {
                accountCode: finding.accountCode,
                ruleId: finding.ruleId,
                score: finding.score,
                description: finding.description,
            });
        }

        // ─── Step 6: Composite Risk Scoring ──────────────────────
        const compositeRisks = computeAllCompositeRisks(
            normalizedAccounts,
            allDuplicates,
            anomalyFindings,
            reputationProfiles,
            this.config
        );
        this.lastCompositeRisks = compositeRisks;

        // ─── Step 7: Alert Logging ─────────────────────────────────
        for (const alert of allAlerts) {
            this.auditLog.append('ALERT_GENERATED', cycleId, {
                alertId: alert.id,
                category: alert.category,
                riskLevel: alert.riskLevel,
                riskScore: alert.riskScore,
                accountCode: alert.accountCode,
                message: alert.message,
            });
        }

        // ─── Build Summary ─────────────────────────────────────────
        const summary: Record<AlertCategory, number> = {
            EXACT_DUPLICATE: 0,
            SEMANTIC_DUPLICATE: 0,
            REPUTATION_RISK: 0,
            BALANCE_ANOMALY: 0,
            DICTIONARY_CONFLICT: 0,
            ANTI_FRAUD: 0,
            GLOSA_DETECTED: 0,
        };

        const riskSummary: Record<RiskLevel, number> = {
            NORMAL: 0,
            OBSERVATION: 0,
            HIGH: 0,
            CRITICAL: 0,
        };

        for (const alert of allAlerts) {
            summary[alert.category]++;
            riskSummary[alert.riskLevel]++;
        }

        // ─── Audit: Cycle Complete ─────────────────────────────────
        const completedAt = new Date().toISOString();

        this.auditLog.append('CYCLE_COMPLETED', cycleId, {
            mode,
            accountsAnalyzed: normalizedAccounts.length,
            totalAlerts: allAlerts.length,
            summary,
            riskSummary,
            duration: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
        });

        // ─── Store Results ─────────────────────────────────────────
        const result: MonitoringCycleResult = {
            cycleId,
            mode,
            startedAt,
            completedAt,
            accountsAnalyzed: normalizedAccounts.length,
            alerts: allAlerts,
            summary,
            riskSummary,
        };

        this.lastCycleResult = result;
        this.alertHistory.push(...allAlerts);

        // ─── Console Report ────────────────────────────────────────
        this.logCycleReport(result);

        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    //  SYNC INTERCEPTION — Account Creation/Modification Guard
    // ═══════════════════════════════════════════════════════════════

    /**
     * Synchronous validation for a single account name.
     * Called BEFORE the account is created/modified in the ledger.
     *
     * Returns alerts if the name is problematic (duplicate, ambiguous, etc.)
     * The calling code should present these to the user and optionally
     * block the operation.
     *
     * THIS DOES NOT MODIFY THE LEDGER.
     */
    interceptAccountCreation(
        proposedName: string,
        ledgerMap: Record<string, AccountLedger>
    ): WatchdogMonitorAlert[] {
        if (!this.config.syncInterceptionEnabled) return [];

        const cycleId = `INTERCEPT-${Date.now()}`;
        const alerts: WatchdogMonitorAlert[] = [];

        const normalizedProposed = normalizeText(proposedName);

        // Check against all existing accounts
        for (const [code, ledger] of Object.entries(ledgerMap)) {
            const normalizedExisting = normalizeText(ledger.accountName);

            // Exact match
            if (normalizedProposed === normalizedExisting) {
                alerts.push({
                    id: `WD-INT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    timestamp: new Date().toISOString(),
                    category: 'EXACT_DUPLICATE',
                    riskLevel: 'CRITICAL',
                    riskScore: 1.0,
                    accountCode: code,
                    accountName: ledger.accountName,
                    relatedAccountName: proposedName,
                    message: `[WATCHDOG] BLOQUEO: "${proposedName}" es idéntica a la cuenta existente "${ledger.accountName}".`,
                    details: `Normalizada: "${normalizedProposed}" ≡ "${normalizedExisting}"`,
                    proposedAction: {
                        type: 'BLOCK_CREATION',
                        description: `No se permite crear "${proposedName}" — ya existe como "${ledger.accountName}".`,
                        targetAccounts: [code],
                        confirmed: false,
                    },
                    acknowledged: false,
                    cycleId,
                });
            }
        }

        // Log interception
        if (alerts.length > 0) {
            this.auditLog.append('ACCOUNT_BLOCKED', cycleId, {
                proposedName,
                reason: alerts.map(a => a.message),
                alertCount: alerts.length,
            });
        }

        return alerts;
    }

    // ═══════════════════════════════════════════════════════════════
    //  SCHEDULER — Continuous Monitoring
    // ═══════════════════════════════════════════════════════════════

    /**
     * Starts the continuous monitoring scheduler.
     * Runs a full ASYNC cycle at the configured interval.
     *
     * @param getLedger — Function that returns the current ledger state
     */
    startScheduler(
        getLedger: () => Record<string, AccountLedger>
    ): void {
        if (this.schedulerTimer) {
            console.warn('[WATCHDOG] Scheduler already running. Stop it first.');
            return;
        }

        console.log(
            `[WATCHDOG] ══════════════════════════════════════════════════\n` +
            `[WATCHDOG] Scheduler STARTED — interval: ${this.config.monitoringIntervalMs}ms\n` +
            `[WATCHDOG] ══════════════════════════════════════════════════`
        );

        this.schedulerTimer = setInterval(() => {
            try {
                const ledger = getLedger();
                if (Object.keys(ledger).length > 0) {
                    this.runCycle(ledger, 'ASYNC');
                }
            } catch (error) {
                console.error('[WATCHDOG] Scheduler cycle failed:', error);
            }
        }, this.config.monitoringIntervalMs);
    }

    /**
     * Stops the continuous monitoring scheduler.
     */
    stopScheduler(): void {
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
            console.log('[WATCHDOG] Scheduler STOPPED.');
        }
    }

    /**
     * Returns whether the scheduler is currently running.
     */
    isSchedulerRunning(): boolean {
        return this.schedulerTimer !== null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  QUERY API — Read-Only Access to Results
    // ═══════════════════════════════════════════════════════════════

    /**
     * Returns the result of the last monitoring cycle.
     */
    getLastCycleResult(): MonitoringCycleResult | null {
        return this.lastCycleResult;
    }

    /**
     * Returns all alerts from all cycles.
     */
    getAllAlerts(): ReadonlyArray<WatchdogMonitorAlert> {
        return [...this.alertHistory];
    }

    /**
     * Returns alerts filtered by risk level.
     */
    getAlertsByRisk(minLevel: RiskLevel): WatchdogMonitorAlert[] {
        const levelOrder: Record<RiskLevel, number> = {
            NORMAL: 0, OBSERVATION: 1, HIGH: 2, CRITICAL: 3,
        };
        const minOrder = levelOrder[minLevel];
        return this.alertHistory.filter(a => levelOrder[a.riskLevel] >= minOrder);
    }

    /**
     * Returns alerts filtered by category.
     */
    getAlertsByCategory(category: AlertCategory): WatchdogMonitorAlert[] {
        return this.alertHistory.filter(a => a.category === category);
    }

    /**
     * Returns unacknowledged alerts.
     */
    getUnacknowledgedAlerts(): WatchdogMonitorAlert[] {
        return this.alertHistory.filter(a => !a.acknowledged);
    }

    /**
     * Acknowledges an alert by ID.
     */
    acknowledgeAlert(alertId: string): boolean {
        const alert = this.alertHistory.find(a => a.id === alertId);
        if (!alert) return false;

        alert.acknowledged = true;

        this.auditLog.append('MANUAL_OVERRIDE', alert.cycleId, {
            alertId,
            action: 'ACKNOWLEDGED',
            timestamp: new Date().toISOString(),
        });

        return true;
    }

    /**
     * Returns the last computed composite risks.
     */
    getCompositeRisks(): ReadonlyArray<CompositeRiskProfile> {
        return [...this.lastCompositeRisks];
    }

    /**
     * Returns the audit log instance (read-only access).
     */
    getAuditLog(): ImmutableAuditLog {
        return this.auditLog;
    }

    /**
     * Returns the current configuration.
     */
    getConfig(): Readonly<WatchdogConfig> {
        return { ...this.config };
    }

    /**
     * Updates configuration (only allowed for non-security settings).
     */
    updateConfig(partial: Partial<WatchdogConfig>): void {
        this.config = { ...this.config, ...partial };

        this.auditLog.append('MANUAL_OVERRIDE', 'CONFIG', {
            action: 'CONFIG_UPDATED',
            changes: partial,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Returns a comprehensive status report.
     */
    getStatusReport(): {
        isRunning: boolean;
        totalCycles: number;
        totalAlerts: number;
        unacknowledgedAlerts: number;
        criticalAlerts: number;
        auditLogSize: number;
        auditLogIntegrity: boolean;
        lastCycleTime: string | null;
        config: WatchdogConfig;
    } {
        const integrity = this.auditLog.verifyIntegrity();

        return {
            isRunning: this.isSchedulerRunning(),
            totalCycles: this.cycleCount,
            totalAlerts: this.alertHistory.length,
            unacknowledgedAlerts: this.getUnacknowledgedAlerts().length,
            criticalAlerts: this.getAlertsByRisk('CRITICAL').length,
            auditLogSize: this.auditLog.length,
            auditLogIntegrity: integrity.valid,
            lastCycleTime: this.lastCycleResult?.completedAt || null,
            config: this.config,
        };
    }

    // ─── Private: Console Report ────────────────────────────────────────

    private logCycleReport(result: MonitoringCycleResult): void {
        const duration = new Date(result.completedAt).getTime() -
            new Date(result.startedAt).getTime();

        const lines = [
            ``,
            `[WATCHDOG] ══════════════════════════════════════════════════`,
            `[WATCHDOG] Ciclo ${result.cycleId} completado`,
            `[WATCHDOG] ──────────────────────────────────────────────────`,
            `[WATCHDOG] Modo: ${result.mode}`,
            `[WATCHDOG] Cuentas analizadas: ${result.accountsAnalyzed}`,
            `[WATCHDOG] Alertas generadas: ${result.alerts.length}`,
            `[WATCHDOG]   · Duplicados exactos:    ${result.summary.EXACT_DUPLICATE}`,
            `[WATCHDOG]   · Duplicados semánticos:  ${result.summary.SEMANTIC_DUPLICATE}`,
            `[WATCHDOG]   · Riesgo reputacional:    ${result.summary.REPUTATION_RISK}`,
            `[WATCHDOG]   · Anomalías de saldo:     ${result.summary.BALANCE_ANOMALY}`,
            `[WATCHDOG]   · Anti-fraude:            ${result.summary.ANTI_FRAUD}`,
            `[WATCHDOG] ──────────────────────────────────────────────────`,
            `[WATCHDOG] Por riesgo:`,
            `[WATCHDOG]   · CRITICAL:    ${result.riskSummary.CRITICAL}`,
            `[WATCHDOG]   · HIGH:        ${result.riskSummary.HIGH}`,
            `[WATCHDOG]   · OBSERVATION: ${result.riskSummary.OBSERVATION}`,
            `[WATCHDOG]   · NORMAL:      ${result.riskSummary.NORMAL}`,
            `[WATCHDOG] Duración: ${duration}ms`,
            `[WATCHDOG] ══════════════════════════════════════════════════`,
        ];

        if (result.riskSummary.CRITICAL > 0) {
            console.error(lines.join('\n'));
        } else if (result.riskSummary.HIGH > 0) {
            console.warn(lines.join('\n'));
        } else {
            console.log(lines.join('\n'));
        }
    }
}

// ─── Singleton Factory ────────────────────────────────────────────────

let _instance: WatchdogMonitor | null = null;

/**
 * Returns the singleton WatchdogMonitor instance.
 * Creates it on first call with the given config.
 */
export const getWatchdogMonitor = (
    config?: Partial<WatchdogConfig>
): WatchdogMonitor => {
    if (!_instance) {
        _instance = new WatchdogMonitor(config);
    }
    return _instance;
};

/**
 * Resets the singleton (for testing purposes only).
 */
export const resetWatchdogMonitor = (): void => {
    if (_instance) {
        _instance.stopScheduler();
        _instance = null;
    }
};
