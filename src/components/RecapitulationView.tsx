import React, { useMemo } from 'react';
import { AccountLedger } from '../types';
import { CURRENCY_FORMAT } from '../utils/constants';
import { Table } from 'lucide-react';

interface RecapitulationViewProps {
    ledgerData: Record<string, AccountLedger>;
}

const RecapitulationView: React.FC<RecapitulationViewProps> = ({ ledgerData }) => {
    const recapRows = useMemo(() => {
        // Sort by Journal Order (firstLine)
        const sortedAccounts = Object.values(ledgerData).sort((a, b) =>
            (a.firstLine || 0) - (b.firstLine || 0)
        );

        return sortedAccounts.map(account => {
            // Calculate Sumas (Total Debit and Total Credit for the period/file)
            // Note: We need to sum up all debit/credit entries in the ledger array.
            const sumasDebe = account.entries.reduce((sum, entry) => sum + entry.debit, 0);
            const sumasHaber = account.entries.reduce((sum, entry) => sum + entry.credit, 0);

            // Calculate Saldos (Balances)
            // GT Accounting: 
            // Saldo Deudor = (Sumas Debe > Sumas Haber) ? (Debe - Haber) : 0
            // Saldo Acreedor = (Sumas Haber > Sumas Debe) ? (Haber - Debe) : 0
            const balance = sumasDebe - sumasHaber;

            let saldoDeudor = 0;
            let saldoAcreedor = 0;

            if (balance > 0) {
                saldoDeudor = balance;
            } else if (balance < 0) {
                saldoAcreedor = Math.abs(balance);
            }

            return {
                code: account.accountCode,
                name: account.accountName,
                sumasDebe,
                sumasHaber,
                saldoDeudor,
                saldoAcreedor
            };
        });
    }, [ledgerData]);

    const totals = useMemo(() => {
        return recapRows.reduce(
            (acc, row) => ({
                sumasDebe: acc.sumasDebe + row.sumasDebe,
                sumasHaber: acc.sumasHaber + row.sumasHaber,
                saldoDeudor: acc.saldoDeudor + row.saldoDeudor,
                saldoAcreedor: acc.saldoAcreedor + row.saldoAcreedor
            }),
            { sumasDebe: 0, sumasHaber: 0, saldoDeudor: 0, saldoAcreedor: 0 }
        );
    }, [recapRows]);



    // Verification Logic
    const areSumasBalanced = Math.abs(totals.sumasDebe - totals.sumasHaber) < 0.01;
    const areSaldosBalanced = Math.abs(totals.saldoDeudor - totals.saldoAcreedor) < 0.01;
    // Fully balanced if both pairs match
    const isFullyBalanced = areSumasBalanced && areSaldosBalanced;

    if (recapRows.length === 0) {
        return <div className="p-8 text-center text-obsidian/40 dark:text-seashell/40 font-medium">No hay datos para generar el balance.</div>;
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-obsidian rounded-sm border border-obsidian/10 dark:border-white/10 shadow-sm overflow-hidden">

            {/* Header - Responsive */}
            <div className="px-3 py-3 md:px-6 md:py-4 border-b border-obsidian/10 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0 bg-white dark:bg-obsidian shrink-0">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 bg-denim/10 rounded-sm text-denim">
                        <Table className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div>
                        <h2 className="text-base md:text-lg font-bold text-obsidian dark:text-seashell uppercase tracking-tight">Balance de Comprobación</h2>
                        <p className="text-[9px] md:text-[10px] text-obsidian/40 dark:text-seashell/40 font-mono font-bold uppercase tracking-widest">
                            4 Columnas (Sumas y Saldos)
                        </p>
                    </div>
                </div>

                <div className={`flex flex-col items-end px-3 py-1.5 md:px-4 md:py-2 rounded-sm border text-xs md:text-sm ${isFullyBalanced ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                    <span className={`text-[8px] md:text-[9px] uppercase font-bold tracking-widest mb-0.5 ${isFullyBalanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                        {isFullyBalanced ? 'Balance Cuadrado' : 'Diferencia Detectada'}
                    </span>
                    {!isFullyBalanced && (
                        <div className="flex flex-col text-right">
                            {!areSumasBalanced && (
                                <span className="text-[9px] md:text-[10px] font-mono text-red-600 dark:text-red-400">
                                    Sumas Diff: {CURRENCY_FORMAT.format(Math.abs(totals.sumasDebe - totals.sumasHaber))}
                                </span>
                            )}
                            {!areSaldosBalanced && (
                                <span className="text-[9px] md:text-[10px] font-mono text-red-600 dark:text-red-400">
                                    Saldos Diff: {CURRENCY_FORMAT.format(Math.abs(totals.saldoDeudor - totals.saldoAcreedor))}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Table - Mobile-friendly with horizontal scroll */}
            <div className="flex-1 overflow-auto p-0 min-h-0 -webkit-overflow-scrolling-touch">
                {/* Wrapper for horizontal scroll on mobile */}
                <div className="overflow-x-auto">
                    <table className="min-w-full lg:min-w-0 border-collapse">
                        <thead className="bg-obsidian/5 dark:bg-white/5 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th rowSpan={2} scope="col" className="px-4 py-3 md:px-4 md:py-3 text-left text-sm md:text-xs lg:text-[10px] font-bold text-obsidian/60 dark:text-seashell/60 uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 align-bottom bg-gray-50 dark:bg-[#1e1e1e] min-w-[180px] md:min-w-0">Cuenta</th>

                                <th colSpan={2} scope="col" className="px-4 py-2 md:px-4 md:py-1 text-center text-sm md:text-xs lg:text-[10px] font-bold text-obsidian/50 dark:text-seashell/50 uppercase tracking-wider border-b border-r border-obsidian/10 dark:border-white/10 bg-gray-100 dark:bg-white/10">Sumas</th>
                                <th colSpan={2} scope="col" className="px-4 py-2 md:px-4 md:py-1 text-center text-sm md:text-xs lg:text-[10px] font-bold text-denim uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 bg-denim/10">Saldos</th>
                            </tr>
                            <tr>
                                {/* Sumas Subheaders */}
                                <th scope="col" className="px-4 py-2.5 md:px-4 md:py-2 text-right text-sm md:text-xs lg:text-[9px] font-bold text-obsidian/50 dark:text-seashell/50 uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 min-w-[140px] md:min-w-[120px] lg:w-32 bg-gray-100 dark:bg-white/10">Debe</th>
                                <th scope="col" className="px-4 py-2.5 md:px-4 md:py-2 text-right text-sm md:text-xs lg:text-[9px] font-bold text-obsidian/50 dark:text-seashell/50 uppercase tracking-wider border-b border-r border-obsidian/10 dark:border-white/10 min-w-[140px] md:min-w-[120px] lg:w-32 bg-gray-100 dark:bg-white/10">Haber</th>

                                {/* Saldos Subheaders */}
                                <th scope="col" className="px-4 py-2.5 md:px-4 md:py-2 text-right text-sm md:text-xs lg:text-[9px] font-bold text-denim uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 min-w-[140px] md:min-w-[120px] lg:w-32 bg-denim/10">Deudor</th>
                                <th scope="col" className="px-4 py-2.5 md:px-4 md:py-2 text-right text-sm md:text-xs lg:text-[9px] font-bold text-denim uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 min-w-[140px] md:min-w-[120px] lg:w-32 bg-denim/10">Acreedor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-obsidian/5 dark:divide-white/5 bg-white dark:bg-obsidian">
                            {recapRows.map((row, index) => (
                                <tr key={row.code} className="hover:bg-denim/5 dark:hover:bg-white/5 transition-colors group">
                                    <td className="px-4 py-3 md:px-4 md:py-2 text-obsidian/80 dark:text-seashell/80 font-medium text-sm md:text-xs">
                                        <span className="text-[10px] text-obsidian/30 dark:text-seashell/30 font-normal mr-2">{index + 1}.</span>
                                        {row.name}
                                    </td>

                                    {/* Sumas Columns - Larger fonts on mobile */}
                                    <td className="px-4 py-3 md:px-4 md:py-2 text-right font-mono text-obsidian/60 dark:text-seashell/60 bg-gray-50/50 dark:bg-white/5 text-base md:text-sm lg:text-xs">
                                        {row.sumasDebe !== 0 ? CURRENCY_FORMAT.format(row.sumasDebe) : '-'}
                                    </td>
                                    <td className="px-4 py-3 md:px-4 md:py-2 text-right font-mono text-obsidian/60 dark:text-seashell/60 border-r border-obsidian/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 text-base md:text-sm lg:text-xs">
                                        {row.sumasHaber !== 0 ? CURRENCY_FORMAT.format(row.sumasHaber) : '-'}
                                    </td>

                                    {/* Saldos Columns - Larger fonts on mobile */}
                                    <td className="px-4 py-3 md:px-4 md:py-2 text-right font-mono text-obsidian dark:text-seashell bg-denim/5 font-bold text-base md:text-sm lg:text-xs">
                                        {row.saldoDeudor !== 0 ? CURRENCY_FORMAT.format(row.saldoDeudor) : '-'}
                                    </td>
                                    <td className="px-4 py-3 md:px-4 md:py-2 text-right font-mono text-obsidian dark:text-seashell bg-denim/5 font-bold text-base md:text-sm lg:text-xs">
                                        {row.saldoAcreedor !== 0 ? CURRENCY_FORMAT.format(row.saldoAcreedor) : '-'}
                                    </td>
                                </tr>
                            ))}

                            {/* Visual Totals Row - Sticky at bottom */}
                            <tr className="bg-seashell dark:bg-white/5 font-bold border-t-2 border-denim sticky bottom-0 z-20 shadow-md">
                                <td className="px-4 py-4 md:px-4 md:py-3 text-right text-obsidian/40 dark:text-seashell/40 uppercase text-xs md:text-[10px] tracking-widest">Totales Generales</td>

                                {/* Sumas Totals - Larger on mobile */}
                                <td className="px-4 py-4 md:px-4 md:py-3 text-right font-mono text-obsidian/70 dark:text-seashell/70 text-lg md:text-sm lg:text-xs bg-gray-100 dark:bg-white/10">
                                    {CURRENCY_FORMAT.format(totals.sumasDebe)}
                                </td>
                                <td className="px-4 py-4 md:px-4 md:py-3 text-right font-mono text-obsidian/70 dark:text-seashell/70 text-lg md:text-sm lg:text-xs border-r border-obsidian/10 dark:border-white/10 bg-gray-100 dark:bg-white/10">
                                    {CURRENCY_FORMAT.format(totals.sumasHaber)}
                                </td>

                                {/* Saldos Totals - Larger on mobile */}
                                <td className="px-4 py-4 md:px-4 md:py-3 text-right font-mono text-denim text-lg md:text-sm lg:text-xs bg-denim/10">
                                    {CURRENCY_FORMAT.format(totals.saldoDeudor)}
                                </td>
                                <td className="px-4 py-4 md:px-4 md:py-3 text-right font-mono text-denim text-lg md:text-sm lg:text-xs bg-denim/10">
                                    {CURRENCY_FORMAT.format(totals.saldoAcreedor)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RecapitulationView;
