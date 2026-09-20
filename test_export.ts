import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildLedgerWorkbook } from './src/utils/ledgerWorkbook';
import { AccountLedger, UserMode } from './src/types';

const make = (code: string, name: string, movements: [number, number, boolean?][], order: number): AccountLedger => {
  let running = 0;
  const entries = movements.map(([debit, credit, isHidden], i) => ({ id: `${code}-${i}`, date: '2026-09-19', accountCode: code, accountName: name, debit, credit,
    description: i === 0 ? 'Movimiento de prueba para verificar la presentación del documento y la separación de las columnas.' : 'Ajuste por reasignación',
    entryId: String(i + 1), originalLine: i, runningBalance: running += debit - credit, isHidden }));
  return { accountCode: code, accountName: name, entries, firstLine: order, finalBalance: running,
    totalDebit: entries.reduce((s,e) => s+e.debit,0), totalCredit: entries.reduce((s,e) => s+e.credit,0) };
};
const data = {
  caja: make('00101', 'Caja', [[1000,0],[0,200,true]], 1),
  bancos: make('00102', 'Bancos', [[200,0]], 2),
  capital: make('00301', 'Capital social', [[0,1000]], 3),
  compensada: make('00401', 'Clientes', [[150,150]], 4),
};
for (const mode of ['Practica', 'Bancaria'] as UserMode[]) {
  const wb = buildLedgerWorkbook(data, { heading: 'Comercial del Valle', mode, date: '2026-09-19', place: 'Ciudad de Guatemala' });
  const decoded = new ExcelJS.Workbook();
  await decoded.xlsx.load(await wb.xlsx.writeBuffer());
  const mayor = decoded.getWorksheet('Libro Mayor')!;
  const balance = decoded.getWorksheet('Balance de Comprobación')!;
  for (const ws of [mayor, balance]) {
    assert.equal(ws.getCell('A1').value, 'Comercial del Valle');
    assert.equal(ws.getCell('A1').isMerged, true);
    assert.equal(ws.getCell('A3').value, 'Ciudad de Guatemala, 19 de septiembre de 2026');
    assert.equal(ws.getCell('A3').isMerged, true);
    assert.equal(ws.getCell('A1').font.name, 'Cambria');
    assert.equal((ws.getRow(6).values as ExcelJS.CellValue[]).includes('Código'), mode === 'Bancaria');
    assert.equal(ws.views[0].showGridLines, false);
    assert.equal(ws.pageSetup.fitToWidth, 1);
  }
  const debitCol = mode === 'Bancaria' ? 4 : 3;
  const get = (r: number, c: number) => balance.getCell(r,c).result;
  assert.equal(get(7,debitCol),1000);
  assert.equal(get(7,debitCol+1),200);
  assert.equal(get(7,debitCol+2),800);
  assert.equal(get(9,debitCol+3),1000);
  assert.equal(get(10,debitCol+2),0);
  assert.equal(get(11,debitCol),1350);
  assert.equal(get(11,debitCol+1),1350);
  assert.equal(get(11,debitCol+2),1000);
  assert.equal(get(11,debitCol+3),1000);
  assert.equal(mayor.getRow(9).hidden,true);
  assert.ok(mayor.getCell(8,mode === 'Bancaria' ? 2 : 1).value instanceof Date);
  if (mode === 'Bancaria') assert.equal(balance.getCell('B7').value,'00101');
  else assert.ok(!JSON.stringify(decoded.model).includes('00101'));
  if (process.env.EXPORT_TEST_DIR) await wb.xlsx.writeFile(`${process.env.EXPORT_TEST_DIR}/export-${mode}.xlsx`);
}
assert.throws(() => buildLedgerWorkbook(data, { heading: '   ', mode: 'Practica', date: '2026-09-19', place: 'Ciudad de Guatemala' }));
const empty = buildLedgerWorkbook({}, { heading: 'Sin movimientos', mode: 'Practica', date: '2026-09-19', place: 'Ciudad de Guatemala' });
assert.equal(empty.getWorksheet('Balance de Comprobación')!.getCell('C7').value,0);
console.log('Exportación verificada: ambos regímenes, títulos, códigos, ajustes ocultos, saldos, totales, fechas y archivo guardado.');

assert.throws(() => buildLedgerWorkbook(data, { heading: 'Empresa', mode: 'Practica', date: '2026-02-30', place: 'Guatemala' }));
assert.throws(() => buildLedgerWorkbook(data, { heading: 'Empresa', mode: 'Practica', date: '', place: 'Guatemala' }));
assert.throws(() => buildLedgerWorkbook(data, { heading: 'Empresa', mode: 'Practica', date: '2026-09-19', place: '  ' }));

const five = { ...data, adicional: make('00501', 'Proveedores', [[0,250]], 5) };
const twb = buildLedgerWorkbook(five, { heading: 'Prueba de distribución', date: '2026-09-20', place: 'Guatemala', mode: 'Bancaria' });
const ts = twb.getWorksheet('T gráficas')!;
assert.equal(ts.getCell('A6').value, '00101 · Caja');
assert.equal(ts.getCell('D6').value, '00102 · Bancos');
assert.equal(ts.getCell('G6').value, '00301 · Capital social');
assert.equal(ts.getCell('J6').value, '00401 · Clientes');
assert.equal(ts.getCell('A16').value, '00501 · Proveedores');
assert.equal(ts.getCell('A12').result, 1000);
assert.equal(ts.getCell('B12').result, 200);
assert.equal(ts.getCell('A14').result, 800);
assert.equal(ts.getCell('B24').result, 250);
if (process.env.EXPORT_TEST_DIR) await twb.xlsx.writeFile(`${process.env.EXPORT_TEST_DIR}/t-grid.xlsx`);
console.log('T gráficas: cuatro columnas, quinta cuenta en la siguiente fila y saldos verificados.');
