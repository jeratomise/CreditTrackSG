
import React, { useMemo, useState, useEffect } from 'react';
import { Bill, PaymentDetails } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, CheckCircle, Clock, Plus, TrendingUp, Pencil, FileText, Calendar, Trash2, Globe } from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { EditBillModal } from './EditBillModal';
import { AlertModal } from './AlertModal';
import { dbService } from '../services/dbService';

interface DashboardProps {
  bills: Bill[];
  onUpdateBill: (bill: Bill) => void;
  onAddBill: (bill: Bill) => void;
  onDeleteBill: (billId: string) => void;
  onOpenManualModal?: () => void;
}

const MONTH_FILTER_KEY = 'credittrack_month_filter';
const DUE_SOON_DAYS = 3;
const DUE_WARNING_DAYS = 7;

/**
 * Series colours are a brass→marine tonal ramp rather than a rainbow.
 * The palette has exactly two working colours; categorical separation comes
 * from tone, not hue.
 */
const SERIES_COLORS = [
  '#c9a157', // brass-500
  '#8a8474', // ink-mute
  '#d9c190', // brass-300
  '#2f627a', // marine-500
  '#876a37', // brass-700
  '#d9cba8', // ink-soft
  '#244e62', // marine-600
  '#d4a849', // warning
];

const CHART_GRID = '#1c3d4d';   // marine-700
const CHART_AXIS = '#8a8474';   // ink-mute

const money = (n: number): string =>
  n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const Dashboard: React.FC<DashboardProps> = ({ bills, onUpdateBill, onAddBill, onDeleteBill, onOpenManualModal }) => {
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<Bill | null>(null);
  const [billToEdit, setBillToEdit] = useState<Bill | null>(null);
  // Default to the latest month with bills (lazy init to avoid flicker on first render)
const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(() => {
  if (typeof window === 'undefined') return 'ALL';
  try {
    const cached = localStorage.getItem(MONTH_FILTER_KEY);
    if (cached) return cached;
  } catch {}
  return 'ALL';
});
  const [billToDelete, setBillToDelete] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const totalDue = useMemo(() =>
    bills.filter(b => !b.isPaid).reduce((acc, b) => acc + b.totalAmount, 0),
  [bills]);

  // ------------------------------------------------------------------
  // Logic for Category List (Bar Format)
  // ------------------------------------------------------------------
  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    let grandTotal = 0;
    bills.forEach(bill => {
      bill.transactions.forEach(t => {
        const amount = t.amount;
        categories[t.category] = (categories[t.category] || 0) + amount;
        grandTotal += amount;
      });
    });

    // Sort and limit to top 5, group rest as other
    const sorted = Object.keys(categories)
        .map(key => ({ name: key, value: categories[key], percentage: (categories[key] / (grandTotal || 1)) * 100 }))
        .sort((a, b) => b.value - a.value);

    return { data: sorted, total: grandTotal };
  }, [bills]);

  // ------------------------------------------------------------------
  // Logic for Clustered Bar Chart (Spend Trend by Bank per Month)
  // ------------------------------------------------------------------
  const { clusteredData, uniqueBanks } = useMemo(() => {
    const monthlyData: Record<string, Record<string, number>> = {};
    const banksSet = new Set<string>();

    bills.forEach(bill => {
        // Use Statement Date for spend allocation, fallback to Due Date
        const dateStr = bill.statementDate || bill.dueDate;
        const dateObj = new Date(dateStr);

        // Key format: YYYY-MM for sorting/grouping
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        // Display label: MMM YYYY
        const monthLabel = dateObj.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { name: monthLabel, _sortKey: monthKey } as any;
        }

        // Normalize Bank Name (simple cleaning)
        let bankName = bill.bankName.trim();
        if (bankName.toLowerCase().includes('dbs')) bankName = 'DBS';
        else if (bankName.toLowerCase().includes('uob')) bankName = 'UOB';
        else if (bankName.toLowerCase().includes('citi')) bankName = 'Citibank';
        else if (bankName.toLowerCase().includes('hsbc')) bankName = 'HSBC';
        else if (bankName.toLowerCase().includes('ocbc')) bankName = 'OCBC';
        else if (bankName.toLowerCase().includes('american express') || bankName.toLowerCase().includes('amex')) bankName = 'AMEX';

        banksSet.add(bankName);

        // Add amount
        const currentAmount = (monthlyData[monthKey][bankName] as number) || 0;
        monthlyData[monthKey][bankName] = currentAmount + bill.totalAmount;
    });

    // Convert to array and sort by date
    const dataArray = Object.values(monthlyData).sort((a: any, b: any) =>
        a._sortKey.localeCompare(b._sortKey)
    );

    return { clusteredData: dataArray, uniqueBanks: Array.from(banksSet) };
  }, [bills]);

  const upcomingBills = useMemo(() => bills
    .filter(b => !b.isPaid)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), [bills]);

  // Extract unique months from bills for filtering list
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    bills.forEach(bill => {
      if (bill.dueDate) {
        const date = new Date(bill.dueDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(key);
      }
    });
    return Array.from(months).sort().reverse(); // Newest first
  }, [bills]);

  // Default filter to the latest month with bills on first load (when user hasn't picked one yet)
  useEffect(() => {
    if (availableMonths.length === 0) return;
    try {
      const saved = localStorage.getItem(MONTH_FILTER_KEY);
      // If saved filter is no longer valid (e.g. month no longer has bills), reset to latest
      if (saved && saved !== 'ALL' && !availableMonths.includes(saved)) {
        setSelectedMonthFilter(availableMonths[0]);
        localStorage.setItem(MONTH_FILTER_KEY, availableMonths[0]);
        return;
      }
      if (saved && saved !== 'ALL') {
        setSelectedMonthFilter(saved);
        return;
      }
      // No saved preference → default to latest month
      if (!saved || saved === 'ALL') {
        setSelectedMonthFilter(availableMonths[0]);
        localStorage.setItem(MONTH_FILTER_KEY, availableMonths[0]);
      }
    } catch {}
  }, [availableMonths]);

  // Persist filter changes
  useEffect(() => {
    try {
      localStorage.setItem(MONTH_FILTER_KEY, selectedMonthFilter);
    } catch {}
  }, [selectedMonthFilter]);

  const filteredBills = useMemo(() => {
    let result = selectedMonthFilter === 'ALL' ? bills : bills.filter(b => b.dueDate.startsWith(selectedMonthFilter));
    // Sort: unpaid first, then most recent due date first
    return [...result].sort((a, b) => {
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
      return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
    });
  }, [bills, selectedMonthFilter]);

  const handlePaymentConfirm = (billId: string, details: PaymentDetails) => {
    const billToUpdate = bills.find(b => b.id === billId);
    if (billToUpdate) {
        onUpdateBill({
            ...billToUpdate,
            isPaid: true,
            paymentDetails: details
        });
    }
  };

  const handleEditSave = (updatedBill: Bill) => {
      onUpdateBill(updatedBill);
  };

  const formatDateForDisplay = (dateStr: string) => {
     if (!dateStr) return 'N/A';
     const d = new Date(dateStr);
     const day = String(d.getDate()).padStart(2, '0');
     const month = String(d.getMonth() + 1).padStart(2, '0');
     const year = d.getFullYear();
     return `${day}/${month}/${year}`;
  };

  // Days remaining helper
  const getDaysRemaining = (dueDateStr: string) => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const due = new Date(dueDateStr);
      due.setHours(0,0,0,0);
      const diffTime = due.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getUrgencyTone = (days: number) => {
      if (days < 0) return 'text-danger border-danger/40';
      if (days <= DUE_SOON_DAYS) return 'text-danger border-danger/40';
      if (days <= DUE_WARNING_DAYS) return 'text-warning border-warning/40';
      return 'text-ink-mute border-brass-500/25';
  };

  const getUrgencyLabel = (days: number) => {
      if (days < 0) return `Overdue ${Math.abs(days)}d`;
      if (days === 0) return 'Due today';
      if (days === 1) return 'Due tomorrow';
      return `${days}d left`;
  };

  const getMonthLabel = (yyyyMm: string) => {
    if (!yyyyMm) return '';
    const [year, month] = yyyyMm.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
  };

  const handleViewDocument = async (bill: Bill) => {
      if (!bill.filePath) return;
      const url = await dbService.getBillFileUrl(bill.filePath);
      if (url) {
          window.open(url, '_blank');
      } else {
          setAlertMessage("Could not retrieve document. It may have been deleted.");
      }
  };

  const monthChipClass = (active: boolean) =>
    `px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] whitespace-nowrap transition-colors duration-150 min-h-[40px] ${
      active ? 'bg-brass-500 text-marine-900' : 'text-ink-mute hover:text-ink'
    }`;

  const iconButtonClass =
    'w-10 h-10 flex items-center justify-center text-ink-mute hover:text-brass-400 transition-colors duration-150';

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-marine-900 border border-brass-500/15 p-5">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Outstanding</p>
              <p className="font-mono text-2xl tabular-nums text-ink mt-2">${money(totalDue)}</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-brass-400 shrink-0" strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-marine-900 border border-brass-500/15 p-5">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Bills due</p>
              <p className="font-mono text-2xl tabular-nums text-ink mt-2">{upcomingBills.length}</p>
            </div>
            <Clock className="w-5 h-5 text-brass-400 shrink-0" strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-marine-900 border border-brass-500/15 p-5">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Processed</p>
              <p className="font-mono text-2xl tabular-nums text-ink mt-2">{bills.length}</p>
            </div>
            <CheckCircle className="w-5 h-5 text-brass-400 shrink-0" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming List */}
        <div className="bg-marine-900 border border-brass-500/15 p-5 sm:p-6 h-96 flex flex-col">
          <h2 className="text-base font-medium text-ink mb-4 flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
              Upcoming deadlines
          </h2>
          {upcomingBills.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-ink-mute">
                <CheckCircle className="w-8 h-8 mb-3 text-brass-500/40" strokeWidth={1.5} />
                <p className="text-sm">Nothing pending.</p>
            </div>
          ) : (
            <div className="overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {upcomingBills.map(bill => {
                  const daysLeft = getDaysRemaining(bill.dueDate);
                  return (
                    <div key={bill.id} className="flex items-center justify-between gap-3 p-3 bg-marine-800 border border-brass-500/10 hover:border-brass-500/30 transition-colors duration-150">
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm text-ink truncate">{bill.bankName} · {bill.cardName}</p>
                        <p className="font-mono text-[10px] tabular-nums text-ink-mute mt-0.5">{formatDateForDisplay(bill.dueDate)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm tabular-nums text-ink">${money(bill.totalAmount)}</p>
                        <span className={`inline-block mt-1 font-mono text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 border ${getUrgencyTone(daysLeft)}`}>
                            {getUrgencyLabel(daysLeft)}
                        </span>
                      </div>
                    </div>
                  );
              })}
            </div>
          )}
        </div>

        {/* Spend Breakdown */}
        <div className="bg-marine-900 border border-brass-500/15 p-5 sm:p-6 h-96 flex flex-col">
          <h2 className="text-base font-medium text-ink mb-4 flex items-center gap-2.5">
            <TrendingUp className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
            Spend by category
          </h2>

          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {categoryData.data.length > 0 ? (
                  <div className="space-y-4">
                      {categoryData.data.map((cat, index) => (
                          <div key={cat.name}>
                              <div className="flex justify-between items-end mb-1.5 gap-3">
                                  <span className="text-sm text-ink-soft truncate">{cat.name}</span>
                                  <div className="text-right shrink-0">
                                      <span className="font-mono text-sm tabular-nums text-ink">${money(cat.value)}</span>
                                      <span className="font-mono text-[10px] tabular-nums text-ink-mute ml-2">{cat.percentage.toFixed(1)}%</span>
                                  </div>
                              </div>
                              <div className="w-full h-1.5 bg-marine-700 overflow-hidden">
                                  <div
                                    className="h-full"
                                    style={{
                                        width: `${cat.percentage}%`,
                                        backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length]
                                    }}
                                  ></div>
                              </div>
                          </div>
                      ))}
                      <div className="pt-3 mt-3 border-t border-brass-500/10 flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Total tracked</span>
                          <span className="font-mono text-sm tabular-nums text-brass-400">${money(categoryData.total)}</span>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex items-center justify-center text-sm text-ink-mute">No transaction data yet.</div>
              )}
          </div>
        </div>
      </div>

      {/* Bank Spend Trend (Clustered Bar Chart) */}
      <div className="bg-marine-900 border border-brass-500/15 p-5 sm:p-6">
          <h2 className="text-base font-medium text-ink mb-6 flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
              Monthly spend by bank
          </h2>
          <div className="h-80">
            {clusteredData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={clusteredData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                        <XAxis dataKey="name" tick={{fontSize: 11, fill: CHART_AXIS}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{fontSize: 11, fill: CHART_AXIS}} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} width={56} />
                        <Tooltip
                            formatter={(value: number, name: string) => [`$${money(value)}`, name]}
                            contentStyle={{
                              background: '#0e2330',
                              border: '1px solid rgba(201, 161, 87, 0.3)',
                              borderRadius: 0,
                              fontSize: 12,
                            }}
                            labelStyle={{ color: '#f4ead7' }}
                            itemStyle={{ color: '#d9cba8' }}
                            cursor={{ fill: 'rgba(201, 161, 87, 0.06)' }}
                        />
                        <Legend wrapperStyle={{paddingTop: '16px', fontSize: 12, color: CHART_AXIS}} />

                        {uniqueBanks.map((bank, index) => (
                            <Bar
                                key={bank}
                                dataKey={bank}
                                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                                barSize={36}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-sm text-ink-mute">
                    Add bills to compare monthly spend by bank.
                </div>
            )}
          </div>
      </div>

      {/* Bills Table */}
      <div className="bg-marine-900 border border-brass-500/15 overflow-hidden">
          {/* Table Header with Filters */}
          <div className="p-5 sm:p-6 border-b border-brass-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
                  <h2 className="text-base font-medium text-ink shrink-0">Recent bills</h2>

                  {/* Month Filters */}
                  {availableMonths.length > 0 && (
                    <div className="flex items-center border border-brass-500/20 overflow-x-auto custom-scrollbar">
                        <button onClick={() => setSelectedMonthFilter('ALL')} className={monthChipClass(selectedMonthFilter === 'ALL')}>
                            All
                        </button>
                        {availableMonths.map(month => (
                            <button
                                key={month}
                                onClick={() => setSelectedMonthFilter(month)}
                                className={monthChipClass(selectedMonthFilter === month)}
                            >
                                {getMonthLabel(month)}
                            </button>
                        ))}
                    </div>
                  )}
              </div>

              <button
                onClick={() => onOpenManualModal?.()}
                className="flex items-center justify-center gap-2 text-sm text-brass-300 border border-brass-500/30 px-4 py-2.5 hover:border-brass-500 hover:text-brass-400 font-medium transition-colors duration-150 whitespace-nowrap min-h-[44px] shrink-0"
              >
                <Plus className="w-4 h-4" strokeWidth={1.5} />
                Add manually
              </button>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-brass-500/10">
            {filteredBills.length === 0 ? (
              <p className="px-6 py-8 text-center text-ink-mute text-sm">No bills for this period.</p>
            ) : (
              filteredBills.map(bill => {
                const daysLeft = getDaysRemaining(bill.dueDate);
                return (
                  <div key={`mobile-${bill.id}`} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-ink truncate">{bill.cardName}</p>
                        <p className="text-xs text-ink-mute truncate">{bill.bankName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono tabular-nums text-ink">${money(bill.totalAmount)}</p>
                        <span className={`inline-block mt-1 font-mono text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 border ${
                          bill.isPaid ? 'text-brass-400 border-brass-500/40' : 'text-warning border-warning/40'
                        }`}>
                          {bill.isPaid ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-ink-mute">
                        <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span className="font-mono tabular-nums">{formatDateForDisplay(bill.dueDate)}</span>
                      </div>
                      {!bill.isPaid && (
                        <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${daysLeft <= DUE_SOON_DAYS ? 'text-danger' : 'text-ink-mute'}`}>
                          {getUrgencyLabel(daysLeft)}
                        </span>
                      )}
                      {bill.isPaid && bill.paymentDetails?.paidAt && (
                        <span className="font-mono text-[10px] tabular-nums text-ink-mute">
                          Paid {formatDateForDisplay(bill.paymentDetails.paidAt)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {!bill.isPaid ? (
                        <button
                          onClick={() => setSelectedBillForPayment(bill)}
                          className="flex-1 py-3 text-center text-sm bg-brass-500 text-marine-900 font-medium hover:bg-brass-400 transition-colors duration-150 min-h-[48px]"
                        >
                          Mark paid
                        </button>
                      ) : (
                        <div className="flex-1 py-3 text-center text-sm border border-brass-500/15 text-ink-mute min-h-[48px] flex items-center justify-center">
                          Settled
                        </div>
                      )}
                      {bill.filePath && (
                        <button
                          onClick={() => handleViewDocument(bill)}
                          aria-label="View document"
                          className="w-12 h-12 flex items-center justify-center text-ink-mute hover:text-brass-400 border border-brass-500/20 transition-colors duration-150"
                        >
                          <FileText className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        onClick={() => setBillToEdit(bill)}
                        aria-label="Edit bill"
                        className="w-12 h-12 flex items-center justify-center text-ink-mute hover:text-brass-400 border border-brass-500/20 transition-colors duration-150"
                      >
                        <Pencil className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => setBillToDelete(bill.id)}
                        aria-label="Delete bill"
                        className="w-12 h-12 flex items-center justify-center text-ink-mute hover:text-danger border border-brass-500/20 transition-colors duration-150"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-ink-soft">
                  <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute border-b border-brass-500/15">
                      <tr>
                          <th className="px-5 py-3 font-normal">Bank / card</th>
                          <th className="px-5 py-3 font-normal">Due date</th>
                          <th className="px-5 py-3 font-normal">Amount</th>
                          <th className="px-5 py-3 font-normal">Status</th>
                          <th className="px-5 py-3 font-normal">Payment</th>
                          <th className="px-5 py-3 font-normal">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-brass-500/10">
                      {filteredBills.length === 0 ? (
                          <tr>
                              <td colSpan={6} className="px-5 py-8 text-center text-ink-mute">No bills for this period.</td>
                          </tr>
                      ) : (
                          filteredBills.map(bill => (
                              <tr key={bill.id} className="hover:bg-marine-800 transition-colors duration-150">
                                  <td className="px-5 py-4">
                                      <div className="text-ink">{bill.cardName}</div>
                                      <div className="text-xs text-ink-mute">{bill.bankName}</div>
                                  </td>
                                  <td className="px-5 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-xs tabular-nums">{formatDateForDisplay(bill.dueDate)}</span>
                                        {!bill.isPaid && (
                                            <span className={`font-mono text-[10px] uppercase tracking-[0.12em] mt-0.5 ${
                                                getDaysRemaining(bill.dueDate) <= DUE_SOON_DAYS ? 'text-danger' : 'text-ink-mute'
                                            }`}>
                                                {getUrgencyLabel(getDaysRemaining(bill.dueDate))}
                                            </span>
                                        )}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4 font-mono tabular-nums text-ink">${money(bill.totalAmount)}</td>
                                  <td className="px-5 py-4">
                                      <span className={`inline-flex font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 border whitespace-nowrap ${
                                          bill.isPaid ? 'text-brass-400 border-brass-500/40' : 'text-warning border-warning/40'
                                      }`}>
                                          {bill.isPaid ? 'Paid' : 'Pending'}
                                      </span>
                                  </td>
                                  <td className="px-5 py-4 text-xs">
                                      {bill.isPaid && bill.paymentDetails ? (
                                          <div>
                                              <p className="text-ink-soft">{bill.paymentDetails.method}</p>
                                              <p className="font-mono text-[10px] text-ink-mute">{bill.paymentDetails.transactionId}</p>
                                          </div>
                                      ) : (
                                          <span className="text-ink-mute">—</span>
                                      )}
                                  </td>
                                  <td className="px-5 py-4">
                                      <div className="flex items-center gap-1">
                                          {bill.filePath && (
                                              <button
                                                  onClick={() => handleViewDocument(bill)}
                                                  aria-label="View document"
                                                  className={iconButtonClass}
                                                  title="View uploaded document"
                                              >
                                                  <FileText className="w-4 h-4" strokeWidth={1.5} />
                                              </button>
                                          )}

                                          {!bill.isPaid ? (
                                              <button
                                                  onClick={() => setSelectedBillForPayment(bill)}
                                                  className="text-brass-300 hover:text-brass-400 text-xs font-medium border border-brass-500/30 hover:border-brass-500 px-3 py-2 transition-colors duration-150 whitespace-nowrap"
                                              >
                                                  Mark paid
                                              </button>
                                          ) : (
                                            <div className="flex flex-col items-start">
                                                <span className="text-ink-mute text-xs px-3 py-2 border border-brass-500/15">
                                                    Settled
                                                </span>
                                                {bill.paymentDetails?.paidAt && (
                                                    <span className="font-mono text-[10px] tabular-nums text-ink-mute mt-1 ml-1">
                                                        {formatDateForDisplay(bill.paymentDetails.paidAt)}
                                                    </span>
                                                )}
                                            </div>
                                          )}

                                          <button
                                            onClick={() => setBillToEdit(bill)}
                                            aria-label="Edit bill"
                                            className={iconButtonClass}
                                            title="Edit bill details"
                                          >
                                              <Pencil className="w-4 h-4" strokeWidth={1.5} />
                                          </button>

                                          <button
                                            onClick={() => setBillToDelete(bill.id)}
                                            aria-label="Delete bill"
                                            className="w-10 h-10 flex items-center justify-center text-ink-mute hover:text-danger transition-colors duration-150"
                                            title="Delete bill"
                                          >
                                              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <PaymentModal
        bill={selectedBillForPayment}
        isOpen={!!selectedBillForPayment}
        onClose={() => setSelectedBillForPayment(null)}
        onConfirm={handlePaymentConfirm}
      />

      <EditBillModal
        bill={billToEdit}
        isOpen={!!billToEdit}
        onClose={() => setBillToEdit(null)}
        onSave={handleEditSave}
      />

      {/* Delete Confirmation Modal */}
      {billToDelete && (
        <div className="fixed inset-0 bg-marine-950/80 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-marine-900 border border-brass-500/25 p-6 w-full max-w-sm animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-danger" strokeWidth={1.5} />
              <h2 className="text-lg font-medium text-ink">Delete bill</h2>
            </div>
            <p className="text-sm text-ink-soft mb-6">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBillToDelete(null)}
                className="px-4 py-2.5 text-sm text-ink-soft hover:text-ink font-medium transition-colors duration-150 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteBill(billToDelete);
                  setBillToDelete(null);
                }}
                className="px-5 py-2.5 bg-danger text-ink font-medium text-sm hover:opacity-90 transition-opacity duration-150 min-h-[44px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage(null)}
        type="warning"
      />

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-brass-500/10 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-ink-mute">
          <Globe className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
          <p>
            <span className="text-ink-soft">Optimised for Singapore banks</span>
            <span className="mx-2 text-ink-mute">·</span>
            <span>More countries coming</span>
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mt-3">© 2026 CreditTrack · EliteX.CC Group</p>
      </footer>
    </div>
  );
};
