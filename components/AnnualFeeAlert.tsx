import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Calendar, Loader2 } from 'lucide-react';
import { AnnualFee } from '../types';

interface AnnualFeeAlertProps {
  fees: AnnualFee[];
  onFeesUpdated?: (fees: AnnualFee[]) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const AnnualFeeAlert: React.FC<AnnualFeeAlertProps> = ({ fees, onFeesUpdated }) => {
  const [backfilling, setBackfilling] = useState(false);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const token = localStorage.getItem('sb-token') || sessionStorage.getItem('sb-token');
      const res = await fetch('/api/backfill-annual-fees', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success && onFeesUpdated) {
        // Re-fetch fees after backfill
        const feesRes = await fetch('/api/annual-fees', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const feesData = await feesRes.json();
        onFeesUpdated(feesData.fees || []);
      }
    } catch (err) {
      console.error('Backfill failed:', err);
    } finally {
      setBackfilling(false);
    }
  };

  if (!fees || fees.length === 0) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="bg-amber-100 p-2.5 rounded-xl mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Annual Fee Alert</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              No annual fees detected yet. Upload bills to start detecting.
            </p>
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="mt-3 flex items-center gap-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {backfilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {backfilling ? 'Scanning...' : 'Scan existing data'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-6">
      <div className="flex items-start gap-3">
        <div className="bg-amber-100 p-2.5 rounded-xl mt-0.5">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            Annual Fee Alert
            <span className="text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {fees.length} detected
            </span>
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            The following cards have annual fees detected. Consider canceling before the fee hits.
          </p>

          <div className="mt-4 space-y-3">
            {fees.map((fee) => (
              <div key={fee.id} className="flex items-center justify-between bg-white/80 rounded-lg p-3 border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{fee.cardName}</p>
                    <p className="text-xs text-gray-500">{fee.bankName} • Charged {MONTH_NAMES[fee.chargeMonth - 1]} {fee.chargeYear}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">${fee.amount.toFixed(2)}</p>
                  {fee.isRecurring && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium mt-1">
                      <RefreshCw className="w-3 h-3" />
                      Recurring
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};