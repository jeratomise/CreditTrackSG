
import React, { useState, useEffect, useRef } from 'react';
import { BillUploader } from './components/BillUploader';
import { Dashboard } from './components/Dashboard';
import { InsightPanel } from './components/InsightPanel';
import { Settings } from './components/Settings';
import { LandingPage } from './components/LandingPage';
import { AdminPanel } from './components/AdminPanel';
import { ManualBillModal } from './components/ManualBillModal';
import { Bill } from './types';
import { EmailLogs } from './components/EmailLogs';
import {
  LayoutDashboard, PieChart, Settings as SettingsIcon, Shield, LogOut,
  LockKeyhole, Mail, Plus, X, Upload, ChevronRight, User, Sparkles
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { dbService } from './services/dbService';

type ServiceStatus = 'ok' | 'error' | 'loading';
interface BackendStatus { supabase: ServiceStatus; resend: ServiceStatus; gemini: ServiceStatus; }

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
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  const dotColor = !status
    ? 'bg-gray-400 animate-pulse'
    : status.supabase === 'error'
    ? 'bg-red-500'
    : status.resend === 'error' || status.gemini === 'error'
    ? 'bg-yellow-400'
    : 'bg-green-500';

  const label = !status
    ? 'Checking...'
    : status.supabase === 'error'
    ? 'System Error'
    : status.resend === 'error' || status.gemini === 'error'
    ? 'Partial Outage'
    : 'All Systems OK';

  const serviceRow = (name: string, s: ServiceStatus | undefined) => (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s === 'ok' ? 'bg-green-500' : s === 'error' ? 'bg-red-500' : 'bg-gray-400'}`} />
      <span className="text-gray-600">{name}</span>
      <span className={`ml-auto text-[10px] font-bold uppercase ${s === 'ok' ? 'text-green-600' : s === 'error' ? 'text-red-600' : 'text-gray-400'}`}>
        {s === 'ok' ? 'OK' : s === 'error' ? 'Error' : '...'}
      </span>
    </div>
  );

  return (
    <div className="relative flex items-center gap-1.5" ref={tooltipRef}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`w-2.5 h-2.5 rounded-full cursor-pointer ${dotColor}`} />
      <span className="hidden md:block text-xs text-gray-500 cursor-default">{label}</span>

      {showTooltip && (
        <div className="absolute right-0 top-7 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-52 z-50">
          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">System Status</p>
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

type ViewType = 'dashboard' | 'upload' | 'settings' | 'admin' | 'logs';

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
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-indigo-600">Loading CreditTrack...</div></div>;
  }

  if (!user) {
    return <LandingPage />;
  }

  const navItems: { id: ViewType; icon: React.FC<any>; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'upload', icon: PieChart, label: 'Upload' },
    { id: 'logs', icon: Mail, label: 'Logs' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
          <Shield className="w-6 h-6" />
          CreditTrack
        </div>
        <div className="flex items-center gap-3">
          <StatusIndicator />
          {/* Avatar Menu */}
          <div className="relative" ref={avatarRef}>
            <button
              onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                user.role === 'pro'
                  ? 'bg-amber-100 text-amber-800 border-amber-400'
                  : 'bg-indigo-100 text-indigo-700 border-indigo-200'
              }`}
            >
              {user.name.charAt(0).toUpperCase()}
            </button>

            {isAvatarMenuOpen && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-xl w-56 z-50 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-indigo-50/50">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {user.role === 'admin' && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">ADMIN</span>
                    )}
                    {user.role === 'pro' && (
                      <span className="text-[10px] bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 px-1.5 py-0.5 rounded font-bold">⭐ PRO</span>
                    )}
                    {user.role === 'user' && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-semibold">FREE</span>
                    )}
                  </div>
                </div>
                <div className="p-2">
                  {user.role === 'user' && (
                    <button
                      onClick={() => { setView('settings'); setIsAvatarMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 mb-1 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Upgrade to Pro
                      <ChevronRight className="w-3 h-3 ml-auto opacity-70" />
                    </button>
                  )}
                  {user.role === 'admin' && (
                    <button
                      onClick={() => { setView('admin'); setIsAvatarMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <LockKeyhole className="w-4 h-4 text-indigo-500" />
                      Admin Portal
                      <ChevronRight className="w-3 h-3 ml-auto text-gray-400" />
                    </button>
                  )}
                  <button
                    onClick={() => { logout(); setIsAvatarMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-1"
                  >
                    <LogOut className="w-4 h-4" />
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
        <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 z-30">
          <div className="p-6 flex flex-col border-b border-gray-100">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-2xl mb-1">
              <Shield className="w-8 h-8" />
              CreditTrack
            </div>
            <span className="text-xs text-gray-400 ml-10">EliteX.CC Group</span>
          </div>

          <div className="px-4 py-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-50">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${user.role === 'pro' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-200 text-indigo-700'}`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                  {user.role === 'admin' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded font-semibold shrink-0">ADMIN</span>}
                  {user.role === 'pro' && <span className="text-[10px] bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 px-1 rounded font-bold shrink-0">⭐ PRO</span>}
                  {user.role === 'user' && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-semibold shrink-0">FREE</span>}
                </div>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>

            {/* Upgrade CTA — free users only */}
            {user.role === 'user' && (
              <button
                onClick={() => setView('settings')}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade to Pro — $2.99/mo
              </button>
            )}
          </div>

          <nav className="p-4 space-y-2 flex-1">
            <button
              onClick={() => setView('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === 'dashboard' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </button>
            <button
              onClick={() => setView('upload')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === 'upload' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <PieChart className="w-5 h-5" />
              Upload & Analyze
            </button>
            <button
              onClick={() => setView('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === 'logs' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Mail className="w-5 h-5" />
              Email Logs
            </button>

            {user.role === 'admin' && (
              <button
                onClick={() => setView('admin')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <LockKeyhole className="w-5 h-5" />
                Admin Portal
              </button>
            )}

            <div className="pt-8 mt-8 border-t border-gray-100">
              <button
                onClick={() => setView('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <SettingsIcon className="w-5 h-5" />
                Settings
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-500 hover:bg-red-50 mt-2"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-4 lg:p-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8">
          {view === 'dashboard' && (
            <div className="space-y-8 animate-fade-in">
              {/* Upgrade banner — free users only */}
              {user.role === 'user' && (
                <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                    <p className="text-sm text-indigo-700 font-medium truncate">
                      <span className="font-bold">You're on Free</span> — DBS only, 3 uploads/month.{' '}
                      <span className="hidden sm:inline text-indigo-500">Unlock all 7 banks, unlimited uploads & full analytics.</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setView('settings')}
                    className="shrink-0 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Upgrade →
                  </button>
                </div>
              )}

              <header className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h1 className="text-2xl font-bold text-gray-900">Financial Overview</h1>
                    {user.role === 'pro' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 shadow-sm">
                        ⭐ PRO
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">Welcome back, {user.name}. Here is your 2026 summary.</p>
                </div>
                <div className="hidden md:flex items-center gap-3">
                  <StatusIndicator />
                  <button
                    onClick={() => setView('upload')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium"
                  >
                    + Upload Bill
                  </button>
                </div>
              </header>

              {dataLoading && bills.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-gray-400">Loading your data...</div>
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
                  className="text-sm text-gray-500 hover:text-gray-900 mb-2 block"
                >
                  &larr; Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Upload Statement</h1>
                <p className="text-gray-500">Upload a screenshot or PDF of your bill. AI will extract the details.</p>
              </header>
              <BillUploader onBillProcessed={handleBillsProcessed} />
            </div>
          )}

          {view === 'logs' && <EmailLogs />}
          {view === 'settings' && <Settings />}
          {view === 'admin' && user.role === 'admin' && <AdminPanel />}
        </main>
      </div>

      {/* Bottom Navigation — mobile only */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-20 flex safe-area-bottom">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-[10px] font-medium transition-colors ${
              view === id ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <Icon className={`w-5 h-5 ${view === id ? 'text-indigo-600' : 'text-gray-400'}`} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* FAB — mobile only, shown on dashboard */}
      {view === 'dashboard' && (
        <div className="lg:hidden fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2">
          {isFabOpen && (
            <>
              <button
                onClick={() => { setView('upload'); setIsFabOpen(false); }}
                className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2"
              >
                <Upload className="w-4 h-4" />
                Upload Bill
              </button>
              <button
                onClick={() => { setIsManualModalOpen(true); setIsFabOpen(false); }}
                className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2"
              >
                <Plus className="w-4 h-4" />
                Manual Entry
              </button>
            </>
          )}
          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${
              isFabOpen ? 'bg-gray-700 rotate-45' : 'bg-indigo-600'
            }`}
          >
            <Plus className="w-7 h-7 text-white" />
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
