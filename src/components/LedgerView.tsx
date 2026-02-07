import React, { useMemo, useState, useEffect } from 'react';
import { AccountLedger } from '../types';
import { CURRENCY_FORMAT } from '../utils/constants';
import { Search, Filter, Download, ArrowRightCircle, X, Table, LayoutList } from 'lucide-react';
import * as XLSX from 'xlsx';
import RecapitulationView from './RecapitulationView';

interface LedgerViewProps {
  ledgerData: Record<string, AccountLedger>;
  fileName: string;
  onUpdateEntry: (accountCode: string, entryId: string, field: 'debit' | 'credit', newValue: number) => void;
}

const EditableCell: React.FC<{
  value: number;
  onSave: (newValue: number) => void;
  currencyFormat: Intl.NumberFormat;
}> = ({ value, onSave, currencyFormat }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());

  useEffect(() => {
    setTempValue(value.toString());
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      const parsed = parseFloat(tempValue);
      if (!isNaN(parsed)) {
        onSave(parsed);
      } else {
        setTempValue(value.toString()); // Revert if invalid
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempValue(value.toString());
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(tempValue);
    if (!isNaN(parsed)) {
      onSave(parsed);
    } else {
      setTempValue(value.toString());
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.01"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="w-full text-right font-mono text-xs bg-white dark:bg-obsidian border border-denim outline-none p-1 rounded-sm"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className="cursor-pointer hover:bg-denim/10 transition-colors rounded-sm px-1 -mx-1 py-0.5"
      title="Click to edit"
    >
      {value > 0 ? currencyFormat.format(value) : '-'}
    </div>
  );
};

const LedgerView: React.FC<LedgerViewProps> = ({ ledgerData, fileName, onUpdateEntry }) => {
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('');
  const [filterText, setFilterText] = useState('');
  const [sortMode, setSortMode] = useState<'ALPHA' | 'BOOK'>('BOOK');
  const [viewMode, setViewMode] = useState<'DETAIL' | 'RECAP'>('DETAIL');

  // Get list of accounts for sidebar/dropdown
  const accounts = useMemo(() => {
    const list = Object.values(ledgerData) as AccountLedger[];

    if (sortMode === 'ALPHA') {
      return list.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    } else {
      // Book Order (Appearance)
      return list.sort((a, b) => (a.firstLine || 0) - (b.firstLine || 0));
    }
  }, [ledgerData, sortMode]);

  // Set default account on load
  React.useEffect(() => {
    if (accounts.length > 0 && !selectedAccountCode) {
      setSelectedAccountCode(accounts[0].accountCode);
    }
  }, [accounts, selectedAccountCode]);

  const currentAccount = ledgerData[selectedAccountCode];

  // Filter accounts list
  const filteredAccounts = accounts.filter(acc =>
    acc.accountCode.toLowerCase().includes(filterText.toLowerCase()) ||
    acc.accountName.toLowerCase().includes(filterText.toLowerCase())
  );

  const exportToExcel = () => {
    if (!currentAccount) return;

    const wsData = currentAccount.entries.map(e => ({
      'Fecha': e.date,
      'ID Asiento': e.entryId,
      'Glosa': e.description,
      'Debe': e.debit,
      'Haber': e.credit,
      'Saldo': e.runningBalance
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mayor");
    XLSX.writeFile(wb, `Mayor_${currentAccount.accountCode}.xlsx`);
  };

  if (!currentAccount && accounts.length === 0) {
    return <div className="p-8 text-center text-obsidian/40 dark:text-seashell/40 font-medium">No se encontraron cuentas procesables.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-obsidian rounded-sm border border-obsidian/10 dark:border-white/10 shadow-sm overflow-hidden md:flex-row">

      {/* Sidebar: Account Selection */}
      <div className="w-full md:w-80 bg-seashell dark:bg-[#222222] border-b md:border-b-0 md:border-r border-obsidian/10 dark:border-white/10 flex flex-col h-[300px] md:h-full shrink-0">
        <div className="p-3 border-b border-obsidian/10 dark:border-white/10 bg-obsidian/5 dark:bg-white/5 shrink-0 z-10 sticky top-0 flex flex-col gap-2">

          {/* SORT TOGGLE */}
          <div className="flex bg-white dark:bg-obsidian rounded border border-obsidian/10 dark:border-white/10 p-0.5 mb-1">
            <button
              onClick={() => setSortMode('BOOK')}
              className={`flex-1 text-[10px] uppercase font-bold py-1.5 rounded-sm transition-colors ${sortMode === 'BOOK' ? 'bg-denim text-white shadow-sm' : 'text-obsidian/50 dark:text-seashell/50 hover:bg-obsidian/5 dark:hover:bg-white/5'}`}
            >
              Por Diario
            </button>
            <button
              onClick={() => setSortMode('ALPHA')}
              className={`flex-1 text-[10px] uppercase font-bold py-1.5 rounded-sm transition-colors ${sortMode === 'ALPHA' ? 'bg-denim text-white shadow-sm' : 'text-obsidian/50 dark:text-seashell/50 hover:bg-obsidian/5 dark:hover:bg-white/5'}`}
            >
              Alfabético
            </button>
          </div>

          {/* VIEW MODE TOGGLE */}
          <div className="flex bg-white dark:bg-obsidian rounded border border-obsidian/10 dark:border-white/10 p-0.5 mb-1">
            <button
              onClick={() => setViewMode('DETAIL')}
              className={`flex-1 flex items-center justify-center gap-1 text-[10px] uppercase font-bold py-1.5 rounded-sm transition-colors ${viewMode === 'DETAIL' ? 'bg-denim text-white shadow-sm' : 'text-obsidian/50 dark:text-seashell/50 hover:bg-obsidian/5 dark:hover:bg-white/5'}`}
            >
              <LayoutList className="w-3 h-3" />
              Detalle
            </button>
            <button
              onClick={() => setViewMode('RECAP')}
              className={`flex-1 flex items-center justify-center gap-1 text-[10px] uppercase font-bold py-1.5 rounded-sm transition-colors ${viewMode === 'RECAP' ? 'bg-denim text-white shadow-sm' : 'text-obsidian/50 dark:text-seashell/50 hover:bg-obsidian/5 dark:hover:bg-white/5'}`}
            >
              <Table className="w-3 h-3" />
              Resumen
            </button>
          </div>

          <div className="relative w-full flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-obsidian/40 dark:text-seashell/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar cuenta..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 rounded-md text-sm focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim text-obsidian dark:text-seashell transition-all shadow-sm placeholder:text-obsidian/30 dark:placeholder:text-seashell/30 truncate"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2.5 p-0.5 text-obsidian/40 hover:text-denim dark:text-seashell/40 dark:hover:text-denim transition-colors rounded-full hover:bg-obsidian/5 dark:hover:bg-white/10"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredAccounts.map((acc) => (
            <button
              key={acc.accountCode}
              onClick={() => setSelectedAccountCode(acc.accountCode)}
              className={`w-full text-left px-4 py-2.5 border-b border-obsidian/5 dark:border-white/5 hover:bg-white dark:hover:bg-white/5 transition-all flex justify-between items-center group
                ${selectedAccountCode === acc.accountCode ? 'bg-white dark:bg-obsidian border-l-[3px] border-l-denim shadow-sm' : 'border-l-[3px] border-l-transparent'}
              `}
            >
              <div className="overflow-hidden">
                <div className={`font-mono text-[10px] uppercase tracking-wider ${selectedAccountCode === acc.accountCode ? 'text-denim font-bold' : 'text-obsidian/50 dark:text-seashell/50'}`}>
                  {acc.accountCode}
                </div>
                <div className={`text-xs truncate ${selectedAccountCode === acc.accountCode ? 'text-obsidian dark:text-seashell font-bold' : 'text-obsidian/80 dark:text-seashell/80 font-medium'}`}>
                  {acc.accountName}
                </div>
              </div>
              <div className={`text-[10px] font-mono font-bold ${acc.finalBalance < 0 ? 'text-red-600' : 'text-obsidian/60 dark:text-seashell/60'}`}>
                {CURRENCY_FORMAT.format(acc.finalBalance)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Ledger Table or Recapitulation */}
      <div className="flex-1 flex flex-col h-[500px] md:h-full overflow-hidden bg-white dark:bg-obsidian">

        {viewMode === 'RECAP' ? (
          <RecapitulationView ledgerData={ledgerData} />
        ) : (
          <>
            {/* Header */}
            {currentAccount && (
              <div className="px-6 py-4 border-b border-obsidian/10 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-obsidian shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-denim uppercase tracking-widest border border-denim/20 px-1 rounded-sm">
                      Cuenta Mayor
                    </span>
                    <span className="text-[10px] text-obsidian/40 dark:text-seashell/40 font-mono font-bold">
                      #{currentAccount.accountCode}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-obsidian dark:text-seashell uppercase tracking-tight">{currentAccount.accountName}</h2>
                </div>

                <div className="flex items-center gap-6 bg-seashell dark:bg-white/5 px-4 py-2 rounded-sm border border-obsidian/5 dark:border-white/5">
                  <div className="text-right">
                    <div className="text-[10px] text-obsidian/50 dark:text-seashell/50 uppercase font-bold tracking-wider">Saldo Acumulado</div>
                    <div className={`text-xl font-mono font-bold ${currentAccount.finalBalance < 0 ? 'text-red-600' : 'text-denim'}`}>
                      {CURRENCY_FORMAT.format(currentAccount.finalBalance)}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-obsidian/10 dark:bg-white/10"></div>
                  <button
                    onClick={exportToExcel}
                    className="text-obsidian/40 hover:text-denim dark:text-seashell/40 dark:hover:text-denim transition-colors"
                    title="Descargar Hoja de Cálculo"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Table Area */}
            <div className="flex-1 overflow-auto p-0 min-h-0">
              {currentAccount ? (
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full">
                    <thead className="bg-obsidian/5 dark:bg-white/5 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-obsidian/60 dark:text-seashell/60 uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10">Fecha</th>
                        <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-obsidian/60 dark:text-seashell/60 uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10">Ref. Asiento</th>
                        <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-obsidian/60 dark:text-seashell/60 uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 w-1/3">Concepto / Glosa</th>
                        <th scope="col" className="px-4 py-2 text-right text-[10px] font-bold text-denim uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10">Debe</th>
                        <th scope="col" className="px-4 py-2 text-right text-[10px] font-bold text-denim uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10">Haber</th>
                        <th scope="col" className="px-4 py-2 text-right text-[10px] font-bold text-obsidian dark:text-seashell uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 bg-obsidian/5 dark:bg-white/10">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-obsidian/5 dark:divide-white/5">
                      {currentAccount.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-denim/5 dark:hover:bg-white/5 transition-colors group text-xs">
                          <td className="px-4 py-2 whitespace-nowrap text-obsidian/70 dark:text-seashell/70 font-mono">
                            {entry.date}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-obsidian/50 dark:text-seashell/50 font-mono">
                            {entry.entryId}
                          </td>
                          <td className="px-4 py-2 text-obsidian/80 dark:text-seashell/80 font-medium truncate max-w-xs" title={entry.description}>
                            {entry.description}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-obsidian/70 dark:text-seashell/70">
                            <EditableCell
                              value={entry.debit}
                              currencyFormat={CURRENCY_FORMAT}
                              onSave={(val) => onUpdateEntry(currentAccount.accountCode, entry.id, 'debit', val)}
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-obsidian/70 dark:text-seashell/70">
                            <EditableCell
                              value={entry.credit}
                              currencyFormat={CURRENCY_FORMAT}
                              onSave={(val) => onUpdateEntry(currentAccount.accountCode, entry.id, 'credit', val)}
                            />
                          </td>
                          <td className={`px-4 py-2 text-right font-mono font-bold border-l border-obsidian/5 dark:border-white/5 ${entry.runningBalance < 0 ? 'text-red-600 bg-red-50 dark:bg-red-900/10' : 'text-obsidian dark:text-seashell bg-obsidian/5 dark:bg-white/5'}`}>
                            {CURRENCY_FORMAT.format(entry.runningBalance)}
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="bg-seashell dark:bg-white/5 font-bold border-t-2 border-denim">
                        <td colSpan={3} className="px-4 py-3 text-right text-obsidian/40 dark:text-seashell/40 uppercase text-[10px] tracking-widest">Totales del Periodo</td>
                        <td className="px-4 py-3 text-right font-mono text-denim text-xs">
                          {CURRENCY_FORMAT.format(currentAccount.entries.reduce((sum, e) => sum + e.debit, 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-denim text-xs">
                          {CURRENCY_FORMAT.format(currentAccount.entries.reduce((sum, e) => sum + e.credit, 0))}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-xs border-l border-obsidian/5 dark:border-white/5 bg-obsidian/10 dark:bg-white/10 ${currentAccount.finalBalance < 0 ? 'text-red-600' : 'text-obsidian dark:text-seashell'}`}>
                          {CURRENCY_FORMAT.format(currentAccount.finalBalance)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-obsidian/30 dark:text-seashell/30">
                  <ArrowRightCircle className="w-10 h-10 mb-3 opacity-30" strokeWidth={1} />
                  <p className="text-sm font-medium">Seleccione una cuenta del listado.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>

  );
};

export default LedgerView;