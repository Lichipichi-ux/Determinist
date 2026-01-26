import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { ChevronRight, ChevronDown, Hash, Copy, RotateCcw, Search, Book, ShieldCheck, FileSpreadsheet, Check } from 'lucide-react';
import { ChartNode, ChartSelectionState } from '../types';
import { ALL_STRUCTURES } from '../data/chartStructures';

// Sub-componente optimizado con React.memo para evitar re-renders innecesarios
const TreeNode = memo(({
  node,
  depth,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  filterText,
  matchesFilter
}: {
  node: ChartNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (node: ChartNode) => void;
  filterText: string;
  matchesFilter: (node: ChartNode, text: string) => boolean;
}) => {
  if (filterText && !matchesFilter(node, filterText)) return null;

  const hasChildren = node.children && node.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpand(node.id);
    } else {
      onToggleSelect(node);
    }
  };

  return (
    <div className="select-none">
      <div
        onClick={handleClick}
        className={`flex items-center py-1.5 px-3 border-b border-obsidian/5 dark:border-white/5 cursor-pointer transition-all duration-75 group
          ${isSelected ? 'bg-denim/10 dark:bg-denim/20' : 'hover:bg-denim/[0.04] dark:hover:bg-white/[0.04]'}
          ${node.level === 'GROUP' ? 'bg-obsidian/[0.02] dark:bg-white/5' : ''}
          active:bg-denim/25
        `}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {/* Expand Icon Area */}
        <div className="w-5 shrink-0 flex items-center justify-center mr-1">
          {hasChildren && (
            <div className={`transition-colors ${isExpanded ? 'text-denim' : 'text-obsidian/40 dark:text-seashell/40'}`}>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>
          )}
        </div>

        {/* Small Checkbox Area - High Fidelity Accounting UI */}
        <div className="w-6 shrink-0 flex items-center justify-center mr-2">
          {!hasChildren && (
            <div className={`border rounded-[2px] w-3.5 h-3.5 flex items-center justify-center transition-all
              ${isSelected
                ? 'bg-denim border-denim shadow-[0_0_4px_rgba(91,131,174,0.4)]'
                : 'bg-white dark:bg-obsidian border-obsidian/20 dark:border-white/20 group-hover:border-denim/50'
              }`}
            >
              {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
            </div>
          )}
        </div>

        {/* Text Content */}
        <div className="flex-1 flex items-baseline gap-2 overflow-hidden">
          <span className={`text-[10.5px] truncate uppercase tracking-tight transition-colors
            ${node.level === 'GROUP' ? 'font-bold text-obsidian dark:text-white' : ''}
            ${node.level === 'SUBGROUP' ? 'font-semibold text-obsidian/80 dark:text-seashell/90' : ''}
            ${isSelected ? 'text-denim font-black' : 'text-obsidian/70 dark:text-seashell/70'}
          `}>
            {node.name}
          </span>
        </div>
      </div>
    </div>
  );
});

TreeNode.displayName = 'TreeNode';

const ChartSelector: React.FC = () => {
  const [activeBookId, setActiveBookId] = useState<string>(ALL_STRUCTURES[0].id);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['bg_activo', 'bg_anc', 'cp_mpc', 'cp_cpri', 'er_iop', 'er_cdv']));
  const [filterText, setFilterText] = useState('');
  const [copied, setCopied] = useState(false);

  const [globalSelection, setGlobalSelection] = useState<ChartSelectionState>(() => {
    const initialState: ChartSelectionState = {};
    ALL_STRUCTURES.forEach(book => {
      initialState[book.id] = {
        selectedIds: new Set(),
        selectionOrder: []
      };
    });
    return initialState;
  });

  const activeBook = useMemo(() =>
    ALL_STRUCTURES.find(b => b.id === activeBookId) || ALL_STRUCTURES[0],
    [activeBookId]
  );

  const currentBookState = globalSelection[activeBookId] || { selectedIds: new Set(), selectionOrder: [] };

  const handleToggleNode = useCallback((node: ChartNode) => {
    setGlobalSelection(prev => {
      const bookState = prev[activeBookId] || { selectedIds: new Set(), selectionOrder: [] };
      const nextIds = new Set(bookState.selectedIds);
      let nextOrder = [...bookState.selectionOrder];

      if (nextIds.has(node.id)) {
        nextIds.delete(node.id);
        nextOrder = nextOrder.filter(id => id !== node.id);
      } else {
        nextIds.add(node.id);
        nextOrder.push(node.id);
      }

      return {
        ...prev,
        [activeBookId]: { selectedIds: nextIds, selectionOrder: nextOrder }
      };
    });
  }, [activeBookId]);

  const resetBookSelections = () => {
    setGlobalSelection(prev => ({
      ...prev,
      [activeBookId]: { selectedIds: new Set(), selectionOrder: [] }
    }));
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const matchesFilter = useCallback((node: ChartNode, text: string): boolean => {
    if (!text) return true;
    const lowerText = text.toLowerCase();
    const selfMatches = node.name.toLowerCase().includes(lowerText) ||
      (node.code?.toLowerCase().includes(lowerText) || false);
    if (selfMatches) return true;
    return node.children?.some(child => matchesFilter(child, text)) || false;
  }, []);

  useEffect(() => {
    if (filterText.length > 0) {
      const newExpanded = new Set<string>();
      const expandMatching = (nodes: ChartNode[]) => {
        nodes.forEach(node => {
          if (node.children && matchesFilter(node, filterText)) {
            newExpanded.add(node.id);
            expandMatching(node.children);
          }
        });
      };
      expandMatching(activeBook.rootNodes);
      setExpandedNodes(prev => new Set([...prev, ...newExpanded]));
    }
  }, [filterText, activeBook, matchesFilter]);

  const compiledStructure = useMemo(() => {
    const lines: { name: string, level: number }[] = [];
    const selected = currentBookState.selectedIds;
    const order = currentBookState.selectionOrder;

    const findNodeById = (nodes: ChartNode[], id: string): ChartNode | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) {
          const found = findNodeById(n.children, id);
          if (found) return found;
        }
      }
      return undefined;
    };

    const getSelectedFromSubtree = (parentId: string): string[] => {
      const findInNode = (node: ChartNode): string[] => {
        if (!node.children || node.children.length === 0) {
          return selected.has(node.id) ? [node.id] : [];
        }
        return node.children.flatMap(findInNode);
      };

      const root = findNodeById(activeBook.rootNodes, parentId);
      if (!root) return [];
      const ids = findInNode(root);
      return order.filter(id => ids.includes(id));
    };

    const getAccountName = (id: string): string => {
      const node = findNodeById(activeBook.rootNodes, id);
      return node ? node.name : id;
    };

    const injectSubgroup = (parentId: string, label: string, level: number) => {
      const accounts = getSelectedFromSubtree(parentId);
      if (accounts.length > 0) {
        lines.push({ name: label, level: level });
        accounts.forEach(id => lines.push({ name: getAccountName(id), level: level + 1 }));
      }
    };

    const injectDirectAccounts = (parentId: string, level: number) => {
      getSelectedFromSubtree(parentId).forEach(id => lines.push({ name: getAccountName(id), level }));
    };

    activeBook.obligatoryRules.forEach(rule => {
      lines.push({ name: rule, level: 0 });
      const lastLine = lines.length > 1 ? lines[lines.length - 2].name : '';

      if (activeBook.id === 'BG_GUA') {
        if (rule === 'NO CORRIENTE' && lastLine === 'ACTIVO') {
          injectDirectAccounts('bg_ppe', 1);
          injectDirectAccounts('bg_ilp', 1);
          injectDirectAccounts('bg_int', 1);
          injectDirectAccounts('bg_oanc', 1);
        } else if (rule === 'CORRIENTE' && lines.some(l => l.name === 'ACTIVO') && !lines.some(l => l.name === 'PASIVO')) {
          injectDirectAccounts('bg_inv', 1);
          injectDirectAccounts('bg_it', 1);
          injectDirectAccounts('bg_cxc', 1);
          injectDirectAccounts('bg_ad', 1);
          injectDirectAccounts('bg_eye', 1);
        } else if (rule === 'NO CORRIENTE' && lines.some(l => l.name === 'PASIVO')) {
          injectDirectAccounts('bg_dlp', 1);
          injectDirectAccounts('bg_plp', 1);
        } else if (rule === 'CORRIENTE' && lines.some(l => l.name === 'PASIVO')) {
          injectDirectAccounts('bg_of', 1);
          injectDirectAccounts('bg_cxpc', 1);
          injectDirectAccounts('bg_ipp', 1);
          injectDirectAccounts('bg_ol', 1);
          injectDirectAccounts('bg_oo', 1);
          injectDirectAccounts('bg_idif', 1);
        } else if (rule === 'PATRIMONIO NETO') {
          injectDirectAccounts('bg_pat', 1);
        }
      }
      else if (activeBook.id === 'CP_GUA') {
        if (rule === 'MOVIMIENTO DE MATERIA PRIMA') {
          injectDirectAccounts('cp_mpc', 1);
        } else if (rule === 'Costo Primo') {
          injectDirectAccounts('cp_cpri', 1);
        } else if (rule === 'GASTOS DE FABRICACIÓN') {
          injectDirectAccounts('cp_gf', 1);
        } else if (rule === 'Costo de Producción') {
          injectDirectAccounts('cp_pep', 1);
        }
      }
      else if (activeBook.id === 'ER_GUA') {
        if (rule === 'INGRESO DE OPERACIONES') {
          injectDirectAccounts('er_iop', 1);
        } else if (rule === 'COSTO DE VENTA') {
          injectDirectAccounts('er_cdv', 1);
        } else if (rule === 'GASTO DE OPERACIÓN') {
          injectSubgroup('er_gv_g', 'GASTOS DE VENTAS', 1);
          injectSubgroup('er_ga_g', 'GASTOS DE ADMINISTRACIÓN', 1);
        } else if (rule === 'Resultado de Operación Positivo') {
          injectSubgroup('er_oi_g', 'OTROS INGRESOS', 1);
          injectSubgroup('er_og_g', 'OTROS GASTOS', 1);
          injectDirectAccounts('er_isr_g', 1);
        } else if (rule === 'GASTOS FINANCIEROS') {
          injectDirectAccounts('er_gf_g', 1);
        } else if (rule === 'DIFERENCIA POSITIVA') {
          injectDirectAccounts('er_dp_g', 1);
        }
      }
    });
    return lines;
  }, [activeBook, currentBookState]);

  const copyToExcelFormat = () => {
    const text = compiledStructure.map(l => "    ".repeat(l.level) + l.name).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const renderNodesRecursive = useCallback((nodes: ChartNode[], depth = 0): React.ReactNode => {
    return nodes.map(node => (
      <React.Fragment key={node.id}>
        <TreeNode
          node={node}
          depth={depth}
          isExpanded={expandedNodes.has(node.id)}
          isSelected={currentBookState.selectedIds.has(node.id)}
          onToggleExpand={toggleExpand}
          onToggleSelect={handleToggleNode}
          filterText={filterText}
          matchesFilter={matchesFilter}
        />
        {expandedNodes.has(node.id) && node.children && renderNodesRecursive(node.children, depth + 1)}
      </React.Fragment>
    ));
  }, [expandedNodes, currentBookState, toggleExpand, handleToggleNode, filterText, matchesFilter]);

  return (
    <div className="flex flex-col md:flex-row h-full gap-4 overflow-hidden animate-in fade-in duration-500">
      {/* Sidebar: Navigation */}
      <div className="w-full md:w-64 bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 rounded-sm flex flex-col shrink-0 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-obsidian/10 dark:border-white/10 bg-obsidian/5 dark:bg-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Book className="w-4 h-4 text-denim" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-obsidian/60 dark:text-seashell/60">Libros Contables</h3>
          </div>
          <div className="space-y-1">
            {ALL_STRUCTURES.map(str => (
              <button
                key={str.id}
                onClick={() => setActiveBookId(str.id)}
                className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all border-l-2
                  ${activeBookId === str.id ? 'bg-denim text-white border-l-obsidian shadow-md' : 'text-obsidian/60 dark:text-seashell/60 hover:bg-denim/10 border-l-transparent'}`}
              >
                {str.title}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto min-h-0 bg-seashell/10 dark:bg-transparent">
          <h4 className="text-[9px] font-bold text-obsidian/40 uppercase mb-3 tracking-widest border-b border-obsidian/5 pb-1 flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" />
            Estructura Obligatoria
          </h4>
          <div className="space-y-1">
            {activeBook.obligatoryRules.map((rule, idx) => (
              <div key={idx} className="text-[9px] text-obsidian/50 dark:text-seashell/50 font-medium bg-white dark:bg-white/5 p-1.5 rounded-sm border border-obsidian/5 uppercase tracking-tighter">
                {rule}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Area: Tree with Refined Header */}
      <div className="flex-1 bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 rounded-sm flex flex-col shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-obsidian/10 dark:border-white/10 flex items-center justify-between bg-white dark:bg-obsidian shrink-0 gap-4">

          {/* Static Title Container - Prevents Search Bar Shifting */}
          <div className="flex items-center gap-3 min-w-[280px]">
            <Hash className="w-4 h-4 text-denim shrink-0" />
            <h2 className="text-xs font-black uppercase tracking-wider text-obsidian dark:text-seashell truncate">
              {activeBook.title}
            </h2>
          </div>

          {/* Centered Stable Search Bar */}
          <div className="flex-1 flex justify-center max-w-lg">
            <div className="relative w-full max-w-xs group">
              <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-obsidian/30 dark:text-seashell/30 group-focus-within:text-denim transition-colors" />
              <input
                type="text"
                placeholder="Buscar cuenta inteligente..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-seashell/50 dark:bg-white/5 border border-obsidian/10 dark:border-white/10 rounded-sm text-[10px] focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim/20 shadow-inner transition-all placeholder:text-obsidian/30 dark:placeholder:text-seashell/20"
              />
            </div>
          </div>

          {/* Actions Container - Visible and Stable */}
          <div className="flex items-center justify-end min-w-[100px]">
            <button
              onClick={resetBookSelections}
              className="flex items-center gap-1.5 px-3 py-1.5 text-obsidian/50 dark:text-seashell/70 hover:text-red-600 dark:hover:text-red-400 transition-colors text-[9px] font-black uppercase tracking-widest bg-obsidian/5 dark:bg-white/5 rounded-sm active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-seashell/[0.2] dark:bg-white/[0.01]">
          {renderNodesRecursive(activeBook.rootNodes)}
        </div>
      </div>

      {/* Right Sidebar: Preview & Clipboard */}
      <div className="hidden xl:flex w-96 bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 rounded-sm flex flex-col shrink-0 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-950/5 dark:bg-white/5 border-b border-obsidian/10 dark:border-white/10 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 dark:text-seashell uppercase tracking-tight">
            Estructura Compilada
          </h3>
          <span className="text-[9px] font-mono font-bold text-denim px-1.5 bg-denim/10 rounded-full">
            {currentBookState.selectedIds.size} opcionales
          </span>
        </div>

        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">VISTA PREVIA DE ESTRUCTURA</h4>
          </div>

          <div className="bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 rounded-md p-4 flex-1 overflow-y-auto shadow-inner">
            <div className="space-y-1 font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              {compiledStructure.map((line, idx) => (
                <div key={idx} className="uppercase py-0.5 whitespace-pre" style={{ paddingLeft: `${line.level * 16}px` }}>
                  {line.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-obsidian/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
          <button
            onClick={copyToExcelFormat}
            className={`w-full flex items-center justify-center gap-2 py-3 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm transition-all shadow-lg active:scale-95
               ${copied ? 'bg-emerald-600' : 'bg-denim hover:bg-denim/90'}`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? '¡Copiado!' : 'Copiar formato Excel'}
          </button>
          <p className="text-[9px] text-center mt-3 text-obsidian/40 uppercase font-bold tracking-tighter">
            Copiado con espacios para preservar la sangría en una sola columna de Excel
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChartSelector;