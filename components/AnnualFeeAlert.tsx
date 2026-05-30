import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Calendar, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { AnnualFee } from '../types';

interface AnnualFeeAlertProps {
  fees: AnnualFee[];
  onFeesUpdated?: (fees: AnnualFee[]) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type FilterType = 'all' | 'active' | 'waived' | 'ignored';

export const AnnualFeeAlert: React.FC<AnnualFeeAlertProps> = ({ fees, onFeesUpdated }) => {
  const [backfilling, setBackfilling] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredFees = fees.filter(f => filter === 'all' ? true : f.status === filter);
  const activeCount = fees.filter(f => f.status === 'active').length;

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

  const handleStatusChange = async (feeId: string, status: 'waived' | 'ignored' | 'active') => {
    try {
      const token = localStorage.getItem('sb-token') || sessionStorage.getItem('sb-token');
      const res = await fetch(`/api/annual-fees/${feeId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok && onFeesUpdated) {
        const feesRes = await fetch('/api/annual-fees', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const feesData = await feesRes.json();
        onFeesUpdated(feesData.fees || []);
      }
    } catch (err) {
      console.error('Failed to update fee status:', err);
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
    <>
      {/* Collapsed Tab — always visible when fees exist */}
      <div
        onClick={() => setIsOpen(v => !v)}
        className={`mb-6 flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${
          activeCount > 0
            ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${activeCount > 0 ? 'bg-amber-200' : 'bg-gray-200'}`}>
            <AlertTriangle className={`w-4 h-4 ${activeCount > 0 ? 'text-amber-700' : 'text-gray-500'}`} />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Annual Fee Alert</p>
            <p className="text-xs text-gray-500">
              {activeCount > 0 ? `${activeCount} unhandled fee${activeCount > 1 ? 's' : ''}` : 'All handled'}
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {/* Expanded Panel */}
      {isOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900">Annual Fees</h3>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {fees.length} total
              </span>
            </div>
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {backfilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {backfilling ? 'Scanning...' : 'Rescan'}
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            {(['all', 'active', 'waived', 'ignored'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                  filter === f
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {filteredFees.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No fees in this category.</p>
          ) : (
            <div className="space-y-2">
              {filteredFees.map((fee) => (
                <div
                  key={fee.id}
                  className={`flex items-center justify-between rounded-lg p-3 border transition-all ${
                    fee.status === 'waived'
                      ? 'bg-green-50 border-green-100 opacity-60'
                      : fee.status === 'ignored'
                      ? 'bg-gray-50 border-gray-100 opacity-40'
                      : 'bg-white border-gray-100 hover:border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      fee.status === 'waived' ? 'bg-green-100' : fee.status === 'ignored' ? 'bg-gray-200' : 'bg-indigo-100'
                    }`}>
                      <Calendar className={`w-4 h-4 ${
                        fee.status === 'waived' ? 'text-green-600' : fee.status === 'ignored' ? 'text-gray-400' : 'text-indigo-600'
                      }`} />
                    </div>
                    <div>
                      <p className={`font-medium text-sm ${fee.status === 'waived' ? 'line-through text-gray-400' : fee.status === 'ignored' ? 'text-gray-400' : 'text-gray-900'}`}>
                        {fee.cardName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {fee.bankName} • {MONTH_NAMES[fee.chargeMonth - 1]} {fee.chargeYear}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`font-bold text-sm ${fee.status === 'waived' ? 'text-gray-400' : 'text-gray-900'}`}>
                        ${fee.amount.toFixed(2)}
                      </p>
                      {fee.isRecurring && fee.status === 'active' && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                          <RefreshCw className="w-3 h-3" />
                          Recurring
                        </span>
                      )}
                    </div>

                    {fee.status === 'active' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleStatusChange(fee.id, 'waived')}
                          className="text-xs px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium transition-colors"
                        >
                          Waived
                        </button>
                        <button
                          onClick={() => handleStatusChange(fee.id, 'ignored')}
                          className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium transition-colors"
                        >
                          Ignore
                        </button>
                      </div>
                    )}

                    {fee.status !== 'active' && (
                      <button
                        onClick={() => handleStatusChange(fee.id, 'active')}
                        className="text-xs px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg font-medium transition-colors"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};