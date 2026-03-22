import React, { useState } from 'react';
import { Bill } from '../types';
import { X, PlusCircle } from 'lucide-react';

interface ManualBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (bill: Bill) => void;
}

export const ManualBillModal: React.FC<ManualBillModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    bankName: '',
    cardName: '',
    totalAmount: '',
    dueDate: '',
    statementDate: new Date().toISOString().split('T')[0]
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newBill: Bill = {
      id: crypto.randomUUID(),
      bankName: formData.bankName,
      cardName: formData.cardName,
      totalAmount: parseFloat(formData.totalAmount),
      dueDate: formData.dueDate,
      statementDate: formData.statementDate,
      isPaid: false,
      transactions: [], // Manual entry usually doesn't include transaction lines initially
      uploadedAt: new Date().toISOString(),
      riskScore: 0
    };
    onAdd(newBill);
    setFormData({ bankName: '', cardName: '', totalAmount: '', dueDate: '', statementDate: new Date().toISOString().split('T')[0] });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-indigo-600" />
            Add Manual Bill
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input 
                    required
                    type="text" 
                    placeholder="e.g. DBS, UOB, Citibank"
                    value={formData.bankName}
                    onChange={e => setFormData({...formData, bankName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Name</label>
                <input 
                    required
                    type="text" 
                    placeholder="e.g. Woman's World Card"
                    value={formData.cardName}
                    onChange={e => setFormData({...formData, cardName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                    <input 
                        required
                        type="number" 
                        step="0.01"
                        placeholder="0.00"
                        value={formData.totalAmount}
                        onChange={e => setFormData({...formData, totalAmount: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input 
                        required
                        type="date" 
                        value={formData.dueDate}
                        onChange={e => setFormData({...formData, dueDate: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                    Cancel
                </button>
                <button 
                    type="submit"
                    className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm"
                >
                    Add Bill
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};