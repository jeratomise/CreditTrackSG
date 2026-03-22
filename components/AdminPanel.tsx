
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, SystemConfig } from '../types';
import { Users, Shield, Save, Type, Trash2, Power, LayoutTemplate, Plus } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { user, getAllUsers, toggleUserStatus, systemConfig, updateSystemConfig } = useAuth();
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
          const list = await getAllUsers();
          setUsersList(list);
      } catch (err) {
          console.error(err);
      } finally {
          setLoadingUsers(false);
      }
  };

  useEffect(() => {
      setCmsForm(systemConfig);
  }, [systemConfig]);

  if (user?.role !== 'admin') {
      return <div className="p-8 text-center text-red-500">Access Denied. Admin privileges required.</div>;
  }

  const handleToggleStatus = async (userId: string) => {
      await toggleUserStatus(userId);
      await loadUsers(); // Refresh list
  };

  const handleCmsSave = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await updateSystemConfig(cmsForm);
          setSaveStatus("Configuration saved successfully!");
          setTimeout(() => setSaveStatus(null), 3000);
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

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            Admin Portal
        </h1>
        <p className="text-gray-500">Manage users and system configuration.</p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
              User Management
          </button>
          <button 
            onClick={() => setActiveTab('cms')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'cms' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
              Front Page & Config
          </button>
      </div>

      {/* User Management Tab */}
      {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                {loadingUsers ? <div className="p-8 text-center text-gray-400">Loading Users...</div> : (
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Joined</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {usersList.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{u.name || "No Name"}</div>
                                        <div className="text-xs text-gray-400">{u.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {(() => {
                                            const d = new Date(u.joinedAt);
                                            const day = String(d.getDate()).padStart(2, '0');
                                            const month = String(d.getMonth() + 1).padStart(2, '0');
                                            const year = d.getFullYear();
                                            return `${day}/${month}/${year}`;
                                        })()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                                            u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {u.status === 'active' ? 'Active' : 'Suspended'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {u.email !== user?.email && (
                                            <button 
                                                onClick={() => handleToggleStatus(u.id)}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    u.status === 'active' 
                                                    ? 'text-red-500 hover:bg-red-50' 
                                                    : 'text-green-500 hover:bg-green-50'
                                                }`}
                                                title={u.status === 'active' ? "Suspend User" : "Activate User"}
                                            >
                                                <Power className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
              </div>
          </div>
      )}

      {/* CMS & Config Tab */}
      {activeTab === 'cms' && (
          <form onSubmit={handleCmsSave} className="space-y-6">
              {saveStatus && (
                  <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      {saveStatus}
                  </div>
              )}

              {/* General Settings */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-gray-400" />
                      Global Access
                  </h3>
                  <div className="flex items-center justify-between">
                      <div>
                          <label className="font-medium text-gray-900">Allow New Signups</label>
                          <p className="text-sm text-gray-500">If disabled, new users cannot register.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={cmsForm.allowSignups}
                                onChange={(e) => setCmsForm({...cmsForm, allowSignups: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                  </div>
              </div>

              {/* Front Page Text */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <LayoutTemplate className="w-5 h-5 text-gray-400" />
                      Landing Page Content
                  </h3>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Hero Title</label>
                          <textarea 
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={cmsForm.landingPage.heroTitle}
                              onChange={e => setCmsForm({
                                  ...cmsForm, 
                                  landingPage: {...cmsForm.landingPage, heroTitle: e.target.value}
                              })}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Hero Subtitle</label>
                          <textarea 
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={cmsForm.landingPage.heroSubtitle}
                              onChange={e => setCmsForm({
                                  ...cmsForm, 
                                  landingPage: {...cmsForm.landingPage, heroSubtitle: e.target.value}
                              })}
                          />
                      </div>
                      
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Feature Bullets</label>
                          <div className="space-y-2">
                              {cmsForm.landingPage.bullets.map((bullet, idx) => (
                                  <div key={idx} className="flex gap-2">
                                      <input 
                                          type="text"
                                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                          value={bullet}
                                          onChange={(e) => updateBullet(idx, e.target.value)}
                                      />
                                      <button 
                                        type="button" 
                                        onClick={() => removeBullet(idx)}
                                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                              <button 
                                type="button" 
                                onClick={addBullet}
                                className="text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1 mt-2"
                              >
                                  <Plus className="w-4 h-4" /> Add Bullet
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
            
            <div className="flex justify-end">
                <button 
                    type="submit"
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium shadow-sm"
                >
                    <Save className="w-4 h-4" />
                    Save Configuration
                </button>
            </div>
          </form>
      )}
    </div>
  );
};
