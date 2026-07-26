
import React, { useState, useEffect, useRef } from 'react';
import { BillUploader } from './components/BillUploader';
import { Dashboard } from './components/Dashboard';
import { InsightPanel } from './components/InsightPanel';
import { Settings } from './components/Settings';
import { LandingPage } from './components/LandingPage';
import { AdminPanel } from './components/AdminPanel';
import { ManualBillModal } from './components/ManualBillModal';
import { BrandMark } from './components/BrandMark';
import { Bill } from './types';
import { EmailLogs } from './components/EmailLogs';
import { ReferralPage } from './components/ReferralPage';
import { FloatingShareBar } from './components/FloatingShareBar';
import {
  LayoutDashboard, PieChart, Settings as SettingsIcon, LogOut,
  LockKeyhole, Mail, Plus, Upload, ChevronRight, Sparkles, Share2
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { dbService } from './services/dbService';

type ServiceStatus = 'ok' | 'error' | 'loading';
interface BackendStatus { supabase: ServiceStatus; resend: ServiceStatus; gemini: ServiceStatus; }

const STATUS_POLL_MS = 60000;

const StatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        setStatus(data);
      } catch {
        setStatus({ supabase: 'error', resend: 'error', gemini: 'error' });
      }
    };
    check();
    const interval = setInterval(check, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const dotColor = !status
    ? 'bg-ink-mute animate-pulse'
    : status.supabase === 'error'
    ? 'bg-danger'
    : status.resend === 'error' || status.gemini === 'error'
    ? 'bg-warning'
    : 'bg-brass-500';

  const label = !status
    ? 'Checking'
    : status.supabase === 'error'
    ? 'System error'
    : status.resend === 'error' || status.gemini === 'error'
    ? 'Partial outage'
    : 'All systems ok';

  const serviceRow = (name: string, s: ServiceStatus | undefined) => (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 flex-shrink-0 ${s === 'ok' ? 'bg-brass-500' : s === 'error' ? 'bg-danger' : 'bg-ink-mute'}`} />
      <span className="text-ink-soft">{name}</span>
      <span className={`ml-auto font-mono text-[10px] uppercase tracking-[0.14em] ${s === 'ok' ? 'text-brass-400' : s === 'error' ? 'text-danger' : 'text-ink-mute'}`}>
        {s === 'ok' ? 'OK' : s === 'error' ? 'Error' : '—'}
      </span>
    </div>
  );

  return (
    <div className="relative flex items-center gap-2" ref={tooltipRef}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`w-2 h-2 cursor-pointer ${dotColor}`} />
      <span className="hidden md:block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute cursor-default">{label}</span>

      {showTooltip && (
        <div className="absolute right-0 top-7 bg-marine-900 border border-brass-500/20 p-4 w-56 z-50">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass-400 mb-3">System status</p>
          <div className="space-y-2 text-xs">
            {serviceRow('Database', status?.supabase)}
            {serviceRow('Email (Resend)', status?.resend)}
            {serviceRow('AI (Gemini)', status?.gemini)}
          </div>
        </div>
      )}
    </div>
  );
};

type ViewType = 'dashboard' | 'upload' | 'settings' | 'admin' | 'logs' | 'referral';

const App: React.FC = () => {
  const { user, logout, loading: authLoading } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [view, setView] = useState<ViewType>('dashboard');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Close avatar menu when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load data from DB when user logs in
  useEffect(() => {
    if (user) {
      setDataLoading(true);
      dbService.getBills(user.id)
        .then(setBills)
        .catch(console.error)
        .finally(() => setDataLoading(false));
    } else {
      setBills([]);
    }
  }, [user]);

  const refreshBills = async () => {
    if (user) {
      const freshBills = await dbService.getBills(user.id);
      setBills(freshBills);
    }
  };

  const handleBillsProcessed = async (newBills: Bill[]) => {
    await refreshBills();
    for (const bill of newBills.filter(b => !b.isPaid)) {
      dbService.scheduleReminder(bill, user!);
    }
    setView('dashboard');
  };

  const handleUpdateBill = async (updatedBill: Bill) => {
    setBills(prev => prev.map(b => b.id === updatedBill.id ? updatedBill : b));
    try {
      await dbService.updateBill(updatedBill);
      if (updatedBill.isPaid && updatedBill.reminderEmailId) {
        dbService.cancelReminder(updatedBill.reminderEmailId);
      }
    } catch (error) {
      console.error("Failed to sync update", error);
    }
  };

  const handleAddBill = async (newBill: Bill) => {
    if (!user) return;
    try {
      const savedBill = await dbService.createBill(newBill, user.id);
      dbService.scheduleReminder(savedBill, user);
      await refreshBills();
    } catch (error) {
      console.error("Failed to create manual bill", error);
    }
  };

  const handleDeleteBill = async (billId: string) => {
    setBills(prev => prev.filter(b => b.id !== billId));
    try {
      await dbService.deleteBill(billId);
    } catch (error) {
      console.error("Failed to delete bill", error);
      await refreshBills();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-marine-800">
        <div className="animate-pulse font-mono text-[11px] uppercase tracking-[0.14em] text-brass-400">Loading CreditTrack</div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const navItems: { id: ViewType; icon: React.FC<any>; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'upload', icon: PieChart, label: 'Upload' },
    { id: 'logs', icon: Mail, label: 'Logs' },
    { id: 'referral', icon: Share2, label: 'Referral' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
  ];

  const sideNavClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-150 min-h-[48px] ${
      active ? 'bg-brass-500/10 text-brass-300' : 'text-ink-soft hover:text-ink hover:bg-marine-800'
    }`;

  const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'pro' ? 'Pro' : 'Free';

  return (
    <div className="min-h-screen bg-marine-800 text-ink font-sans">
      {/* Floating Share Bar */}
      <FloatingShareBar />

      {/* Mobile Header */}
      <div
        className="lg:hidden bg-marine-800/85 backdrop-blur-md border-b border-brass-500/10 px-4 py-3 flex justify-between items-center sticky top-0 z-20"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-2.5">
          <BrandMark className="w-5 h-5 text-brass-400" />
          <span className="font-semibold tracking-tight-display text-ink">CreditTrack</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusIndicator />
          {/* Avatar Menu */}
          <div className="relative" ref={avatarRef}>
            <button
              onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
              aria-label="Account menu"
              className="w-10 h-10 flex items-center justify-center text-sm font-medium border border-brass-500/40 bg-marine-700 text-brass-300 hover:border-brass-500 transition-colors duration-150"
            >
              {user.name.charAt(0).toUpperCase()}
            </button>

            {isAvatarMenuOpen && (
              <div className="absolute right-0 top-12 w-64 z-50 overflow-hidden bg-marine-800 border border-brass-500/20">
                <div className="px-4 py-3 border-b border-brass-500/15">
                  <p className="text-sm text-ink truncate">{user.name}</p>
                  <p className="text-xs text-ink-mute truncate">{user.email}</p>
                  <div className="flex gap-2 mt-2 flex-wrap font-mono text-[10px] uppercase tracking-[0.14em]">
                    <span className={user.role === 'user' ? 'text-ink-mute' : 'text-brass-400'}>{roleLabel}</span>
                  </div>
                </div>
                <div className="p-2">
                  {user.role === 'admin' && (
                    <button
                      onClick={() => { setView('admin'); setIsAvatarMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-3 mb-1 bg-brass-500 text-marine-900 text-sm font-medium hover:bg-brass-400 transition-colors duration-150 min-h-[48px]"
                    >
                      <LockKeyhole className="w-4 h-4" strokeWidth={1.5} />
                      Admin Portal
                      <ChevronRight className="w-3 h-3 ml-auto opacity-70" strokeWidth={1.5} />
                    </button>
                  )}
                  {user.role === 'user' && (
                    <button
                      onClick={() => { setView('settings'); setIsAvatarMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-3 mb-1 bg-brass-500 text-marine-900 text-sm font-medium hover:bg-brass-400 transition-colors duration-150 min-h-[48px]"
                    >
                      <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                      Upgrade to Pro
                      <ChevronRight className="w-3 h-3 ml-auto opacity-70" strokeWidth={1.5} />
                    </button>
                  )}
                  <button
                    onClick={() => { setView('referral'); setIsAvatarMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-ink-soft hover:bg-marine-700 transition-colors duration-150 min-h-[48px]"
                  >
                    <Share2 className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
                    Referral Program
                    <ChevronRight className="w-3 h-3 ml-auto text-ink-mute" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => { logout(); setIsAvatarMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-ink-soft hover:bg-marine-700 transition-colors duration-150 min-h-[48px] border-t border-brass-500/10 mt-1"
                  >
                    <LogOut className="w-4 h-4" strokeWidth={1.5} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-64 bg-marine-900 border-r border-brass-500/15 z-30">
          <div className="p-6 flex flex-col border-b border-brass-500/10">
            <div className="flex items-center gap-2.5 mb-1">
              <BrandMark className="w-6 h-6 text-brass-400" />
              <span className="text-lg font-semibold tracking-tight-display text-ink">CreditTrack</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute ml-9">EliteX.CC Group</span>
          </div>

          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center gap-3 p-3 bg-marine-800 border border-brass-500/15">
              <div className="w-9 h-9 flex items-center justify-center text-sm font-medium border border-brass-500/40 bg-marine-700 text-brass-300 shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-sm text-ink truncate">{user.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] truncate mt-0.5">
                  <span className={user.role === 'user' ? 'text-ink-mute' : 'text-brass-400'}>{roleLabel}</span>
                </p>
              </div>
            </div>

            {/* Upgrade CTA — free users only */}
            {user.role === 'user' && (
              <button
                onClick={() => setView('settings')}
                className="w-full flex items-center justify-center gap-2 bg-brass-500 text-marine-900 text-sm font-medium px-3 py-3 hover:bg-brass-400 transition-colors duration-150 min-h-[48px]"
              >
                <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                Upgrade to Pro
              </button>
            )}
          </div>

          <nav className="p-4 space-y-1 flex-1">
            <button onClick={() => setView('dashboard')} className={sideNavClass(view === 'dashboard')}>
              <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} />
              Dashboard
            </button>
            <button onClick={() => setView('upload')} className={sideNavClass(view === 'upload')}>
              <PieChart className="w-5 h-5" strokeWidth={1.5} />
              Upload &amp; Analyse
            </button>
            <button onClick={() => setView('logs')} className={sideNavClass(view === 'logs')}>
              <Mail className="w-5 h-5" strokeWidth={1.5} />
              Email Logs
            </button>
            <button onClick={() => setView('referral')} className={sideNavClass(view === 'referral')}>
              <Share2 className="w-5 h-5" strokeWidth={1.5} />
              Referral
            </button>

            {user.role === 'admin' && (
              <button onClick={() => setView('admin')} className={sideNavClass(view === 'admin')}>
                <LockKeyhole className="w-5 h-5" strokeWidth={1.5} />
                Admin Portal
              </button>
            )}

            <div className="pt-6 mt-6 border-t border-brass-500/10">
              <button onClick={() => setView('settings')} className={sideNavClass(view === 'settings')}>
                <SettingsIcon className="w-5 h-5" strokeWidth={1.5} />
                Settings
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink-mute hover:text-danger transition-colors duration-150 min-h-[48px]"
              >
                <LogOut className="w-5 h-5" strokeWidth={1.5} />
                Sign Out
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-4 lg:p-8 max-w-7xl mx-auto w-full pb-28 lg:pb-8">
          {view === 'dashboard' && (
            <div className="space-y-8 animate-fade-in">
              {/* Upgrade banner — free users only */}
              {user.role === 'user' && (
                <div className="flex items-center justify-between gap-4 bg-marine-700 border border-brass-500/25 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Sparkles className="w-4 h-4 text-brass-400 shrink-0" strokeWidth={1.5} />
                    <p className="text-sm text-ink-soft truncate">
                      DBS only, <span className="font-mono tabular-nums">3</span> uploads a month on Free.
                      <span className="hidden sm:inline text-ink-mute"> Pro opens all 7 banks and unlimited uploads.</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setView('settings')}
                    className="shrink-0 text-sm font-medium bg-brass-500 text-marine-900 px-4 py-2 hover:bg-brass-400 transition-colors duration-150 min-h-[40px]"
                  >
                    Upgrade
                  </button>
                </div>
              )}

              <header className="flex justify-between items-start gap-4">
                <div>
                  <h1 className="text-2xl font-medium tracking-tight-display text-ink">Financial overview</h1>
                  <p className="text-ink-mute text-sm mt-1">Welcome back, {user.name}.</p>
                </div>
                <div className="hidden md:flex items-center gap-4 shrink-0">
                  <StatusIndicator />
                  <button
                    onClick={() => setView('upload')}
                    className="bg-brass-500 text-marine-900 px-4 py-2.5 hover:bg-brass-400 transition-colors duration-150 font-medium text-sm min-h-[44px]"
                  >
                    Upload a bill
                  </button>
                </div>
              </header>

              {dataLoading && bills.length === 0 ? (
                <div className="h-40 flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">Loading your data</div>
              ) : (
                <>
                  <InsightPanel bills={bills} />
                  <Dashboard
                    bills={bills}
                    onUpdateBill={handleUpdateBill}
                    onAddBill={handleAddBill}
                    onDeleteBill={handleDeleteBill}
                    onOpenManualModal={() => setIsManualModalOpen(true)}
                  />
                </>
              )}
            </div>
          )}

          {view === 'upload' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <header>
                <button
                  onClick={() => setView('dashboard')}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute hover:text-brass-400 transition-colors duration-150 mb-3 block min-h-[40px]"
                >
                  &larr; Back to dashboard
                </button>
                <h1 className="text-2xl font-medium tracking-tight-display text-ink">Upload statement</h1>
                <p className="text-ink-mute text-sm mt-1">A photo or PDF works. We read every line.</p>
              </header>
              <BillUploader onBillProcessed={handleBillsProcessed} />
            </div>
          )}

          {view === 'logs' && <EmailLogs />}
          {view === 'settings' && <Settings />}
          {view === 'admin' && user.role === 'admin' && <AdminPanel />}
          {view === 'referral' && <ReferralPage onBack={() => setView('dashboard')} />}
        </main>
      </div>

      {/* Bottom Navigation — mobile only */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-marine-900 border-t border-brass-500/15 z-20 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 min-h-[56px] font-mono text-[9px] uppercase tracking-[0.12em] transition-colors duration-150 ${
              view === id ? 'text-brass-400' : 'text-ink-mute'
            }`}
          >
            <Icon className="w-5 h-5" strokeWidth={1.5} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* FAB — mobile only, shown on dashboard */}
      {view === 'dashboard' && (
        <div className="lg:hidden fixed bottom-24 right-4 z-30 flex flex-col items-end gap-2">
          {isFabOpen && (
            <>
              <button
                onClick={() => { setView('upload'); setIsFabOpen(false); }}
                className="flex items-center gap-2 bg-marine-900 text-ink border border-brass-500/30 px-4 py-3 text-sm font-medium min-h-[48px]"
              >
                <Upload className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
                Upload bill
              </button>
              <button
                onClick={() => { setIsManualModalOpen(true); setIsFabOpen(false); }}
                className="flex items-center gap-2 bg-marine-900 text-ink border border-brass-500/30 px-4 py-3 text-sm font-medium min-h-[48px]"
              >
                <Plus className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
                Manual entry
              </button>
            </>
          )}
          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            aria-label={isFabOpen ? 'Close actions' : 'Open actions'}
            className={`w-14 h-14 flex items-center justify-center bg-brass-500 text-marine-900 transition-transform duration-150 ${
              isFabOpen ? 'rotate-45' : ''
            }`}
          >
            <Plus className="w-7 h-7" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* FAB backdrop */}
      {isFabOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20"
          onClick={() => setIsFabOpen(false)}
        />
      )}

      {/* Manual Bill Modal — lifted to App level for FAB access */}
      <ManualBillModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onAdd={handleAddBill}
      />
    </div>
  );
};

export default App;
