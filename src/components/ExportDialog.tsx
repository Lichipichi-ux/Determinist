import React, { useEffect, useRef, useState } from 'react';
import { UserMode } from '../types';
import { ExportHeader, formatReportDate } from '../utils/ledgerWorkbook';
import { deriveExportFileName } from '../utils/exportUtils';

interface Props {
  initialHeader: ExportHeader;
  mode: UserMode;
  busy: boolean;
  onClose: () => void;
  onExport: (header: ExportHeader) => Promise<void>;
}

export default function ExportDialog({ initialHeader, mode, busy, onClose, onExport }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [heading, setHeading] = useState(initialHeader.heading);
  const [date, setDate] = useState(initialHeader.date);
  const [place, setPlace] = useState(initialHeader.place);
  let dateLabel = '';
  try { dateLabel = date ? formatReportDate(date) : ''; } catch {}
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!heading.trim()) { setError('Ingrese el encabezado del documento.'); return; }
    setError('');
    try {
      if (!place.trim()) throw new Error('Ingrese el país o lugar.');
      formatReportDate(date);
      await onExport({ heading: heading.trim(), date, place: place.trim() });
    }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo exportar.'); }
  };
  return (
    <dialog ref={dialog} className="sap-export-dialog" aria-labelledby="export-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
      <form onSubmit={submit}>
        <div className="sap-panel-title" id="export-title">Exportar a Excel</div>
        <div className="sap-export-body">
          <label htmlFor="export-heading">Encabezado del documento</label>
          <input id="export-heading" value={heading} onChange={e => setHeading(e.target.value)} maxLength={120} required autoFocus disabled={busy} placeholder="Nombre de la empresa o institución" />
          <div className="sap-export-fields">
            <label htmlFor="export-date">Fecha del documento<input id="export-date" type="date" value={date} onChange={e => setDate(e.target.value)} required disabled={busy} min="0001-01-01" max="9999-12-31" /></label>
            <label htmlFor="export-place">País o lugar<input id="export-place" value={place} onChange={e => setPlace(e.target.value)} required disabled={busy} maxLength={120} placeholder="País, ciudad o localidad" /></label>
          </div>
          <div className="sap-export-preview"><strong>{heading.trim() || 'Nombre de la empresa o institución'}</strong><span>LIBRO MAYOR / BALANCE DE COMPROBACIÓN</span><span>{[place.trim(), dateLabel].filter(Boolean).join(', ') || 'Lugar y fecha del documento'}</span><span>Cifras expresadas en quetzales</span></div>
          <dl><dt>Régimen</dt><dd>{mode === 'Bancaria' ? 'Contabilidad bancaria · con código' : 'Práctica supervisada · sin código'}</dd><dt>Archivo</dt><dd>{heading.trim() ? deriveExportFileName(heading) : 'Pendiente de encabezado'}</dd></dl>
          {error && <p className="sap-export-error" role="alert">{error}</p>}
        </div>
        <div className="sap-panel-footer"><button type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="sap-primary" type="submit" disabled={busy || !heading.trim() || !place.trim() || !dateLabel}>{busy ? 'Generando Excel…' : 'Exportar'}</button></div>
      </form>
    </dialog>
  );
}
