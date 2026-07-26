
import React, { useEffect, useState, useRef } from 'react';
import { Bill } from '../types';
import { generateOptimizationAdvice } from '../services/geminiService';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, ChevronDown, ChevronUp, Sparkles, RefreshCcw } from 'lucide-react';

interface InsightPanelProps {
  bills: Bill[];
}

const MAX_TRANSACTIONS_ANALYSED = 30;
const HIGH_RISK_THRESHOLD = 50;

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
    const transactions = bills.flatMap(b => b.transactions || []).slice(0, MAX_TRANSACTIONS_ANALYSED);
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
      <div className="bg-marine-900 border border-brass-500/20 p-6 mb-6">
        <h2 className="text-lg font-medium tracking-tight-display text-ink mb-1.5">Nothing tracked yet</h2>
        <p className="text-sm text-ink-mute">Upload your first statement and we'll tell you which card to tap next.</p>
      </div>
    );
  }

  const getAdvicePoints = (adviceStr: string) => {
    if (!adviceStr) return [];
    return adviceStr.split(/\n|•\s|–\s|-\s/).filter(s => s.trim().length > 5);
  };

  const riskScore = analysis?.riskScore ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Main Advice */}
      <div className="lg:col-span-2 bg-marine-900 border border-brass-500/15 overflow-hidden">
        <div
          className="p-5 sm:p-6 flex items-center justify-between cursor-pointer hover:bg-marine-800 transition-colors duration-150 min-h-[56px]"
          onClick={() => setShowInsights(!showInsights)}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
            <h2 className="text-base font-medium text-ink">Miles optimisation</h2>
          </div>
          <div className="flex items-center gap-1">
            {lastUpdated && !loading && (
              <span className="font-mono text-[10px] tabular-nums text-ink-mute mr-2 hidden sm:inline-block">
                {lastUpdated}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleForceRefresh(); }}
              aria-label="Refresh analysis"
              className="w-10 h-10 flex items-center justify-center text-ink-mute hover:text-brass-400 transition-colors duration-150"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </button>
            <span className="w-10 h-10 flex items-center justify-center text-ink-mute">
              {showInsights ? <ChevronUp className="w-4 h-4" strokeWidth={1.5} /> : <ChevronDown className="w-4 h-4" strokeWidth={1.5} />}
            </span>
          </div>
        </div>

        {showInsights && (
          <div className="px-5 sm:px-6 pb-6 border-t border-brass-500/10 pt-5">
            {loading ? (
              <div className="space-y-3">
                <div className="h-2 bg-marine-700 w-3/4 animate-pulse"></div>
                <div className="h-2 bg-marine-700 w-1/2 animate-pulse"></div>
                <div className="h-2 bg-marine-700 w-2/3 animate-pulse"></div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <ul className="space-y-3">
                    {getAdvicePoints(analysis?.advice).map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
                        <span className="font-mono text-[10px] tabular-nums text-brass-400 shrink-0 mt-1">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        {point}
                      </li>
                    ))}
                    {!analysis?.advice && (
                      <li className="text-sm text-ink-mute">Upload more bills to receive strategy advice.</li>
                    )}
                  </ul>
                </div>

                {/* Stats */}
                <div className="md:w-48 shrink-0 space-y-3">
                  <div className="bg-marine-800 border border-brass-500/15 p-4">
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-2">Missed miles</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-2xl tabular-nums text-brass-400">
                        {Math.round(analysis?.missedMiles ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="bg-marine-800 border border-brass-500/15 p-4">
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-2">Risk score</span>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-marine-600 overflow-hidden">
                        <div
                          className={`h-full ${riskScore > HIGH_RISK_THRESHOLD ? 'bg-danger' : 'bg-brass-500'}`}
                          style={{ width: `${riskScore}%` }}
                        />
                      </div>
                      <span className="font-mono text-sm tabular-nums text-ink">{Math.round(riskScore)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Anomalies / Quick Actions */}
      <div className="bg-marine-900 border border-brass-500/15 flex flex-col justify-between overflow-hidden">
        <div
          className="p-5 sm:p-6 flex items-center justify-between cursor-pointer hover:bg-marine-800 transition-colors duration-150 min-h-[56px]"
          onClick={() => setShowAnomalies(!showAnomalies)}
        >
          <h2 className="text-base font-medium text-ink flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
            To review
          </h2>
          <span className="w-10 h-10 flex items-center justify-center text-ink-mute">
            {showAnomalies ? <ChevronUp className="w-4 h-4" strokeWidth={1.5} /> : <ChevronDown className="w-4 h-4" strokeWidth={1.5} />}
          </span>
        </div>

        {showAnomalies && (
          <div className="px-5 sm:px-6 pb-6 border-t border-brass-500/10 pt-5 flex-1 flex flex-col justify-between">
            <div>
              {loading ? (
                <div className="h-2 bg-marine-700 animate-pulse w-full mb-2"></div>
              ) : (
                <ul className="space-y-2.5">
                  {analysis?.anomalies && analysis.anomalies.length > 0 ? (
                    analysis.anomalies.map((a: string, i: number) => (
                      <li key={i} className="flex items-start gap-3 p-3 bg-marine-800 border border-warning/25 text-sm text-ink-soft">
                        <ShieldAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
                        <span>{a}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-ink-mute py-2">Nothing unusual in your recent spend.</li>
                  )}
                </ul>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-brass-500/10">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Source</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass-400">MileLion engine</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
