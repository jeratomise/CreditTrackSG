import React, { useState } from 'react';
import { Bill, PaymentDetails } from '../types';
import { X, CheckCircle } from 'lucide-react';

interface PaymentModalProps {
  bill: Bill | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (billId: string, details: PaymentDetails) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ bill, isOpen, onClose, onConfirm }) => {
  const [transactionId, setTransactionId] = useState('');
  const [method, setMethod] = useState<'Online' | 'Giro' | 'Mobile'>('Online');

  if (!isOpen || !bill) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const details: PaymentDetails = {
      paidAt: new Date().toISOString(),
      transactionId,
      method
    };
    onConfirm(bill.id, details);
    // Reset form
    setTransactionId('');
    setMethod('Online');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Mark as Paid
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
            <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Settling Bill For</p>
                <p className="text-lg font-bold text-indigo-900">{bill.cardName}</p>
                <p className="text-sm text-indigo-700">{bill.bankName} • ${bill.totalAmount.toFixed(2)}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Reference ID</label>
                    <input 
                        required
                        type="text" 
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="e.g. MB-29384723"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select 
                        value={method}
                        onChange={(e) => setMethod(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                        <option value="Online">Online Banking</option>
                        <option value="Giro">GIRO / Auto-Debit</option>
                        <option value="Mobile">Mobile Wallet / PayNow</option>
                    </select>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        className="px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm"
                    >
                        Confirm Payment
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};