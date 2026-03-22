
import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Save, Bell, Mail, Clock, Lock, CheckCircle, AlertCircle, Loader2, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import { AlertModal } from './AlertModal';

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
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async (billingCycle: 'monthly' | 'annual') => {
    if (!user) return;
    setIsUpgrading(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userEmail: user.email, billingCycle }),
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
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('credittrack_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setPassMsg(null);
      
      if (passwords.new.length < 8) {
          setPassMsg({ type: 'error', text: 'Password must be at least 8 characters for EliteX compliance.' });
          return;
      }
      if (passwords.new !== passwords.confirm) {
          setPassMsg({ type: 'error', text: 'Confirmed password does not match original entry.' });
          return;
      }

      setIsChangingPassword(true);

      try {
          // The supabase call is handled inside context
          await changePassword(passwords.new);
          setPassMsg({ type: 'success', text: 'Security credentials updated successfully.' });
          setPasswords({ new: '', confirm: '' });
          
          // Clear success message after 5 seconds
          setTimeout(() => setPassMsg(null), 5000);
      } catch (err: any) {
          console.error("Security update failed:", err);
          let errorMessage = err.message || 'Security update rejected by server. Please re-authenticate.';
          
          if (errorMessage.toLowerCase().includes('different from the old password')) {
              errorMessage = 'New password should be different from the old password.';
          }
          
          setPassMsg({ 
              type: 'error', 
              text: errorMessage
          });
      } finally {
          setIsChangingPassword(false);
      }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pb-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">System Preferences</h1>
        <p className="text-gray-500 mt-1">Manage your notification preferences and account security.</p>
      </header>

      <div className="space-y-8">
          {/* General Preferences */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <form onSubmit={handleSave} className="p-8 space-y-8">
            
            <div className="space-y-6">
                <div className="flex items-center gap-3 text-gray-900 font-bold border-b border-gray-50 pb-4">
                    <div className="bg-indigo-50 p-2 rounded-lg">
                        <Mail className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3>Contact & Reminders</h3>
                </div>
                
                <div className="grid gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Verified Email Address</label>
                        <input 
                            type="email"
                            required
                            placeholder="name@elitex.cc"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                            value={settings.email}
                            onChange={(e) => setSettings({...settings, email: e.target.value})}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${settings.reminderEnabled ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-400'}`}>
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-800">Payment Proximity Alerts</label>
                                <p className="text-xs text-gray-500">Automated reminders for bills due within 72 hours.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={settings.reminderEnabled}
                                onChange={(e) => setSettings({...settings, reminderEnabled: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {settings.reminderEnabled && (
                        <div className="space-y-4 animate-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5" />
                                    Monitoring Intensity
                                </label>
                                <select 
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-all text-sm"
                                    value={settings.notificationFrequency}
                                    onChange={(e) => setSettings({...settings, notificationFrequency: e.target.value as any})}
                                >
                                    <option value="6hours">Critical Monitor (Every 6 Hours)</option>
                                    <option value="daily">Standard Monitor (Daily Check)</option>
                                    <option value="weekly">Passive Monitor (Weekly Digest)</option>
                                </select>
                            </div>
                            
                            <div className="pt-2 flex flex-col sm:flex-row gap-3">
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
                                            if (res.ok && data.success) setAlertMessage('Daily reminders triggered successfully!');
                                            else setAlertMessage(`Failed: ${data.error || 'Unknown error'}`);
                                        } catch (e: any) {
                                            setAlertMessage(`Error: ${e.message}`);
                                        }
                                    }}
                                    className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Mail className="w-4 h-4" />
                                    Test Daily Reminder Now
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
                                            if (res.ok && data.success) setAlertMessage('Weekly update triggered successfully!');
                                            else setAlertMessage(`Failed: ${data.error || 'Unknown error'}`);
                                        } catch (e: any) {
                                            setAlertMessage(`Error: ${e.message}`);
                                        }
                                    }}
                                    className="text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Mail className="w-4 h-4" />
                                    Test Weekly Update Now
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-4 flex justify-end">
                <button 
                    type="submit"
                    className={`flex items-center gap-2 px-8 py-3 rounded-xl text-white font-bold text-sm transition-all shadow-lg ${
                        saved ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'
                    }`}
                >
                    {saved ? (
                        <><CheckCircle className="w-4 h-4" /> Preferences Updated</>
                    ) : (
                        <><Save className="w-4 h-4" /> Apply Changes</>
                    )}
                </button>
            </div>
            </form>
          </div>

          {/* Subscription Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 text-gray-900 font-bold border-b border-gray-50 pb-4">
                <div className="bg-amber-50 p-2 rounded-lg">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                <h3>Subscription</h3>
              </div>

              {user?.role === 'pro' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200">
                    <span className="text-2xl">⭐</span>
                    <div>
                      <p className="font-bold text-amber-800">You're on Pro</p>
                      <p className="text-xs text-amber-600">All features unlocked — unlimited uploads, all banks, full analytics.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleManageSubscription}
                    disabled={isUpgrading}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    Manage Subscription
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="font-medium text-gray-700 text-sm mb-1">You're on the Free plan</p>
                    <p className="text-xs text-gray-500">DBS only · 3 bill uploads/month · 3 months history</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Upgrade to Pro</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleUpgrade('monthly')}
                      disabled={isUpgrading}
                      className="flex-1 flex flex-col items-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-4 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {isUpgrading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                          <span className="font-black text-lg">$4.99</span>
                          <span className="text-xs text-indigo-200">per month</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleUpgrade('annual')}
                      disabled={isUpgrading}
                      className="flex-1 flex flex-col items-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-4 rounded-xl transition-colors disabled:opacity-50 relative"
                    >
                      <span className="absolute -top-2 right-3 text-[10px] font-black bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">SAVE 40%</span>
                      {isUpgrading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                          <span className="font-black text-lg">$2.99</span>
                          <span className="text-xs text-indigo-200">per month · billed $35.88/yr</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 space-y-8">
                <div className="flex items-center gap-3 text-gray-900 font-bold border-b border-gray-50 pb-4">
                    <div className="bg-red-50 p-2 rounded-lg">
                        <Lock className="w-5 h-5 text-red-600" />
                    </div>
                    <h3>Security & Encryption</h3>
                </div>
                
                <form onSubmit={handleChangePassword} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">New Vault Key</label>
                            <input 
                                type="password"
                                required
                                minLength={8}
                                placeholder="Min 8 characters"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                value={passwords.new}
                                onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                                disabled={isChangingPassword}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Confirm Vault Key</label>
                            <input 
                                type="password"
                                required
                                minLength={8}
                                placeholder="Verify entry"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                value={passwords.confirm}
                                onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                                disabled={isChangingPassword}
                            />
                        </div>
                    </div>
                    
                    {passMsg && (
                        <div className={`text-sm flex items-center gap-3 p-4 rounded-xl font-medium animate-in slide-in-from-top-2 ${passMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                            {passMsg.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            {passMsg.text}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button 
                            type="submit"
                            disabled={isChangingPassword}
                            className="bg-gray-900 text-white px-8 py-3 rounded-xl hover:bg-black text-sm font-bold transition-all shadow-lg shadow-gray-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                        >
                            {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                            Rotate Keys
                        </button>
                    </div>
                </form>
            </div>
          </div>
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
