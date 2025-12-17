import React, { useCallback, useState } from 'react';
import { Upload, FileType, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseFile } from '../services/parserService';
import { ParseResult } from '../types';

interface FileUploadProps {
  onDataLoaded: (result: ParseResult, fileName: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
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
    const result = await parseFile(file);
    
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
    <div className="w-full max-w-xl mx-auto">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-sm p-12 text-center transition-all duration-200
          ${isDragging 
            ? 'border-denim bg-denim/5' 
            : 'border-obsidian/20 dark:border-white/20 hover:border-denim hover:bg-obsidian/5 dark:hover:bg-white/5'
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
        
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-denim/20' : 'bg-seashell dark:bg-white/5'}`}>
            {isProcessing ? (
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-denim"></div>
            ) : (
               <Upload className={`w-10 h-10 ${isDragging ? 'text-denim' : 'text-obsidian/40 dark:text-seashell/40'}`} strokeWidth={1.5} />
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-obsidian dark:text-seashell uppercase tracking-tight">
              {isProcessing ? 'Analizando Estructura...' : 'Arrastre archivo aquí'}
            </h3>
            <p className="text-xs text-obsidian/50 dark:text-seashell/50 mt-2 font-medium">
              Soporte para Excel (.xlsx) y Texto Delimitado (.csv)
            </p>
          </div>

          {!isProcessing && (
            <label
              htmlFor="fileInput"
              className="px-8 py-2.5 bg-obsidian dark:bg-white text-seashell dark:text-obsidian rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-denim dark:hover:bg-seashell/90 cursor-pointer transition-colors shadow-sm"
            >
              Examinar Equipo
            </label>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-px bg-obsidian/10 dark:bg-white/10 border border-obsidian/10 dark:border-white/10 rounded-sm overflow-hidden">
        <div className="bg-white dark:bg-obsidian p-3 flex items-center justify-center space-x-2">
          <FileType className="w-4 h-4 text-denim" />
          <span className="text-[10px] font-semibold text-obsidian/60 dark:text-seashell/60 uppercase">Estructura Plana</span>
        </div>
        <div className="bg-white dark:bg-obsidian p-3 flex items-center justify-center space-x-2">
          <AlertCircle className="w-4 h-4 text-denim" />
          <span className="text-[10px] font-semibold text-obsidian/60 dark:text-seashell/60 uppercase">Validación Estricta</span>
        </div>
        <div className="bg-white dark:bg-obsidian p-3 flex items-center justify-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-denim" />
          <span className="text-[10px] font-semibold text-obsidian/60 dark:text-seashell/60 uppercase">Inferencia Bloques</span>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;