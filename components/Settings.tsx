
import React, { useState, useEffect } from 'react';
import { UserSettings, ReferralStats } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Save, Bell, Mail, Clock, Lock, CheckCircle, AlertCircle, Loader2, ShieldCheck, Sparkles, ExternalLink, Copy, Users, Gift } from 'lucide-react';
import { AlertModal } from './AlertModal';
import { fieldClass, labelClass, primaryButtonClass } from './formStyles';

const SAVED_RESET_MS = 3000;
const PASS_MSG_RESET_MS = 5000;
const COPIED_RESET_MS = 2000;
const MIN_PASSWORD_LENGTH = 8;

type CopyTarget = 'code' | 'url';

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="bg-marine-900 border border-brass-500/15">
    <div className="px-6 py-4 border-b border-brass-500/10 flex items-center gap-2.5">
      {icon}
      <h2 className="text-base font-medium text-ink">{title}</h2>
    </div>
    <div className="p-6">{children}</div>
  </section>
);

export const Settings: React.FC = () => {
  const { changePassword, user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    email: '',
    notificationFrequency: 'weekly',
    reminderEnabled: true
  });
  const [saved, setSaved] = useState(false);

  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [passMsg, setPassMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [refLoading, setRefLoading] = useState(false);
  // Track which field was copied so one tick does not light up both buttons
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const copyToClipboard = (target: CopyTarget, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedTarget(target);
    setTimeout(() => setCopiedTarget(null), COPIED_RESET_MS);
  };

  const handleUpgrade = async (billingCycle: 'monthly' | 'annual') => {
    if (!user) return;
    setIsUpgrading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ billingCycle }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setAlertMessage(data.error || 'Failed to start checkout');
    } catch (err: any) {
      setAlertMessage(err.message);
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    setIsUpgrading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setAlertMessage(data.error || 'Failed to open billing portal');
    } catch (err: any) {
      setAlertMessage(err.message);
    } finally {
      setIsUpgrading(false);
    }
  };

  useEffect(() => {
    const savedSettings = localStorage.getItem('credittrack_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    if (user?.email && (!savedSettings)) {
        setSettings(prev => ({ ...prev, email: user.email }));
    }
  }, [user]);

  // Fetch referral stats on mount
  useEffect(() => {
    if (!user) return;
    const fetchRefStats = async () => {
      setRefLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;
        const res = await fetch('/api/referrals/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const stats = await res.json();
          setReferralStats(stats);
        }
      } catch (err) {
        console.error("Failed to fetch referral stats:", err);
      } finally {
        setRefLoading(false);
      }
    };
    fetchRefStats();
  }, [user]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('credittrack_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), SAVED_RESET_MS);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setPassMsg(null);

      if (passwords.new.length < MIN_PASSWORD_LENGTH) {
          setPassMsg({ type: 'error', text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
          return;
      }
      if (passwords.new !== passwords.confirm) {
          setPassMsg({ type: 'error', text: 'The two passwords do not match.' });
          return;
      }

      setIsChangingPassword(true);

      try {
          // The supabase call is handled inside context
          await changePassword(passwords.new);
          setPassMsg({ type: 'success', text: 'Password updated.' });
          setPasswords({ new: '', confirm: '' });

          setTimeout(() => setPassMsg(null), PASS_MSG_RESET_MS);
      } catch (err: any) {
          console.error("Password update failed:", err);
          let errorMessage = err.message || 'Could not update your password. Please sign in again and retry.';

          if (errorMessage.toLowerCase().includes('different from the old password')) {
              errorMessage = 'Your new password must be different from the old one.';
          }

          setPassMsg({
              type: 'error',
              text: errorMessage
          });
      } finally {
          setIsChangingPassword(false);
      }
  };

  const copyButtonClass =
    'w-12 h-12 flex items-center justify-center shrink-0 text-ink-mute border border-brass-500/20 hover:text-brass-400 hover:border-brass-500 transition-colors duration-150';

  const testButtonClass =
    'flex-1 flex items-center justify-center gap-2 text-sm text-ink-soft border border-brass-500/20 px-4 py-3 hover:text-brass-400 hover:border-brass-500 transition-colors duration-150 min-h-[48px]';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pb-16">
      <header className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight-display text-ink">Settings</h1>
        <p className="text-ink-mute text-sm mt-1">Reminders, billing, and your password.</p>
      </header>

      <div className="space-y-6">
          {/* Reminders */}
          <SectionCard title="Reminders" icon={<Mail className="w-4 h-4 text-brass-400" strokeWidth={1.5} />}>
            <form onSubmit={handleSave} className="space-y-6">
                <div>
                    <label htmlFor="settings-email" className={labelClass}>Email address</label>
                    <input
                        id="settings-email"
                        type="email"
                        required
                        placeholder="name@example.com"
                        className={fieldClass}
                        value={settings.email}
                        onChange={(e) => setSettings({...settings, email: e.target.value})}
                    />
                </div>

                <div className="flex items-center justify-between gap-4 p-4 bg-marine-800 border border-brass-500/15">
                    <div className="flex items-center gap-3 min-w-0">
                        <Bell className={`w-4 h-4 shrink-0 ${settings.reminderEnabled ? 'text-brass-400' : 'text-ink-mute'}`} strokeWidth={1.5} />
                        <div className="min-w-0">
                            <label htmlFor="reminder-toggle" className="text-sm text-ink">Payment reminders</label>
                            <p className="text-xs text-ink-mute mt-0.5">An email three days before each due date.</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                            id="reminder-toggle"
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.reminderEnabled}
                            onChange={(e) => setSettings({...settings, reminderEnabled: e.target.checked})}
                        />
                        <div className="w-12 h-7 bg-marine-700 border border-brass-500/25 peer-focus:border-brass-500 peer peer-checked:bg-brass-500 peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-ink after:h-5 after:w-5 after:transition-transform after:duration-150 peer-checked:after:bg-marine-900"></div>
                    </label>
                </div>

                {settings.reminderEnabled && (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="settings-frequency" className={`${labelClass} flex items-center gap-2`}>
                                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                                How often
                            </label>
                            <select
                                id="settings-frequency"
                                className={fieldClass}
                                value={settings.notificationFrequency}
                                onChange={(e) => setSettings({...settings, notificationFrequency: e.target.value as any})}
                            >
                                <option value="6hours">Every six hours</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly digest</option>
                            </select>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const res = await fetch('/api/trigger-reminders', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ userId: user?.id })
                                        });
                                        const data = await res.json();
                                        if (res.ok && data.success) setAlertMessage('Daily reminders triggered.');
                                        else setAlertMessage(`Failed: ${data.error || 'Unknown error'}`);
                                    } catch (e: any) {
                                        setAlertMessage(`Error: ${e.message}`);
                                    }
                                }}
                                className={testButtonClass}
                            >
                                <Mail className="w-4 h-4" strokeWidth={1.5} />
                                Test daily
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const res = await fetch('/api/trigger-weekly', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ userId: user?.id })
                                        });
                                        const data = await res.json();
                                        if (res.ok && data.success) setAlertMessage('Weekly update triggered.');
                                        else setAlertMessage(`Failed: ${data.error || 'Unknown error'}`);
                                    } catch (e: any) {
                                        setAlertMessage(`Error: ${e.message}`);
                                    }
                                }}
                                className={testButtonClass}
                            >
                                <Mail className="w-4 h-4" strokeWidth={1.5} />
                                Test weekly
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <button type="submit" className={primaryButtonClass}>
                        {saved ? (
                            <><CheckCircle className="w-4 h-4" strokeWidth={1.5} /> Saved</>
                        ) : (
                            <><Save className="w-4 h-4" strokeWidth={1.5} /> Save changes</>
                        )}
                    </button>
                </div>
            </form>
          </SectionCard>

          {/* Subscription */}
          <SectionCard title="Subscription" icon={<Sparkles className="w-4 h-4 text-brass-400" strokeWidth={1.5} />}>
              {user?.role === 'pro' ? (
                <div className="space-y-4">
                  <div className="p-4 bg-marine-800 border border-brass-500/30">
                    <p className="text-ink">You're on Pro</p>
                    <p className="text-xs text-ink-mute mt-1">Unlimited uploads, all banks, full analytics.</p>
                  </div>
                  <button
                    onClick={handleManageSubscription}
                    disabled={isUpgrading}
                    className="flex items-center gap-2 text-sm text-ink-soft border border-brass-500/25 px-5 py-3 hover:text-brass-400 hover:border-brass-500 transition-colors duration-150 disabled:opacity-50 min-h-[48px]"
                  >
                    {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : <ExternalLink className="w-4 h-4" strokeWidth={1.5} />}
                    Manage subscription
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-marine-800 border border-brass-500/15">
                    <p className="text-sm text-ink">You're on Free</p>
                    <p className="text-xs text-ink-mute mt-1">
                      DBS only · <span className="font-mono tabular-nums">3</span> uploads a month · <span className="font-mono tabular-nums">3</span> months of history
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleUpgrade('monthly')}
                      disabled={isUpgrading}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 border border-brass-500/30 text-ink px-5 py-4 hover:border-brass-500 transition-colors duration-150 disabled:opacity-50 min-h-[76px]"
                    >
                      {isUpgrading ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> : (
                        <>
                          <span className="font-mono text-lg tabular-nums text-brass-400">$4.99</span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">per month</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleUpgrade('annual')}
                      disabled={isUpgrading}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-brass-500 text-marine-900 px-5 py-4 hover:bg-brass-400 transition-colors duration-150 disabled:opacity-50 relative min-h-[76px]"
                    >
                      {isUpgrading ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> : (
                        <>
                          <span className="font-mono text-lg tabular-nums">$2.99</span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-80">per month · save 40%</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
          </SectionCard>

          {/* Security */}
          <SectionCard title="Password" icon={<Lock className="w-4 h-4 text-brass-400" strokeWidth={1.5} />}>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="new-password" className={labelClass}>New password</label>
                            <input
                                id="new-password"
                                type="password"
                                required
                                minLength={MIN_PASSWORD_LENGTH}
                                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                                className={fieldClass}
                                value={passwords.new}
                                onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                                disabled={isChangingPassword}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirm-password" className={labelClass}>Confirm password</label>
                            <input
                                id="confirm-password"
                                type="password"
                                required
                                minLength={MIN_PASSWORD_LENGTH}
                                placeholder="Type it again"
                                className={fieldClass}
                                value={passwords.confirm}
                                onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                                disabled={isChangingPassword}
                            />
                        </div>
                    </div>

                    {passMsg && (
                        <div className={`text-sm flex items-start gap-3 p-4 border ${
                          passMsg.type === 'success'
                            ? 'bg-marine-800 border-brass-500/30 text-brass-300'
                            : 'bg-marine-800 border-danger/40 text-danger'
                        }`}>
                            {passMsg.type === 'success'
                              ? <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />}
                            {passMsg.text}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isChangingPassword}
                            className={`${primaryButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : <Lock className="w-4 h-4" strokeWidth={1.5} />}
                            Update password
                        </button>
                    </div>
                </form>
          </SectionCard>

          {/* Referral Program */}
          <SectionCard title="Referrals" icon={<Gift className="w-4 h-4 text-brass-400" strokeWidth={1.5} />}>
            {refLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-ink-mute" strokeWidth={1.5} />
                </div>
            ) : referralStats ? (
                <div className="space-y-5">
                    <div>
                        <label className={labelClass}>Your code</label>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 px-4 py-3 bg-marine-800 border border-brass-500/20 font-mono text-lg text-brass-400 tracking-widest min-h-[48px] flex items-center">
                                {referralStats.referralCode || '—'}
                            </div>
                            <button
                                onClick={() => copyToClipboard('code', referralStats.referralCode || '')}
                                aria-label="Copy referral code"
                                className={copyButtonClass}
                            >
                                {copiedTarget === 'code' ? <CheckCircle className="w-5 h-5 text-brass-400" strokeWidth={1.5} /> : <Copy className="w-5 h-5" strokeWidth={1.5} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Shareable link</label>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 px-4 py-3 bg-marine-800 border border-brass-500/20 text-sm text-ink-soft truncate min-h-[48px] flex items-center">
                                {referralStats.referralUrl || '—'}
                            </div>
                            <button
                                onClick={() => copyToClipboard('url', referralStats.referralUrl || '')}
                                aria-label="Copy referral link"
                                className={copyButtonClass}
                            >
                                {copiedTarget === 'url' ? <CheckCircle className="w-5 h-5 text-brass-400" strokeWidth={1.5} /> : <Copy className="w-5 h-5" strokeWidth={1.5} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Referrals', value: referralStats.total, icon: <Users className="w-3.5 h-3.5" strokeWidth={1.5} /> },
                            { label: 'Converted', value: referralStats.converted, icon: <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> },
                            { label: 'Rewarded', value: referralStats.rewarded, icon: <Gift className="w-3.5 h-3.5" strokeWidth={1.5} /> },
                            { label: 'Pro months', value: referralStats.proMonthsEarned, icon: <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} /> },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-marine-800 border border-brass-500/15 p-4 text-center">
                                <div className="flex items-center justify-center gap-1.5 text-brass-400 mb-1.5">
                                    {stat.icon}
                                    <span className="font-mono text-xl tabular-nums text-ink">{stat.value}</span>
                                </div>
                                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    <p className="text-sm text-ink-soft border-t border-brass-500/10 pt-4">
                        When someone signs up with your code and upgrades to Pro, you get a free month. They stack.
                    </p>
                </div>
            ) : (
                <p className="text-sm text-ink-mute">Could not load your referral stats.</p>
            )}
          </SectionCard>
      </div>

      {/* Alert Modal */}
      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage(null)}
        type="success"
      />
    </div>
  );
};
