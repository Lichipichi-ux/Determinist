import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { AccountLedger } from '../types';
import { isGlosa } from '../services/watchdog';

/**
 * Exports the full ledger data to a professional Excel file.
 * Groups by account, includes totals, and applies styling.
 */
export const exportFullLedger = async (ledgerData: Record<string, AccountLedger>) => {
    // 1. Create a new Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Determinist Ledger';
    workbook.created = new Date();

    // 2. Add a Worksheet
    const worksheet = workbook.addWorksheet('Libro Mayor', {
        views: [
            { state: 'frozen', xSplit: 0, ySplit: 1 } // Freeze the header row
        ]
    });

    // 3. Define Columns
    worksheet.columns = [
        { header: 'Código', key: 'accountCode', width: 12 },
        { header: 'Nombre de Cuenta', key: 'accountName', width: 40 },
        { header: 'Fecha', key: 'date', width: 12 },
        { header: 'ID Asiento', key: 'entryId', width: 15 },
        { header: 'Descripción', key: 'description', width: 50 },
        { header: 'Debe', key: 'debit', width: 15, style: { numFmt: '"Q"#,##0.00' } },
        { header: 'Haber', key: 'credit', width: 15, style: { numFmt: '"Q"#,##0.00' } },
        { header: 'Saldo Acumulado', key: 'balance', width: 15, style: { numFmt: '"Q"#,##0.00' } }
    ];

    // Stylize Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2c3e50' } // Dark Blue/Grey background
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // 4. Process Data
    // Sort accounts by appearance (book order)
    const sortedAccounts = Object.values(ledgerData).sort((a, b) => (a.firstLine || 0) - (b.firstLine || 0));

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    for (const account of sortedAccounts) {
        if (account.entries.length === 0 && account.finalBalance === 0) continue;

        // ═══ WATCHDOG: Export defense-in-depth ═══
        if (isGlosa(account.accountCode) || isGlosa(account.accountName)) {
            console.warn(`[WATCHDOG:EXPORT] Skipping glosa account in export: "${account.accountName}"`);
            continue;
        }

        // Add Group Header Row (Account Info)
        const groupRow = worksheet.addRow({
            accountCode: account.accountCode,
            accountName: account.accountName,
            description: '--- INICIO DE CUENTA ---'
        });
        groupRow.font = { bold: true, color: { argb: 'FF1a5276' } }; // Dark Blue
        groupRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFeaeded' } // Light Grey
        };

        // Add Detail Rows
        let accountDebit = 0;
        let accountCredit = 0;

        for (const entry of account.entries) {
            if (entry.isHidden) continue;

            worksheet.addRow({
                accountCode: '', // Empty for cleaner look, or repeat if needed (cleaner is better for reading)
                accountName: '',
                date: entry.date,
                entryId: entry.entryId,
                description: entry.description,
                debit: entry.debit,
                credit: entry.credit,
                balance: entry.runningBalance
            });

            accountDebit += entry.debit;
            accountCredit += entry.credit;
        }

        // Add Account Total Row
        const totalRow = worksheet.addRow({
            description: 'TOTAL CUENTA',
            debit: accountDebit,
            credit: accountCredit,
            balance: account.finalBalance
        });

        // Style Total Row
        totalRow.font = { bold: true };
        totalRow.getCell('description').alignment = { horizontal: 'right' };
        totalRow.getCell('balance').font = { bold: true, color: { argb: account.finalBalance < 0 ? 'FFC0392B' : 'FF196F3D' } }; // Red or Green

        // Add spacer row
        worksheet.addRow({});

        // Accumulate Grand Totals
        grandTotalDebit += accountDebit;
        grandTotalCredit += accountCredit;
    }

    // 5. Add Grand Total Row
    worksheet.addRow({}); // Extra spacing
    const grandTotalRow = worksheet.addRow({
        description: 'TOTAL GENERAL DEL LIBRO MAYOR',
        debit: grandTotalDebit,
        credit: grandTotalCredit
    });

    grandTotalRow.height = 30;
    grandTotalRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    grandTotalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2c3e50' }
    };
    grandTotalRow.alignment = { vertical: 'middle' };
    grandTotalRow.getCell('description').alignment = { horizontal: 'right', vertical: 'middle' };

    // 6. Generate Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // 7. Save File using file-saver
    const fileName = `Libro_Mayor_Consolidado_${new Date().toISOString().split('T')[0]}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
};
