import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, Database } from 'lucide-react';
import FileUpload from './components/FileUpload';
import LedgerView from './components/LedgerView';
import ChartSelector from './components/ChartSelector';
import { AccountLedger, JournalEntry, ParseResult, ProcessingError, WatchdogAlert, UserMode } from './types';
import { generateLedger } from './services/ledgerService';
import { isGlosa, filterGlosaEntries, createBlockedOperationAlert } from './services/watchdog';

type ActiveModule = 'LEDGER' | 'CHART';

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ActiveModule>('LEDGER');
  const [viewState, setViewState] = useState<'UPLOAD' | 'VIEW'>('UPLOAD');
  const [ledgerData, setLedgerData] = useState<Record<string, AccountLedger>>({});
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [errors, setErrors] = useState<ProcessingError[]>([]);
  const [watchdogAlerts, setWatchdogAlerts] = useState<WatchdogAlert[]>([]);
  const [userMode, setUserMode] = useState<UserMode | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try { localStorage.removeItem('determinist-theme'); } catch {}
  }, []);

  const handleDataLoaded = (result: ParseResult, fileName: string) => {
    if (result.success === false) {
      setErrors(result.errors);
      setViewState('UPLOAD');
      return;
    }

    // ═══ WATCHDOG: Final scan at App layer ═══
    // Parser already filters, but we run one more pass to collect alerts for the UI.
    const { clean, alerts } = filterGlosaEntries(result.data);
    if (alerts.length > 0) {
      setWatchdogAlerts(prev => [...prev, ...alerts]);
    }

    if (!userMode) return;

    const { ledgerMap, newAlerts } = generateLedger(clean, userMode);

    if (newAlerts.length > 0) {
      setWatchdogAlerts(prev => [...prev, ...newAlerts]);
    }

    setLedgerData(ledgerMap);
    setJournalEntries(clean);
    setCurrentFileName(fileName);
    setErrors([]);
    setViewState('VIEW');
  };

  const resetApp = () => {
    setViewState('UPLOAD');
    setLedgerData({});
    setJournalEntries([]);
    setCurrentFileName('');
    setErrors([]);
    setWatchdogAlerts([]);
    setUserMode(null);
  };

  const handleUpdateEntry = (accountCode: string, entryId: string, field: 'debit' | 'credit', newValue: number) => {
    setLedgerData(prevData => {
      const newData = { ...prevData };
      const account = newData[accountCode];

      if (!account) return prevData;

      // Create a new array for entries to ensure immutability
      const newEntries = [...account.entries];
      const entryIndex = newEntries.findIndex(e => e.id === entryId);

      if (entryIndex === -1) return prevData;

      // Update the specific entry
      const entry = { ...newEntries[entryIndex] };

      // Calculate the difference to update running balances efficiently
      // or just recalculate everything from this point onwards.
      // Recalculating from this point is safer.

      if (field === 'debit') {
        entry.debit = newValue;
      } else {
        entry.credit = newValue;
      }

      newEntries[entryIndex] = entry;

      // Recalculate running balances from the modified entry onwards
      let runningBalance = entryIndex > 0 ? newEntries[entryIndex - 1].runningBalance : 0;

      for (let i = entryIndex; i < newEntries.length; i++) {
        const e = newEntries[i];
        runningBalance = runningBalance + e.debit - e.credit;
        newEntries[i] = { ...e, runningBalance };
      }

      // Update account final balance
      const newAccount = {
        ...account,
        entries: newEntries,
        finalBalance: runningBalance,
        totalDebit: newEntries.reduce((sum, e) => sum + e.debit, 0),
        totalCredit: newEntries.reduce((sum, e) => sum + e.credit, 0)
      };

      newData[accountCode] = newAccount;
      return newData;
    });
  };

  const handleSplitAccount = (originalAccountCode: string, newAccountName: string, amount: number, side: 'DEBIT' | 'CREDIT', targetOrder: number) => {
    if (amount <= 0) return;

    // ═══ WATCHDOG: Block split into glosa-patterned account names ═══
    if (isGlosa(newAccountName)) {
      const alert = createBlockedOperationAlert(newAccountName, 'División de Cuenta');
      setWatchdogAlerts(prev => [...prev, alert]);
      console.error(alert.message);
      return; // BLOCKED — do not proceed
    }

    setLedgerData(prevData => {
      const newData = { ...prevData };
      const originalAccount = newData[originalAccountCode];


      if (!originalAccount) return prevData;
      // Removed balance check to allow correcting zero-balance or negative accounts
      // if (Math.abs(originalAccount.finalBalance) < amount) return prevData;

      // 1. Generate New Account Code
      const newAccountCode = newAccountName.trim().toUpperCase();

      // 2. Insert new account and Re-order
      let allAccounts = Object.values(newData).sort((a, b) => a.firstLine - b.firstLine);

      let newAccount: AccountLedger;

      if (!newData[newAccountCode]) {
        newAccount = {
          accountCode: newAccountCode,
          accountName: newAccountName,
          entries: [],
          finalBalance: 0,
          totalDebit: 0,
          totalCredit: 0,
          firstLine: 0
        };
        // Insert into the array at the specific index (targetOrder - 1)
        if (targetOrder > allAccounts.length + 1) targetOrder = allAccounts.length + 1;
        if (targetOrder < 1) targetOrder = 1;

        allAccounts.splice(targetOrder - 1, 0, newAccount);
      } else {
        newAccount = newData[newAccountCode];
        // If it exists, move it.
        const existingIdx = allAccounts.findIndex(a => a.accountCode === newAccountCode);
        if (existingIdx !== -1) {
          allAccounts.splice(existingIdx, 1);
        }
        if (targetOrder > allAccounts.length + 1) targetOrder = allAccounts.length + 1;
        if (targetOrder < 1) targetOrder = 1;

        allAccounts.splice(targetOrder - 1, 0, newAccount);
      }

      // Re-index all accounts
      allAccounts.forEach((acc, index) => {
        acc.firstLine = index + 1;
        newData[acc.accountCode] = acc;
      });

      // 3. Silent Transfer Logic
      const entryIndexToRemove = originalAccount.entries.findIndex(e =>
        (side === 'DEBIT' && e.debit === amount) ||
        (side === 'CREDIT' && e.credit === amount)
      );

      const timestamp = new Date().toISOString().split('T')[0];
      const splitId = `SPLIT-${Date.now()}`;

      // Update Original Account
      let updatedOriginalEntries = [...originalAccount.entries];

      if (entryIndexToRemove !== -1) {
        // EXACT MATCH FOUND: Remove it completely (Silence)
        updatedOriginalEntries.splice(entryIndexToRemove, 1);
      } else {
        // NO EXACT MATCH: Create a silent adjustment (Hidden)
        const hiddenAdjustment: any = {
          id: `adj-${splitId}-orig-hidden`,
          date: timestamp,
          accountCode: originalAccountCode,
          accountName: originalAccount.accountName,
          debit: side === 'CREDIT' ? amount : 0,
          credit: side === 'DEBIT' ? amount : 0,
          description: `(Oculto) Ajuste por división a ${newAccountName}`,
          entryId: 'AJUSTE',
          originalLine: 999999,
          runningBalance: 0,
          isHidden: true
        };
        updatedOriginalEntries.push(hiddenAdjustment);
      }

      // Recalculate original running balances
      let runBalOrig = 0;
      updatedOriginalEntries.forEach(e => {
        runBalOrig = runBalOrig + e.debit - e.credit;
        e.runningBalance = runBalOrig;
      });
      newData[originalAccountCode] = {
        ...originalAccount,
        entries: updatedOriginalEntries,
        finalBalance: runBalOrig,
        totalDebit: updatedOriginalEntries.reduce((sum, e) => sum + e.debit, 0),
        totalCredit: updatedOriginalEntries.reduce((sum, e) => sum + e.credit, 0)
      };

      // Update New Account
      const targetAcc = newData[newAccountCode]; // Get reference from updated map/array

      const newEntry: any = {
        id: `adj-${splitId}-new`,
        date: timestamp,
        accountCode: newAccountCode,
        accountName: newAccountName,
        debit: side === 'DEBIT' ? amount : 0,
        credit: side === 'CREDIT' ? amount : 0,
        description: `Traslado desde ${originalAccount.accountName}`,
        entryId: 'APERTURA',
        originalLine: 999999,
        runningBalance: 0
      };

      const updatedNewEntries = [...targetAcc.entries, newEntry];

      let runBalNew = 0;
      updatedNewEntries.forEach(e => {
        runBalNew = runBalNew + e.debit - e.credit;
        e.runningBalance = runBalNew;
      });

      newData[newAccountCode] = {
        ...targetAcc,
        entries: updatedNewEntries,
        finalBalance: runBalNew,
        totalDebit: updatedNewEntries.reduce((sum, e) => sum + e.debit, 0),
        totalCredit: updatedNewEntries.reduce((sum, e) => sum + e.credit, 0)
      };

      return newData;
    });
  };

  const handleDeleteAccount = (accountCode: string) => {
    // Confirmation is handled in the UI component, this just executes
    setLedgerData(prevData => {
      const newData = { ...prevData };
      delete newData[accountCode];
      return newData;
    });
  };

  return (
    <div className="sap-app">
      <nav className="sap-menubar" aria-label="Módulos">
        <div className="sap-brand"><span className="sap-logo-frame"><img src="/determinis.png" alt="Determinist" /></span></div>
        <button aria-current={activeModule === 'LEDGER' ? 'page' : undefined} onClick={() => setActiveModule('LEDGER')}>Libro mayor</button>
        <button aria-current={activeModule === 'CHART' ? 'page' : undefined} onClick={() => setActiveModule('CHART')}>Estructuras contables</button>
      </nav>
      <div className="sap-location">Finanzas <ChevronRight size={12} /> {activeModule === 'LEDGER' ? 'Libro mayor' : 'Estructuras contables'} <span>{activeModule === 'LEDGER' ? (viewState === 'UPLOAD' ? 'Importación de datos' : currentFileName) : 'Selección de cuentas'}</span></div>
      <main className="sap-workspace">
        {activeModule === 'CHART' ? <ChartSelector /> : viewState === 'UPLOAD' ? (
          <div className="sap-import-layout">
            <aside className="sap-navigation">
              <div className="sap-panel-title">Operaciones</div>
              <div className="sap-tree-group"><ChevronRight size={12} /> Contabilidad</div>
              <button aria-current="step">Importar libro diario</button>
              <button onClick={() => setActiveModule('CHART')}>Estructuras contables</button>
            </aside>
            <section className="sap-import-panel">
              <div className="sap-panel-title">Importar libro diario</div>
              <div className="sap-form-content">
                <h1>Generación de libro mayor</h1>
                <fieldset className="sap-fieldset"><legend>Parámetros de importación</legend>
                  <label className="sap-field-row"><span>Régimen contable</span><select value={userMode || ''} onChange={e => setUserMode(e.target.value as UserMode || null)}><option value="">Seleccionar…</option><option value="Practica">Práctica supervisada</option><option value="Bancaria">Contabilidad bancaria</option></select></label>
                  <div className="sap-field-row"><span>Documento fuente</span><span className="sap-readonly">Libro diario</span></div>
                  <div className="sap-field-row"><span>Archivo</span><span className="sap-readonly">Excel (.xlsx) / CSV (.csv)</span></div>
                </fieldset>
                <fieldset className="sap-fieldset"><legend>Archivo fuente</legend>
                  {userMode ? <FileUpload onDataLoaded={handleDataLoaded} mode={userMode} /> : <div className="sap-upload-placeholder"><UploadIcon /><span>Seleccione un régimen para habilitar la carga.</span></div>}
                </fieldset>
                {errors.length > 0 && <div className="sap-errors" role="alert"><strong>No se pudo importar el archivo</strong><ul>{errors.map((err, i) => <li key={i}>Línea {err.line}: {err.message}</li>)}</ul></div>}
              </div>
              <div className="sap-panel-footer"><button onClick={resetApp}>Restablecer</button></div>
            </section>
          </div>
        ) : (
          <div className="sap-ledger-workspace">
            <div className="sap-document-toolbar"><button onClick={resetApp}><ArrowLeft size={13} /> Nueva importación</button><span title={currentFileName}>{currentFileName}</span><span>{Object.keys(ledgerData).length} cuentas</span></div>
            <div className="sap-ledger-content"><LedgerView mode={userMode || 'Practica'} ledgerData={ledgerData} fileName={currentFileName} journalEntries={journalEntries} onUpdateEntry={handleUpdateEntry} onSplitAccount={handleSplitAccount} onDeleteAccount={handleDeleteAccount} watchdogAlerts={watchdogAlerts} onDismissAlerts={() => setWatchdogAlerts([])} /></div>
          </div>
        )}
      </main>
    </div>
  );
};
const UploadIcon = () => <Database size={22} strokeWidth={1.3} />;
export default App;
