
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { User, SystemConfig } from '../types';
import { Save, Trash2, Power, LayoutTemplate, Plus, LockKeyhole } from 'lucide-react';
import { fieldClass, labelClass, primaryButtonClass } from './formStyles';

const SAVE_STATUS_TIMEOUT_MS = 3000;

const formatJoinedDate = (iso: string): string => {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
};

/** Squared status chip — mirrors the landing page's Pill affordance. */
const StatusChip: React.FC<{ tone: 'brass' | 'danger' | 'warning' | 'mute'; children: React.ReactNode }> = ({ tone, children }) => {
  const toneClass =
    tone === 'brass' ? 'text-brass-400 border-brass-500/40'
    : tone === 'danger' ? 'text-danger border-danger/40'
    : tone === 'warning' ? 'text-warning border-warning/40'
    : 'text-ink-mute border-brass-500/20';
  return (
    <span className={`inline-flex items-center font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 border whitespace-nowrap ${toneClass}`}>
      {children}
    </span>
  );
};

export const AdminPanel: React.FC = () => {
  const { user, getAllUsers, toggleUserStatus, updateUserRole, systemConfig, updateSystemConfig } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'cms'>('users');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // CMS State
  const [cmsForm, setCmsForm] = useState<SystemConfig>(systemConfig);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'admin' && activeTab === 'users') {
      loadUsers();
    }
  }, [user, activeTab]);

  const loadUsers = async () => {
      setLoadingUsers(true);
      try {
          // Use the admin endpoint so PENDING signups (in auth.users but not yet in
          // profiles) are included. Falls back to the profiles-only list on failure.
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          const res = await fetch('/api/admin/users', {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
              const list = await res.json();
              setUsersList(list);
          } else {
              const list = await getAllUsers();
              setUsersList(list);
          }
      } catch (err) {
          console.error(err);
          try { setUsersList(await getAllUsers()); } catch { /* ignore */ }
      } finally {
          setLoadingUsers(false);
      }
  };

  useEffect(() => {
      setCmsForm(systemConfig);
  }, [systemConfig]);

  if (user?.role !== 'admin') {
      return (
        <div className="p-8 text-center">
          <p className="text-danger text-sm">Access denied. Admin privileges required.</p>
        </div>
      );
  }

  const handleToggleStatus = async (userId: string) => {
      await toggleUserStatus(userId);
      await loadUsers();
  };

  const handleRoleChange = async (userId: string, newRole: 'user' | 'pro') => {
      await updateUserRole(userId, newRole);
      await loadUsers();
  };

  const handleCmsSave = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await updateSystemConfig(cmsForm);
          setSaveStatus("Configuration saved.");
          setTimeout(() => setSaveStatus(null), SAVE_STATUS_TIMEOUT_MS);
      } catch (err) {
          setSaveStatus("Error saving config.");
      }
  };

  const updateBullet = (index: number, value: string) => {
      const newBullets = [...cmsForm.landingPage.bullets];
      newBullets[index] = value;
      setCmsForm({
          ...cmsForm,
          landingPage: { ...cmsForm.landingPage, bullets: newBullets }
      });
  };

  const addBullet = () => {
      setCmsForm({
          ...cmsForm,
          landingPage: { ...cmsForm.landingPage, bullets: [...cmsForm.landingPage.bullets, "New feature"] }
      });
  }

  const removeBullet = (index: number) => {
      const newBullets = cmsForm.landingPage.bullets.filter((_, i) => i !== index);
      setCmsForm({
          ...cmsForm,
          landingPage: { ...cmsForm.landingPage, bullets: newBullets }
      });
  };

  const tabClass = (active: boolean) =>
    `px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-150 min-h-[48px] ${
      active ? 'border-brass-500 text-brass-300' : 'border-transparent text-ink-mute hover:text-ink'
    }`;

  const roleControl = (u: User) => {
    if (u.pending) return <span className="text-ink-mute text-xs">—</span>;
    if (u.role === 'admin') return <StatusChip tone="brass">Admin</StatusChip>;
    return (
      <select
        value={u.role}
        onChange={e => handleRoleChange(u.id, e.target.value as 'user' | 'pro')}
        className="bg-marine-800 border border-brass-500/25 text-ink text-xs px-2 py-1.5 cursor-pointer focus:border-brass-500 focus:outline-none transition-colors duration-150"
      >
        <option value="user">Free</option>
        <option value="pro">Pro</option>
      </select>
    );
  };

  const statusChip = (u: User) => {
    if (u.pending) return <StatusChip tone="warning">Pending activation</StatusChip>;
    return u.status === 'active'
      ? <StatusChip tone="brass">Active</StatusChip>
      : <StatusChip tone="danger">Suspended</StatusChip>;
  };

  const canToggle = (u: User) => !u.pending && u.email !== user?.email;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12">
      <header className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight-display text-ink flex items-center gap-2.5">
            <LockKeyhole className="w-5 h-5 text-brass-400" strokeWidth={1.5} />
            Admin Portal
        </h1>
        <p className="text-ink-mute text-sm mt-1">Manage users and system configuration.</p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-brass-500/15 mb-6">
          <button onClick={() => setActiveTab('users')} className={tabClass(activeTab === 'users')}>
              Users
          </button>
          <button onClick={() => setActiveTab('cms')} className={tabClass(activeTab === 'cms')}>
              Front page
          </button>
      </div>

      {/* User Management Tab */}
      {activeTab === 'users' && (
          loadingUsers ? (
            <div className="p-8 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">Loading users</div>
          ) : (
            <>
              {/* Mobile: stacked cards — a 5-column table is unusable at 375px */}
              <div className="sm:hidden space-y-3">
                {usersList.map(u => (
                  <div key={u.id} className="bg-marine-900 border border-brass-500/15 p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm text-ink truncate">{u.name || 'No name'}</p>
                        <p className="text-xs text-ink-mute truncate">{u.email}</p>
                      </div>
                      {canToggle(u) && (
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          aria-label={u.status === 'active' ? 'Suspend user' : 'Activate user'}
                          className={`shrink-0 w-11 h-11 flex items-center justify-center border transition-colors duration-150 ${
                            u.status === 'active'
                              ? 'text-danger border-danger/30 hover:border-danger'
                              : 'text-brass-400 border-brass-500/30 hover:border-brass-500'
                          }`}
                        >
                          <Power className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusChip(u)}
                      {roleControl(u)}
                      <span className="font-mono text-[10px] tabular-nums text-ink-mute ml-auto">
                        {formatJoinedDate(u.joinedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block bg-marine-900 border border-brass-500/15 overflow-x-auto">
                <table className="w-full text-left text-sm text-ink-soft">
                    <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute border-b border-brass-500/15">
                        <tr>
                            <th className="px-5 py-3 font-normal">User</th>
                            <th className="px-5 py-3 font-normal">Role</th>
                            <th className="px-5 py-3 font-normal">Joined</th>
                            <th className="px-5 py-3 font-normal">Status</th>
                            <th className="px-5 py-3 font-normal">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brass-500/10">
                        {usersList.map(u => (
                            <tr key={u.id} className="hover:bg-marine-800 transition-colors duration-150">
                                <td className="px-5 py-4">
                                    <div className="text-ink">{u.name || 'No name'}</div>
                                    <div className="text-xs text-ink-mute">{u.email}</div>
                                </td>
                                <td className="px-5 py-4">{roleControl(u)}</td>
                                <td className="px-5 py-4 font-mono text-xs tabular-nums text-ink-mute">
                                    {formatJoinedDate(u.joinedAt)}
                                </td>
                                <td className="px-5 py-4">{statusChip(u)}</td>
                                <td className="px-5 py-4">
                                    {canToggle(u) && (
                                        <button
                                            onClick={() => handleToggleStatus(u.id)}
                                            aria-label={u.status === 'active' ? 'Suspend user' : 'Activate user'}
                                            className={`w-10 h-10 flex items-center justify-center border transition-colors duration-150 ${
                                                u.status === 'active'
                                                ? 'text-danger border-danger/30 hover:border-danger'
                                                : 'text-brass-400 border-brass-500/30 hover:border-brass-500'
                                            }`}
                                            title={u.status === 'active' ? 'Suspend user' : 'Activate user'}
                                        >
                                            <Power className="w-4 h-4" strokeWidth={1.5} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
            </>
          )
      )}

      {/* CMS & Config Tab */}
      {activeTab === 'cms' && (
          <form onSubmit={handleCmsSave} className="space-y-6">
              {saveStatus && (
                  <div className="p-4 bg-marine-700 border border-brass-500/30 text-brass-300 text-sm flex items-center gap-2">
                      <Save className="w-4 h-4" strokeWidth={1.5} />
                      {saveStatus}
                  </div>
              )}

              {/* General Settings */}
              <div className="bg-marine-900 border border-brass-500/15 p-6">
                  <h2 className="text-base font-medium text-ink mb-4 flex items-center gap-2.5">
                      <Power className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
                      Global access
                  </h2>
                  <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                          <label htmlFor="allow-signups" className="text-sm text-ink">Allow new signups</label>
                          <p className="text-xs text-ink-mute mt-0.5">If disabled, new users cannot register.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                                id="allow-signups"
                                type="checkbox"
                                className="sr-only peer"
                                checked={cmsForm.allowSignups}
                                onChange={(e) => setCmsForm({...cmsForm, allowSignups: e.target.checked})}
                            />
                            <div className="w-12 h-7 bg-marine-700 border border-brass-500/25 peer-focus:border-brass-500 peer peer-checked:bg-brass-500 peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-ink after:h-5 after:w-5 after:transition-transform after:duration-150 peer-checked:after:bg-marine-900"></div>
                        </label>
                  </div>
              </div>

              {/* Front Page Text */}
              <div className="bg-marine-900 border border-brass-500/15 p-6">
                  <h2 className="text-base font-medium text-ink mb-4 flex items-center gap-2.5">
                      <LayoutTemplate className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
                      Landing page content
                  </h2>
                  <p className="text-xs text-ink-mute -mt-2 mb-4">
                      These render in the hero of the public landing page. Put each headline
                      line on its own row; leave bullets empty to hide them.
                  </p>

                  <div className="space-y-4">
                      <div>
                          <label className={labelClass}>Hero title</label>
                          <textarea
                              rows={2}
                              className={fieldClass}
                              value={cmsForm.landingPage.heroTitle}
                              onChange={e => setCmsForm({
                                  ...cmsForm,
                                  landingPage: {...cmsForm.landingPage, heroTitle: e.target.value}
                              })}
                          />
                      </div>
                      <div>
                          <label className={labelClass}>Hero subtitle</label>
                          <textarea
                              rows={3}
                              className={fieldClass}
                              value={cmsForm.landingPage.heroSubtitle}
                              onChange={e => setCmsForm({
                                  ...cmsForm,
                                  landingPage: {...cmsForm.landingPage, heroSubtitle: e.target.value}
                              })}
                          />
                      </div>

                      <div>
                          <label className={labelClass}>Feature bullets</label>
                          <div className="space-y-2">
                              {cmsForm.landingPage.bullets.map((bullet, idx) => (
                                  <div key={idx} className="flex gap-2">
                                      <input
                                          type="text"
                                          className={fieldClass}
                                          value={bullet}
                                          onChange={(e) => updateBullet(idx, e.target.value)}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeBullet(idx)}
                                        aria-label="Remove bullet"
                                        className="shrink-0 w-11 h-11 flex items-center justify-center text-ink-mute border border-brass-500/20 hover:text-danger hover:border-danger/40 transition-colors duration-150"
                                      >
                                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                      </button>
                                  </div>
                              ))}
                              <button
                                type="button"
                                onClick={addBullet}
                                className="text-sm text-brass-400 hover:text-brass-300 flex items-center gap-1.5 mt-2 min-h-[44px] transition-colors duration-150"
                              >
                                  <Plus className="w-4 h-4" strokeWidth={1.5} /> Add bullet
                              </button>
                          </div>
                      </div>
                  </div>
              </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    className={primaryButtonClass}
                >
                    <Save className="w-4 h-4" strokeWidth={1.5} />
                    Save configuration
                </button>
            </div>
          </form>
      )}
    </div>
  );
};
