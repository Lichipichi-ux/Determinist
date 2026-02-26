import * as XLSX from 'xlsx';
import { JournalEntry, ParseResult, ProcessingError } from '../types';
import { HEADER_CANDIDATES } from '../utils/constants';
import { filterGlosaEntries } from './watchdog';
import { UserMode } from '../types';

// Internal types for the parser state machine
interface ParserState {
  currentPartidaId: string | null;
  currentDate: string | null;
  bufferLines: PartialEntry[];
  bufferGlosa: string[];
}

interface PartialEntry {
  lineNum: number;
  accountName: string;
  accountCode: string; // If not present, defaults to name
  debit: number;
  credit: number;
}

interface ColumnMapping {
  date: number;
  debit: number;
  credit: number;
  concept: number;
  code: number | -1;
}

/**
 * Helper: Identify column indices from a header row
 */
const mapColumns = (headers: any[]): ColumnMapping | null => {
  // Safe map: Handle holes in sparse arrays
  const lowerHeaders = Array.from(headers || []).map(h =>
    (h === undefined || h === null) ? '' : String(h).toLowerCase().trim()
  );

  const findIndex = (candidates: string[]) => lowerHeaders.findIndex(h =>
    h && candidates.some(c => h.includes(c))
  );

  const date = findIndex(HEADER_CANDIDATES.DATE);
  const debit = findIndex(HEADER_CANDIDATES.DEBIT);
  const credit = findIndex(HEADER_CANDIDATES.CREDIT);
  const concept = findIndex(HEADER_CANDIDATES.CONCEPT);
  const code = findIndex(HEADER_CANDIDATES.CODE);

  // Critical columns must exist
  if (date === -1 || debit === -1 || credit === -1 || concept === -1) {
    return null;
  }

  return { date, debit, credit, concept, code };
};

/**
 * Helper: Parse Excel Date
 */
const parseExcelDate = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial date
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    return dateObj.toISOString().split('T')[0];
  }
  const strVal = String(val).trim();
  // Simple check for YYYY-MM-DD or DD/MM/YYYY could be added here if needed
  // For now, return string as is if not number, assuming ISO or consistent format
  return strVal;
};

/**
 * Helper: Remove empty rows from the start of the dataset
 */
const trimEmptyRows = (data: any[][]): any[][] => {
  let startIndex = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    // Check if row has any non-empty cell
    const hasContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    if (hasContent) {
      startIndex = i;
      break;
    }
  }
  return data.slice(startIndex);
};

/**
 * Helper: Infer columns if no headers are found (Fallback Strategy)
 */
const inferColumns = (data: any[][]): ColumnMapping | null => {
  // We need at least a few rows to guess
  if (data.length < 2) return null;

  // Statistics per column
  const colStats = new Map<number, { numbers: number; text: number }>();

  // Sample first 50 rows
  const sample = data.slice(0, 50);

  // Safely determine max column index
  const maxColIndex = sample.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);

  for (let c = 0; c < maxColIndex; c++) {
    colStats.set(c, { numbers: 0, text: 0 });
  }

  sample.forEach(row => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, idx) => {
      if (!cell) return;

      const stats = colStats.get(idx);
      if (!stats) return; // Prevention of crash

      const str = String(cell).trim();
      if (!str) return;

      const val = parseFloat(str.replace(/[^0-9.-]/g, ''));
      if (!isNaN(val) && /[0-9]/.test(str)) {
        stats.numbers++;
      } else {
        stats.text++;
      }
    });
  });

  // Identify Debit/Credit: The two columns with the most numbers
  const sortedByNumbers = Array.from(colStats.entries())
    .sort((a, b) => b[1].numbers - a[1].numbers);

  // Identify Concept: The column with the most text
  const sortedByText = Array.from(colStats.entries())
    .sort((a, b) => b[1].text - a[1].text);

  if (sortedByNumbers.length < 2 || sortedByText.length < 1) return null;

  const concept = sortedByText[0][0];

  // Refined Logic:
  // Filter numeric columns that are likely Account Codes (Left of Concept) vs Money (Right of Concept)
  const numericColumns = sortedByNumbers.map(n => n[0]);

  // Prefer money columns to be to the right of the concept
  const candidatesRightOfConcept = numericColumns.filter(colIdx => colIdx > concept);

  let debit, credit;

  if (candidatesRightOfConcept.length >= 2) {
    // Sort indices ascending (Debit usually left of Credit)
    candidatesRightOfConcept.sort((a, b) => a - b);
    debit = candidatesRightOfConcept[0];
    credit = candidatesRightOfConcept[1];
  } else {
    // Fallback: Take top 2 numeric columns regardless of position
    // This handles cases where Code might be alphanumeric (text) or concept is rightmost
    const amountCols = [numericColumns[0], numericColumns[1]].sort((a, b) => a - b);
    debit = amountCols[0];
    credit = amountCols[1];
  }

  // Prevent Concept from being overwritten if it was mistakenly identified as numeric
  if (debit === concept || credit === concept) {
    // If conflict, assume standard layout A=Code, B=Concept, C=Debit, D=Credit
    if (concept === 1) {
      return { date: -1, debit: 2, credit: 3, concept: 1, code: 0 };
    }
  }

  // If we found candidates
  if (debit !== undefined && credit !== undefined && concept !== undefined) {
    console.log('Inferred Columns:', { debit, credit, concept });
    return { date: -1, debit, credit, concept, code: -1 };
  }

  return null;
};

/**
 * Main Logic: Block-based Parser
 */
const processSheet = (data: any[][], mode: UserMode): ParseResult => {
  const errors: ProcessingError[] = [];
  const entries: JournalEntry[] = [];

  // 1. Find Header Row
  let headerRowIndex = -1;
  let mapping: ColumnMapping | null = null;

  if (mode === 'Bancaria') {
    // Modo Bancaria: Formato estricto (A=Partida, B=Fecha, C=Código, D=Nombre, E=Debe, F=Haber)
    mapping = { date: 1, code: 2, concept: 3, debit: 4, credit: 5 };
    // Intentar encontrar si hay fila de encabezado revisando primeras filas
    for (let i = 0; i < Math.min(data.length, 5); i++) {
      const row = data[i];
      if (!row) continue;
      const map = mapColumns(row);
      if (map && map.date !== -1 && map.debit !== -1) {
        headerRowIndex = i;
        break;
      }
    }
  } else {
    // Search logic for headers (Práctica)
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i];
      if (!row) continue;
      const map = mapColumns(row);
      if (map) {
        let matchCount = 0;
        if (map.date !== -1) matchCount++;
        if (map.debit !== -1) matchCount++;
        if (map.credit !== -1) matchCount++;
        if (map.concept !== -1) matchCount++;

        if (matchCount >= 3) {
          headerRowIndex = i;
          mapping = map;
          break;
        }
      }
    }
  }

  if (!mapping) {
    // Attempt fallback inference
    mapping = inferColumns(data);

    if (!mapping) {
      return {
        success: false,
        errors: [{
          line: 0,
          message: 'No se identificó la estructura del Libro Diario. Asegúrese de tener columnas de texto y numéricas claras.',
          type: 'STRUCTURAL'
        }]
      };
    }
  }

  // 2. Initialize State Machine
  const state: ParserState = {
    currentPartidaId: null,
    currentDate: null,
    bufferLines: [],
    bufferGlosa: []
  };

  // Helper to flush buffer to final entries
  const flushBuffer = () => {
    if (state.bufferLines.length > 0 && state.currentPartidaId) {
      const fullDescription = state.bufferGlosa.join(' ').trim();

      state.bufferLines.forEach(line => {
        entries.push({
          id: crypto.randomUUID(),
          date: state.currentDate || 'Sin Fecha',
          accountCode: line.accountCode,
          accountName: line.accountName,
          debit: line.debit,
          credit: line.credit,
          description: fullDescription || `Asiento ${state.currentPartidaId}`, // Fallback description
          entryId: state.currentPartidaId!,
          originalLine: line.lineNum
        });
      });
    }
    // Reset buffer
    state.bufferLines = [];
    state.bufferGlosa = [];
  };

  // 3. Iterate Rows
  // If header found, start after it. If inferred, start from 0 because there are no headers.
  const startIndex = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;

  for (let i = startIndex; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const lineNum = i + 1; // 1-based index

    // Extract raw values
    const rawConcept = mapping.concept !== -1 ? row[mapping.concept] : undefined;
    const rawDebit = mapping.debit !== -1 ? row[mapping.debit] : undefined;
    const rawCredit = mapping.credit !== -1 ? row[mapping.credit] : undefined;
    const rawCode = mapping.code !== -1 ? row[mapping.code] : undefined;
    const rawDate = mapping.date !== -1 ? row[mapping.date] : undefined;

    const conceptStr = String(rawConcept || '').trim();
    // Normalize amounts: remove currency symbols, spaces, keep dots and numbers/minuses
    const parseAmount = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      return parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    };

    const debitVal = parseAmount(rawDebit);
    const creditVal = parseAmount(rawCredit);

    const debit = isNaN(debitVal) ? 0 : debitVal;
    const credit = isNaN(creditVal) ? 0 : creditVal;

    // Check if this row has financial data (Amount)
    const hasAmount = Math.abs(debit) > 0.0001 || Math.abs(credit) > 0.0001;

    // --- DETECTOR LOGIC ---

    // A. DETECT PARTIDA START
    let partidaMatch: RegExpMatchArray | null = null;
    if (mode === 'Bancaria') {
      // En Bancaria, la partida está en la columna A
      const cellVal = String(row[0] || '').trim();
      const match = cellVal.match(/^(?:Partida|Asiento|p\.?)\s*([a-zA-Z0-9\.-]+)/i);
      if (match) partidaMatch = match;
    } else {
      // Scan first 5 columns for "Partida/p.X" marker.
      for (let c = 0; c < Math.min(row.length, 5); c++) {
        const cellVal = String(row[c] || '').trim();
        const match = cellVal.match(/^(?:Partida|Asiento|p\.?)\s*([a-zA-Z0-9\.-]+)/i);
        if (match) {
          partidaMatch = match;
          break;
        }
      }
    }

    if (partidaMatch) {
      // Flush previous block
      flushBuffer();

      // Start new block
      state.currentPartidaId = `Partida ${partidaMatch[1]}`;

      // Update Date if present
      const rowDate = parseExcelDate(rawDate);
      if (rowDate) {
        state.currentDate = rowDate;
      }

      // If the header row also contains account data (hasAmount), we fall through to process it.
      // Otherwise, we skip it to avoid adding the header text as a Glosa/Account.
      if (!hasAmount) {
        continue;
      }
    }

    // B. DETECT CONTROL TOTALS / GLOSAS (Ticket C-6)
    // If a row has amounts in BOTH Debit and Credit, and they are equal, it is a summary line (not an account).
    // User Requirement: "Si tiene el mismo monto en el debe y el haber, no es cuenta".
    if (debit > 0 && credit > 0 && Math.abs(debit - credit) < 0.1) {
      continue;
    }

    // C. DETECT ACCOUNT LINE

    if (hasAmount) {
      let cleanName = conceptStr.replace(/^[aA]:\s*/, '').trim();

      let code = cleanName;
      if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
        code = String(rawCode).trim();
      }

      // If name is empty but has amount, might be data issue, but we'll take it if we have a code
      if (!cleanName && !rawCode) continue;

      // ORPHAN DATA GUARD: If we find an account but haven't seen a "Partida" header yet,
      // assume this is Partida 1.
      if (!state.currentPartidaId) {
        state.currentPartidaId = "Partida 1";
      }

      state.bufferLines.push({
        lineNum,
        accountName: cleanName || 'Sin Cuenta',
        accountCode: code,
        debit,
        credit
      });
      continue;
    }

    // D. DETECT GLOSA LINE
    // No amounts, has text
    if (!hasAmount && conceptStr.length > 0) {
      // En modo bancario, si tiene código explícito pero no tiene montos, 
      // es una cuenta estructural padre. No es una glosa. Se ignora.
      if (mode === 'Bancaria' && rawCode && String(rawCode).trim() !== '') {
        continue;
      }
      state.bufferGlosa.push(conceptStr);
    }
  }

  flushBuffer();

  if (errors.length > 0 && mode === 'Bancaria') {
    return { success: false, errors };
  }

  if (entries.length === 0) {
    return {
      success: false,
      errors: [{
        line: 0,
        message: 'No se encontraron asientos contables. Verifique que use "Partida X" o "p.X" para iniciar bloques.',
        type: 'FORMAT'
      }]
    };
  }

  return { success: true, data: entries };
};

export const parseFile = async (file: File, mode: UserMode): Promise<ParseResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Parse to Array of Arrays (AOA)
        let aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (!aoa || aoa.length === 0) {
          resolve({
            success: false,
            errors: [{ line: 0, message: 'El archivo está vacío.', type: 'STRUCTURAL' }]
          });
          return;
        }

        // Pre-process: Strip leading empty rows (Ticket: "start reading from where letters begin")
        aoa = trimEmptyRows(aoa);

        if (aoa.length === 0) {
          resolve({
            success: false,
            errors: [{ line: 0, message: 'El archivo no contiene datos legibles.', type: 'STRUCTURAL' }]
          });
          return;
        }

        const result = processSheet(aoa, mode);

        // ═══ WATCHDOG: Primary interception point ═══
        // Filter out entries whose accountName matches a glosa pattern.
        // These are narrative descriptions, NOT accounting accounts.
        if (result.success) {
          const { clean } = filterGlosaEntries(result.data);
          resolve({ success: true, data: clean });
        } else {
          resolve(result);
        }

      } catch (error: any) {
        console.error(error);
        resolve({
          success: false,
          errors: [{
            line: 0,
            message: `Error crítico al leer el archivo: ${error instanceof Error ? error.message : String(error)}`,
            type: 'FORMAT'
          }]
        });
      }
    };

    reader.readAsBinaryString(file);
  });
};
