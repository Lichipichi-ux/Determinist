import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { AccountLedger, UserMode } from '../types';
import { CURRENCY_FORMAT } from '../utils/constants';

interface Props { ledgerData: Record<string, AccountLedger>; mode: UserMode; onClose: () => void; }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function getTAccount(account: AccountLedger) {
  const visible = account.entries.filter(entry => !entry.isHidden);
  const items = (side: 'debit' | 'credit') => visible.filter(entry => entry[side] !== 0).map(entry => ({ id: entry.id, amount: entry[side], reference: entry.entryId, description: entry.description }));
  const debit = items('debit'), credit = items('credit');
  const hidden = account.entries.filter(entry => entry.isHidden);
  for (const [side, list] of [['debit', debit], ['credit', credit]] as const) {
    const adjustment = hidden.reduce((sum, entry) => sum + entry[side], 0);
    if (adjustment !== 0) list.push({ id: `adjustment-${side}`, amount: adjustment, reference: 'Ajuste', description: 'Ajustes por reasignación' });
  }
  const totalDebit = account.entries.reduce((sum, entry) => sum + entry.debit, 0);
  const totalCredit = account.entries.reduce((sum, entry) => sum + entry.credit, 0);
  return { debit, credit, totalDebit, totalCredit, balance: totalDebit - totalCredit };
}

export default function TAccountsViewer({ ledgerData, mode, onClose }: Props) {
  const [query, setQuery] = useState('');
  const accounts = useMemo(() => Object.values(ledgerData).sort((a, b) => a.firstLine - b.firstLine).map(account => ({ account, t: getTAccount(account) })), [ledgerData]);
  const filtered = useMemo(() => {
    const search = normalize(query.trim());
    return accounts.filter(({ account }) => normalize(account.accountName).includes(search) || (mode === 'Bancaria' && normalize(account.accountCode).includes(search)));
  }, [accounts, query, mode]);
  return <section className="sap-t-viewer sap-t-inline" aria-labelledby="t-viewer-title">
    <div className="sap-t-shell">
      <div className="sap-t-title"><h2 id="t-viewer-title">T gráficas</h2><button type="button" onClick={onClose} aria-label="Cerrar visor de T gráficas"><X size={17} /></button></div>
      <div className="sap-t-toolbar">
        <label className="sap-t-search"><Search size={15} aria-hidden="true" /><input autoFocus type="search" aria-label="Buscar T gráfica" placeholder={mode === 'Bancaria' ? 'Buscar cuenta o código…' : 'Buscar cuenta…'} value={query} onChange={event => setQuery(event.target.value)} /></label>
        <span role="status">{filtered.length} de {accounts.length} cuentas</span>
      </div>
      <div className="sap-t-scroll">
        {filtered.length === 0 ? <div className="sap-t-empty">No se encontraron cuentas.<button type="button" onClick={() => setQuery('')}>Limpiar búsqueda</button></div> : <div className="sap-t-grid">
          {filtered.map(({ account, t }) => <section className="sap-t-card" key={account.accountCode} aria-label={`Cuenta T: ${account.accountName}`}>
            <h3>{mode === 'Bancaria' && <span className="sap-t-code">{account.accountCode}</span>}{account.accountName}</h3>
            <div className="sap-t-columns">
              {(['debit', 'credit'] as const).map(side => <div className="sap-t-side" key={side}>
                <div className="sap-t-side-label">{side === 'debit' ? 'Debe' : 'Haber'}</div>
                <ol aria-label={`${side === 'debit' ? 'Debe' : 'Haber'} de ${account.accountName}`}>
                  {t[side].map((item, index) => <li key={`${item.id}-${index}`} title={`${item.reference} · ${item.description}`}><span className="sap-t-reference">{item.reference}</span><span>{CURRENCY_FORMAT.format(item.amount)}</span></li>)}
                  {!t[side].length && <li className="sap-t-zero">—</li>}
                </ol>
                <div className="sap-t-total" aria-label={`Total ${side === 'debit' ? 'debe' : 'haber'}`}>{CURRENCY_FORMAT.format(side === 'debit' ? t.totalDebit : t.totalCredit)}</div>
                <div className="sap-t-balance">{(side === 'debit' && t.balance > .005) || (side === 'credit' && t.balance < -.005) ? <><span>Saldo {side === 'debit' ? 'deudor' : 'acreedor'}</span><strong>{CURRENCY_FORMAT.format(Math.abs(t.balance))}</strong></> : Math.abs(t.balance) <= .005 && side === 'debit' ? <><span>Saldo cero</span><strong>{CURRENCY_FORMAT.format(0)}</strong></> : null}</div>
              </div>)}
            </div>
          </section>)}
        </div>}
      </div>
    </div>
  </section>;
}
