import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { EmailLog } from '../types';
import { Mail, Calendar, ExternalLink, Loader2 } from 'lucide-react';

export const EmailLogs: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user) return;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const response = await fetch('/api/email-logs', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error('Failed to fetch logs');
        }
        const data = await response.json();
        setLogs(data);
      } catch (err) {
        console.error("Error fetching email logs:", err);
        setError("Could not load email logs.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 text-brass-400 animate-spin" strokeWidth={1.5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-danger bg-marine-900 border border-danger/30">
        {error}
      </div>
    );
  }

  const formatDateTime = (dateString: string) => {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12">
      <header className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight-display text-ink flex items-center gap-2.5">
            <Mail className="w-5 h-5 text-brass-400" strokeWidth={1.5} />
            Email log
        </h1>
        <p className="text-ink-mute text-sm mt-1 truncate">Reminders sent to {user?.email}.</p>
      </header>

      {logs.length === 0 ? (
        <div className="bg-marine-900 border border-brass-500/15 p-8 text-center text-sm text-ink-mute">
          Nothing sent yet. Reminders appear here once a bill is due.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="sm:hidden space-y-3">
            {logs.map(log => (
              <div key={log.id} className="bg-marine-900 border border-brass-500/15 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass-400">
                    {log.type.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-ink-mute">
                    {formatDateTime(log.sent_at)}
                  </span>
                </div>
                <p className="text-sm text-ink-soft truncate">{log.email}</p>
                <div className="flex items-center justify-between gap-3 mt-2">
                  <span className="text-xs text-ink-mute">
                    Bills: <span className="font-mono tabular-nums text-ink">{log.details?.bills_count || 0}</span>
                  </span>
                  {log.details?.preview_url && (
                    <a
                      href={log.details.preview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brass-400 hover:text-brass-300 flex items-center gap-1 transition-colors duration-150 min-h-[40px]"
                    >
                      Preview <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block bg-marine-900 border border-brass-500/15 overflow-x-auto">
            <table className="w-full text-left text-sm text-ink-soft">
              <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute border-b border-brass-500/15">
                <tr>
                  <th className="px-5 py-3 font-normal">Sent</th>
                  <th className="px-5 py-3 font-normal">Type</th>
                  <th className="px-5 py-3 font-normal">Recipient</th>
                  <th className="px-5 py-3 font-normal">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brass-500/10">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-marine-800 transition-colors duration-150">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-ink-mute" strokeWidth={1.5} />
                        <span className="font-mono text-xs tabular-nums">{formatDateTime(log.sent_at)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 border border-brass-500/40 text-brass-400 whitespace-nowrap">
                        {log.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {log.email}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-ink-mute">
                          Bills: <span className="font-mono tabular-nums text-ink">{log.details?.bills_count || 0}</span>
                        </span>
                        {log.details?.preview_url && (
                          <a
                            href={log.details.preview_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-brass-400 hover:text-brass-300 flex items-center gap-1 transition-colors duration-150"
                          >
                            Preview <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
