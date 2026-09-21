import { ChartNode, FinancialStructure } from '../types';

export function compileChartStructure(activeBook: FinancialStructure, selectedIds: Set<string>) {
    const lines: { name: string, level: number }[] = [];
    const selected = selectedIds;

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

    const containsSelection = (node: ChartNode): boolean =>
      selected.has(node.id) || !!node.children?.some(containsSelection);

    const appendNode = (node: ChartNode, level: number) => {
      if (!containsSelection(node)) return;
      lines.push({ name: node.name, level });
      node.children?.forEach(child => appendNode(child, level + 1));
    };

    const injectSubgroup = (parentId: string, label: string, level: number) => {
      const node = findNodeById(activeBook.rootNodes, parentId);
      if (node && containsSelection(node)) {
        lines.push({ name: label, level });
        node.children?.forEach(child => appendNode(child, level + 1));
      }
    };

    const injectDirectAccounts = (parentId: string, level: number) => {
      const node = findNodeById(activeBook.rootNodes, parentId);
      if (!node) return;
      const adjustment = parentId === 'bg_ppe'
        ? { id: 'bg_dep_ac', name: 'Depreciación acumulada' }
        : parentId === 'bg_int'
          ? { id: 'bg_ama', name: 'Amortización acumulada' }
          : null;
      if (adjustment) {
        node.children?.forEach(asset => {
          if (asset.id === adjustment.id || !containsSelection(asset)) return;
          appendNode(asset, level);
          if (selected.has(adjustment.id)) {
            lines.push({ name: `(-) ${adjustment.name} de ${asset.name}`, level: level + 1 });
          }
        });
        return;
      }
      if (node.level === 'ACCOUNT') appendNode(node, level);
      else node.children?.forEach(child => appendNode(child, level));
    };

    activeBook.obligatoryRules.forEach(rule => {
      if (rule === 'Materia Prima, Inventario Inicial' && selected.has('cp_mp_ii')) return;
      if (rule === 'Costo de Producción' && activeBook.id === 'CP_GUA') injectSubgroup('cp_pep', 'PRODUCTOS EN PROCESO', 0);
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
        } else if (rule === 'Diferencia Positiva') {
          injectDirectAccounts('er_dp_g', 1);
        }
      }
    });
    return lines;
}
