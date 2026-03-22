
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield, ArrowRight, Loader2, Zap, BarChart2, Bell,
  CreditCard, ChevronLeft, Users, CheckCircle, Upload,
  Sparkles, TrendingUp, Smartphone
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

export const LandingPage: React.FC = () => {
  const { login, signup, resetPassword, systemConfig } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setSuccess('');
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
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-950 text-white font-sans selection:bg-indigo-500 selection:text-white">

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
              EliteX.CC · 2026
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
          <div>
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
      <div className="lg:w-[42%] bg-[#080b12] flex items-center justify-center p-8 lg:p-12 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent pointer-events-none" />

        <div className="w-full max-w-sm relative z-10">
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
        </div>
      </div>
    </div>
  );
};
