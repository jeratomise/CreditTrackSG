import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { primaryButtonClass } from './formStyles';

interface AlertModalProps {
  message: string | null;
  onClose: () => void;
  type?: 'success' | 'warning';
}

export const AlertModal: React.FC<AlertModalProps> = ({ message, onClose, type = 'warning' }) => {
  if (!message) return null;

  const icon = type === 'success'
    ? <CheckCircle className="w-4 h-4 text-brass-400 shrink-0" strokeWidth={1.5} />
    : <AlertTriangle className="w-4 h-4 text-warning shrink-0" strokeWidth={1.5} />;

  return (
    <Modal isOpen onClose={onClose} title={type === 'success' ? 'Done' : 'Notice'} icon={icon}>
      <div className="p-6">
        <p className="text-sm text-ink-soft mb-6">{message}</p>
        <div className="flex justify-end">
          <button onClick={onClose} className={primaryButtonClass}>
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
};
