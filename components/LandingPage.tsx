import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowRight, Loader2, Camera, Sparkles, Bell,
  BarChart2, ChevronLeft, Check, Upload,
} from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot';

const BANKS = ['DBS', 'UOB', 'Citi', 'HSBC', 'OCBC', 'StanChart', 'AMEX'] as const;

const STEPS = [
  {
    n: '01',
    title: 'Drop a statement',
    body: 'PDF, photo, or snap live from your phone. We read every line — including consolidated multi-card statements from DBS or Citi.',
    icon: Upload,
  },
  {
    n: '02',
    title: 'We extract everything',
    body: 'Every transaction, amount, due date, and merchant pulled out by Gemini. Tagged to your cards automatically.',
    icon: Sparkles,
  },
  {
    n: '03',
    title: 'You stop thinking about it',
    body: 'We tell you which card to tap next time, and email you three days before every due date. Mark a bill paid and the reminder cancels itself.',
    icon: Bell,
  },
] as const;

const PRICING_ROWS = [
  { label: 'Bill uploads',          free: '3 / month',     pro: 'Unlimited' },
  { label: 'Statement history',     free: 'Last 3 months', pro: 'All time' },
  { label: 'AI miles optimisation', free: '1× / month',    pro: 'Unlimited' },
  { label: 'Smart email reminders', free: false,           pro: true },
  { label: 'Banks supported',       free: 'DBS only',      pro: 'All 7+ banks' },
  { label: 'Spend analytics',       free: 'KPIs only',     pro: 'Full charts' },
  { label: 'Camera bill capture',   free: false,           pro: true },
  { label: 'Multi-device sync',     free: false,           pro: true },
  { label: 'Support',               free: '—',             pro: 'Priority' },
] as const;

const BrandMark: React.FC<{ className?: string; strokeWidth?: number }> = ({ className, strokeWidth = 1.5 }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    <path
      d="M3 19 L9 13 L13 16 L21 5"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="13" r="1.5" fill="currentColor" />
    <circle cx="13" cy="16" r="1.5" fill="currentColor" />
    <circle cx="21" cy="5" r="1.5" fill="currentColor" />
  </svg>
);

/** Squared-off pill used for inline status / labels — replaces the rounded glass variant. */
const Pill: React.FC<{ children: React.ReactNode; tone?: 'brass' | 'ink' }> = ({ children, tone = 'ink' }) => (
  <span
    className={`inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] ${
      tone === 'brass' ? 'text-brass-400' : 'text-ink-mute'
    }`}
  >
    {children}
  </span>
);

const PricingTable: React.FC<{ onGetPro?: () => void }> = ({ onGetPro }) => {
  const [annual, setAnnual] = useState(true);
  const proMonthly = 4.99;
  const proAnnual = 2.99;
  const displayed = annual ? proAnnual : proMonthly;
  const saving = Math.round((1 - (proAnnual * 12) / (proMonthly * 12)) * 100);

  const Cell: React.FC<{ value: string | boolean }> = ({ value }) => {
    if (value === true) return <Check className="w-4 h-4 text-brass-400 mx-auto" strokeWidth={1.5} />;
    if (value === false) return <span className="text-ink-mute/60">—</span>;
    return <span className="font-mono text-xs text-ink-soft">{value}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Pill tone="brass">Pricing</Pill>

        <div className="flex items-center gap-3">
          <span className={`text-xs transition-colors ${!annual ? 'text-ink' : 'text-ink-mute'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            aria-label="Toggle annual pricing"
            className="relative w-11 h-6 border border-ink-mute/30 transition-colors hover:border-brass-500/60"
          >
            <span
              className={`absolute top-0.5 w-[18px] h-[18px] bg-brass-500 transition-all duration-200 ease-out ${
                annual ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
          <span className={`text-xs transition-colors ${annual ? 'text-ink' : 'text-ink-mute'}`}>
            Annual
            {annual && (
              <span className="ml-2 font-mono text-[10px] text-brass-400">SAVE {saving}%</span>
            )}
          </span>
        </div>
      </div>

      {/* Table — hairline borders, no nested cards, no side stripes */}
      <div className="border-t border-brass-500/15">
        {/* Header row */}
        <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-brass-500/15">
          <div className="py-4 pr-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Plan</span>
          </div>
          <div className="py-4 px-2 text-center">
            <p className="text-sm text-ink mb-0.5">Free</p>
            <p className="font-mono text-lg text-ink tabular-nums">$0</p>
            <p className="font-mono text-[10px] text-ink-mute">forever</p>
          </div>
          <div className="py-4 pl-2 text-center">
            <p className="text-sm text-brass-300 mb-0.5">Pro</p>
            <p className="font-mono text-lg text-brass-300 tabular-nums">
              ${displayed.toFixed(2)}
              <span className="text-[10px] text-ink-mute"> /mo</span>
            </p>
            <p className="font-mono text-[10px] text-ink-mute">
              {annual ? `billed $${(proAnnual * 12).toFixed(2)} /yr` : 'billed monthly'}
            </p>
          </div>
        </div>

        {/* Feature rows */}
        {PRICING_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={`grid grid-cols-[1.4fr_1fr_1fr] border-b border-brass-500/10 ${
              i === PRICING_ROWS.length - 1 ? '' : ''
            }`}
          >
            <div className="py-3 pr-4 text-sm text-ink-soft">{row.label}</div>
            <div className="py-3 px-2 flex items-center justify-center"><Cell value={row.free} /></div>
            <div className="py-3 pl-2 flex items-center justify-center"><Cell value={row.pro} /></div>
          </div>
        ))}

        {/* CTA row */}
        <div className="grid grid-cols-[1.4fr_1fr_1fr]">
          <div className="py-5 pr-4 text-xs text-ink-mute">No card needed for Free.</div>
          <div className="py-5 px-2 flex items-center justify-center">
            <span className="font-mono text-[11px] text-ink-mute">Free forever</span>
          </div>
          <div className="py-5 pl-2 flex items-center justify-center">
            <button
              onClick={onGetPro}
              className="bg-brass-500 text-marine-900 text-sm font-medium px-5 py-3 min-h-[48px] hover:bg-brass-400 transition-colors duration-150 flex items-center gap-2"
            >
              Get Pro <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Shared auth form — used in the main landing page and the pro sign-up page. */
const AuthForm: React.FC<{
  mode: AuthMode;
  isLoading: boolean;
  error: string;
  success: string;
  formData: { name: string; email: string; password: string };
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; email: string; password: string }>>;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchMode: (m: AuthMode) => void;
}> = ({ mode, isLoading, error, success, formData, setFormData, onSubmit, onSwitchMode }) => {
  const heading =
    mode === 'login' ? 'Welcome back' :
    mode === 'signup' ? 'Open an account' :
    'Reset password';
  const sub =
    mode === 'login' ? 'Sign in to your CreditTrack account.' :
    mode === 'signup' ? 'Free to start. Upgrade to Pro any time.' :
    "Enter your email and we'll send a recovery link.";

  return (
    <div className="w-full">
      <div className="mb-8">
        <Pill tone="brass">{mode === 'login' ? 'Sign in' : mode === 'signup' ? 'New account' : 'Recovery'}</Pill>
        <h2 className="mt-4 text-[clamp(1.75rem,3vw,2.25rem)] font-medium tracking-tight-display leading-[1.08] text-ink">
          {heading}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{sub}</p>
      </div>

      {error && (
        <div className="mb-5 p-3 border border-danger/40 text-danger text-xs flex items-start gap-2">
          <span className="w-1 h-1 mt-1.5 bg-danger shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-5 p-3 border border-brass-500/40 text-brass-300 text-xs flex items-start gap-2">
          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />
          <span>{success}</span>
        </div>
      )}

      {!success && (
        <form onSubmit={onSubmit} className="space-y-5">
          {mode === 'signup' && (
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-2">
                Full name
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                className="w-full bg-transparent border border-ink-mute/30 px-4 py-4 min-h-[56px] focus:border-brass-500 focus:ring-1 focus:ring-brass-500 outline-none transition-colors text-ink placeholder:text-ink-mute/60"
                placeholder="Your name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-2">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full bg-transparent border border-ink-mute/30 px-4 py-4 min-h-[56px] focus:border-brass-500 focus:ring-1 focus:ring-brass-500 outline-none transition-colors text-ink placeholder:text-ink-mute/60"
              placeholder="you@email.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => onSwitchMode('forgot')}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute hover:text-brass-400 transition-colors"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full bg-transparent border border-ink-mute/30 px-4 py-4 min-h-[56px] focus:border-brass-500 focus:ring-1 focus:ring-brass-500 outline-none transition-colors text-ink placeholder:text-ink-mute/60"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brass-500 text-marine-900 font-medium px-6 py-4 min-h-[56px] hover:bg-brass-400 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
            ) : (
              <>
                {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Open account' : 'Send recovery link'}
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </>
            )}
          </button>
        </form>
      )}

      <div className="mt-7 pt-6 border-t border-brass-500/10 flex items-center justify-between text-sm">
        {mode === 'forgot' ? (
          <button
            onClick={() => onSwitchMode('login')}
            className="inline-flex items-center gap-2 text-ink-mute hover:text-brass-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            Back to sign in
          </button>
        ) : (
          <>
            <span className="text-ink-mute">
              {mode === 'login' ? 'New here?' : 'Have an account?'}
            </span>
            <button
              onClick={() => onSwitchMode(mode === 'login' ? 'signup' : 'login')}
              className="text-brass-300 hover:text-brass-400 transition-colors font-medium"
            >
              {mode === 'login' ? 'Open account →' : 'Sign in →'}
            </button>
          </>
        )}
      </div>

      {mode === 'signup' && (
        <ul className="mt-6 space-y-2">
          {[
            'No card needed for Free',
            'Your statements stay in your account',
            'AI runs on your data only',
          ].map(t => (
            <li key={t} className="flex items-start gap-2 text-xs text-ink-mute">
              <Check className="w-3.5 h-3.5 mt-0.5 text-brass-500 shrink-0" strokeWidth={1.5} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const { login, signup, resetPassword, systemConfig } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signup');
  const authRef = React.useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [showProPage, setShowProPage] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      localStorage.setItem('credittrack_referral_code', refCode);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setSuccess('');
  };

  const handleGetPro = () => {
    setShowProPage(true);
    switchMode('signup');
    window.scrollTo({ top: 0 });
  };

  const scrollToAuth = () => {
    if (window.innerWidth >= 1024) return;
    setTimeout(() => authRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else if (mode === 'signup') {
        const referralCode = localStorage.getItem('credittrack_referral_code') || undefined;
        await signup(formData.name, formData.email, formData.password, referralCode);
        localStorage.removeItem('credittrack_referral_code');
      } else if (mode === 'forgot') {
        await resetPassword(formData.email);
        setSuccess('Recovery link sent — check your inbox.');
      }
    } catch (err: any) {
      if (err.message === 'CHECK_EMAIL') {
        setSuccess('Account created! Check your inbox to confirm, then sign in.');
        setMode('login');
      } else {
        setError(err.message || 'An error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── PRO SIGN-UP PAGE (full-screen replacement, brass + marine) ───────────
  if (showProPage) {
    return (
      <div className="min-h-screen bg-marine-800 text-ink font-sans flex flex-col">
        <header className="border-b border-brass-500/15">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
            <button
              onClick={() => { setShowProPage(false); switchMode('login'); }}
              className="inline-flex items-center gap-2 text-ink-mute hover:text-brass-400 transition-colors text-sm"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              Back
            </button>
            <div className="flex items-center gap-2 text-ink">
              <BrandMark className="w-5 h-5 text-brass-400" />
              <span className="font-semibold tracking-tight-display">CreditTrack</span>
            </div>
            <Pill>Pro</Pill>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-5 sm:px-8 lg:px-12 py-12 lg:py-20 grid lg:grid-cols-[1fr_360px] gap-12 lg:gap-20">
          <section>
            <Pill tone="brass">You're one step from Pro</Pill>
            <h1 className="mt-5 text-[clamp(2.25rem,5vw,3.5rem)] font-medium tracking-tight-display leading-[1.04] text-ink">
              Open your account.<br />
              Upgrade in <span className="text-brass-400">Settings</span>.
            </h1>
            <p className="mt-5 text-ink-soft max-w-prose">
              Takes under two minutes. No card needed for Free — add payment later when you're ready for Pro.
            </p>

            <dl className="mt-10 space-y-5">
              {[
                { kpi: '7+', label: 'Singapore banks', detail: 'DBS, UOB, Citi, HSBC, OCBC, StanChart, AMEX' },
                { kpi: '∞', label: 'Bill uploads', detail: 'No monthly cap on Pro' },
                { kpi: '24/7', label: 'Smart reminders', detail: 'Auto-scheduled, auto-cancelled on payment' },
              ].map(r => (
                <div key={r.label} className="grid grid-cols-[80px_1fr] gap-4 pb-5 border-b border-brass-500/10 last:border-b-0">
                  <div className="font-mono text-2xl text-brass-400 tabular-nums">{r.kpi}</div>
                  <div>
                    <dt className="text-ink font-medium">{r.label}</dt>
                    <dd className="text-sm text-ink-mute mt-0.5">{r.detail}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="border border-brass-500/20 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Monthly</p>
                <p className="mt-2 font-mono text-2xl text-ink tabular-nums">$4.99<span className="text-sm text-ink-mute">/mo</span></p>
                <p className="mt-1 text-xs text-ink-mute">Cancel any time</p>
              </div>
              <div className="border border-brass-500 p-5 relative">
                <span className="absolute -top-2.5 left-3 font-mono text-[10px] uppercase tracking-[0.14em] bg-marine-800 px-2 text-brass-400">Save 40%</span>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Annual</p>
                <p className="mt-2 font-mono text-2xl text-brass-300 tabular-nums">$2.99<span className="text-sm text-ink-mute">/mo</span></p>
                <p className="mt-1 text-xs text-ink-mute">$35.88 billed yearly</p>
              </div>
            </div>
          </section>

          <aside className="lg:border-l lg:border-brass-500/15 lg:pl-12">
            <div className="lg:sticky lg:top-8">
              <AuthForm
                mode={mode}
                isLoading={isLoading}
                error={error}
                success={success}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                onSwitchMode={switchMode}
              />
            </div>
          </aside>
        </main>
      </div>
    );
  }

  // ── MAIN LANDING PAGE ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-marine-800 text-ink font-sans">
      {/* ── Sticky top bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-marine-800/85 backdrop-blur-md border-b border-brass-500/10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-ink">
            <BrandMark className="w-5 h-5 text-brass-400" />
            <span className="font-semibold tracking-tight-display">CreditTrack</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-3">
            <a
              href="#how-it-works"
              className="hidden sm:inline-block text-sm text-ink-mute hover:text-ink transition-colors px-3 py-2 min-h-[40px] flex items-center"
            >
              How it works
            </a>
            <a
              href="#pricing"
              className="hidden sm:inline-block text-sm text-ink-mute hover:text-ink transition-colors px-3 py-2 min-h-[40px] flex items-center"
            >
              Pricing
            </a>
            <button
              onClick={() => { switchMode('login'); scrollToAuth(); }}
              className="text-sm text-ink hover:text-brass-300 transition-colors px-3 py-2 min-h-[40px] flex items-center"
            >
              Sign in
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="border-b border-brass-500/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <Pill tone="brass">Mobile-first · Singapore</Pill>

          <h1 className="mt-5 text-[clamp(2.5rem,6.5vw+0.5rem,4.5rem)] font-medium tracking-tight-display leading-[1.02] text-ink max-w-[16ch]">
            Track every card.<br />
            Earn every mile.
          </h1>

          <p className="mt-6 text-[clamp(1rem,1.5vw,1.125rem)] text-ink-soft leading-relaxed max-w-prose">
            Built for the Singapore miles obsessive who treats their wallet like a portfolio. Statement in, strategy out, reminders handled.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={() => { switchMode('signup'); scrollToAuth(); }}
              className="bg-brass-500 text-marine-900 font-medium px-7 py-4 min-h-[56px] hover:bg-brass-400 transition-colors duration-150 flex items-center justify-center gap-2"
            >
              Open an account <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <a
              href="#how-it-works"
              className="text-sm text-ink hover:text-brass-300 transition-colors px-3 py-3 min-h-[48px] flex items-center justify-center sm:justify-start"
            >
              See how it works ↓
            </a>
          </div>

          {/* Trust strip — supported banks, monospace, hairline rule */}
          <div className="mt-14 pt-8 border-t border-brass-500/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-4">
              Supports all major Singapore issuers
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {BANKS.map(b => (
                <span
                  key={b}
                  className="font-mono text-sm text-ink-soft tabular-nums"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Two-column: marketing + auth ─────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 lg:grid lg:grid-cols-[1fr_360px] lg:gap-16">

        <main>
          {/* How it works — earned numbered sequence (it IS a sequence) */}
          <section id="how-it-works" className="py-16 sm:py-20 lg:py-24 border-b border-brass-500/10">
            <ol className="space-y-10">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.n} className="grid grid-cols-[56px_1fr] gap-5 sm:gap-8">
                    <div className="flex flex-col items-start">
                      <span className="font-mono text-[11px] tabular-nums text-brass-400 tracking-[0.14em]">
                        {s.n}
                      </span>
                      <span className="mt-2 w-px flex-1 bg-brass-500/15 hidden sm:block" style={{ minHeight: '24px' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 text-brass-400 mb-2">
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-medium tracking-tight-display text-ink leading-snug">
                        {s.title}
                      </h3>
                      <p className="mt-2 text-ink-soft leading-relaxed max-w-prose">{s.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Features — varied layout, NOT an identical card grid */}
          <section className="py-16 sm:py-20 lg:py-24 border-b border-brass-500/10">
            <div className="grid sm:grid-cols-2 gap-px bg-brass-500/10">
              {/* Tall split — first feature gets 2 rows */}
              <div className="bg-marine-800 p-6 sm:p-8 sm:row-span-2 flex flex-col">
                <div className="flex items-center gap-3 text-brass-400 mb-4">
                  <Camera className="w-5 h-5" strokeWidth={1.5} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Scan</span>
                </div>
                <h3 className="text-2xl font-medium tracking-tight-display text-ink leading-snug">
                  Read any statement in seconds.
                </h3>
                <p className="mt-3 text-ink-soft leading-relaxed">
                  Drop a PDF, a photo, or snap live from your phone camera. Gemini handles the rest — every transaction, amount, merchant, and due date pulled out automatically, even from consolidated multi-card statements.
                </p>
                <div className="mt-auto pt-6 font-mono text-xs text-ink-mute">
                  → PDF · JPG · PNG · HEIC
                </div>
              </div>

              {/* Short — margin note */}
              <div className="bg-marine-800 p-6 sm:p-8 flex flex-col">
                <div className="flex items-center gap-3 text-brass-400 mb-3">
                  <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Strategise</span>
                </div>
                <h3 className="text-lg font-medium tracking-tight-display text-ink leading-snug">
                  Know which card to tap.
                </h3>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed">
                  Miles-per-dollar ranked by category, shaped by Singapore's miles community.
                </p>
              </div>

              {/* Short — quote-style */}
              <div className="bg-marine-800 p-6 sm:p-8 flex flex-col">
                <div className="flex items-center gap-3 text-brass-400 mb-3">
                  <Bell className="w-4 h-4" strokeWidth={1.5} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Remind</span>
                </div>
                <h3 className="text-lg font-medium tracking-tight-display text-ink leading-snug">
                  "Set and forget" is the goal.
                </h3>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed">
                  Email reminders arrive three days before every due date. Mark a bill paid and the alert cancels itself.
                </p>
              </div>
            </div>

            {/* Final feature as a number-statement, not a card */}
            <div className="mt-12 grid sm:grid-cols-[1fr_auto] gap-6 items-end">
              <div>
                <div className="flex items-center gap-3 text-brass-400 mb-3">
                  <BarChart2 className="w-4 h-4" strokeWidth={1.5} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Portfolio</span>
                </div>
                <h3 className="text-2xl font-medium tracking-tight-display text-ink leading-snug max-w-md">
                  One dashboard for every card you carry.
                </h3>
                <p className="mt-3 text-ink-soft leading-relaxed max-w-md">
                  Spend by bank, category, and month. A 0–100 risk score on your runway. Trends that surface what your statement already said.
                </p>
              </div>
              <div className="font-mono text-[11px] text-ink-mute tabular-nums sm:text-right">
                <div>avg mpd <span className="text-brass-300 ml-2">2.84</span></div>
                <div>monthly spend <span className="text-brass-300 ml-2">$3,210</span></div>
                <div>next due <span className="text-brass-300 ml-2">3d</span></div>
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="py-16 sm:py-20 lg:py-24">
            <PricingTable onGetPro={handleGetPro} />

            <p className="mt-10 font-mono text-xs text-ink-mute max-w-md">
              Pro is a Singapore small-business product billed in SGD by EliteX.CC Group. Cancel any time from Settings.
            </p>
          </section>

          {/* Footer */}
          <footer className="py-12 border-t border-brass-500/10 flex flex-col sm:flex-row justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 text-ink">
                <BrandMark className="w-4 h-4 text-brass-400" />
                <span className="font-semibold tracking-tight-display text-sm">CreditTrack</span>
              </div>
              <p className="mt-3 text-xs text-ink-mute">© 2026 · EliteX.CC Group · Singapore</p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">
              <a href="#" className="hover:text-brass-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-brass-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-brass-400 transition-colors">Contact</a>
            </div>
          </footer>
        </main>

        {/* Auth panel — sticky on desktop, in-flow on mobile */}
        <aside className="py-16 sm:py-20 lg:py-24">
          <div ref={authRef} className="lg:sticky lg:top-20" id="auth">
            <AuthForm
              mode={mode}
              isLoading={isLoading}
              error={error}
              success={success}
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onSwitchMode={switchMode}
            />
          </div>
        </aside>
      </div>

      {/* Sticky bottom CTA — mobile only */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-marine-900/95 backdrop-blur-md border-t border-brass-500/15"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-ink truncate">Open an account</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Free · 30s</p>
          </div>
          <button
            onClick={() => { switchMode('signup'); scrollToAuth(); }}
            className="bg-brass-500 text-marine-900 font-medium px-5 py-3 min-h-[48px] flex items-center gap-2 shrink-0"
          >
            Start <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
};