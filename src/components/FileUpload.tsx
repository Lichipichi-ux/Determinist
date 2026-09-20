import React, { useCallback, useState } from 'react';
import { Upload, FileType, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseFile } from '../services/parserService';
import { ParseResult, UserMode } from '../types';

interface FileUploadProps {
  onDataLoaded: (result: ParseResult, fileName: string) => void;
  mode: UserMode;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, mode }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const processFile = async (file: File) => {
    setIsProcessing(true);

    // Ticket 0.1: Validate extension
    const validExtensions = ['.xlsx', '.csv'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validExtensions.includes(extension)) {
      onDataLoaded({
        success: false,
        errors: [{ line: 0, message: 'Formato no soportado. Use .xlsx o .csv', type: 'FORMAT' }]
      }, file.name);
      setIsProcessing(false);
      return;
    }

    // Call Parser Service
    const result = await parseFile(file, mode);

    // Simulate a small delay for better UX (perception of processing)
    setTimeout(() => {
      onDataLoaded(result, file.name);
      setIsProcessing(false);
    }, 600);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full sap-file-upload">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-sm p-4 text-center transition-all duration-200
          ${isDragging
            ? 'border-denim bg-denim/5'
            : 'border-obsidian/20  hover:border-denim hover:bg-obsidian/5 '
          }
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          type="file"
          id="fileInput"
          className="hidden"
          accept=".xlsx,.csv"
          onChange={handleInputChange}
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className={`p-2 transition-colors ${isDragging ? 'bg-denim/20' : 'bg-seashell '}`}>
            {isProcessing ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-denim"></div>
            ) : (
              <Upload className={`w-6 h-6 ${isDragging ? 'text-denim' : 'text-obsidian/40 '}`} strokeWidth={1.5} />
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-obsidian  uppercase tracking-tight">
              {isProcessing ? 'Analizando Estructura...' : 'Arrastre archivo aquí'}
            </h3>
            <p className="text-xs text-obsidian/50  mt-2 font-medium">
              Excel (.xlsx) / CSV (.csv)
            </p>
          </div>

          {!isProcessing && (
            <label
              htmlFor="fileInput"
              tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById("fileInput")?.click(); } }}
              className="sap-primary px-8 py-2.5 bg-obsidian  text-seashell  rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-denim  cursor-pointer transition-colors shadow-sm"
            >
              Examinar…
            </label>
          )}
        </div>
      </div>


    </div>
  );
};

export default FileUpload;
