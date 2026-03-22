import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface AlertModalProps {
  message: string | null;
  onClose: () => void;
  type?: 'success' | 'warning';
}

export const AlertModal: React.FC<AlertModalProps> = ({ message, onClose, type = 'warning' }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scale-in">
        <div className={`flex items-center gap-3 mb-4 ${type === 'success' ? 'text-indigo-600' : 'text-amber-600'}`}>
          {type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          <h3 className="text-lg font-bold text-gray-900">Notice</h3>
        </div>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
