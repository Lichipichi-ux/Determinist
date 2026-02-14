import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ArrowRight, ListOrdered } from 'lucide-react';
import { CURRENCY_FORMAT } from '../utils/constants';

interface SplitAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (amount: number, newAccountName: string, side: 'DEBIT' | 'CREDIT', targetOrder: number) => void;
    currentAccountName: string;
    currentBalance: number;
    totalAccounts: number;
}

const SplitAccountModal: React.FC<SplitAccountModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    currentAccountName,
    currentBalance,
    totalAccounts,
}) => {
    const [amount, setAmount] = useState<string>('');
    const [newAccountName, setNewAccountName] = useState('');
    const [side, setSide] = useState<'DEBIT' | 'CREDIT' | null>(null);
    const [targetOrder, setTargetOrder] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setNewAccountName('');
            setSide(null);
            setTargetOrder((totalAccounts + 1).toString());
            setError(null);
        }
    }, [isOpen, totalAccounts]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        const numOrder = parseInt(targetOrder, 10);

        if (isNaN(numAmount) || numAmount <= 0) {
            setError('Ingrese un monto válido mayor a 0.');
            return;
        }


        // Validation removed to allow correcting zero-balance accounts (User Request)
        // if (numAmount > Math.abs(currentBalance)) { ... }


        if (!newAccountName.trim()) {
            setError('Ingrese un nombre para la nueva cuenta.');
            return;
        }

        if (!side) {
            setError('Seleccione si el monto es Deudor o Acreedor.');
            return;
        }

        if (isNaN(numOrder) || numOrder < 1) {
            setError(`El orden debe ser mayor a 0.`);
            return;
        }

        onConfirm(numAmount, newAccountName.trim(), side, numOrder);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-obsidian border border-obsidian/10 dark:border-white/10 shadow-2xl rounded-xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-obsidian/10 dark:border-white/10 flex items-center justify-between bg-seashell/50 dark:bg-white/5">
                    <h3 className="text-lg font-bold text-obsidian dark:text-seashell flex items-center gap-2">
                        <span className="w-2 h-6 bg-denim rounded-full"></span>
                        Dividir Cuenta
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-obsidian/40 hover:text-red-500 dark:text-seashell/40 dark:hover:text-red-400 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">

                    {/* Info Card */}
                    <div className="bg-denim/5 border border-denim/10 rounded-lg p-4">
                        <div className="text-xs uppercase tracking-widest text-denim/70 font-bold mb-1">Cuenta Original</div>
                        <div className="text-sm font-medium text-obsidian dark:text-seashell mb-2">{currentAccountName}</div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs text-obsidian/50 dark:text-seashell/50">Saldo Actual:</span>
                            <span className="text-lg font-mono font-bold text-denim">{CURRENCY_FORMAT.format(currentBalance)}</span>
                        </div>
                    </div>

                    {/* Side Selector (Deudor/Acreedor) - REQUIRED */}
                    <div className="bg-gradient-to-br from-denim/5 to-denim/10 border border-denim/20 rounded-lg p-4">
                        <label className="block text-xs uppercase tracking-wider font-bold text-obsidian/70 dark:text-seashell/70 mb-3">
                            Origen del monto <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                            {/* Debit Radio Button */}
                            <label
                                className={`
                                    flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                                    ${side === 'DEBIT'
                                        ? 'border-denim bg-denim/10 shadow-sm'
                                        : 'border-obsidian/20 dark:border-white/20 bg-white dark:bg-obsidian hover:border-denim/50 hover:bg-denim/5'
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
                                        <span className="text-sm font-bold text-obsidian dark:text-seashell">🔘 Deudor</span>
                                    </div>
                                    <p className="text-xs text-obsidian/60 dark:text-seashell/60 mt-1">
                                        El monto proviene del lado del Debe
                                    </p>
                                </div>
                            </label>

                            {/* Credit Radio Button */}
                            <label
                                className={`
                                    flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                                    ${side === 'CREDIT'
                                        ? 'border-denim bg-denim/10 shadow-sm'
                                        : 'border-obsidian/20 dark:border-white/20 bg-white dark:bg-obsidian hover:border-denim/50 hover:bg-denim/5'
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
                                        <span className="text-sm font-bold text-obsidian dark:text-seashell">🔘 Acreedor</span>
                                    </div>
                                    <p className="text-xs text-obsidian/60 dark:text-seashell/60 mt-1">
                                        El monto proviene del lado del Haber
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Amount Input */}
                            <div>
                                <label className="block text-xs uppercase tracking-wider font-bold text-obsidian/60 dark:text-seashell/60 mb-2">
                                    Monto a separar
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian/30 dark:text-seashell/30 font-bold">Q</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => {
                                            setAmount(e.target.value);
                                            setError(null);
                                        }}
                                        className="w-full pl-8 pr-4 py-3 bg-white dark:bg-obsidian border border-obsidian/20 dark:border-white/20 rounded-lg focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim transition-all font-mono font-bold text-lg text-obsidian dark:text-seashell"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Order Input */}
                            <div>
                                <label className="block text-xs uppercase tracking-wider font-bold text-obsidian/60 dark:text-seashell/60 mb-2">
                                    Orden
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian/30 dark:text-seashell/30 font-bold">#</span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={targetOrder}
                                        onChange={(e) => {
                                            setTargetOrder(e.target.value);
                                            setError(null);
                                        }}
                                        className="w-full pl-8 pr-4 py-3 bg-white dark:bg-obsidian border border-obsidian/20 dark:border-white/20 rounded-lg focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim transition-all font-mono font-bold text-lg text-obsidian dark:text-seashell"
                                        placeholder="#"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* New Account Name Input */}
                        <div>
                            <label className="block text-xs uppercase tracking-wider font-bold text-obsidian/60 dark:text-seashell/60 mb-2">
                                Nombre de la nueva cuenta
                            </label>
                            <input
                                type="text"
                                value={newAccountName}
                                onChange={(e) => {
                                    setNewAccountName(e.target.value);
                                    setError(null);
                                }}
                                className="w-full px-4 py-3 bg-white dark:bg-obsidian border border-obsidian/20 dark:border-white/20 rounded-lg focus:outline-none focus:border-denim focus:ring-1 focus:ring-denim transition-all text-sm font-medium text-obsidian dark:text-seashell"
                                placeholder="Ej. Cuotas patronales Administración"
                            />
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg text-red-600 dark:text-red-400 text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-lg border border-obsidian/10 dark:border-white/10 text-obsidian/60 dark:text-seashell/60 font-bold text-sm hover:bg-obsidian/5 dark:hover:bg-white/5 transition-colors"
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
