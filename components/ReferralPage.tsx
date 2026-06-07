import React, { useState, useEffect } from 'react';
import { ReferralStats } from '../types';
import { supabase } from '../lib/supabaseClient';
import { Copy, CheckCircle, Loader2, Users, Gift, Share2, ChevronLeft } from 'lucide-react';

interface ReferralPageProps {
  onBack?: () => void;
}

export const ReferralPage: React.FC<ReferralPageProps> = ({ onBack }) => {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) return;
        const res = await fetch('/api/referrals/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch referral stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(stats?.referralCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(stats?.referralUrl || '');
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const shareText = `Track your credit card bills the smart way — AI-powered with miles optimization! Sign up with my referral code and get started free: ${stats?.referralCode || ''} ${stats?.referralUrl || ''}`;

  const shareLinks = [
    {
      name: 'WhatsApp',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.296-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.1980-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.1221.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.1421.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      ),
      url: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      name: 'Instagram',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.7410 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 0108zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
      ),
      url: `https://www.instagram.com/compose/text=${encodeURIComponent(shareText)}`,
      color: 'bg-gradient-to-tr from-purple-600 via-pink-500 to-orange-400 hover:opacity-90',
    },
    {
      name: 'Facebook',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      ),
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(stats?.referralUrl || '')}&quote=${encodeURIComponent(shareText)}`,
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      name: 'LinkedIn',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      ),
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(stats?.referralUrl || '')}`,
      color: 'bg-blue-700 hover:bg-blue-800',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pb-16">
      <header className="mb-8">
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-900 mb-3 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Referral Program</h1>
        <p className="text-gray-500 mt-1">Share CreditTrack and earn free Pro months.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : stats ? (
        <div className="space-y-8">
          {/* Share Bar — matches the floating bar design */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 px-6 py-5 shadow-xl">
            {/* Glow effect */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[-50%] left-[-10%] w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-[-30%] right-[-10%] w-40 h-40 bg-amber-500/5 rounded-full blur-2xl" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Share2 className="w-5 h-5 text-amber-400" />
                <p className="text-sm font-bold text-amber-300 uppercase tracking-widest">Share & Earn</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {shareLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all shadow-lg ${link.color}`}
                  >
                    {link.icon}
                    {link.name}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Referral Code Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 text-gray-900 font-bold border-b border-gray-50 pb-4">
                <div className="bg-indigo-50 p-2 rounded-lg">
                  <Share2 className="w-5 h-5 text-indigo-600" />
                </div>
                <h3>Your Referral Code</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Code</label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-2xl font-black text-gray-900 tracking-widest">
                      {stats.referralCode || '—'}
                    </div>
                    <button
                      onClick={copyCode}
                      className="p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"
                      title="Copy code"
                    >
                      {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Shareable Link</label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 truncate">
                      {stats.referralUrl || '—'}
                    </div>
                    <button
                      onClick={copyUrl}
                      className="p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"
                      title="Copy link"
                    >
                      {copiedUrl ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Your Referral Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Referrals', value: stats.total, icon: <Users className="w-4 h-4" />, color: 'text-indigo-600' },
                  { label: 'Converted', value: stats.converted, icon: <CheckCircle className="w-4 h-4" />, color: 'text-emerald-600' },
                  { label: 'Rewards Earned', value: stats.rewarded, icon: <Gift className="w-4 h-4" />, color: 'text-amber-600' },
                  { label: 'Pro Months', value: stats.proMonthsEarned, icon: <span className="text-amber-400">⭐</span>, color: 'text-amber-600' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-50 rounded-xl p-5 text-center">
                    <div className={`flex items-center justify-center gap-1.5 ${stat.color} mb-2`}>
                      {stat.icon}
                      <span className="text-3xl font-black text-gray-900">{stat.value}</span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-amber-900 mb-3">How It Works</h3>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Share your referral code or link with friends' },
                { step: '2', text: 'Friend signs up with your code — they get started free' },
                { step: '3', text: 'Friend upgrades to Pro' },
                { step: '4', text: 'You earn +1 month of Pro (stackable!)' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <p className="text-sm text-amber-800 font-medium">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-500 py-16">Loading referral stats...</p>
      )}
    </div>
  );
};
