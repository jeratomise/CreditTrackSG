
import React, { useMemo, useState, useEffect } from 'react';
import { Bill, PaymentDetails } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, CheckCircle, Clock, Plus, Filter, TrendingUp, Pencil, FileText, ExternalLink, Calendar, Trash2, ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';
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

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const BANK_COLORS: Record<string, string> = {
    'DBS': '#ef4444', // Red
    'Citibank': '#0ea5e9', // Light Blue
    'UOB': '#0f172a', // Dark Navy
    'HSBC': '#db2777', // Pink
    'OCBC': '#f97316', // Orange
    'Standard Chartered': '#16a34a', // Green
    'AMEX': '#8b5cf6', // Purple
    'Unknown': '#9ca3af' // Gray
};
const DEFAULT_BANK_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#84cc16', '#06b6d4', '#f43f5e'];

export const Dashboard: React.FC<DashboardProps> = ({ bills, onUpdateBill, onAddBill, onDeleteBill, onOpenManualModal }) => {
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<Bill | null>(null);
  const [billToEdit, setBillToEdit] = useState<Bill | null>(null);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
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

  const filteredBills = useMemo(() => {
    const base = selectedMonthFilter === 'ALL'
      ? bills
      : bills.filter(b => b.dueDate.startsWith(selectedMonthFilter));
    const dir = sortOrder === 'desc' ? -1 : 1;
    return [...base].sort((a, b) =>
      dir * (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    );
  }, [bills, selectedMonthFilter, sortOrder]);

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

  const getUrgencyColor = (days: number) => {
      if (days < 0) return 'text-red-600 bg-red-100'; // Overdue
      if (days <= 3) return 'text-orange-600 bg-orange-100'; // Critical
      if (days <= 7) return 'text-yellow-600 bg-yellow-100'; // Warning
      return 'text-green-600 bg-green-100'; // Safe
  };

  const getUrgencyLabel = (days: number) => {
      if (days < 0) return `Overdue by ${Math.abs(days)} days`;
      if (days === 0) return 'Due Today';
      if (days === 1) return 'Due Tomorrow';
      return `Due in ${days} days`;
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

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Outstanding</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">${totalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="bg-red-50 p-2.5 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Bills Due Soon</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{upcomingBills.length}</h3>
            </div>
            <div className="bg-yellow-50 p-2.5 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Processed Bills</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{bills.length}</h3>
            </div>
             <div className="bg-green-50 p-2.5 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Upcoming List */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Upcoming Deadlines
          </h3>
          {upcomingBills.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <CheckCircle className="w-12 h-12 mb-2 opacity-20" />
                <p>All clear! No bills pending.</p>
            </div>
          ) : (
            <div className="overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {upcomingBills.map(bill => {
                  const daysLeft = getDaysRemaining(bill.dueDate);
                  return (
                    <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-primary/30 transition-all">
                      <div className="flex flex-col">
                        <p className="font-semibold text-gray-800 text-sm">{bill.bankName} • {bill.cardName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDateForDisplay(bill.dueDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-sm">${bill.totalAmount.toFixed(2)}</p>
                        <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getUrgencyColor(daysLeft)}`}>
                            {getUrgencyLabel(daysLeft)}
                        </span>
                      </div>
                    </div>
                  );
              })}
            </div>
          )}
        </div>

        {/* Spend Breakdown - REPLACED PIE CHART WITH LIST */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Spend by Category
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {categoryData.data.length > 0 ? (
                  <div className="space-y-4">
                      {categoryData.data.map((cat, index) => (
                          <div key={cat.name} className="group">
                              <div className="flex justify-between items-end mb-1">
                                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                                  <div className="text-right">
                                      <span className="text-sm font-bold text-gray-900">${cat.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                      <span className="text-xs text-gray-400 ml-2">({cat.percentage.toFixed(1)}%)</span>
                                  </div>
                              </div>
                              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all duration-500 ease-out"
                                    style={{ 
                                        width: `${cat.percentage}%`,
                                        backgroundColor: COLORS[index % COLORS.length]
                                    }}
                                  ></div>
                              </div>
                          </div>
                      ))}
                      <div className="pt-2 mt-2 border-t border-gray-100 text-right">
                          <span className="text-xs text-gray-400">Total Tracked Spend: </span>
                          <span className="text-sm font-bold text-gray-700">${categoryData.total.toLocaleString()}</span>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">No transaction data available yet.</div>
              )}
          </div>
        </div>
      </div>

      {/* Bank Spend Trend (Clustered Bar Chart) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Monthly Spend Trend by Bank
              </h3>
          </div>
          <div className="h-80">
            {clusteredData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                        data={clusteredData} 
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                        <Tooltip 
                            formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f9fafb' }}
                        />
                        <Legend wrapperStyle={{paddingTop: '20px'}} />
                        
                        {uniqueBanks.map((bank, index) => (
                            <Bar 
                                key={bank} 
                                dataKey={bank} 
                                fill={BANK_COLORS[bank] || DEFAULT_BANK_COLORS[index % DEFAULT_BANK_COLORS.length]} 
                                radius={[4, 4, 0, 0]} 
                                barSize={40}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    Add bills to see your monthly bank spending comparison.
                </div>
            )}
          </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table Header with Filters */}
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Bills</h3>
                  
                  {/* Month Filters */}
                  {availableMonths.length > 0 && (
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg overflow-x-auto">
                        <button
                            onClick={() => setSelectedMonthFilter('ALL')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                                selectedMonthFilter === 'ALL' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            ALL
                        </button>
                        {availableMonths.map(month => (
                            <button
                                key={month}
                                onClick={() => setSelectedMonthFilter(month)}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                                    selectedMonthFilter === month 
                                    ? 'bg-white text-indigo-600 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {getMonthLabel(month)}
                            </button>
                        ))}
                    </div>
                  )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortOrder(s => (s === 'desc' ? 'asc' : 'desc'))}
                  title={sortOrder === 'desc' ? 'Newest first (click for oldest first)' : 'Oldest first (click for newest first)'}
                  className="flex items-center gap-2 text-sm bg-gray-50 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100 font-medium transition-colors whitespace-nowrap"
                >
                  {sortOrder === 'desc' ? (
                    <ArrowDownWideNarrow className="w-4 h-4" />
                  ) : (
                    <ArrowUpWideNarrow className="w-4 h-4" />
                  )}
                  {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
                </button>
                <button
                  onClick={() => onOpenManualModal?.()}
                  className="flex items-center gap-2 text-sm bg-indigo-50 text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-100 font-medium transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Add Manual Bill
                </button>
              </div>
          </div>
          
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100">
            {filteredBills.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-400 text-sm">No bills found for this period.</p>
            ) : (
              filteredBills.map(bill => {
                const daysLeft = getDaysRemaining(bill.dueDate);
                return (
                  <div key={`mobile-${bill.id}`} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{bill.cardName}</p>
                        <p className="text-xs text-gray-400">{bill.bankName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">${bill.totalAmount.toFixed(2)}</p>
                        <span className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          bill.isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {bill.isPaid ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Due {formatDateForDisplay(bill.dueDate)}</span>
                      </div>
                      {!bill.isPaid && (
                        <span className={`font-semibold ${daysLeft <= 3 ? 'text-red-500' : 'text-gray-500'}`}>
                          {getUrgencyLabel(daysLeft)}
                        </span>
                      )}
                      {bill.isPaid && bill.paymentDetails?.paidAt && (
                        <span className="text-gray-400">Paid {formatDateForDisplay(bill.paymentDetails.paidAt)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {!bill.isPaid ? (
                        <button
                          onClick={() => setSelectedBillForPayment(bill)}
                          className="flex-1 py-2 text-center text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <div className="flex-1 py-2 text-center text-sm bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed">
                          Settled
                        </div>
                      )}
                      {bill.filePath && (
                        <button
                          onClick={() => handleViewDocument(bill)}
                          className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Document"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setBillToEdit(bill)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Bill"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setBillToDelete(bill.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Bill"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                      <tr>
                          <th className="px-6 py-4">Bank / Card</th>
                          <th className="px-6 py-4">Due Date</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Payment Info</th>
                          <th className="px-6 py-4">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {filteredBills.length === 0 ? (
                          <tr>
                              <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No bills found for this period.</td>
                          </tr>
                      ) : (
                          filteredBills.map(bill => (
                              <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4">
                                      <div className="font-medium text-gray-900">{bill.cardName}</div>
                                      <div className="text-xs text-gray-400">{bill.bankName}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span>{formatDateForDisplay(bill.dueDate)}</span>
                                        {!bill.isPaid && (
                                            <span className={`text-[10px] font-bold uppercase ${
                                                getDaysRemaining(bill.dueDate) <= 3 ? 'text-red-600' : 'text-gray-400'
                                            }`}>
                                                {getDaysRemaining(bill.dueDate)} days left
                                            </span>
                                        )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 font-medium">${bill.totalAmount.toFixed(2)}</td>
                                  <td className="px-6 py-4">
                                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                          bill.isPaid 
                                          ? 'bg-green-100 text-green-700' 
                                          : 'bg-amber-100 text-amber-700'
                                      }`}>
                                          {bill.isPaid ? 'Paid' : 'Pending'}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-xs">
                                      {bill.isPaid && bill.paymentDetails ? (
                                          <div>
                                              <p><span className="font-semibold text-gray-700">{bill.paymentDetails.method}</span></p>
                                              <p className="text-gray-400">Ref: {bill.paymentDetails.transactionId}</p>
                                          </div>
                                      ) : (
                                          <span className="text-gray-300">-</span>
                                      )}
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                          {bill.filePath && (
                                              <button 
                                                  onClick={() => handleViewDocument(bill)}
                                                  className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition-colors"
                                                  title="View Uploaded Document"
                                              >
                                                  <FileText className="w-4 h-4" />
                                              </button>
                                          )}

                                          {!bill.isPaid ? (
                                              <button 
                                                  onClick={() => setSelectedBillForPayment(bill)}
                                                  className="text-indigo-600 hover:text-indigo-800 font-medium text-xs bg-indigo-50 px-3 py-1 rounded-md hover:bg-indigo-100 transition-colors"
                                              >
                                                  Mark Paid
                                              </button>
                                          ) : (
                                            <div className="flex flex-col items-start">
                                                <button 
                                                    disabled
                                                    className="text-gray-400 font-medium text-xs cursor-not-allowed bg-gray-100 px-3 py-1 rounded-md"
                                                >
                                                    Settled
                                                </button>
                                                {/* Display Date Below Button */}
                                                {bill.paymentDetails?.paidAt && (
                                                    <span className="text-[10px] text-gray-500 mt-1 ml-1">
                                                        {formatDateForDisplay(bill.paymentDetails.paidAt)}
                                                    </span>
                                                )}
                                            </div>
                                          )}
                                          
                                          <button 
                                            onClick={() => setBillToEdit(bill)}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                            title="Edit Bill Details"
                                          >
                                              <Pencil className="w-4 h-4" />
                                          </button>

                                          <button 
                                            onClick={() => setBillToDelete(bill.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                            title="Delete Bill"
                                          >
                                              <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scale-in">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-gray-900">Delete Bill</h3>
            </div>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this bill? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setBillToDelete(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onDeleteBill(billToDelete);
                  setBillToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm"
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
    </div>
  );
};
