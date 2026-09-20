import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { ChevronRight, ChevronDown, Hash, Copy, RotateCcw, Search, Book, ShieldCheck, FileSpreadsheet, Check } from 'lucide-react';
import { ChartNode, ChartSelectionState } from '../types';
import { compileChartStructure } from '../utils/compileChartStructure';
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
        data-chart-node={node.id}
        tabIndex={0}
        role="treeitem"
        aria-label={node.name}
        aria-level={depth + 1}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={node.level === 'ACCOUNT' ? isSelected : undefined}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (node.level === 'ACCOUNT') onToggleSelect(node);
            else onToggleExpand(node.id);
          } else if (hasChildren && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
            e.preventDefault();
            if ((e.key === 'ArrowRight') !== isExpanded) onToggleExpand(node.id);
          }
        }}
        onClick={handleClick}
        className={`flex items-center py-1.5 px-3 border-b border-obsidian/5  cursor-pointer transition-all duration-75 group
          ${isSelected ? 'bg-denim/10 ' : 'hover:bg-denim/[0.04] '}
          ${node.level === 'GROUP' ? 'bg-obsidian/[0.02] ' : ''}
          active:bg-denim/25
        `}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {/* Expand Icon Area */}
        <div className="w-5 shrink-0 flex items-center justify-center mr-1">
          {hasChildren && (
            <div className={`transition-colors ${isExpanded ? 'text-denim' : 'text-obsidian/40 '}`}>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>
          )}
        </div>

        {/* Small Checkbox Area - High Fidelity Accounting UI */}
        <div className="w-6 shrink-0 flex items-center justify-center mr-2">
          {node.level === 'ACCOUNT' && (
            <input type="checkbox" aria-label={node.name} checked={isSelected}
              onClick={e => e.stopPropagation()} onChange={() => onToggleSelect(node)}
              className="w-3.5 h-3.5 accent-[#c6a23b]" />
          )}
        </div>

        {/* Text Content */}
        <div className="flex-1 flex items-baseline gap-2 overflow-hidden">
          <span className={`text-[10.5px] truncate uppercase tracking-tight transition-colors
            ${node.level === 'GROUP' ? 'font-bold text-obsidian ' : ''}
            ${node.level === 'SUBGROUP' ? 'font-semibold text-obsidian/80 ' : ''}
            ${isSelected ? 'text-denim font-black' : 'text-obsidian/70 '}
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
  const treeRef = useRef<HTMLDivElement>(null);
  const navigateTree = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const rows = Array.from(treeRef.current?.querySelectorAll<HTMLElement>('[data-chart-node]') ?? []);
    if (!rows.length) return;
    event.preventDefault();
    const index = rows.findIndex(row => row.contains(document.activeElement));
    const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : rows.length - 1)
      : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    rows[next].focus({ preventScroll: true });
    rows[next].scrollIntoView({ block: 'nearest' });
  };
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
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const lowerText = normalize(text);
    const selfMatches = normalize(node.name).includes(lowerText) ||
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
    return compileChartStructure(activeBook, currentBookState.selectedIds);
  }, [activeBook, currentBookState]);

  const copyToExcelFormat = () => {
    const text = compiledStructure.map(l => "    ".repeat(l.level) + l.name).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const renderNodesRecursive = useCallback((nodes: ChartNode[], depth = 0, inheritedMatch = false): React.ReactNode => {
    return nodes.filter(node => inheritedMatch || matchesFilter(node, filterText)).map(node => (
      <React.Fragment key={node.id}>
        <TreeNode
          node={node}
          depth={depth}
          isExpanded={expandedNodes.has(node.id)}
          isSelected={currentBookState.selectedIds.has(node.id)}
          onToggleExpand={toggleExpand}
          onToggleSelect={handleToggleNode}
          filterText={inheritedMatch ? '' : filterText}
          matchesFilter={matchesFilter}
        />
        {expandedNodes.has(node.id) && node.children && renderNodesRecursive(node.children, depth + 1, inheritedMatch || (!!filterText && node.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(filterText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())))}
      </React.Fragment>
    ));
  }, [expandedNodes, currentBookState, toggleExpand, handleToggleNode, filterText, matchesFilter]);

  return (
    <div className="sap-chart-layout flex flex-col md:flex-row h-full gap-2 md:gap-4 overflow-hidden animate-in fade-in duration-500">
      {/* Sidebar: Navigation - Mobile optimized */}
      <div className="w-full md:w-64 bg-white  border border-obsidian/10  rounded-sm flex flex-col shrink-0 shadow-sm overflow-hidden h-auto md:h-full">
        <div className="p-2 md:p-3 border-b border-obsidian/10  bg-obsidian/5 ">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Book className="w-4 h-4 text-denim" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-obsidian/60 ">Libros Contables</h3>
          </div>
          <div className="space-y-1">
            {ALL_STRUCTURES.map(str => (
              <button
                key={str.id}
                onClick={() => setActiveBookId(str.id)}
                className={`w-full text-left px-3 py-2.5 md:py-2 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all border-l-2 min-h-[44px] md:min-h-0
                  ${activeBookId === str.id ? 'bg-denim text-white border-l-obsidian shadow-md' : 'text-obsidian/60  hover:bg-denim/10 border-l-transparent'}`}
              >
                {str.title}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 md:p-4 flex-1 overflow-y-auto min-h-0 bg-seashell/10  max-h-[200px] md:max-h-none">
          <h4 className="text-[9px] font-bold text-obsidian/40 uppercase mb-2 md:mb-3 tracking-widest border-b border-obsidian/5 pb-1 flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" />
            Estructura Obligatoria
          </h4>
          <div className="space-y-1">
            {activeBook.obligatoryRules.map((rule, idx) => (
              <div key={idx} className="text-[9px] text-obsidian/50  font-medium bg-white  p-1.5 rounded-sm border border-obsidian/5 uppercase tracking-tighter">
                {rule}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Area: Tree with Refined Header - Mobile optimized */}
      <div className="flex-1 bg-white  border border-obsidian/10  rounded-sm flex flex-col shadow-sm overflow-hidden">
        <div className="px-3 py-2 md:px-4 md:py-3 border-b border-obsidian/10  flex flex-col md:flex-row md:items-center justify-between bg-white  shrink-0 gap-2 md:gap-4">

          {/* Static Title Container */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0 md:min-w-[280px]">
            <Hash className="w-4 h-4 text-denim shrink-0" />
            <h2 className="text-xs md:text-xs font-black uppercase tracking-wider text-obsidian  truncate">
              {activeBook.title}
            </h2>
          </div>

          {/* Centered Stable Search Bar */}
          <div className="flex-1 flex justify-center max-w-lg">
            <div className="relative w-full max-w-xs group">
              <Search className="absolute left-2.5 top-2 md:top-1.5 w-3.5 h-3.5 text-obsidian/30  group-focus-within:text-denim transition-colors" />
              <input
                type="text"
                placeholder="Buscar cuenta..."
                onKeyDown={navigateTree}
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="w-full pl-8 pr-2 py-2 md:py-1.5 bg-seashell/50  border border-obsidian/10  rounded-sm text-sm md:text-[10px] focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim/20 shadow-inner transition-all placeholder:text-obsidian/30 "
              />
            </div>
          </div>

          {/* Actions Container */}
          <div className="flex items-center justify-end min-w-[100px]">
            <button className="px-2 py-1 text-[10px] border mr-2" onClick={() => {
              const ids: string[] = [];
              const visit = (nodes: ChartNode[]) => nodes.forEach(node => {
                if (node.level === 'ACCOUNT') ids.push(node.id);
                if (node.children) visit(node.children);
              });
              visit(activeBook.rootNodes);
              setGlobalSelection(prev => ({ ...prev, [activeBookId]: { selectedIds: new Set(ids), selectionOrder: ids } }));
            }}>Seleccionar todas</button>
            <button
              onClick={resetBookSelections}
              className="flex items-center gap-1.5 px-3 py-2 md:py-1.5 text-obsidian/50  hover:text-red-600  transition-colors text-[9px] font-black uppercase tracking-widest bg-obsidian/5  rounded-sm active:scale-95 min-h-[40px] md:min-h-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>

        <div ref={treeRef} role="tree" aria-label="Cuentas contables" onKeyDown={navigateTree} className="sap-chart-tree flex-1 overflow-y-auto bg-seashell/[0.2] ">
          {renderNodesRecursive(activeBook.rootNodes)}
        </div>
      </div>

      {/* Right Sidebar: Preview & Clipboard - Hidden on mobile/tablet */}
      <div className="sap-chart-preview flex w-96 bg-white  border border-obsidian/10  rounded-sm flex-col shrink-0 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-950/5  border-b border-obsidian/10  flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800  uppercase tracking-tight">
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

          <div className="bg-white  border border-obsidian/10  rounded-md p-4 flex-1 overflow-y-auto shadow-inner">
            <div className="space-y-1 font-mono text-[11px] leading-relaxed text-slate-700 ">
              {compiledStructure.map((line, idx) => (
                <div key={idx} className="uppercase py-0.5 whitespace-pre-wrap break-words" style={{ paddingLeft: `${line.level * 16}px` }}>
                  {line.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-obsidian/10  bg-slate-50 ">
          <button
            onClick={copyToExcelFormat}
            className={`w-full flex items-center justify-center gap-2 py-3 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm transition-all shadow-lg active:scale-95
               ${copied ? 'bg-emerald-600' : 'bg-denim hover:bg-denim/90'}`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar formato Excel'}
          </button>

        </div>
      </div>
    </div>
  );
};

export default ChartSelector;
