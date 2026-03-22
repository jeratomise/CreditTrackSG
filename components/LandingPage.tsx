
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield, ArrowRight, Loader2, Zap, BarChart2, Bell,
  CreditCard, ChevronLeft, Users, CheckCircle, Upload,
  Sparkles, TrendingUp, Smartphone, X
} from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot';

const BANKS = ['DBS', 'UOB', 'Citi', 'HSBC', 'OCBC', 'StanChart', 'AMEX'];

const FEATURES = [
  {
    icon: <Zap className="w-5 h-5 text-yellow-400" />,
    title: 'Neural Bill Extraction',
    desc: 'Drop a PDF, photo, or snap directly from your phone camera. AI reads your full statement — including multi-card consolidated bills — in seconds. No manual entry.',
    color: 'yellow',
  },
  {
    icon: <Users className="w-5 h-5 text-indigo-400" />,
    title: 'Crowdsourced Miles Strategy',
    desc: "Card recommendations shaped by Singapore's miles community. Know exactly which card to swipe for dining, travel, online shopping, and more.",
    color: 'indigo',
  },
  {
    icon: <Bell className="w-5 h-5 text-emerald-400" />,
    title: 'Smart Payment Reminders',
    desc: 'Auto-scheduled email alerts sent 3 days before every due date. Cancel automatically when you mark a bill as paid.',
    color: 'emerald',
  },
  {
    icon: <BarChart2 className="w-5 h-5 text-blue-400" />,
    title: 'Full Portfolio Analytics',
    desc: 'One dashboard for all your cards. Spend trends by bank, category breakdowns, risk scoring, and outstanding balance at a glance.',
    color: 'blue',
  },
  {
    icon: <Smartphone className="w-5 h-5 text-pink-400" />,
    title: 'On-the-Go Ready',
    desc: 'Built mobile-first. Bottom navigation, swipeable card views, and a quick-action button let you manage bills in seconds — anywhere, anytime.',
    color: 'pink',
  },
];

const STEPS = [
  {
    n: '01',
    icon: <Upload className="w-5 h-5" />,
    title: 'Upload your statement',
    desc: 'PDF, photo, or snap live from your phone camera — even consolidated multi-card DBS or Citi statements.',
  },
  {
    n: '02',
    icon: <Sparkles className="w-5 h-5" />,
    title: 'AI extracts everything',
    desc: 'Every transaction, amount, and due date pulled out automatically.',
  },
  {
    n: '03',
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'Optimise & never miss a payment',
    desc: 'Get miles strategy advice and auto-scheduled reminders — zero setup.',
  },
];

const STATS = [
  { value: '7+', label: 'Banks Supported' },
  { value: 'AI', label: 'Powered Extraction' },
  { value: '📱', label: 'Mobile-First Design' },
];

const PRICING_ROWS = [
  { label: 'Bill uploads',          free: '3 / month',     pro: 'Unlimited' },
  { label: 'Statement history',     free: 'Last 3 months', pro: 'All time' },
  { label: 'AI Miles Optimisation', free: '1× / month',    pro: 'Unlimited, real-time' },
  { label: 'Smart email reminders', free: false,           pro: true },
  { label: 'Banks supported',       free: 'DBS only',      pro: 'All 7+ banks' },
  { label: 'Spend analytics',       free: 'KPIs only',     pro: 'Full charts & trends' },
  { label: 'Camera bill capture',   free: false,           pro: true },
  { label: 'Multi-device sync',     free: false,           pro: true },
  { label: 'Support',               free: '—',             pro: 'Priority' },
];

const PricingTable: React.FC<{ onGetPro?: () => void }> = ({ onGetPro }) => {
  const [annual, setAnnual] = useState(true);

  const proMonthly = 4.99;
  const proAnnual  = 2.99;
  const displayed  = annual ? proAnnual : proMonthly;
  const saving     = Math.round((1 - (proAnnual * 12) / (proMonthly * 12)) * 100);

  const Cell = ({ value }: { value: string | boolean }) => {
    if (value === true)  return <CheckCircle className="w-4 h-4 text-indigo-400 mx-auto" />;
    if (value === false) return <X className="w-4 h-4 text-slate-700 mx-auto" />;
    return <span className="text-xs text-slate-400">{value}</span>;
  };

  return (
    <div className="mb-10">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-6">Pricing</p>

      {/* Toggle */}
      <div className="flex items-center gap-3 mb-6">
        <span className={`text-sm font-medium transition-colors ${!annual ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${annual ? 'bg-indigo-600' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${annual ? 'left-7' : 'left-1'}`} />
        </button>
        <span className={`text-sm font-medium transition-colors ${annual ? 'text-white' : 'text-slate-500'}`}>
          Annual
          {annual && (
            <span className="ml-2 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
              SAVE {saving}%
            </span>
          )}
        </span>
      </div>

      {/* Cards + Table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-3 bg-white/[0.03]">
          <div className="p-4 border-r border-white/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Feature</p>
          </div>
          {/* Free */}
          <div className="p-4 border-r border-white/[0.06] text-center">
            <p className="text-xs font-bold text-slate-400 mb-1">Free</p>
            <p className="text-2xl font-black text-white">$0</p>
            <p className="text-[10px] text-slate-600">forever</p>
          </div>
          {/* Pro */}
          <div className="p-4 text-center bg-indigo-600/10 relative">
            <div className="absolute top-2 right-2 text-[9px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-full tracking-wide">
              {annual ? 'LAUNCH PRICE' : 'POPULAR'}
            </div>
            <p className="text-xs font-bold text-indigo-400 mb-1">Pro</p>
            <div className="flex items-baseline justify-center gap-1">
              <p className="text-2xl font-black text-white">${displayed.toFixed(2)}</p>
              <span className="text-[10px] text-slate-500">/ mo</span>
            </div>
            <p className="text-[10px] text-slate-500">
              {annual ? `billed $${(proAnnual * 12).toFixed(2)} / year` : 'billed monthly'}
            </p>
          </div>
        </div>

        {/* Feature rows */}
        {PRICING_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={`grid grid-cols-3 border-t border-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
          >
            <div className="px-4 py-3 border-r border-white/[0.04] flex items-center">
              <span className="text-xs text-slate-400">{row.label}</span>
            </div>
            <div className="px-4 py-3 border-r border-white/[0.04] flex items-center justify-center">
              <Cell value={row.free} />
            </div>
            <div className="px-4 py-3 flex items-center justify-center bg-indigo-600/5">
              <Cell value={row.pro} />
            </div>
          </div>
        ))}

        {/* CTA row */}
        <div className="grid grid-cols-3 border-t border-white/[0.07] bg-white/[0.02]">
          <div className="p-4 border-r border-white/[0.06]" />
          <div className="p-4 border-r border-white/[0.06] flex items-center justify-center">
            <span className="text-xs text-slate-600 font-medium">No card needed</span>
          </div>
          <div className="p-4 flex items-center justify-center bg-indigo-600/10">
            <button
              onClick={onGetPro}
              className="text-xs text-white font-bold bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Get Pro →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const { login, signup, resetPassword, systemConfig } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const authRef = React.useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [showProPage, setShowProPage] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else if (mode === 'signup') {
        await signup(formData.name, formData.email, formData.password);
      } else if (mode === 'forgot') {
        await resetPassword(formData.email);
        setSuccess('Recovery link sent — check your inbox.');
      }
    } catch (err: any) {
      if (err.message === 'CHECK_EMAIL') {
        setSuccess('Account created! Check your inbox to confirm your email, then sign in.');
        setMode('login');
      } else {
        setError(err.message || 'An error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── PRO SIGN-UP PAGE ─────────────────────────────────────────────────────
  if (showProPage) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-700/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-[120px]" />
        </div>

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/5">
          <button
            onClick={() => { setShowProPage(false); switchMode('login'); }}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-indigo-600 to-blue-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              CreditTrack
            </span>
          </div>
          <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-indigo-400/70 bg-indigo-500/5 px-3 py-1 rounded-full border border-indigo-500/20">
            EliteX.CC
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full px-6 py-10 lg:py-16 gap-12 lg:gap-20">

          {/* Left: Pro value prop */}
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Upgrade to Pro
            </div>
            <h1 className="text-4xl lg:text-5xl font-black leading-tight tracking-tight mb-4">
              You're one step<br />
              from{' '}
              <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                Pro.
              </span>
            </h1>
            <p className="text-slate-400 text-base mb-8">
              Create your free account, then upgrade to Pro in Settings. Takes under 2 minutes.
            </p>

            {/* Pro benefits */}
            <div className="space-y-3">
              {[
                { icon: '🏦', text: 'All 7+ Singapore banks — DBS, UOB, Citi, HSBC, OCBC, StanChart, AMEX' },
                { icon: '♾️', text: 'Unlimited bill uploads every month' },
                { icon: '📊', text: 'Full portfolio analytics — charts, trends, risk scoring' },
                { icon: '🤖', text: 'Unlimited real-time AI miles optimisation' },
                { icon: '🔔', text: 'Smart payment reminders — auto-scheduled, auto-cancelled' },
                { icon: '📱', text: 'Camera capture, multi-device sync, priority support' },
              ].map(b => (
                <div key={b.text} className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                  <span className="text-lg">{b.icon}</span>
                  <span className="text-sm text-slate-300">{b.text}</span>
                </div>
              ))}
            </div>

            {/* Pricing reminder */}
            <div className="mt-8 flex gap-4">
              <div className="flex-1 bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-white">$4.99</p>
                <p className="text-xs text-slate-500 mt-0.5">per month</p>
              </div>
              <div className="flex-1 bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 text-center relative">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-black bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full whitespace-nowrap">SAVE 40%</span>
                <p className="text-2xl font-black text-white">$2.99</p>
                <p className="text-xs text-slate-500 mt-0.5">per month · billed annually</p>
              </div>
            </div>
          </div>

          {/* Right: Sign-up form */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="bg-[#080b12] border border-white/[0.07] rounded-2xl p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-black text-white mb-1">
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-slate-500 text-sm">
                  {mode === 'login' ? 'Sign in to continue.' : 'Free to start. Upgrade to Pro anytime.'}
                </p>
              </div>

              {success && (
                <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold mb-0.5">Check your inbox!</p>
                    <p className="text-xs text-emerald-500">We've sent a confirmation link to <strong>{formData.email}</strong>. Click it to activate your account, then sign in here.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {error}
                </div>
              )}

              {!success && <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Full Name</label>
                    <input
                      type="text" required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600 text-sm"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Email</label>
                  <input
                    type="email" required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600 text-sm"
                    placeholder="you@email.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                {mode !== 'forgot' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Password</label>
                    <input
                      type="password" required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600 text-sm"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                )}
                <button
                  type="submit" disabled={isLoading}
                  className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>}

              {!success && (
                <div className="mt-6 pt-5 border-t border-white/5 text-center">
                  <p className="text-sm text-slate-500">
                    {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <button
                      onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                      className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                    >
                      {mode === 'login' ? 'Sign Up' : 'Sign In'}
                    </button>
                  </p>
                </div>
              )}

              {success && (
                <div className="mt-6 pt-5 border-t border-white/5 text-center">
                  <button
                    onClick={() => { setSuccess(''); switchMode('login'); }}
                    className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors text-sm"
                  >
                    Back to Sign In →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Auth form content (shared between mobile and desktop)
  const authContent = (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-black text-white mb-2">
          {mode === 'login' && 'Welcome back'}
          {mode === 'signup' && 'Get started free'}
          {mode === 'forgot' && 'Reset password'}
        </h2>
        <p className="text-slate-500 text-sm">
          {mode === 'login' && 'Sign in to your CreditTrack account.'}
          {mode === 'signup' && 'Create your account. No credit card required.'}
          {mode === 'forgot' && 'Enter your email and we\'ll send a recovery link.'}
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-3">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Full Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 text-sm"
              placeholder="Your name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Email</label>
          <input
            type="email"
            required
            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 text-sm"
            placeholder="you@email.com"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        {mode !== 'forgot' && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Password</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-[11px] text-indigo-400 hover:text-white font-semibold transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              type="password"
              required
              className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 text-sm"
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {mode === 'login' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgot' && 'Send Recovery Link'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Mode switcher */}
      <div className="mt-8 pt-6 border-t border-white/5 text-center">
        {mode === 'forgot' ? (
          <button
            onClick={() => switchMode('login')}
            className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors mx-auto"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Sign In
          </button>
        ) : (
          <p className="text-sm text-slate-500">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        )}
      </div>

      {/* Trust signals */}
      <div className="mt-8 pt-6 border-t border-white/5 space-y-2">
        {[
          'Bank-grade encryption via Supabase',
          'Your statements are never stored in plain text',
          'AI analysis runs on your data only',
        ].map(t => (
          <div key={t} className="flex items-center gap-2 text-[11px] text-slate-600">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            {t}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500 selection:text-white">

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE LAYOUT (< lg)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col">

        {/* ── MOBILE: Compact Hero ── */}
        <div className="relative overflow-hidden px-6 pt-6 pb-8">
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-30%] left-[-30%] w-[400px] h-[400px] bg-indigo-700/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[300px] h-[300px] bg-blue-700/10 rounded-full blur-[100px]" />
          </div>

          <div className="relative z-10">
            {/* Logo row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-indigo-600 to-blue-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  CreditTrack
                </span>
              </div>
              <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-indigo-400/70 bg-indigo-500/5 px-3 py-1 rounded-full border border-indigo-500/20">
                EliteX.CC
              </span>
            </div>

            {/* Animated badge pill */}
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Mobile-first · Singapore's card tracker
            </div>

            {/* Headline */}
            <h1 className="text-4xl font-black leading-tight tracking-tight mb-4">
              Stop Paying Late Fees.<br />
              <span className="bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                Start Earning More.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-400 text-sm mb-5">
              AI-powered bill tracking with miles optimization for Singapore cards.
            </p>

            {/* Benefit pills */}
            <div className="flex flex-wrap gap-2">
              <span className="bg-white/5 border border-white/[0.08] text-slate-400 text-xs px-3 py-1.5 rounded-full">
                AI Bill Extraction
              </span>
              <span className="bg-white/5 border border-white/[0.08] text-slate-400 text-xs px-3 py-1.5 rounded-full">
                Miles Strategy
              </span>
              <span className="bg-white/5 border border-white/[0.08] text-slate-400 text-xs px-3 py-1.5 rounded-full">
                Auto Reminders
              </span>
            </div>
          </div>
        </div>

        {/* ── MOBILE: Auth Section ── */}
        <div ref={authRef} className="bg-[#080b12] px-6 py-8">
          <div className="w-full relative z-10">
            {authContent}
          </div>
        </div>

        {/* ── MOBILE: Marketing Section ── */}
        <div className="bg-slate-950 px-6 py-10">

          {/* Why CreditTrack? */}
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-6">Why CreditTrack?</p>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3 mb-10">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="group bg-white/[0.03] border border-white/[0.06] p-4 rounded-2xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-white/5 p-1.5 rounded-lg">
                    {f.icon}
                  </div>
                </div>
                <h3 className="font-bold text-white text-xs leading-tight mb-1">{f.title}</h3>
                <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-3">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="mb-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-5">How it works</p>
            <div className="flex flex-col gap-4">
              {STEPS.map((step, i) => (
                <div key={step.n} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="bg-indigo-600/20 text-indigo-400 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                      {step.icon}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="w-px h-4 mt-2 bg-white/5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-indigo-500 font-bold mb-1">{step.n}</p>
                    <p className="text-sm font-semibold text-white mb-1">{step.title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supported Banks */}
          <div className="mb-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-4">Supported Banks</p>
            <div className="flex flex-wrap gap-2">
              {BANKS.map(b => (
                <span
                  key={b}
                  className="text-[11px] font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.07] px-3 py-1.5 rounded-lg"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <PricingTable onGetPro={handleGetPro} />

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col gap-4 text-[11px] font-medium text-slate-600 uppercase tracking-widest">
            <p>© CreditTrack · EliteX.CC Group</p>
            <div className="flex gap-6">
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">Terms</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT (>= lg) — UNCHANGED FROM ORIGINAL
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-row min-h-screen">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:w-[58%] relative overflow-hidden flex flex-col p-8 lg:p-14 xl:p-20">
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[-20%] w-[900px] h-[900px] bg-indigo-700/10 rounded-full blur-[130px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-blue-700/10 rounded-full blur-[130px]" />
          </div>

          <div className="relative z-10 flex-1 flex flex-col">
            {/* Nav */}
            <div className="flex items-center justify-between mb-14">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-indigo-600 to-blue-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  CreditTrack
                </span>
              </div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-indigo-400/70 bg-indigo-500/5 px-4 py-1.5 rounded-full border border-indigo-500/20">
                EliteX.CC
              </span>
            </div>

            {/* Hero */}
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Mobile-first · Singapore's card tracker
              </div>

              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black leading-[0.92] tracking-tight mb-6">
                Stop Paying<br />
                Late Fees.<br />
                <span className="bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                  Start Earning More.
                </span>
              </h1>

              <p className="text-lg text-slate-400 leading-relaxed max-w-lg font-light">
                {systemConfig.landingPage?.heroSubtitle ||
                  'Upload any credit card statement. AI extracts every transaction instantly. Get crowdsourced miles strategy and automated payment reminders — all in one place.'}
              </p>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-8 mb-10 pb-10 border-b border-white/5">
              {STATS.map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-black text-white">{s.value}</div>
                  <div className="text-[11px] text-slate-500 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
              {FEATURES.map(f => (
                <div
                  key={f.title}
                  className="group bg-white/[0.03] border border-white/[0.06] p-5 rounded-2xl hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white/5 p-2 rounded-lg group-hover:scale-110 transition-transform">
                      {f.icon}
                    </div>
                    <h3 className="font-bold text-white text-sm leading-tight">{f.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="mb-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-5">How it works</p>
              <div className="flex flex-col sm:flex-row gap-4">
                {STEPS.map((step, i) => (
                  <div key={step.n} className="flex-1 flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="bg-indigo-600/20 text-indigo-400 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                        {step.icon}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className="hidden sm:block w-px flex-1 mt-2 bg-white/5" />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-indigo-500 font-bold mb-1">{step.n}</p>
                      <p className="text-sm font-semibold text-white mb-1">{step.title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Banks supported */}
            <div className="mb-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-4">Supported Banks</p>
              <div className="flex flex-wrap gap-2">
                {BANKS.map(b => (
                  <span
                    key={b}
                    className="text-[11px] font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.07] px-3 py-1.5 rounded-lg"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <PricingTable onGetPro={handleGetPro} />
          </div>

          {/* Footer */}
          <div className="relative z-10 mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[11px] font-medium text-slate-600 uppercase tracking-widest">
            <p>© 2026 CreditTrack · EliteX.CC Group</p>
            <div className="flex gap-6">
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-indigo-400 cursor-pointer transition-colors">Terms</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Auth ── */}
        <div ref={authRef} className="lg:w-[42%] bg-[#080b12] flex items-start justify-center p-8 lg:p-12 lg:pt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent pointer-events-none" />

          <div className="w-full max-w-sm relative z-10">
            {authContent}
          </div>
        </div>
      </div>
    </div>
  );
};
