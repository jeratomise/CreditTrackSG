import React, { useState, useEffect } from 'react';
import { Bill } from '../types';
import { Save, Pencil } from 'lucide-react';
import { Modal } from './Modal';
import { fieldClass, labelClass, primaryButtonClass, ghostButtonClass } from './formStyles';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit bill"
      icon={<Pencil className="w-4 h-4 text-brass-400 shrink-0" strokeWidth={1.5} />}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
              <label htmlFor="edit-bank" className={labelClass}>Bank name</label>
              <input
                  id="edit-bank"
                  required
                  type="text"
                  value={formData.bankName}
                  onChange={e => setFormData({...formData, bankName: e.target.value})}
                  className={fieldClass}
              />
          </div>
          <div>
              <label htmlFor="edit-card" className={labelClass}>Card name</label>
              <input
                  id="edit-card"
                  required
                  type="text"
                  value={formData.cardName}
                  onChange={e => setFormData({...formData, cardName: e.target.value})}
                  className={fieldClass}
              />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <label htmlFor="edit-amount" className={labelClass}>Amount ($)</label>
                  <input
                      id="edit-amount"
                      required
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={formData.totalAmount}
                      onChange={e => setFormData({...formData, totalAmount: e.target.value})}
                      className={`${fieldClass} font-mono tabular-nums`}
                  />
              </div>
              <div>
                  <label htmlFor="edit-due" className={labelClass}>Due date</label>
                  <input
                      id="edit-due"
                      required
                      type="date"
                      value={formData.dueDate}
                      onChange={e => setFormData({...formData, dueDate: e.target.value})}
                      className={`${fieldClass} font-mono tabular-nums`}
                  />
              </div>
          </div>

          <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button type="button" onClick={onClose} className={ghostButtonClass}>
                  Cancel
              </button>
              <button type="submit" className={primaryButtonClass}>
                  <Save className="w-4 h-4" strokeWidth={1.5} />
                  Save changes
              </button>
          </div>
      </form>
    </Modal>
  );
};
