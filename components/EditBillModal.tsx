import React, { useState, useEffect } from 'react';
import { Bill } from '../types';
import { X, Save, Pencil } from 'lucide-react';

interface EditBillModalProps {
  bill: Bill | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedBill: Bill) => void;
}

export const EditBillModal: React.FC<EditBillModalProps> = ({ bill, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    bankName: '',
    cardName: '',
    totalAmount: '',
    dueDate: '',
    statementDate: ''
  });

  useEffect(() => {
    if (bill) {
      setFormData({
        bankName: bill.bankName,
        cardName: bill.cardName,
        totalAmount: bill.totalAmount.toString(),
        dueDate: bill.dueDate,
        statementDate: bill.statementDate || ''
      });
    }
  }, [bill]);

  if (!isOpen || !bill) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill) return;
    
    const updatedBill: Bill = {
      ...bill,
      bankName: formData.bankName,
      cardName: formData.cardName,
      totalAmount: parseFloat(formData.totalAmount),
      dueDate: formData.dueDate,
      statementDate: formData.statementDate,
    };
    onSave(updatedBill);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-indigo-600" />
            Edit Bill Details
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
                    className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm flex items-center gap-2"
                >
                    <Save className="w-4 h-4" />
                    Save Changes
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};