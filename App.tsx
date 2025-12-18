import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCcw, AlertOctagon, CheckCircle2, Moon, Sun, ArrowLeft, Grid, ChevronRight, Settings2, Database } from 'lucide-react';
import FileUpload from './components/FileUpload';
import LedgerView from './components/LedgerView';
import ChartSelector from './components/ChartSelector';
import { AccountLedger, ParseResult, ProcessingError } from './types';
import { generateLedger } from './services/ledgerService';

type ActiveModule = 'LEDGER' | 'CHART';

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ActiveModule>('LEDGER');
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
      setViewState('UPLOAD');
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
      {/* Enterprise Navbar - Updated for transparency and clean theme compatibility */}
      <nav className="bg-white/80 dark:bg-obsidian/80 backdrop-blur-md text-obsidian dark:text-seashell z-50 h-14 shrink-0 border-b border-obsidian/10 dark:border-white/10">
        <div className="w-full h-full px-4 flex items-center justify-between">
          
          {/* Left: Branding & Module Navigation */}
          <div className="flex items-center h-full">
            <div className="flex items-center gap-2 pr-6 border-r border-obsidian/10 dark:border-white/10 h-full">
              <div className="bg-denim p-1 rounded-sm">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-obsidian dark:text-white uppercase">Determinist</span>
            </div>

            {/* Module Switcher */}
            <div className="flex items-center h-full gap-0 pl-0 text-sm">
              <button 
                onClick={() => setActiveModule('LEDGER')}
                className={`flex items-center gap-2 px-6 h-full border-b-2 transition-all relative
                  ${activeModule === 'LEDGER' ? 'border-denim text-denim bg-denim/5' : 'border-transparent text-obsidian/60 dark:text-seashell/60 hover:text-denim hover:bg-denim/5'}`}
              >
                <Database className="w-3.5 h-3.5" />
                <span className="font-bold uppercase text-[10px] tracking-widest">Generador Ledger</span>
              </button>
              
              <button 
                onClick={() => setActiveModule('CHART')}
                className={`flex items-center gap-2 px-6 h-full border-b-2 transition-all relative
                  ${activeModule === 'CHART' ? 'border-denim text-denim bg-denim/5' : 'border-transparent text-obsidian/60 dark:text-seashell/60 hover:text-denim hover:bg-denim/5'}`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="font-bold uppercase text-[10px] tracking-widest">Chart Selector</span>
              </button>

              <div className="hidden lg:flex h-full items-center px-6 border-l border-obsidian/10 dark:border-white/10 gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-obsidian/20 dark:text-white/20" />
                <span className="text-[10px] font-mono text-denim font-bold uppercase tracking-widest">
                  {activeModule === 'LEDGER' ? 'Accounting::Main' : 'Structure::Compiler'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Right: Tools Only */}
          <div className="flex items-center h-full gap-2">
            {activeModule === 'LEDGER' && viewState === 'VIEW' && (
              <button
                onClick={resetApp}
                className="flex items-center gap-2 px-3 py-1.5 bg-denim hover:bg-denim/90 text-white text-xs font-semibold uppercase tracking-wide rounded-sm transition-all shadow-sm"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Reiniciar</span>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-sm hover:bg-obsidian/5 dark:hover:bg-white/10 text-obsidian/70 dark:text-seashell/70 hover:text-denim transition-colors"
              title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 overflow-hidden">
        
        {/* Module Content Transitions */}
        {activeModule === 'CHART' ? (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
            <ChartSelector />
          </div>
        ) : (
          /* Ledger Module */
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-left-4 duration-500 overflow-hidden">
            {viewState === 'UPLOAD' && (
              <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 overflow-y-auto">
                <div className="w-full max-w-4xl bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 shadow-sm rounded-sm p-12 text-center">
                  <div className="inline-flex p-3 bg-denim/10 rounded-full mb-6 text-denim">
                    <Database className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-obsidian dark:text-seashell mb-2 uppercase tracking-wide">
                    Ingesta de Datos Contables
                  </h2>
                  <p className="text-obsidian/60 dark:text-seashell/60 text-sm mb-10 max-w-xl mx-auto">
                    Cargue el archivo fuente del <span className="font-semibold text-denim">Libro Diario</span>. El sistema ejecutará validaciones estructurales estrictas y generará el Libro Mayor de forma determinista.
                  </p>
                  <FileUpload onDataLoaded={handleDataLoaded} />
                </div>

                {errors.length > 0 && (
                  <div className="mt-6 w-full max-w-4xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-sm p-4 animate-in slide-in-from-bottom-5">
                    <div className="flex items-center gap-3 mb-2 text-red-800 dark:text-red-300 border-b border-red-100 dark:border-red-900/30 pb-2">
                      <AlertOctagon className="w-5 h-5" />
                      <h3 className="font-bold text-xs uppercase tracking-widest">Excepciones de Proceso Detectadas</h3>
                    </div>
                    <div className="max-h-40 overflow-y-auto pr-2">
                      <table className="w-full text-left text-[10px]">
                        <tbody>
                        {errors.map((err, idx) => (
                          <tr key={idx} className="border-b border-red-100 dark:border-red-900/20 last:border-0">
                            <td className="py-2 px-2 font-mono font-bold text-red-700 dark:text-red-400 w-20">LÍNEA {err.line}</td>
                            <td className="py-2 px-2 text-red-800 dark:text-red-200 font-medium uppercase">{err.message}</td>
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
              <div className="h-full flex flex-col overflow-hidden">
                 <div className="mb-4 bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 rounded-sm p-2 flex items-center justify-between shadow-sm shrink-0">
                   <div className="flex items-center gap-4">
                     <button 
                        onClick={resetApp}
                        className="flex items-center gap-2 text-obsidian/70 hover:text-denim dark:text-seashell/70 dark:hover:text-denim transition-colors text-[10px] font-bold px-3 py-1.5 rounded-sm hover:bg-obsidian/5 dark:hover:bg-seashell/10 uppercase tracking-widest"
                     >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Reiniciar</span>
                     </button>
                     <div className="h-6 w-px bg-obsidian/10 dark:bg-white/10"></div>
                     <div className="flex items-center gap-2 text-[10px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-obsidian/40 dark:text-seashell/40 uppercase font-bold tracking-widest">FUENTE DE DATOS:</span>
                        <span className="font-mono text-obsidian dark:text-seashell font-bold">{currentFileName}</span>
                     </div>
                   </div>
                   <div className="flex items-center gap-2 px-3">
                      <span className="text-obsidian/40 dark:text-seashell/40 uppercase text-[9px] font-bold tracking-widest">Registros:</span>
                      <span className="font-mono font-bold text-denim text-lg leading-none">{Object.keys(ledgerData).length}</span>
                   </div>
                 </div>
                 <div className="flex-1 overflow-hidden h-full">
                   <LedgerView ledgerData={ledgerData} fileName={currentFileName} />
                 </div>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-white/50 dark:bg-obsidian/50 backdrop-blur-sm border-t border-obsidian/10 dark:border-white/10 py-1 px-4 text-[9px] text-obsidian/30 dark:text-seashell/30 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold uppercase tracking-widest">Determinist Ledger Solutions</span>
          <span className="w-px h-3 bg-obsidian/10 dark:bg-white/10"></span>
          <span className="uppercase tracking-widest text-denim font-bold">MODE: {activeModule === 'LEDGER' ? 'GENERATION' : 'COMPILATION'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="opacity-40">Guatemala Accounting Standards Compliance</span>
          <span className="w-px h-3 bg-obsidian/10 dark:bg-white/10"></span>
          <span>&copy; {new Date().getFullYear()} Determinist Enterprise</span>
        </div>
      </footer>
    </div>
  );
};

export default App;