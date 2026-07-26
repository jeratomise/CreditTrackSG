import React, { useState } from 'react';
import { Bill, PaymentDetails } from '../types';
import { CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import { fieldClass, labelClass, primaryButtonClass, ghostButtonClass } from './formStyles';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mark as paid"
      icon={<CheckCircle className="w-4 h-4 text-brass-400 shrink-0" strokeWidth={1.5} />}
    >
      <div className="p-6">
          <div className="mb-6 p-4 bg-marine-800 border border-brass-500/15">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-2">Settling</p>
              <p className="text-ink">{bill.cardName}</p>
              <p className="text-sm text-ink-mute mt-0.5">
                {bill.bankName} · <span className="font-mono tabular-nums text-brass-400">${bill.totalAmount.toFixed(2)}</span>
              </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                  <label htmlFor="payment-ref" className={labelClass}>Transaction reference</label>
                  <input
                      id="payment-ref"
                      required
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="e.g. MB-29384723"
                      className={fieldClass}
                  />
              </div>

              <div>
                  <label htmlFor="payment-method" className={labelClass}>Payment method</label>
                  <select
                      id="payment-method"
                      value={method}
                      onChange={(e) => setMethod(e.target.value as any)}
                      className={fieldClass}
                  >
                      <option value="Online">Online banking</option>
                      <option value="Giro">GIRO / auto-debit</option>
                      <option value="Mobile">Mobile wallet / PayNow</option>
                  </select>
              </div>

              <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                  <button type="button" onClick={onClose} className={ghostButtonClass}>
                      Cancel
                  </button>
                  <button type="submit" className={primaryButtonClass}>
                      Confirm payment
                  </button>
              </div>
          </form>
      </div>
    </Modal>
  );
};
