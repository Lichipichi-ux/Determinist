import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCcw, AlertOctagon, CheckCircle2, Moon, Sun, ArrowLeft, Grid, ChevronRight, UserCircle } from 'lucide-react';
import FileUpload from './components/FileUpload';
import LedgerView from './components/LedgerView';
import { AccountLedger, ParseResult, ProcessingError } from './types';
import { generateLedger } from './services/ledgerService';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<'UPLOAD' | 'VIEW'>('UPLOAD');
  const [ledgerData, setLedgerData] = useState<Record<string, AccountLedger>>({});
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [errors, setErrors] = useState<ProcessingError[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize theme based on system preference
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  // Apply theme class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleDataLoaded = (result: ParseResult, fileName: string) => {
    if (result.success === false) {
      setErrors(result.errors);
      setViewState('UPLOAD'); // Stay on upload but show errors
      return;
    }

    const generatedLedger = generateLedger(result.data);
    setLedgerData(generatedLedger);
    setCurrentFileName(fileName);
    setErrors([]);
    setViewState('VIEW');
  };

  const resetApp = () => {
    setViewState('UPLOAD');
    setLedgerData({});
    setCurrentFileName('');
    setErrors([]);
  };

  return (
    <div className="h-screen bg-seashell dark:bg-[#1a1a1a] text-obsidian dark:text-seashell font-sans transition-colors duration-300 selection:bg-denim selection:text-white flex flex-col overflow-hidden">
      {/* Enterprise Navbar */}
      <nav className="bg-obsidian text-seashell shadow-md z-50 h-14 shrink-0 border-b-4 border-denim">
        <div className="w-full h-full px-4 flex items-center justify-between">
          
          {/* Left: Branding & Module Navigation */}
          <div className="flex items-center h-full">
            {/* Logo Area */}
            <div className="flex items-center gap-2 pr-6 border-r border-white/10 h-full">
              <div className="bg-denim p-1 rounded-sm">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white uppercase">LedgerGen</span>
            </div>

            {/* Breadcrumbs / System Context */}
            <div className="hidden md:flex items-center gap-2 pl-6 text-sm text-seashell/80">
              <div className="flex items-center gap-1 hover:text-white cursor-pointer transition-colors">
                <Grid className="w-4 h-4" />
                <span className="font-medium">Finanzas</span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40" />
              <span className="font-medium hover:text-white cursor-pointer transition-colors">Contabilidad General</span>
              <ChevronRight className="w-4 h-4 text-white/40" />
              <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded-sm">
                Libro Mayor
              </span>
            </div>
          </div>
          
          {/* Right: Tools & Status */}
          <div className="flex items-center h-full gap-0">
            {viewState === 'VIEW' && (
              <div className="flex items-center h-full border-l border-white/10 px-4">
                <button
                  onClick={resetApp}
                  className="flex items-center gap-2 px-3 py-1.5 bg-denim hover:bg-denim/90 text-white text-xs font-semibold uppercase tracking-wide rounded-sm transition-all shadow-sm"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  <span>Nuevo Proceso</span>
                </button>
              </div>
            )}

            <div className="flex items-center h-full border-l border-white/10 px-2">
               <button
                onClick={toggleTheme}
                className="p-2 rounded-sm hover:bg-white/10 text-seashell/70 hover:text-seashell transition-colors"
                title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="flex items-center h-full border-l border-white/10 pl-4 gap-3">
              <div className="text-right hidden lg:block leading-tight">
                <div className="text-xs font-bold text-white">Admin User</div>
                <div className="text-[10px] text-seashell/60">GUA_ACC_01</div>
              </div>
              <UserCircle className="w-8 h-8 text-seashell/50" />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 overflow-hidden">
        
        {viewState === 'UPLOAD' && (
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 overflow-y-auto">
            <div className="w-full max-w-4xl bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 shadow-sm rounded-sm p-12 text-center">
              <h2 className="text-2xl font-bold text-obsidian dark:text-seashell mb-2 uppercase tracking-wide">
                Ingesta de Datos Contables
              </h2>
              <p className="text-obsidian/60 dark:text-seashell/60 text-base mb-10 max-w-xl mx-auto">
                Cargue el archivo fuente del <span className="font-semibold text-denim">Libro Diario</span>. El sistema ejecutará validaciones estructurales estrictas y generará el Libro Mayor de forma determinista.
              </p>

              <FileUpload onDataLoaded={handleDataLoaded} />
            </div>

            {/* Error Display */}
            {errors.length > 0 && (
              <div className="mt-6 w-full max-w-4xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-sm p-4 animate-in slide-in-from-bottom-5">
                <div className="flex items-center gap-3 mb-2 text-red-800 dark:text-red-300 border-b border-red-100 dark:border-red-900/30 pb-2">
                  <AlertOctagon className="w-5 h-5" />
                  <h3 className="font-bold text-sm uppercase">Excepciones de Proceso</h3>
                </div>
                <div className="max-h-40 overflow-y-auto pr-2">
                  <table className="w-full text-left text-xs">
                    <tbody>
                    {errors.map((err, idx) => (
                      <tr key={idx} className="border-b border-red-100 dark:border-red-900/20 last:border-0">
                        <td className="py-2 px-2 font-mono font-bold text-red-700 dark:text-red-400 w-20">Ln {err.line}</td>
                        <td className="py-2 px-2 text-red-800 dark:text-red-200">{err.message}</td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {viewState === 'VIEW' && (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
             
             {/* Action Toolbar */}
             <div className="mb-4 bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 rounded-sm p-2 flex items-center justify-between shadow-sm shrink-0">
               <div className="flex items-center gap-4">
                 <button 
                    onClick={resetApp}
                    className="flex items-center gap-2 text-obsidian/70 hover:text-denim dark:text-seashell/70 dark:hover:text-denim transition-colors text-sm font-semibold px-3 py-1.5 rounded-sm hover:bg-obsidian/5 dark:hover:bg-seashell/10"
                 >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="uppercase text-xs tracking-wide">Volver al Diario</span>
                 </button>

                 <div className="h-6 w-px bg-obsidian/10 dark:bg-white/10"></div>

                 <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-obsidian/50 dark:text-seashell/50 uppercase text-xs font-bold">Fuente:</span>
                    <span className="font-mono text-obsidian dark:text-seashell">{currentFileName}</span>
                 </div>
               </div>
               
               <div className="flex items-center gap-2 px-3">
                  <span className="text-obsidian/50 dark:text-seashell/50 uppercase text-xs font-bold">Cuentas Procesadas:</span>
                  <span className="font-mono font-bold text-denim text-lg leading-none">{Object.keys(ledgerData).length}</span>
               </div>
             </div>

             <div className="flex-1 overflow-hidden h-full">
               <LedgerView ledgerData={ledgerData} fileName={currentFileName} />
             </div>
          </div>
        )}
      </main>
      
      {/* Footer (Classic ERP Footer) */}
      <footer className="bg-obsidian border-t border-white/10 py-1 px-4 text-[10px] text-seashell/40 flex justify-between items-center shrink-0">
        <span>Sistema de Gestión Contable v1.1.0-CLASSIC</span>
        <span>&copy; {new Date().getFullYear()} Enterprise Ledger Solutions</span>
      </footer>
    </div>
  );
};

export default App;