import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
        const response = await fetch(`/api/email-logs?userId=${user.id}`);
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
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl">
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
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Mail className="w-6 h-6 text-indigo-600" />
              System Email Logs
          </h1>
          <p className="text-gray-500">A history of automated bill reminders sent to {user?.email}.</p>
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No email logs found. Wait for the daily reminder or trigger a test.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-6 py-4">Date Sent</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Recipient</th>
                  <th className="px-6 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDateTime(log.sent_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-medium uppercase bg-indigo-100 text-indigo-700">
                        {log.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {log.email}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500">
                          Bills included: <strong className="text-gray-900">{log.details?.bills_count || 0}</strong>
                        </span>
                        {log.details?.preview_url && (
                          <a 
                            href={log.details.preview_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            View Email Preview <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
