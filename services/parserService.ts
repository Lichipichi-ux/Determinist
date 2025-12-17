import * as XLSX from 'xlsx';
import { JournalEntry, ParseResult, ProcessingError } from '../types';
import { HEADER_CANDIDATES } from '../utils/constants';

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
  const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());

  const findIndex = (candidates: string[]) => lowerHeaders.findIndex(h => candidates.some(c => h.includes(c)));

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
 * Main Logic: Block-based Parser
 */
const processSheet = (data: any[][]): ParseResult => {
  const errors: ProcessingError[] = [];
  const entries: JournalEntry[] = [];

  // 1. Find Header Row
  let headerRowIndex = -1;
  let mapping: ColumnMapping | null = null;

  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    const map = mapColumns(row);
    if (map) {
      headerRowIndex = i;
      mapping = map;
      break;
    }
  }

  if (!mapping) {
    return {
      success: false,
      errors: [{ 
        line: 0, 
        message: 'No se identificó la estructura del Libro Diario (buscando columnas: Fecha, Concepto, Debe, Haber).', 
        type: 'STRUCTURAL' 
      }]
    };
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
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    const lineNum = i + 1; // 1-based index

    // Extract raw values
    const rawDate = row[mapping.date];
    const rawConcept = row[mapping.concept];
    const rawDebit = row[mapping.debit];
    const rawCredit = row[mapping.credit];
    const rawCode = mapping.code !== -1 ? row[mapping.code] : undefined;

    const conceptStr = String(rawConcept || '').trim();
    const debitVal = typeof rawDebit === 'number' ? rawDebit : parseFloat(String(rawDebit || '0').replace(/[^0-9.-]/g, ''));
    const creditVal = typeof rawCredit === 'number' ? rawCredit : parseFloat(String(rawCredit || '0').replace(/[^0-9.-]/g, ''));
    
    const debit = isNaN(debitVal) ? 0 : debitVal;
    const credit = isNaN(creditVal) ? 0 : creditVal;

    // --- DETECTOR LOGIC ---

    // A. DETECT PARTIDA START (Ticket C-1, C-2)
    // Matches "Partida 1", "Partida n", "Partida Inicial"
    const partidaMatch = conceptStr.match(/^Partida\s+([a-zA-Z0-9]+)/i);
    
    if (partidaMatch) {
      // Flush previous block
      flushBuffer();

      // Start new block
      state.currentPartidaId = `Partida ${partidaMatch[1]}`; // e.g. "Partida 1"
      
      // Update Date if present, otherwise keep previous (though usually Partida header has date)
      const rowDate = parseExcelDate(rawDate);
      if (rowDate) {
        state.currentDate = rowDate;
      }
      
      continue; // Done with this row
    }

    // B. DETECT CONTROL TOTALS (Ticket C-6)
    // If Debe == Haber and both > 0, ignore row.
    // Also ignore if text starts with "Por" or similar summary, but exact amount match is strongest signal.
    if (debit > 0 && credit > 0 && Math.abs(debit - credit) < 0.01) {
      continue;
    }

    // C. DETECT ACCOUNT LINE (Ticket C-3)
    // Has Debit OR Credit (and not a total row)
    const hasAmount = debit !== 0 || credit !== 0;
    
    if (hasAmount) {
      // Ticket C-3: Clean name ("A: Proveedores" -> "Proveedores")
      let cleanName = conceptStr.replace(/^[aA]:\s*/, '').trim();
      
      // Ticket C-4: Code is optional
      let code = cleanName; // Default code is name
      if (rawCode) {
        code = String(rawCode).trim();
      }

      // Add to buffer
      state.bufferLines.push({
        lineNum,
        accountName: cleanName,
        accountCode: code,
        debit,
        credit
      });
      continue;
    }

    // D. DETECT GLOSA LINE (Ticket C-5)
    // No amounts, has text, not a Partida header (handled in A)
    // We also ignore empty concept lines
    if (!hasAmount && conceptStr.length > 0) {
      // It's part of the description
      state.bufferGlosa.push(conceptStr);
    }
  }

  // End of file: flush last buffer
  flushBuffer();

  if (entries.length === 0) {
    return {
      success: false,
      errors: [{ 
        line: 0, 
        message: 'No se encontraron asientos contables. Verifique que use "Partida X" para iniciar bloques.', 
        type: 'FORMAT' 
      }]
    };
  }

  return { success: true, data: entries };
};

export const parseFile = async (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse to Array of Arrays (AOA) to handle structure manually (Ticket C-7)
        const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (!aoa || aoa.length === 0) {
           resolve({ 
             success: false, 
             errors: [{ line: 0, message: 'El archivo está vacío.', type: 'STRUCTURAL' }] 
           });
           return;
        }

        const result = processSheet(aoa);
        resolve(result);

      } catch (error) {
        console.error(error);
        resolve({
          success: false,
          errors: [{ line: 0, message: 'Error crítico al leer el archivo Excel/CSV.', type: 'FORMAT' }]
        });
      }
    };

    reader.readAsBinaryString(file);
  });
};
