
import React, { useEffect, useState, useRef } from 'react';
import { Bill } from '../types';
import { generateOptimizationAdvice } from '../services/geminiService';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, ChevronDown, ChevronUp, Sparkles, RefreshCcw } from 'lucide-react';

interface InsightPanelProps {
  bills: Bill[];
}

/**
 * Stable signature for the current set of bills.
 * Changes when any bill is added or removed.
 * Does NOT change on payment/edit — analysis is about spend patterns, not payment status.
 */
const computeSignature = (bills: Bill[]): string => {
  if (bills.length === 0) return '';
  return [...bills]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(b => `${b.id}:${b.uploadedAt}`)
    .join('|');
};

export const InsightPanel: React.FC<InsightPanelProps> = ({ bills }) => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  // Prevent duplicate runs when bills reference changes without content changing
  const lastRunSignature = useRef<string | null>(null);

  const analyze = async (force: boolean = false) => {
    if (bills.length === 0 || !user) return;

    const currentSignature = computeSignature(bills);

    // Skip if we already ran for this exact bill set (avoids double-fire from React StrictMode etc.)
    if (!force && lastRunSignature.current === currentSignature && analysis) return;

    if (!force) {
      // 1. Check Supabase for a stored result that matches the current bills
      try {
        const cached = await dbService.getInsights(user.id);
        if (cached && cached.billsSignature === currentSignature) {
          setAnalysis(cached.insights);
          setLastUpdated(new Date(cached.updatedAt).toLocaleString('en-GB'));
          lastRunSignature.current = currentSignature;
          return;
        }
      } catch (err) {
        // Supabase fetch failed — fall through to Gemini
        console.warn('Could not fetch cached insights:', err);
      }
    }

    // 2. Bills changed (or force refresh) — run Gemini
    const transactions = bills.flatMap(b => b.transactions || []).slice(0, 30);
    if (transactions.length === 0) return;

    setLoading(true);
    try {
      const result = await generateOptimizationAdvice(transactions);
      if (result) {
        setAnalysis(result);
        setLastUpdated(new Date().toLocaleString('en-GB'));
        lastRunSignature.current = currentSignature;
        // 3. Persist to Supabase so other devices / future sessions skip the API call
        dbService.saveInsights(user.id, result, currentSignature).catch(err =>
          console.warn('Could not save insights to Supabase:', err)
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyze();
  }, [bills]);

  const handleForceRefresh = () => analyze(true);

  if (bills.length === 0) {
    return (
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-xl text-white shadow-lg mb-6">
        <h3 className="text-xl font-bold mb-2">Start Tracking</h3>
        <p className="opacity-90">Upload your first bill to get AI-powered miles optimization insights.</p>
      </div>
    );
  }

  const getAdvicePoints = (adviceStr: string) => {
    if (!adviceStr) return [];
    return adviceStr.split(/\n|•\s|–\s|-\s/).filter(s => s.trim().length > 5);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Main Advice */}
      <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl text-white shadow-lg relative overflow-hidden transition-all duration-300">
        <div className="relative z-10">
          <div
            className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setShowInsights(!showInsights)}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <h3 className="text-lg font-bold tracking-wide">AI MILE OPTIMIZATION</h3>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && !loading && (
                <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-indigo-100 hidden sm:inline-block">
                  Updated: {lastUpdated}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleForceRefresh(); }}
                className="p-1 rounded-full hover:bg-white/10 text-indigo-200 hover:text-white transition-colors"
                title="Force Refresh Analysis"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button className="p-1 rounded-full hover:bg-white/10">
                {showInsights ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {showInsights && (
            <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
              {loading ? (
                <div className="space-y-3 opacity-70">
                  <div className="h-2 bg-white/30 rounded w-3/4 animate-pulse"></div>
                  <div className="h-2 bg-white/30 rounded w-1/2 animate-pulse"></div>
                  <div className="h-2 bg-white/30 rounded w-2/3 animate-pulse"></div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <ul className="space-y-3">
                      {getAdvicePoints(analysis?.advice).map((point, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm md:text-base leading-relaxed opacity-95">
                          <span className="bg-white/20 text-yellow-300 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          {point}
                        </li>
                      ))}
                      {!analysis?.advice && (
                        <li className="opacity-75 italic">Upload more bills to receive strategy advice.</li>
                      )}
                    </ul>
                  </div>

                  {/* Stats Box */}
                  <div className="md:w-48 shrink-0 space-y-3">
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-lg border border-white/10">
                      <span className="block text-xs text-indigo-100 uppercase tracking-wider mb-1">Missed Opportunity</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-yellow-300">~{analysis?.missedMiles ?? 0}</span>
                        <span className="text-xs text-indigo-200">miles</span>
                      </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-lg border border-white/10">
                      <span className="block text-xs text-indigo-100 uppercase tracking-wider mb-1">Risk Assessment</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-black/20 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${(analysis?.riskScore ?? 0) > 50 ? 'bg-red-400' : 'bg-green-400'}`}
                            style={{ width: `${analysis?.riskScore ?? 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold">{analysis?.riskScore ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Anomalies / Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between overflow-hidden">
        <div
          className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setShowAnomalies(!showAnomalies)}
        >
          <h4 className="text-gray-900 font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            Transactions to Review
          </h4>
          <button className="text-gray-400">
            {showAnomalies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {showAnomalies && (
          <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200 flex-1 flex flex-col justify-between">
            <div>
              {loading ? (
                <div className="h-2 bg-gray-100 rounded animate-pulse w-full mb-2"></div>
              ) : (
                <ul className="text-sm text-gray-600 space-y-3">
                  {analysis?.anomalies && analysis.anomalies.length > 0 ? (
                    analysis.anomalies.map((a: string, i: number) => (
                      <li key={i} className="flex items-start gap-3 p-2 bg-orange-50 rounded-lg">
                        <ShieldAlert className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <span>{a}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-400 italic flex flex-col items-center py-4">
                      <div className="bg-gray-100 p-2 rounded-full mb-2">
                        <Sparkles className="w-4 h-4 text-gray-400" />
                      </div>
                      No unusual spending patterns detected.
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Analysis Source</span>
                <span className="font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Milelion Strategy Engine</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
