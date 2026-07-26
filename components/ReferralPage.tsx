import React, { useState, useEffect } from 'react';
import { ReferralStats } from '../types';
import { supabase } from '../lib/supabaseClient';
import { Copy, CheckCircle, Loader2, Users, Gift, Share2, ChevronLeft, Sparkles } from 'lucide-react';
import { labelClass } from './formStyles';

interface ReferralPageProps {
  onBack?: () => void;
}

const COPIED_RESET_MS = 2000;

type CopyTarget = 'code' | 'url';

const STEPS = [
  'Share your code or link.',
  'They sign up with it — free, no card.',
  'They upgrade to Pro.',
  'You get a free month. They stack.',
] as const;

export const ReferralPage: React.FC<ReferralPageProps> = ({ onBack }) => {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
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

  const copyToClipboard = (target: CopyTarget, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedTarget(target);
    setTimeout(() => setCopiedTarget(null), COPIED_RESET_MS);
  };

  const shareText = `I track my card bills with CreditTrack — it reads the statement and tells me which card to tap next. Sign up with my code: ${stats?.referralCode || ''} ${stats?.referralUrl || ''}`;

  const shareLinks = [
    {
      name: 'WhatsApp',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.296-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.1980-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.1221.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.1421.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      ),
      url: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'Instagram',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.7410 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 0108zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
      ),
      url: `https://www.instagram.com/compose/text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'Facebook',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      ),
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(stats?.referralUrl || '')}&quote=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'LinkedIn',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      ),
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(stats?.referralUrl || '')}`,
    },
  ];

  const copyButtonClass =
    'w-12 h-12 flex items-center justify-center shrink-0 text-ink-mute border border-brass-500/20 hover:text-brass-400 hover:border-brass-500 transition-colors duration-150';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pb-16">
      <header className="mb-8">
        {onBack && (
          <button
            onClick={onBack}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute hover:text-brass-400 mb-3 flex items-center gap-1 transition-colors duration-150 min-h-[40px]"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} /> Back
          </button>
        )}
        <h1 className="text-2xl font-medium tracking-tight-display text-ink">Referrals</h1>
        <p className="text-ink-mute text-sm mt-1">Share CreditTrack, earn free Pro months.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-brass-400" strokeWidth={1.5} />
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Share */}
          <section className="bg-marine-900 border border-brass-500/15">
            <div className="px-6 py-4 border-b border-brass-500/10 flex items-center gap-2.5">
              <Share2 className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
              <h2 className="text-base font-medium text-ink">Share</h2>
            </div>
            <div className="p-6 flex flex-wrap gap-2">
              {shareLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-ink-soft border border-brass-500/25 hover:text-brass-400 hover:border-brass-500 transition-colors duration-150 min-h-[48px]"
                >
                  {link.icon}
                  {link.name}
                </a>
              ))}
            </div>
          </section>

          {/* Referral Code */}
          <section className="bg-marine-900 border border-brass-500/15">
            <div className="px-6 py-4 border-b border-brass-500/10 flex items-center gap-2.5">
              <Gift className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
              <h2 className="text-base font-medium text-ink">Your code</h2>
            </div>
            <div className="p-6 space-y-5">
                <div>
                  <label className={labelClass}>Code</label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-3 bg-marine-800 border border-brass-500/20 font-mono text-xl text-brass-400 tracking-widest min-h-[56px] flex items-center">
                      {stats.referralCode || '—'}
                    </div>
                    <button
                      onClick={() => copyToClipboard('code', stats.referralCode || '')}
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
                      {stats.referralUrl || '—'}
                    </div>
                    <button
                      onClick={() => copyToClipboard('url', stats.referralUrl || '')}
                      aria-label="Copy referral link"
                      className={copyButtonClass}
                    >
                      {copiedTarget === 'url' ? <CheckCircle className="w-5 h-5 text-brass-400" strokeWidth={1.5} /> : <Copy className="w-5 h-5" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
            </div>
          </section>

          {/* Stats */}
          <section className="bg-marine-900 border border-brass-500/15">
            <div className="px-6 py-4 border-b border-brass-500/10 flex items-center gap-2.5">
              <Users className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
              <h2 className="text-base font-medium text-ink">Your numbers</h2>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Referrals', value: stats.total, icon: <Users className="w-3.5 h-3.5" strokeWidth={1.5} /> },
                { label: 'Converted', value: stats.converted, icon: <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> },
                { label: 'Rewarded', value: stats.rewarded, icon: <Gift className="w-3.5 h-3.5" strokeWidth={1.5} /> },
                { label: 'Pro months', value: stats.proMonthsEarned, icon: <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} /> },
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
          </section>

          {/* How It Works */}
          <section className="bg-marine-900 border border-brass-500/15 p-6">
            <h2 className="text-base font-medium text-ink mb-4">How it works</h2>
            <ol className="space-y-3">
              {STEPS.map((text, i) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="font-mono text-[10px] tabular-nums text-brass-400 shrink-0 mt-1">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm text-ink-soft">{text}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : (
        <p className="text-center text-sm text-ink-mute py-16">Could not load your referral stats.</p>
      )}
    </div>
  );
};
