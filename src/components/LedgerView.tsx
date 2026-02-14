import React, { useMemo, useState, useEffect } from 'react';
import { AccountLedger } from '../types';
import { CURRENCY_FORMAT } from '../utils/constants';
import { Search, Filter, Download, ArrowRightCircle, X, Table, LayoutList, ChevronDown, Scissors, Trash2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import RecapitulationView from './RecapitulationView';
import SplitAccountModal from './SplitAccountModal';

interface LedgerViewProps {
  ledgerData: Record<string, AccountLedger>;
  fileName: string;
  onUpdateEntry: (accountCode: string, entryId: string, field: 'debit' | 'credit', newValue: number) => void;
  onSplitAccount: (originalAccountCode: string, newAccountName: string, amount: number) => void;
  onDeleteAccount: (accountCode: string) => void;
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

const AccountListItem = React.memo(({
  acc,
  isSelected,
  isExpanded,
  onSelect,
  toggleExpand,
  index
}: {
  acc: AccountLedger;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  toggleExpand: (e: React.MouseEvent) => void;
  index: number;
}) => {
  // Calculate Debe, Haber for the account
  const totalDebe = useMemo(() => acc.entries.reduce((sum, e) => sum + e.debit, 0), [acc.entries]);
  const totalHaber = useMemo(() => acc.entries.reduce((sum, e) => sum + e.credit, 0), [acc.entries]);

  return (
    <div className="md:border-b md:border-obsidian/5 md:dark:border-white/5 relative">
      {/* Cardinal Number (Tiny) - Positioning it absolutely in the top-left or integrated nicely */}
      <div className={`
         absolute top-2 left-2 z-10 text-[9px] font-mono leading-none pointer-events-none select-none
         ${isSelected ? 'text-denim/50' : 'text-obsidian/20 dark:text-seashell/20'}
       `}>
        {index + 1}
      </div>

      {/* Luxury Card (Mobile) / List Item (Desktop) */}
      <button
        onClick={onSelect}
        className={`
          w-full text-left transition-all duration-200 flex flex-col group relative
          
          /* Mobile: Luxury Card */
          md:rounded-none rounded-xl
          md:shadow-none shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]
          md:border-0 border border-obsidian/10 dark:border-white/10
          md:px-4 md:py-2.5 p-4 pt-5
          md:min-h-0 min-h-[72px]
          
          /* Hover & Active States - "Agile" feel */
          active:scale-[0.98]
          hover:scale-[1.01] md:hover:scale-100
          md:hover:bg-white md:dark:hover:bg-white/5
          hover:bg-gradient-to-r hover:from-white hover:to-seashell/20
          dark:hover:from-obsidian dark:hover:to-white/5
          
          /* Selection state */
          ${isSelected
            ? 'md:bg-white md:dark:bg-obsidian bg-gradient-to-r from-denim/5 to-denim/10 md:border-l-[3px] md:border-l-denim md:shadow-sm shadow-md border-denim/30 dark:border-denim/50'
            : 'md:bg-transparent bg-white dark:bg-obsidian/50 md:border-l-[3px] md:border-l-transparent'
          }
        `}
      >
        {/* Main Content Row */}
        <div className="flex justify-between items-start gap-3 pl-2"> {/* Added pl-2 to make space for the number if needed, or just let it float */}
          {/* Left: Code & Name */}
          <div className="flex-1 overflow-hidden">
            <div className={`
              font-mono text-[10px] uppercase tracking-wider mb-1
              ${isSelected ? 'text-denim font-bold' : 'text-obsidian/50 dark:text-seashell/50'}
            `}>
              {acc.accountCode}
            </div>
            <div className={`
              text-sm md:text-xs truncate leading-tight
              ${isSelected ? 'text-obsidian dark:text-seashell font-bold' : 'text-obsidian/80 dark:text-seashell/80 font-medium'}
            `}>
              {acc.accountName}
            </div>
          </div>

          {/* Right: Balance */}
          <div className="flex flex-col items-end gap-1">
            <div className={`
              text-sm md:text-[10px] font-mono font-bold whitespace-nowrap
              ${acc.finalBalance < 0 ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}
            `}>
              {CURRENCY_FORMAT.format(acc.finalBalance)}
            </div>

            {/* Expand indicator (mobile only) */}
            <div
              className="md:hidden p-1 -m-1"
              onClick={toggleExpand}
            >
              <ChevronDown
                className={`w-4 h-4 text-obsidian/30 dark:text-seashell/30 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>
        </div>

        {/* Expandable Details (Mobile Only) */}
        <div className={`
          md:hidden overflow-hidden transition-all duration-300 ease-in-out
          ${isExpanded ? 'max-h-32 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}
        `}>
          <div className="pt-3 border-t border-obsidian/10 dark:border-white/10 grid grid-cols-2 gap-3">
            {/* Debe */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-white/5 dark:to-white/10 rounded-lg p-3 border border-slate-200/50 dark:border-white/10">
              <div className="text-[9px] uppercase tracking-widest text-obsidian/40 dark:text-seashell/40 font-bold mb-1">
                Debe
              </div>
              <div className="text-sm font-mono font-bold text-obsidian dark:text-seashell">
                {CURRENCY_FORMAT.format(totalDebe)}
              </div>
            </div>

            {/* Haber */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-white/5 dark:to-white/10 rounded-lg p-3 border border-slate-200/50 dark:border-white/10">
              <div className="text-[9px] uppercase tracking-widest text-obsidian/40 dark:text-seashell/40 font-bold mb-1">
                Haber
              </div>
              <div className="text-sm font-mono font-bold text-obsidian dark:text-seashell">
                {CURRENCY_FORMAT.format(totalHaber)}
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
});

const LedgerView: React.FC<LedgerViewProps> = ({ ledgerData, fileName, onUpdateEntry, onSplitAccount, onDeleteAccount }) => {
  const [selectedAccountCode, setSelectedAccountCode] = useState<string | null>(null);
  const [expandedAccountCode, setExpandedAccountCode] = useState<string | null>(null);
  const [isLedgerExpanded, setIsLedgerExpanded] = useState(false); // Accordion state for mobile
  const [filterText, setFilterText] = useState('');
  const [sortMode, setSortMode] = useState<'BOOK' | 'ALPHA'>('BOOK');
  const [viewMode, setViewMode] = useState<'DETAIL' | 'RECAP'>('DETAIL');
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);

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

  // Set default account on load, or if the selected account is no longer in the list (deleted)
  React.useEffect(() => {
    // Check if the currently selected code exists in the current list
    const isSelectionValid = selectedAccountCode && accounts.some(a => a.accountCode === selectedAccountCode);

    if (accounts.length > 0 && !isSelectionValid) {
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

      {/* Sidebar: Account Selection - Responsive */}
      <div className="w-full md:w-80 bg-seashell dark:bg-[#222222] border-b md:border-b-0 md:border-r border-obsidian/10 dark:border-white/10 flex flex-col h-[280px] md:h-full shrink-0">
        <div className="p-2 md:p-3 border-b border-obsidian/10 dark:border-white/10 bg-obsidian/5 dark:bg-white/5 shrink-0 z-10 sticky top-0 flex flex-col gap-2">

          {/* SORT TOGGLE - Mobile optimized */}
          <div className="flex bg-white dark:bg-obsidian rounded border border-obsidian/10 dark:border-white/10 p-0.5 mb-1">
            <button
              onClick={() => setSortMode('BOOK')}
              className={`flex-1 text-[10px] md:text-[10px] uppercase font-bold py-2 md:py-1.5 rounded-sm transition-colors min-h-[40px] md:min-h-0 ${sortMode === 'BOOK' ? 'bg-denim text-white shadow-sm' : 'text-obsidian/50 dark:text-seashell/50 hover:bg-obsidian/5 dark:hover:bg-white/5'}`}
            >
              Por Diario
            </button>
            <button
              onClick={() => setSortMode('ALPHA')}
              className={`flex-1 text-[10px] md:text-[10px] uppercase font-bold py-2 md:py-1.5 rounded-sm transition-colors min-h-[40px] md:min-h-0 ${sortMode === 'ALPHA' ? 'bg-denim text-white shadow-sm' : 'text-obsidian/50 dark:text-seashell/50 hover:bg-obsidian/5 dark:hover:bg-white/5'}`}
            >
              Alfabético
            </button>
          </div>

          {/* VIEW MODE TOGGLE - Mobile optimized */}
          <div className="flex bg-white dark:bg-obsidian rounded border border-obsidian/10 dark:border-white/10 p-0.5 mb-1">
            <button
              onClick={() => setViewMode('DETAIL')}
              className={`flex-1 flex items-center justify-center gap-1 text-[10px] md:text-[10px] uppercase font-bold py-2 md:py-1.5 rounded-sm transition-colors min-h-[40px] md:min-h-0 ${viewMode === 'DETAIL' ? 'bg-denim text-white shadow-sm' : 'text-obsidian/50 dark:text-seashell/50 hover:bg-obsidian/5 dark:hover:bg-white/5'}`}
            >
              <LayoutList className="w-3.5 h-3.5 md:w-3 md:h-3" />
              Detalle
            </button>
            <button
              onClick={() => setViewMode('RECAP')}
              className={`flex-1 flex items-center justify-center gap-1 text-[10px] md:text-[10px] uppercase font-bold py-2 md:py-1.5 rounded-sm transition-colors min-h-[40px] md:min-h-0 ${viewMode === 'RECAP' ? 'bg-denim text-white shadow-sm' : 'text-obsidian/50 dark:text-seashell/50 hover:bg-obsidian/5 dark:hover:bg-white/5'}`}
            >
              <Table className="w-3.5 h-3.5 md:w-3 md:h-3" />
              Resumen
            </button>
          </div>

          {/* Search input - Mobile optimized */}
          <div className="relative w-full flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-obsidian/40 dark:text-seashell/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar cuenta..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 md:py-2 bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 rounded-md text-sm focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim text-obsidian dark:text-seashell transition-all shadow-sm placeholder:text-obsidian/30 dark:placeholder:text-seashell/30 truncate"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2.5 p-1 md:p-0.5 text-obsidian/40 hover:text-denim dark:text-seashell/40 dark:hover:text-denim transition-colors rounded-full hover:bg-obsidian/5 dark:hover:bg-white/10 min-w-[32px] min-h-[32px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4 md:w-3.5 md:h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-2 md:p-0 space-y-2 md:space-y-0">
          {filteredAccounts.map((acc, index) => (
            <AccountListItem
              key={acc.accountCode}
              acc={acc}
              index={index}
              isSelected={selectedAccountCode === acc.accountCode}
              isExpanded={expandedAccountCode === acc.accountCode}
              onSelect={() => {
                setSelectedAccountCode(acc.accountCode);
                if (window.innerWidth < 768) {
                  setExpandedAccountCode(expandedAccountCode === acc.accountCode ? null : acc.accountCode);
                }
              }}
              toggleExpand={(e) => {
                e.stopPropagation();
                if (window.innerWidth < 768) {
                  setExpandedAccountCode(expandedAccountCode === acc.accountCode ? null : acc.accountCode);
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Content: Ledger Table or Recapitulation */}
      <div className="flex-1 flex flex-col h-[calc(100vh-400px)] md:h-full overflow-hidden bg-white dark:bg-obsidian">

        {viewMode === 'RECAP' ? (
          <RecapitulationView ledgerData={ledgerData} />
        ) : (
          <>
            {/* Clickeable Header Card - Accordion Trigger (Mobile) / Static Header (Desktop) */}
            {currentAccount && (
              <button
                onClick={() => {
                  // Toggle collapse on mobile only
                  if (window.innerWidth < 768) {
                    setIsLedgerExpanded(!isLedgerExpanded);
                  }
                }}
                className={`
                  px-3 py-3 md:px-6 md:py-4 border-b border-obsidian/10 dark:border-white/10 
                  flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0 
                  bg-white dark:bg-obsidian shrink-0 w-full text-left
                  md:cursor-default cursor-pointer
                  md:hover:bg-transparent hover:bg-gradient-to-r hover:from-denim/5 hover:to-transparent
                  transition-all duration-300
                  ${isLedgerExpanded ? 'md:border-b border-b-0' : ''}
                `}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] md:text-[10px] font-bold text-denim uppercase tracking-widest border border-denim/20 px-1 rounded-sm">
                      Cuenta Mayor
                    </span>
                    <span className="text-[9px] md:text-[10px] text-obsidian/40 dark:text-seashell/40 font-mono font-bold">
                      #{currentAccount.accountCode}
                    </span>
                  </div>
                  <h2 className="text-base md:text-lg font-bold text-obsidian dark:text-seashell uppercase tracking-tight">
                    {currentAccount.accountName}
                  </h2>
                </div>

                {/* Saldo Acumulado - PROTAGONISTA */}
                <div className="flex items-center gap-3 md:gap-6 bg-gradient-to-br from-seashell to-slate-50 dark:from-white/5 dark:to-white/10 px-4 py-3 md:px-4 md:py-2 rounded-lg md:rounded-sm border border-obsidian/10 dark:border-white/10 shadow-sm">
                  <div className="text-right flex-1">
                    <div className="text-[9px] md:text-[10px] text-obsidian/50 dark:text-seashell/50 uppercase font-bold tracking-wider mb-1">
                      Saldo Acumulado
                    </div>
                    <div className={`text-2xl md:text-xl font-mono font-bold ${currentAccount.finalBalance < 0 ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {CURRENCY_FORMAT.format(currentAccount.finalBalance)}
                    </div>
                  </div>

                  {/* Chevron Indicator (Mobile Only) */}
                  <div className="md:hidden">
                    <ChevronDown
                      className={`w-5 h-5 text-denim transition-transform duration-300 ${isLedgerExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>

                  {/* Correction Controls Block */}
                  <div className="flex items-center gap-2 border-l border-obsidian/10 dark:border-white/10 pl-3 md:pl-6 ml-3 md:ml-0">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] uppercase tracking-widest text-obsidian/30 dark:text-seashell/30 font-bold hidden md:block text-right px-1">
                        Corrección Manual
                      </span>
                      <div className="flex items-center gap-2">
                        {/* Split Account Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSplitModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-denim/5 dark:bg-white/5 dark:hover:bg-white/10 text-denim dark:text-seashell font-bold uppercase text-[9px] tracking-widest rounded-sm border border-denim/20 hover:border-denim/50 transition-all shadow-sm"
                          title="Dividir saldo en nueva cuenta"
                        >
                          <Scissors className="w-3 h-3" />
                          <span className="hidden xl:inline">Dividir</span>
                        </button>

                        {/* Delete Account Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`¿Está seguro que desea eliminar la cuenta "${currentAccount.accountName}"?\n\nEsta acción eliminará la cuenta y su saldo de forma permanente de esta vista. El monto nio será reasignado.\n\nEsta acción es irreversible.`)) {
                              onDeleteAccount(currentAccount.accountCode);
                              // If we delete the current account, we should probably clear selection or let the parent/effect handle it.
                              // The effect [ledgerData] will re-run and might set a new default if selectedAccountCode becomes invalid.
                              // However, we should manually clear it to be safe or rely on the effect in LedgerView.
                              // Effect at line 232 sets default if null. If we delete, selectedAccountCode still points to it until render updates.
                              // Ideally we initiate deletion and let the props update.
                            }
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-red-50 dark:bg-white/5 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-bold uppercase text-[9px] tracking-widest rounded-sm border border-red-200 hover:border-red-400 dark:border-red-900/30 transition-all shadow-sm group"
                          title="Eliminar cuenta (Esta acción no cuadra saldos, solo elimina)"
                        >
                          <Trash2 className="w-3 h-3 group-hover:text-red-700" />
                          <span className="hidden xl:inline">Eliminar</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-obsidian/10 dark:bg-white/10 hidden md:block"></div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportToExcel();
                    }}
                    className="text-obsidian/40 hover:text-denim dark:text-seashell/40 dark:hover:text-denim transition-colors p-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:p-0 flex items-center justify-center hidden md:flex"
                    title="Descargar Hoja de Cálculo"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </button>
            )}

            {/* Split Account Modal */}
            {currentAccount && (
              <SplitAccountModal
                isOpen={isSplitModalOpen}
                onClose={() => setIsSplitModalOpen(false)}
                currentAccountName={currentAccount.accountName}
                currentBalance={currentAccount.finalBalance}
                onConfirm={(amount, newName) => {
                  onSplitAccount(currentAccount.accountCode, newName, amount);
                }}
              />
            )}

            {/* Collapsible Detail Section - Hidden by default on mobile */}
            <div className={`
              flex-1 overflow-auto p-0 min-h-0
              md:block
              transition-all duration-300 ease-in-out
              ${isLedgerExpanded ? 'block' : 'hidden md:block'}
            `}>
              {currentAccount ? (
                <>
                  {/* Mobile: Mini-Cards Layout */}
                  <div className="md:hidden p-3 space-y-3 bg-gradient-to-b from-slate-50/50 to-white dark:from-obsidian dark:to-obsidian">
                    {currentAccount.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-white dark:bg-obsidian/80 rounded-xl border border-obsidian/10 dark:border-white/10 p-4 shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        {/* Top: Date & Ref */}
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-obsidian/5 dark:border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-obsidian/70 dark:text-seashell/70 font-bold">
                              {entry.date}
                            </span>
                            <span className="w-px h-3 bg-obsidian/10 dark:bg-white/10"></span>
                            <span className="text-[10px] font-mono text-obsidian/40 dark:text-seashell/40 uppercase tracking-wider">
                              Ref: {entry.entryId}
                            </span>
                          </div>
                        </div>

                        {/* Center: Concepto - RESALTADO */}
                        <div className="mb-4">
                          <div className="text-[9px] uppercase tracking-widest text-obsidian/40 dark:text-seashell/40 font-bold mb-1">
                            Concepto
                          </div>
                          <p className="text-sm font-medium text-obsidian dark:text-seashell leading-snug">
                            {entry.description}
                          </p>
                        </div>

                        {/* Bottom: Amounts Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* Debe */}
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/10 dark:to-blue-800/10 rounded-lg p-2.5 border border-blue-200/50 dark:border-blue-700/30">
                            <div className="text-[8px] uppercase tracking-widest text-blue-600 dark:text-blue-400 font-bold mb-1">
                              Debe
                            </div>
                            <div className="text-sm font-mono font-bold text-obsidian dark:text-seashell">
                              {entry.debit !== 0 ? CURRENCY_FORMAT.format(entry.debit) : '-'}
                            </div>
                          </div>

                          {/* Haber */}
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/10 dark:to-purple-800/10 rounded-lg p-2.5 border border-purple-200/50 dark:border-purple-700/30">
                            <div className="text-[8px] uppercase tracking-widest text-purple-600 dark:text-purple-400 font-bold mb-1">
                              Haber
                            </div>
                            <div className="text-sm font-mono font-bold text-obsidian dark:text-seashell">
                              {entry.credit !== 0 ? CURRENCY_FORMAT.format(entry.credit) : '-'}
                            </div>
                          </div>

                          {/* Saldo */}
                          <div className={`bg-gradient-to-br rounded-lg p-2.5 border ${entry.runningBalance < 0
                            ? 'from-red-50 to-red-100/50 dark:from-red-900/10 dark:to-red-800/10 border-red-200/50 dark:border-red-700/30'
                            : 'from-emerald-50 to-emerald-100/50 dark:from-emerald-900/10 dark:to-emerald-800/10 border-emerald-200/50 dark:border-emerald-700/30'
                            }`}>
                            <div className={`text-[8px] uppercase tracking-widest font-bold mb-1 ${entry.runningBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                              Saldo
                            </div>
                            <div className={`text-sm font-mono font-bold ${entry.runningBalance < 0 ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                              {CURRENCY_FORMAT.format(entry.runningBalance)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Totals Card (Mobile) */}
                    <div className="bg-gradient-to-br from-denim/5 to-denim/10 dark:from-denim/10 dark:to-denim/20 rounded-xl border-2 border-denim/30 dark:border-denim/50 p-4 shadow-md">
                      <div className="text-xs uppercase tracking-widest text-denim font-bold mb-3 text-center">
                        Totales del Periodo
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className="text-[9px] text-obsidian/50 dark:text-seashell/50 mb-1">Debe</div>
                          <div className="text-base font-mono font-bold text-denim">
                            {CURRENCY_FORMAT.format(currentAccount.entries.reduce((sum, e) => sum + e.debit, 0))}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-obsidian/50 dark:text-seashell/50 mb-1">Haber</div>
                          <div className="text-base font-mono font-bold text-denim">
                            {CURRENCY_FORMAT.format(currentAccount.entries.reduce((sum, e) => sum + e.credit, 0))}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-obsidian/50 dark:text-seashell/50 mb-1">Saldo</div>
                          <div className={`text-base font-mono font-bold ${currentAccount.finalBalance < 0 ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {CURRENCY_FORMAT.format(currentAccount.finalBalance)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop: Table Layout (Preserved) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full lg:min-w-0">
                      <thead className="bg-obsidian/5 dark:bg-white/5 sticky top-0 z-10">
                        <tr>
                          <th scope="col" className="px-3 py-2.5 md:px-4 md:py-2 text-left text-sm md:text-xs lg:text-[10px] font-bold text-obsidian/60 dark:text-seashell/60 uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 min-w-[100px] md:min-w-0">Fecha</th>
                          <th scope="col" className="px-3 py-2.5 md:px-4 md:py-2 text-left text-sm md:text-xs lg:text-[10px] font-bold text-obsidian/60 dark:text-seashell/60 uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 min-w-[100px] md:min-w-0">Ref. Asiento</th>
                          <th scope="col" className="px-3 py-2.5 md:px-4 md:py-2 text-left text-sm md:text-xs lg:text-[10px] font-bold text-obsidian/60 dark:text-seashell/60 uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 min-w-[200px] md:w-1/3">Concepto / Glosa</th>
                          <th scope="col" className="px-3 py-2.5 md:px-4 md:py-2 text-right text-sm md:text-xs lg:text-[10px] font-bold text-denim uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 min-w-[120px] md:min-w-0">Debe</th>
                          <th scope="col" className="px-3 py-2.5 md:px-4 md:py-2 text-right text-sm md:text-xs lg:text-[10px] font-bold text-denim uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 min-w-[120px] md:min-w-0">Haber</th>
                          <th scope="col" className="px-3 py-2.5 md:px-4 md:py-2 text-right text-sm md:text-xs lg:text-[10px] font-bold text-obsidian dark:text-seashell uppercase tracking-wider border-b border-obsidian/10 dark:border-white/10 bg-obsidian/5 dark:bg-white/10 min-w-[120px] md:min-w-0">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-obsidian/5 dark:divide-white/5">
                        {currentAccount.entries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-denim/5 dark:hover:bg-white/5 transition-colors group">
                            <td className="px-3 py-3 md:px-4 md:py-2 whitespace-nowrap text-obsidian/70 dark:text-seashell/70 font-mono text-sm md:text-xs">
                              {entry.date}
                            </td>
                            <td className="px-3 py-3 md:px-4 md:py-2 whitespace-nowrap text-obsidian/50 dark:text-seashell/50 font-mono text-sm md:text-xs">
                              {entry.entryId}
                            </td>
                            <td className="px-3 py-3 md:px-4 md:py-2 text-obsidian/80 dark:text-seashell/80 font-medium truncate max-w-xs text-sm md:text-xs" title={entry.description}>
                              {entry.description}
                            </td>
                            <td className="px-3 py-3 md:px-4 md:py-2 text-right font-mono text-obsidian/70 dark:text-seashell/70 text-base md:text-sm lg:text-xs">
                              <EditableCell
                                value={entry.debit}
                                currencyFormat={CURRENCY_FORMAT}
                                onSave={(val) => onUpdateEntry(currentAccount.accountCode, entry.id, 'debit', val)}
                              />
                            </td>
                            <td className="px-3 py-3 md:px-4 md:py-2 text-right font-mono text-obsidian/70 dark:text-seashell/70 text-base md:text-sm lg:text-xs">
                              <EditableCell
                                value={entry.credit}
                                currencyFormat={CURRENCY_FORMAT}
                                onSave={(val) => onUpdateEntry(currentAccount.accountCode, entry.id, 'credit', val)}
                              />
                            </td>
                            <td className={`px-3 py-3 md:px-4 md:py-2 text-right font-mono font-bold border-l border-obsidian/5 dark:border-white/5 text-base md:text-sm lg:text-xs ${entry.runningBalance < 0 ? 'text-red-600 bg-red-50 dark:bg-red-900/10' : 'text-obsidian dark:text-seashell bg-obsidian/5 dark:bg-white/5'}`}>
                              {CURRENCY_FORMAT.format(entry.runningBalance)}
                            </td>
                          </tr>
                        ))}
                        {/* Total Row */}
                        <tr className="bg-seashell dark:bg-white/5 font-bold border-t-2 border-denim">
                          <td colSpan={3} className="px-3 py-3 md:px-4 md:py-3 text-right text-obsidian/40 dark:text-seashell/40 uppercase text-xs md:text-[10px] tracking-widest">Totales del Periodo</td>
                          <td className="px-3 py-3 md:px-4 md:py-3 text-right font-mono text-denim text-base md:text-sm lg:text-xs">
                            {CURRENCY_FORMAT.format(currentAccount.entries.reduce((sum, e) => sum + e.debit, 0))}
                          </td>
                          <td className="px-3 py-3 md:px-4 md:py-3 text-right font-mono text-denim text-base md:text-sm lg:text-xs">
                            {CURRENCY_FORMAT.format(currentAccount.entries.reduce((sum, e) => sum + e.credit, 0))}
                          </td>
                          <td className={`px-3 py-3 md:px-4 md:py-3 text-right font-mono text-base md:text-sm lg:text-xs border-l border-obsidian/5 dark:border-white/5 bg-obsidian/10 dark:bg-white/10 ${currentAccount.finalBalance < 0 ? 'text-red-600' : 'text-obsidian dark:text-seashell'}`}>
                            {CURRENCY_FORMAT.format(currentAccount.finalBalance)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
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