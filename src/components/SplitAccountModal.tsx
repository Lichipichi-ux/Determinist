import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ArrowRight, ListOrdered, CheckCircle2, Circle } from 'lucide-react';
import { CURRENCY_FORMAT } from '../utils/constants';
import { LedgerLine } from '../types';

interface SplitAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (amount: number, newAccountName: string, side: 'DEBIT' | 'CREDIT', targetOrder: number) => void;
    currentAccountName: string;
    currentBalance: number;
    totalAccounts: number;
    entries?: LedgerLine[]; // NEW: Para permitir selección de múltiples movimientos
}

type SplitMode = 'AMOUNT' | 'ENTRIES';

const SplitAccountModal: React.FC<SplitAccountModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    currentAccountName,
    currentBalance,
    totalAccounts,
    entries = [],
}) => {
    const [splitMode, setSplitMode] = useState<SplitMode>('AMOUNT');
    const [amount, setAmount] = useState<string>('');
    const [newAccountName, setNewAccountName] = useState('');
    const [side, setSide] = useState<'DEBIT' | 'CREDIT' | null>(null);
    const [targetOrder, setTargetOrder] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // NEW: Estado para selección de múltiples movimientos
    const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setNewAccountName('');
            setSide(null);
            setTargetOrder((totalAccounts + 1).toString());
            setError(null);
            setSelectedEntries(new Set());

            // Detectar modo automáticamente: si hay movimientos, mostrar opción de seleccionar
            if (entries && entries.length > 0) {
                setSplitMode('ENTRIES');
            } else {
                setSplitMode('AMOUNT');
            }
        }
    }, [isOpen, totalAccounts, entries]);

    const handleToggleEntry = (entryId: string) => {
        const newSelected = new Set(selectedEntries);
        if (newSelected.has(entryId)) {
            newSelected.delete(entryId);
        } else {
            newSelected.add(entryId);
        }
        setSelectedEntries(newSelected);
    };

    const calculateSelectedAmount = (): number => {
        return entries
            .filter(e => selectedEntries.has(e.id))
            .reduce((sum, e) => {
                // Detectar si es deudor o acreedor basado en el monto
                return sum + (e.debit > 0 ? e.debit : e.credit);
            }, 0);
    };

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        let finalAmount = 0;
        let finalSide: 'DEBIT' | 'CREDIT' | null = side;

        if (splitMode === 'AMOUNT') {
            finalAmount = parseFloat(amount);
            if (isNaN(finalAmount) || finalAmount <= 0) {
                setError('Ingrese un monto válido mayor a 0.');
                return;
            }
        } else {
            // Modo ENTRIES: sumar todos los movimientos seleccionados
            if (selectedEntries.size === 0) {
                setError('Seleccione al menos un movimiento.');
                return;
            }
            finalAmount = calculateSelectedAmount();

            // Detectar automáticamente el lado basado en los movimientos seleccionados
            const firstEntry = entries.find(e => selectedEntries.has(e.id));
            if (firstEntry) {
                finalSide = firstEntry.debit > 0 ? 'DEBIT' : 'CREDIT';
            }
        }

        if (!newAccountName.trim()) {
            setError('Ingrese un nombre para la nueva cuenta.');
            return;
        }

        if (!finalSide) {
            setError('Seleccione si el monto es Deudor o Acreedor.');
            return;
        }

        const numOrder = parseInt(targetOrder, 10);
        if (isNaN(numOrder) || numOrder < 1) {
            setError(`El orden debe ser mayor a 0.`);
            return;
        }

        onConfirm(finalAmount, newAccountName.trim(), finalSide, numOrder);
        onClose();
    };

    const hasEntries = entries && entries.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-4">
            <div className="bg-white  border border-obsidian/10  shadow-2xl rounded-xl w-full max-w-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="px-6 py-4 border-b border-obsidian/10  flex items-center justify-between bg-seashell/50  sticky top-0">
                    <h3 className="text-lg font-bold text-obsidian  flex items-center gap-2">
                        <span className="w-2 h-6 bg-denim rounded-full"></span>
                        Dividir / Reasignar Cuenta
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-obsidian/40 hover:text-red-500   transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Mode Selector - NEW */}
                {hasEntries && (
                    <div className="px-6 pt-4 pb-2">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setSplitMode('AMOUNT');
                                    setError(null);
                                }}
                                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                                    splitMode === 'AMOUNT'
                                        ? 'bg-denim text-white shadow-md'
                                        : 'bg-obsidian/5  text-obsidian/60  hover:bg-obsidian/10'
                                }`}
                            >
                                 Por Monto
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSplitMode('ENTRIES');
                                    setError(null);
                                }}
                                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                                    splitMode === 'ENTRIES'
                                        ? 'bg-denim text-white shadow-md'
                                        : 'bg-obsidian/5  text-obsidian/60  hover:bg-obsidian/10'
                                }`}
                            >
                                 Seleccionar Movimientos
                            </button>
                        </div>
                    </div>
                )}

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">

                    {/* Info Card */}
                    <div className="bg-denim/5 border border-denim/10 rounded-lg p-4">
                        <div className="text-xs uppercase tracking-widest text-denim/70 font-bold mb-1">Cuenta Original</div>
                        <div className="text-sm font-medium text-obsidian  mb-2">{currentAccountName}</div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs text-obsidian/50 ">Saldo Actual:</span>
                            <span className="text-lg font-mono font-bold text-denim">{CURRENCY_FORMAT.format(currentBalance)}</span>
                        </div>
                    </div>

                    {/* ENTRIES MODE: Movement Selection */}
                    {splitMode === 'ENTRIES' && hasEntries && (
                        <div className="bg-blue-50  border border-blue-100  rounded-lg p-4">
                            <div className="text-xs uppercase tracking-widest text-blue-700  font-bold mb-3">
                                Selecciona los movimientos a reasignar
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {entries.map((entry, idx) => (
                                    <label
                                        key={entry.id}
                                        className="flex items-center gap-3 p-3 bg-white  rounded-lg border border-blue-100  cursor-pointer hover:bg-blue-50  transition-colors"
                                    >
                                        <div
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleToggleEntry(entry.id);
                                            }}
                                            className="flex-shrink-0"
                                        >
                                            {selectedEntries.has(entry.id) ? (
                                                <CheckCircle2 className="w-5 h-5 text-denim" />
                                            ) : (
                                                <Circle className="w-5 h-5 text-obsidian/30 " />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-obsidian/60 ">{entry.date}</span>
                                                <span className="text-xs font-mono text-obsidian/50 ">Asiento: {entry.entryId}</span>
                                            </div>
                                            <p className="text-sm text-obsidian  font-medium truncate">{entry.description}</p>
                                            <div className="flex justify-between gap-2 mt-1">
                                                {entry.debit > 0 && (
                                                    <span className="text-xs font-mono text-denim font-bold">D: {CURRENCY_FORMAT.format(entry.debit)}</span>
                                                )}
                                                {entry.credit > 0 && (
                                                    <span className="text-xs font-mono text-red-600  font-bold">H: {CURRENCY_FORMAT.format(entry.credit)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {selectedEntries.size > 0 && (
                                <div className="mt-3 pt-3 border-t border-blue-100 ">
                                    <div className="text-sm font-bold text-blue-700 ">
                                        Total a reasignar: {CURRENCY_FORMAT.format(calculateSelectedAmount())}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Side Selector (Deudor/Acreedor) - REQUIRED for AMOUNT mode, auto for ENTRIES */}
                    {splitMode === 'AMOUNT' && (
                        <div className="bg-gradient-to-br from-denim/5 to-denim/10 border border-denim/20 rounded-lg p-4">
                            <label className="block text-xs uppercase tracking-wider font-bold text-obsidian/70  mb-3">
                                Origen del monto <span className="text-red-500">*</span>
                            </label>
                            <div className="space-y-2">
                                {/* Debit Radio Button */}
                                <label
                                    className={`
                                        flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                                        ${side === 'DEBIT'
                                            ? 'border-denim bg-denim/10 shadow-sm'
                                            : 'border-obsidian/20  bg-white  hover:border-denim/50 hover:bg-denim/5'
                                        }
                                    `}
                                >
                                    <input
                                        type="radio"
                                        name="side"
                                        value="DEBIT"
                                        checked={side === 'DEBIT'}
                                        onChange={() => {
                                            setSide('DEBIT');
                                            setError(null);
                                        }}
                                        className="w-4 h-4 text-denim focus:ring-denim focus:ring-2"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-obsidian "> Deudor</span>
                                        </div>
                                    </div>
                                </label>

                                {/* Credit Radio Button */}
                                <label
                                    className={`
                                        flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                                        ${side === 'CREDIT'
                                            ? 'border-denim bg-denim/10 shadow-sm'
                                            : 'border-obsidian/20  bg-white  hover:border-denim/50 hover:bg-denim/5'
                                        }
                                    `}
                                >
                                    <input
                                        type="radio"
                                        name="side"
                                        value="CREDIT"
                                        checked={side === 'CREDIT'}
                                        onChange={() => {
                                            setSide('CREDIT');
                                            setError(null);
                                        }}
                                        className="w-4 h-4 text-denim focus:ring-denim focus:ring-2"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-obsidian "> Acreedor</span>
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Amount Input - AMOUNT mode only */}
                    {splitMode === 'AMOUNT' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Amount Input */}
                                <div>
                                    <label className="block text-xs uppercase tracking-wider font-bold text-obsidian/60  mb-2">
                                        Monto a separar
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian/30  font-bold">Q</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => {
                                                setAmount(e.target.value);
                                                setError(null);
                                            }}
                                            className="w-full pl-8 pr-4 py-3 bg-white  border border-obsidian/20  rounded-lg focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim transition-all font-mono font-bold text-lg text-obsidian "
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* Order Input */}
                                <div>
                                    <label className="block text-xs uppercase tracking-wider font-bold text-obsidian/60  mb-2">
                                        Orden
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian/30  font-bold">#</span>
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={targetOrder}
                                            onChange={(e) => {
                                                setTargetOrder(e.target.value);
                                                setError(null);
                                            }}
                                            className="w-full pl-8 pr-4 py-3 bg-white  border border-obsidian/20  rounded-lg focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim transition-all font-mono font-bold text-lg text-obsidian "
                                            placeholder="#"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Order Input - ENTRIES mode */}
                    {splitMode === 'ENTRIES' && (
                        <div>
                            <label className="block text-xs uppercase tracking-wider font-bold text-obsidian/60  mb-2">
                                Orden de la nueva cuenta
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian/30  font-bold">#</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={targetOrder}
                                    onChange={(e) => {
                                        setTargetOrder(e.target.value);
                                        setError(null);
                                    }}
                                    className="w-full pl-8 pr-4 py-3 bg-white  border border-obsidian/20  rounded-lg focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim transition-all font-mono font-bold text-lg text-obsidian "
                                    placeholder="#"
                                />
                            </div>
                        </div>
                    )}

                    {/* New Account Name Input */}
                    <div>
                        <label className="block text-xs uppercase tracking-wider font-bold text-obsidian/60  mb-2">
                            Nombre de la nueva cuenta
                        </label>
                        <input
                            type="text"
                            value={newAccountName}
                            onChange={(e) => {
                                setNewAccountName(e.target.value);
                                setError(null);
                            }}
                            className="w-full px-4 py-3 bg-white  border border-obsidian/20  rounded-lg focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim transition-all text-sm font-medium text-obsidian "
                            placeholder="Ej. Cuotas patronales Administración"
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50  border border-red-100  rounded-lg text-red-600  text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-lg border border-obsidian/10  text-obsidian/60  font-bold text-sm hover:bg-obsidian/5  transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] py-3 px-4 rounded-lg bg-denim hover:bg-denim/90 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
                        >
                            Confirmar División
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SplitAccountModal;
