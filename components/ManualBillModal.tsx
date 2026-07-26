import React, { useState } from 'react';
import { Bill } from '../types';
import { PlusCircle } from 'lucide-react';
import { Modal } from './Modal';
import { fieldClass, labelClass, primaryButtonClass, ghostButtonClass } from './formStyles';

interface ManualBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (bill: Bill) => void;
}

const emptyForm = () => ({
  bankName: '',
  cardName: '',
  totalAmount: '',
  dueDate: '',
  statementDate: new Date().toISOString().split('T')[0]
});

export const ManualBillModal: React.FC<ManualBillModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState(emptyForm);

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
    setFormData(emptyForm());
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add a bill"
      icon={<PlusCircle className="w-4 h-4 text-brass-400 shrink-0" strokeWidth={1.5} />}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
              <label htmlFor="manual-bank" className={labelClass}>Bank name</label>
              <input
                  id="manual-bank"
                  required
                  type="text"
                  placeholder="e.g. DBS, UOB, Citibank"
                  value={formData.bankName}
                  onChange={e => setFormData({...formData, bankName: e.target.value})}
                  className={fieldClass}
              />
          </div>
          <div>
              <label htmlFor="manual-card" className={labelClass}>Card name</label>
              <input
                  id="manual-card"
                  required
                  type="text"
                  placeholder="e.g. Woman's World Card"
                  value={formData.cardName}
                  onChange={e => setFormData({...formData, cardName: e.target.value})}
                  className={fieldClass}
              />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <label htmlFor="manual-amount" className={labelClass}>Amount ($)</label>
                  <input
                      id="manual-amount"
                      required
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={formData.totalAmount}
                      onChange={e => setFormData({...formData, totalAmount: e.target.value})}
                      className={`${fieldClass} font-mono tabular-nums`}
                  />
              </div>
              <div>
                  <label htmlFor="manual-due" className={labelClass}>Due date</label>
                  <input
                      id="manual-due"
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
                  Add bill
              </button>
          </div>
      </form>
    </Modal>
  );
};
