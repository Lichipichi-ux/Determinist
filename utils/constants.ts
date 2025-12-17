export const APP_VERSION = '1.1.0-CLASSIC';

// Guatemalan accounting display format
export const CURRENCY_FORMAT = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  minimumFractionDigits: 2
});

export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
};

// Flexible header mapping candidates (Lower case)
export const HEADER_CANDIDATES = {
  DATE: ['fecha', 'date'],
  DEBIT: ['debe', 'débito', 'debit', 'cargo'],
  CREDIT: ['haber', 'crédito', 'credit', 'abono'],
  CONCEPT: ['concepto', 'descripción', 'descripcion', 'detalle', 'nombre de cuenta', 'cuenta', 'nombre'],
  CODE: ['código', 'codigo', 'id cuenta', 'no. cuenta']
};
