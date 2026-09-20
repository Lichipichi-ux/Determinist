import ExcelJS from 'exceljs';
import { AccountLedger, UserMode } from '../types';
import { isGlosa } from '../services/watchdog';

export interface ExportHeader { heading: string; date: string; place: string; }
export interface ExportOptions extends ExportHeader { mode: UserMode; }

export function formatReportDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Seleccione una fecha válida.');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Seleccione una fecha válida.');
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}
const C = {
  ink: 'FF323653', muted: 'FF666976', line: 'FFB6B8C0', white: 'FFFFFFFF',
  blue: 'FF8FADC5', yellow: 'FFFAD02C', gray: 'FFE9EAEC',
  balance: 'FFE9EAEC', alternate: 'FFF7F8F9', total: 'FF323653',
};
const MONEY = '#,##0.00;[Red](#,##0.00);"–"';
const fill = (color: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });
const line: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: C.line } };
const col = (ws: ExcelJS.Worksheet, key: string) => ws.getColumn(key).letter;
const ref = (ws: ExcelJS.Worksheet, key: string, row: number) => `${col(ws, key)}${row}`;

function paint(ws: ExcelJS.Worksheet, row: number, from: number, to: number, color: string, bold = false) {
  for (let c = from; c <= to; c++) {
    const cell = ws.getCell(row, c);
    cell.fill = fill(color);
    cell.font = { name: 'Calibri', size: 11, bold, color: { argb: color === C.total ? C.white : C.ink } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { top: line, bottom: line, left: line, right: line };
  }
}

function merged(ws: ExcelJS.Worksheet, row: number, from: number, to: number, text: string, color: string) {
  if (from !== to) ws.mergeCells(row, from, row, to);
  paint(ws, row, from, to, color, true);
  ws.getCell(row, from).value = text;
  ws.getCell(row, from).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

function sheet(workbook: ExcelJS.Workbook, name: string, widths: { key: string; width: number }[], heading: string, context: string) {
  const ws = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 6, xSplit: 0, showGridLines: false, zoomScale: 85 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      horizontalCentered: true, margins: { left: .3, right: .3, top: .4, bottom: .4, header: .15, footer: .15 } },
  });
  ws.columns = widths;
  ws.mergeCells(1, 1, 1, widths.length);
  const title = ws.getCell('A1');
  title.value = heading;
  title.font = { name: 'Cambria', size: 21, bold: true, color: { argb: C.ink } };
  title.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(1).height = heading.length > 75 ? 64 : 38;
  ws.mergeCells(2, 1, 2, widths.length);
  ws.getCell('A2').value = name.toUpperCase();
  ws.getCell('A2').font = { name: 'Calibri', size: 12, bold: true, color: { argb: C.ink } };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 24;
  ws.mergeCells(3, 1, 3, widths.length);
  ws.getCell('A3').value = context;
  ws.getCell('A3').font = { name: 'Calibri', size: 10, color: { argb: C.muted } };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(3).height = context.length > 100 ? 34 : 22;
  ws.mergeCells(4, 1, 4, widths.length);
  ws.getCell('A4').value = 'Cifras expresadas en quetzales';
  ws.getCell('A4').font = { name: 'Calibri', size: 10, color: { argb: C.muted } };
  ws.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(4).height = 24;
  ws.getRow(5).height = 24;
  ws.getRow(6).height = 28;
  ws.pageSetup.printTitlesRow = '1:6';
  ws.headerFooter.oddFooter = '&LDeterminist&R Página &P de &N';
  return ws;
}

function amount(ws: ExcelJS.Worksheet, row: number, key: string, value: ExcelJS.CellValue, color?: string) {
  const cell = ws.getRow(row).getCell(key);
  cell.value = value;
  cell.numFmt = MONEY;
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  if (color) cell.fill = fill(color);
}

function sum(ws: ExcelJS.Worksheet, key: string, start: number, end: number, result: number): ExcelJS.CellValue {
  return end < start ? 0 : { formula: `SUM(${ref(ws, key, start)}:${ref(ws, key, end)})`, result };
}

/** Builds both reports from the same ordered account set. Codes are exclusive to banking. */
export function buildLedgerWorkbook(data: Record<string, AccountLedger>, options: ExportOptions): ExcelJS.Workbook {
  const heading = options.heading.trim();
  if (!heading) throw new Error('Ingrese el encabezado del documento.');
  if (!options.place?.trim()) throw new Error('Ingrese el país o lugar.');
  const context = `${options.place.trim()}, ${formatReportDate(options.date)}`;
  const banking = options.mode === 'Bancaria';
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Determinist';
  workbook.title = heading;
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const accounts = Object.values(data).filter(a => a.entries.some(e => e.debit !== 0 || e.credit !== 0)
    && !isGlosa(a.accountCode) && !isGlosa(a.accountName)).sort((a, b) => a.firstLine - b.firstLine);
  const codeColumn = banking ? [{ key: 'code', width: 18 }] : [];
  const mayor = sheet(workbook, 'Libro Mayor', [...codeColumn,
    { key: 'date', width: 14 }, { key: 'entry', width: 15 }, { key: 'description', width: 58 },
    { key: 'debit', width: 20 }, { key: 'credit', width: 20 }, { key: 'balance', width: 22 }], heading, context);
  const balance = sheet(workbook, 'Balance de Comprobación', [
    { key: 'no', width: 6 }, ...codeColumn, { key: 'name', width: 52 },
    { key: 'debit', width: 21 }, { key: 'credit', width: 21 },
    { key: 'debtor', width: 21 }, { key: 'creditor', width: 21 }], heading, context);
  const detailsEnd = mayor.getColumn('description').number;
  const totalColumns = mayor.columnCount;
  merged(mayor, 5, 1, detailsEnd, 'DETALLE DEL MOVIMIENTO', C.blue);
  merged(mayor, 5, detailsEnd + 1, detailsEnd + 2, 'MOVIMIENTOS', C.yellow);
  merged(mayor, 5, totalColumns, totalColumns, 'SALDO', C.gray);
  const mayorHeaders = [...(banking ? ['Código'] : []), 'Fecha', 'Ref. asiento', 'Descripción / concepto', 'Debe', 'Haber', 'Acumulado'];
  mayorHeaders.forEach((text, i) => {
    paint(mayor, 6, i + 1, i + 1, i < detailsEnd ? C.blue : i < totalColumns - 1 ? C.yellow : C.gray, true);
    mayor.getCell(6, i + 1).value = text;
    mayor.getCell(6, i + 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  const nameEnd = balance.getColumn('name').number;
  merged(balance, 5, 1, nameEnd, 'CUENTAS', C.blue);
  merged(balance, 5, nameEnd + 1, nameEnd + 2, 'SUMAS', C.yellow);
  merged(balance, 5, nameEnd + 3, nameEnd + 4, 'SALDOS', C.gray);
  const balanceHeaders = ['N.º', ...(banking ? ['Código'] : []), 'Cuenta', 'Debe', 'Haber', 'Deudor', 'Acreedor'];
  balanceHeaders.forEach((text, i) => {
    paint(balance, 6, i + 1, i + 1, i < nameEnd ? C.blue : i < nameEnd + 2 ? C.yellow : C.gray, true);
    balance.getCell(6, i + 1).value = text;
    balance.getCell(6, i + 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  const movementRows = new Map<string, { row: number; debit: number; credit: number }[]>();
  let row = 7;
  let totalDebit = 0, totalCredit = 0, totalDebtor = 0, totalCreditor = 0;
  accounts.forEach((account, index) => {
    merged(mayor, row, banking ? 2 : 1, totalColumns, account.accountName, C.blue);
    mayor.getCell(row, banking ? 2 : 1).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    if (banking) { paint(mayor, row, 1, 1, C.blue, true); mayor.getCell(row, 1).value = account.accountCode; mayor.getCell(row, 1).numFmt = '@'; mayor.getCell(row, 1).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }; }
    mayor.getRow(row).height = Math.max(25, Math.ceil(account.accountName.length / 95) * 17);
    row++;
    const first = row;
    let debit = 0, credit = 0, running = 0;
    const references: { row: number; debit: number; credit: number }[] = [];
    movementRows.set(account.accountCode, references);
    account.entries.forEach((entry, entryIndex) => {
      references.push({ row, debit: entry.debit, credit: entry.credit });
      paint(mayor, row, 1, totalColumns, entryIndex % 2 ? C.alternate : C.white);
      mayor.getRow(row).height = Math.max(22, Math.ceil(entry.description.length / 55) * 15 + 7);
      // Keep internal reassignment adjustments out of the printed detail, but include them in all totals.
      mayor.getRow(row).hidden = !!entry.isHidden;
      const dateCell = mayor.getRow(row).getCell('date');
      const iso = entry.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const local = entry.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      const parts = iso ? [+iso[1], +iso[2], +iso[3]] : local ? [+local[3], +local[2], +local[1]] : null;
      const date = parts ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])) : null;
      dateCell.value = date && date.getUTCFullYear() === parts![0] && date.getUTCMonth() === parts![1] - 1 && date.getUTCDate() === parts![2] ? date : entry.date;
      dateCell.numFmt = 'dd/mm/yyyy';
      mayor.getRow(row).getCell('entry').value = entry.entryId;
      mayor.getRow(row).getCell('description').value = entry.description;
      debit += entry.debit; credit += entry.credit; running += entry.debit - entry.credit;
      amount(mayor, row, 'debit', entry.debit);
      amount(mayor, row, 'credit', entry.credit);
      amount(mayor, row, 'balance', { formula: `${row === first ? '' : ref(mayor, 'balance', row - 1) + '+'}${ref(mayor, 'debit', row)}-${ref(mayor, 'credit', row)}`, result: running }, C.balance);
      row++;
    });
    const subtotal = row;
    merged(mayor, row, 1, detailsEnd, 'Total cuenta', C.gray);
    paint(mayor, row, detailsEnd + 1, totalColumns, C.gray, true);
    amount(mayor, row, 'debit', sum(mayor, 'debit', first, row - 1, debit));
    amount(mayor, row, 'credit', sum(mayor, 'credit', first, row - 1, credit));
    amount(mayor, row, 'balance', { formula: `${ref(mayor, 'debit', row)}-${ref(mayor, 'credit', row)}`, result: running });
    mayor.getRow(row).height = 25;
    mayor.getRow(++row).height = 9;
    row++;
    const bRow = index + 7;
    paint(balance, bRow, 1, balance.columnCount, index % 2 ? C.alternate : C.white);
    balance.getRow(bRow).height = Math.max(24, Math.ceil(account.accountName.length / 48) * 15 + 7);
    balance.getRow(bRow).getCell('no').value = index + 1;
    if (banking) { const code = balance.getRow(bRow).getCell('code'); code.value = account.accountCode; code.numFmt = '@'; code.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }; }
    balance.getRow(bRow).getCell('name').value = account.accountName;
    amount(balance, bRow, 'debit', { formula: `'Libro Mayor'!${ref(mayor, 'debit', subtotal)}`, result: debit });
    amount(balance, bRow, 'credit', { formula: `'Libro Mayor'!${ref(mayor, 'credit', subtotal)}`, result: credit });
    const debtor = Math.max(running, 0), creditor = Math.max(-running, 0);
    amount(balance, bRow, 'debtor', { formula: `MAX(${ref(balance, 'debit', bRow)}-${ref(balance, 'credit', bRow)},0)`, result: debtor }, C.balance);
    amount(balance, bRow, 'creditor', { formula: `MAX(${ref(balance, 'credit', bRow)}-${ref(balance, 'debit', bRow)},0)`, result: creditor }, C.balance);
    totalDebit += debit; totalCredit += credit; totalDebtor += debtor; totalCreditor += creditor;
  });
  const bTotal = accounts.length + 7;
  merged(balance, bTotal, 1, nameEnd, 'TOTALES GENERALES', C.total);
  paint(balance, bTotal, nameEnd + 1, balance.columnCount, C.total, true);
  const totals = { debit: totalDebit, credit: totalCredit, debtor: totalDebtor, creditor: totalCreditor };
  Object.entries(totals).forEach(([key, value]) => amount(balance, bTotal, key, sum(balance, key, 7, bTotal - 1, value)));
  balance.getRow(bTotal).height = 29;
  merged(mayor, row, 1, detailsEnd, 'TOTALES GENERALES', C.total);
  paint(mayor, row, detailsEnd + 1, totalColumns, C.total, true);
  ['debit', 'credit'].forEach(key => amount(mayor, row, key, { formula: `'Balance de Comprobación'!${ref(balance, key, bTotal)}`, result: totals[key as 'debit' | 'credit'] }));
  amount(mayor, row, 'balance', { formula: `${ref(mayor, 'debit', row)}-${ref(mayor, 'credit', row)}`, result: totalDebit - totalCredit });
  mayor.getRow(row).height = 29;
  [mayor, balance].forEach(ws => { ws.pageSetup.printArea = `A1:${ws.getColumn(ws.columnCount).letter}${ws.rowCount}`; });
  buildTAccountsSheet(workbook, accounts, movementRows, mayor, options, context);
  return workbook;
}


function buildTAccountsSheet(
  workbook: ExcelJS.Workbook, accounts: AccountLedger[],
  movementRows: Map<string, { row: number; debit: number; credit: number }[]>,
  mayor: ExcelJS.Worksheet, options: ExportOptions, context: string
) {
  // Four equal two-column T accounts; a blank column separates each account.
  const widths = Array.from({ length: 11 }, (_, i) => ({ key: `t${i}`, width: i % 3 === 2 ? 3 : 21 }));
  const ws = sheet(workbook, 'T gráficas', widths, options.heading.trim(), context);
  ws.pageSetup.paperSize = 8 as ExcelJS.PageSetup['paperSize']; // A3 landscape keeps four accounts legible when printed.
  ws.pageSetup.printTitlesRow = '1:4';
  ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 0, showGridLines: false, zoomScale: 75 }];
  ws.getRow(5).height = 10;
  let top = 6;
  for (let index = 0; index < accounts.length; index += 4) {
    const group = accounts.slice(index, index + 4).map(account => {
      const entries = movementRows.get(account.accountCode) || [];
      return { account, debit: entries.filter(e => e.debit !== 0), credit: entries.filter(e => e.credit !== 0) };
    });
    const count = Math.max(4, ...group.flatMap(item => [item.debit.length, item.credit.length]));
    const totalRow = top + 2 + count;
    const titleLength = Math.max(...group.map(({ account }) => account.accountName.length + (options.mode === 'Bancaria' ? account.accountCode.length + 3 : 0)));
    ws.getRow(top).height = Math.max(32, Math.ceil(titleLength / 38) * 16 + 10);
    ws.getRow(top + 1).height = 23;
    for (let row = top + 2; row < totalRow; row++) ws.getRow(row).height = 21;
    ws.getRow(totalRow).height = 26;
    ws.getRow(totalRow + 1).height = 22;
    ws.getRow(totalRow + 2).height = 26;
    ws.getRow(totalRow + 3).height = 17;
    group.forEach(({ account, debit, credit }, offset) => {
      const left = offset * 3 + 1, right = left + 1;
      const name = options.mode === 'Bancaria' ? `${account.accountCode} · ${account.accountName}` : account.accountName;
      merged(ws, top, left, right, name, C.yellow);
      for (const [column, key, entries] of [[left, 'debit', debit], [right, 'credit', credit]] as const) {
        const letter = ws.getColumn(column).letter;
        paint(ws, top + 1, column, column, C.gray, true);
        ws.getCell(top + 1, column).value = key === 'debit' ? 'Debe' : 'Haber';
        ws.getCell(top + 1, column).alignment = { horizontal: 'center', vertical: 'middle' };
        for (let i = 0; i < count; i++) {
          const row = top + 2 + i, cell = ws.getCell(row, column);
          cell.font = { name: 'Calibri', size: 11, color: { argb: C.ink } };
          cell.fill = fill(C.white);
          cell.numFmt = MONEY;
          cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
          cell.border = { ...(column === right ? { left: { style: 'medium' as const, color: { argb: C.ink } } } : {}), ...(i === 0 ? { top: line } : {}) };
          if (entries[i]) cell.value = { formula: `'Libro Mayor'!${ref(mayor, key, entries[i].row)}`, result: entries[i][key] };
        }
        paint(ws, totalRow, column, column, C.gray, true);
        const total = ws.getCell(totalRow, column);
        total.value = { formula: `SUM(${letter}${top + 2}:${letter}${totalRow - 1})`, result: entries.reduce((sum, e) => sum + e[key], 0) };
        total.numFmt = MONEY;
        total.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
        total.border = { top: line, bottom: { style: 'double', color: { argb: C.ink } } };
      }
      const net = debit.reduce((sum, e) => sum + e.debit, 0) - credit.reduce((sum, e) => sum + e.credit, 0);
      const d = ws.getCell(totalRow, left).address, c = ws.getCell(totalRow, right).address;
      for (const column of [left, right]) {
        paint(ws, totalRow + 1, column, column, C.blue, true);
        ws.getCell(totalRow + 1, column).value = column === left ? 'Saldo deudor' : 'Saldo acreedor';
        ws.getCell(totalRow + 1, column).alignment = { horizontal: 'center', vertical: 'middle' };
        paint(ws, totalRow + 2, column, column, C.balance, true);
        const cell = ws.getCell(totalRow + 2, column);
        cell.value = { formula: column === left ? `MAX(${d}-${c},0)` : `MAX(${c}-${d},0)`, result: Math.max(column === left ? net : -net, 0) };
        cell.numFmt = MONEY;
        cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
      }
    });
    top = totalRow + 4;
  }
  ws.pageSetup.printArea = `A1:K${Math.max(4, top - 2)}`;
}
