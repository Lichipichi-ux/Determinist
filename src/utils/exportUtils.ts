import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { AccountLedger } from '../types';
import { isGlosa } from '../services/watchdog';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives a professional file name from the raw file name provided by the user.
 * Example: "Diario del 13" → "Libro Mayor y Balance de Comprobación - Ejercicio 13.xlsx"
 */
export const deriveExportFileName = (rawFileName: string): string => {
    // Strip common extensions
    const stripped = rawFileName.replace(/\.(xlsx|xls|csv|txt)$/i, '').trim();

    // Try to extract a trailing number (e.g. "Diario del 13" → "13")
    const numberMatch = stripped.match(/(\d+)\s*$/);
    const exerciseNumber = numberMatch ? numberMatch[1] : null;

    if (exerciseNumber) {
        return `Libro Mayor y Balance de Comprobación - Ejercicio ${exerciseNumber}.xlsx`;
    }

    // Fallback: use the cleaned name directly
    return `Libro Mayor y Balance de Comprobación - ${stripped}.xlsx`;
};

/** Gray-scale color palette (ARGB) */
const COLOR = {
    WHITE: 'FFFFFFFF',
    LIGHT_GRAY: 'FFF5F5F5',   // rows background alternate / header area
    MEDIUM_GRAY: 'FFD9D9D9',  // borders, separator lines
    DARK_GRAY: 'FF595959',    // header background
    TEXT_DARK: 'FF1A1A1A',    // primary text
    TEXT_MID: 'FF595959',     // secondary text (subheaders, totals label)
    TEXT_LIGHT: 'FF9E9E9E',   // muted text
    TOTAL_BG: 'FFE8E8E8',     // totals row background
    GRAND_TOTAL_BG: 'FF3D3D3D', // grand total background (dark)
} as const;

/** Thin border style for borders */
const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLOR.MEDIUM_GRAY } };
const NO_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLOR.WHITE } };

/** Apply a consistent professional header style */
const styleHeaderRow = (row: ExcelJS.Row) => {
    row.height = 22;
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: COLOR.WHITE }, size: 9, name: 'Calibri' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.DARK_GRAY } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
        cell.border = {
            bottom: { style: 'medium', color: { argb: COLOR.TEXT_DARK } },
        };
    });
};

/** Apply a group-separator row style (account name row in Libro Mayor) */
const styleGroupRow = (row: ExcelJS.Row) => {
    row.height = 18;
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: COLOR.TEXT_DARK }, size: 9, name: 'Calibri' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.LIGHT_GRAY } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = { top: THIN_BORDER, bottom: THIN_BORDER };
    });
};

/** Apply a totals row style inside an account block */
const styleSubTotalRow = (row: ExcelJS.Row) => {
    row.height = 16;
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: COLOR.TEXT_MID }, size: 8.5, name: 'Calibri', italic: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.TOTAL_BG } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = { top: THIN_BORDER };
    });
};

/** Apply the grand total row style */
const styleGrandTotalRow = (row: ExcelJS.Row) => {
    row.height = 24;
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: COLOR.WHITE }, size: 9.5, name: 'Calibri' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.GRAND_TOTAL_BG } };
        cell.alignment = { vertical: 'middle', wrapText: false };
    });
};

/** Apply the Balance de Comprobación sub-header row style */
const styleTrialBalanceSubHeader = (row: ExcelJS.Row) => {
    row.height = 17;
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: COLOR.WHITE }, size: 8.5, name: 'Calibri' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.TEXT_MID } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
        cell.border = { bottom: THIN_BORDER };
    });
};

/** Generic currency numFmt for ExcelJS (Quetzal) */
const QTZ_FMT = '"Q"#,##0.00';

/** Auto-fit column widths based on max content length across all rows */
const autoFitColumns = (worksheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 60) => {
    worksheet.columns.forEach((col) => {
        let maxLen = minWidth;
        col.eachCell?.({ includeEmpty: false }, (cell) => {
            const value = cell.value;
            let len = 0;
            if (typeof value === 'string') len = value.length;
            else if (typeof value === 'number') len = value.toFixed(2).length + 3; // account for currency sign
            else if (value instanceof Date) len = 12;
            else if (value !== null && value !== undefined) len = String(value).length;
            if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(maxLen + 2, maxWidth);
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// SHEET 1 — LIBRO MAYOR
// ─────────────────────────────────────────────────────────────────────────────

const buildLibroMayorSheet = (
    workbook: ExcelJS.Workbook,
    ledgerData: Record<string, AccountLedger>
) => {
    const ws = workbook.addWorksheet('Libro Mayor', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    // ── Columns (NO "Código de Cuenta") ───────────────────────────────────────
    ws.columns = [
        { header: 'Cuenta', key: 'accountName', width: 36 },
        { header: 'Fecha', key: 'date', width: 12 },
        { header: 'Ref. Asiento', key: 'entryId', width: 14 },
        { header: 'Descripción / Concepto', key: 'description', width: 45 },
        { header: 'Debe', key: 'debit', width: 16, style: { numFmt: QTZ_FMT } },
        { header: 'Haber', key: 'credit', width: 16, style: { numFmt: QTZ_FMT } },
        { header: 'Saldo Acumulado', key: 'balance', width: 18, style: { numFmt: QTZ_FMT } },
    ];

    // Style the header row
    styleHeaderRow(ws.getRow(1));

    // ── Data ──────────────────────────────────────────────────────────────────
    const sortedAccounts = Object.values(ledgerData).sort(
        (a, b) => (a.firstLine || 0) - (b.firstLine || 0)
    );

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;
    let blockIndex = 0;   // used for alternating block shading

    for (const account of sortedAccounts) {
        if (account.entries.length === 0 && account.finalBalance === 0) continue;

        // Watchdog defense
        if (isGlosa(account.accountCode) || isGlosa(account.accountName)) {
            console.warn(`[WATCHDOG:EXPORT] Skipping glosa: "${account.accountName}"`);
            continue;
        }

        // ── Block shading: alternate entire account block between white / soft-gray ──
        const BLOCK_LIGHT = COLOR.WHITE;        // even blocks  → white
        const BLOCK_ALT = 'FFF2F2F2';        // odd  blocks  → very soft gray
        const blockBg = blockIndex % 2 === 0 ? BLOCK_LIGHT : BLOCK_ALT;
        blockIndex++;

        // Helper to apply block background to a row
        const applyBlockBg = (row: ExcelJS.Row) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blockBg } };
            });
        };

        // ── Group header row (account name) ───────────────────────────────────
        const groupRow = ws.addRow({ accountName: account.accountName, description: '' });
        groupRow.height = 18;
        groupRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blockBg } };
            cell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: COLOR.TEXT_DARK } };
            cell.alignment = { vertical: 'middle' };
            cell.border = { top: { style: 'thin', color: { argb: COLOR.MEDIUM_GRAY } } };
        });

        // ── Detail rows ───────────────────────────────────────────────────────
        let accountDebit = 0;
        let accountCredit = 0;

        for (const entry of account.entries) {
            if (entry.isHidden) continue;

            const dataRow = ws.addRow({
                accountName: '',
                date: entry.date,
                entryId: entry.entryId,
                description: entry.description,
                debit: entry.debit > 0 ? entry.debit : null,
                credit: entry.credit > 0 ? entry.credit : null,
                balance: entry.runningBalance,
            });

            dataRow.height = 15;
            applyBlockBg(dataRow);
            dataRow.eachCell({ includeEmpty: false }, (cell) => {
                cell.font = { size: 8.5, name: 'Calibri', color: { argb: COLOR.TEXT_DARK } };
                cell.alignment = { vertical: 'middle' };
            });

            // Numeric columns: format + right-align
            ['debit', 'credit', 'balance'].forEach((key) => {
                const cell = dataRow.getCell(key);
                cell.numFmt = QTZ_FMT;
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            });

            accountDebit += entry.debit;
            accountCredit += entry.credit;
        }

        // ── Sub-total row (bottom border acts as block divider) ───────────────
        const totalRow = ws.addRow({
            accountName: '',
            date: '',
            entryId: '',
            description: 'TOTAL CUENTA',
            debit: accountDebit,
            credit: accountCredit,
            balance: account.finalBalance,
        });
        totalRow.height = 16;
        totalRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blockBg } };
            cell.font = { bold: true, italic: true, size: 8.5, name: 'Calibri', color: { argb: COLOR.TEXT_MID } };
            cell.alignment = { vertical: 'middle' };
            // Bottom border as visual separator between blocks
            cell.border = { bottom: { style: 'medium', color: { argb: COLOR.MEDIUM_GRAY } } };
        });
        ['debit', 'credit', 'balance'].forEach((key) => {
            const cell = totalRow.getCell(key);
            cell.numFmt = QTZ_FMT;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
        });
        totalRow.getCell('description').alignment = { horizontal: 'right', vertical: 'middle' };

        grandTotalDebit += accountDebit;
        grandTotalCredit += accountCredit;
    }

    // ── Grand total row ───────────────────────────────────────────────────────
    ws.addRow({}).height = 4;
    const grandRow = ws.addRow({
        accountName: '',
        date: '',
        entryId: '',
        description: 'TOTAL GENERAL DEL LIBRO MAYOR',
        debit: grandTotalDebit,
        credit: grandTotalCredit,
        balance: null,
    });
    styleGrandTotalRow(grandRow);
    ['debit', 'credit'].forEach((key) => {
        const cell = grandRow.getCell(key);
        cell.numFmt = QTZ_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });
    grandRow.getCell('description').alignment = { horizontal: 'right', vertical: 'middle' };

    autoFitColumns(ws);
};

// ─────────────────────────────────────────────────────────────────────────────
// SHEET 2 — BALANCE DE COMPROBACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const buildBalanceComprobacionSheet = (
    workbook: ExcelJS.Workbook,
    ledgerData: Record<string, AccountLedger>
) => {
    const ws = workbook.addWorksheet('Balance de Comprobación', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    // ── Build recap rows ───────────────────────────────────────────────────────
    const sortedAccounts = Object.values(ledgerData).sort(
        (a, b) => (a.firstLine || 0) - (b.firstLine || 0)
    );

    const recapRows = sortedAccounts.map((account) => {
        const sumasDebe = account.entries.reduce((s, e) => s + e.debit, 0);
        const sumasHaber = account.entries.reduce((s, e) => s + e.credit, 0);
        const balance = sumasDebe - sumasHaber;
        const saldoDeudor = balance > 0 ? balance : 0;
        const saldoAcreedor = balance < 0 ? Math.abs(balance) : 0;
        return { name: account.accountName, sumasDebe, sumasHaber, saldoDeudor, saldoAcreedor };
    });

    const totals = recapRows.reduce(
        (acc, r) => ({
            sumasDebe: acc.sumasDebe + r.sumasDebe,
            sumasHaber: acc.sumasHaber + r.sumasHaber,
            saldoDeudor: acc.saldoDeudor + r.saldoDeudor,
            saldoAcreedor: acc.saldoAcreedor + r.saldoAcreedor,
        }),
        { sumasDebe: 0, sumasHaber: 0, saldoDeudor: 0, saldoAcreedor: 0 }
    );

    // ── Column definitions (7 cols total) ─────────────────────────────────────
    ws.columns = [
        { header: '', key: 'no', width: 6 },
        { header: 'Cuenta', key: 'name', width: 38 },
        { header: 'Sumas — Debe', key: 'sumasDebe', width: 18, style: { numFmt: QTZ_FMT } },
        { header: 'Sumas — Haber', key: 'sumasHaber', width: 18, style: { numFmt: QTZ_FMT } },
        { header: 'Saldo Deudor', key: 'saldoDeudor', width: 18, style: { numFmt: QTZ_FMT } },
        { header: 'Saldo Acreedor', key: 'saldoAcreedor', width: 18, style: { numFmt: QTZ_FMT } },
    ];

    // ── Row 1: Main header ────────────────────────────────────────────────────
    const mainHeaderRow = ws.getRow(1);
    mainHeaderRow.values = ['#', 'CUENTA', 'SUMAS — DEBE', 'SUMAS — HABER', 'SALDO DEUDOR', 'SALDO ACREEDOR'];
    styleHeaderRow(mainHeaderRow);

    // Center-align the numeric headers
    ['sumasDebe', 'sumasHaber', 'saldoDeudor', 'saldoAcreedor'].forEach((key) => {
        mainHeaderRow.getCell(key).alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // ── Data rows ─────────────────────────────────────────────────────────────
    recapRows.forEach((row, idx) => {
        const dataRow = ws.addRow({
            no: idx + 1,
            name: row.name,
            sumasDebe: row.sumasDebe > 0 ? row.sumasDebe : null,
            sumasHaber: row.sumasHaber > 0 ? row.sumasHaber : null,
            saldoDeudor: row.saldoDeudor > 0 ? row.saldoDeudor : null,
            saldoAcreedor: row.saldoAcreedor > 0 ? row.saldoAcreedor : null,
        });

        dataRow.height = 15;

        // Alternate row fill
        const fillColor = idx % 2 === 0 ? COLOR.WHITE : 'FFF7F7F7';
        dataRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { size: 8.5, name: 'Calibri', color: { argb: COLOR.TEXT_DARK } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            cell.alignment = { vertical: 'middle' };
            cell.border = { bottom: { style: 'hair', color: { argb: COLOR.MEDIUM_GRAY } } };
        });

        // Row number
        dataRow.getCell('no').alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell('no').font = { size: 8, name: 'Calibri', color: { argb: COLOR.TEXT_LIGHT } };

        // Numeric cells: right-align + currency format
        ['sumasDebe', 'sumasHaber', 'saldoDeudor', 'saldoAcreedor'].forEach((key) => {
            const cell = dataRow.getCell(key);
            cell.numFmt = QTZ_FMT;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
        });
    });

    // ── Totals row ────────────────────────────────────────────────────────────
    ws.addRow({}).height = 4;
    const totalsRow = ws.addRow({
        no: '',
        name: 'TOTALES GENERALES',
        sumasDebe: totals.sumasDebe,
        sumasHaber: totals.sumasHaber,
        saldoDeudor: totals.saldoDeudor,
        saldoAcreedor: totals.saldoAcreedor,
    });

    styleGrandTotalRow(totalsRow);
    totalsRow.getCell('name').alignment = { horizontal: 'right', vertical: 'middle' };
    ['sumasDebe', 'sumasHaber', 'saldoDeudor', 'saldoAcreedor'].forEach((key) => {
        const cell = totalsRow.getCell(key);
        cell.numFmt = QTZ_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    autoFitColumns(ws);
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a professional two-sheet Excel file:
 *  - Sheet 1: Libro Mayor (no "Código de Cuenta" column, grayscale, auto-fit)
 *  - Sheet 2: Balance de Comprobación (currency numFmt, grayscale, auto-fit)
 *
 * @param ledgerData  Processed ledger record
 * @param rawFileName The original file name submitted by the user
 */
export const exportFullLedger = async (
    ledgerData: Record<string, AccountLedger>,
    rawFileName: string = ''
): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Determinist Ledger';
    workbook.created = new Date();
    workbook.properties.date1904 = false;

    buildLibroMayorSheet(workbook, ledgerData);
    buildBalanceComprobacionSheet(workbook, ledgerData);

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = deriveExportFileName(rawFileName || 'Libro Mayor');
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, fileName);
};
