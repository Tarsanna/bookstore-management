
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  ShoppingBag, 
  Wallet, 
  BookOpen, 
  TrendingUp,
  Upload,
  Plus,
  Trash2,
  Calendar,
  Ticket,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Save,
  Store,
  Settings,
  ChevronRight,
  AlertCircle,
  BarChart3,
  Info,
  History,
  Table as TableIcon,
  PieChart as PieIcon,
  Edit2,
  Check,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { OrderRecord, PaymentRecord, PurchaseRecord, FixedCost, DailySummary, MonthlyManualIncome, Shop, OrderCategory } from './types';
import { parseOrderExcel, parsePaymentCSV, aggregateDailySummary, parsePurchaseExcel } from './utils/dataProcessors';

// Predefined Shops
const INITIAL_SHOPS: Shop[] = [
  { id: 'hj', name: '海椒市' },
  { id: 'zb', name: '棕北' }
];

// Reusable Components
const Card: React.FC<{ children: React.ReactNode; title?: string; extra?: React.ReactNode }> = ({ children, title, extra }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    {(title || extra) && (
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
        {extra}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const StatCard: React.FC<{ title: string; value: string; subValue?: string; icon: React.ReactNode; color: string }> = ({ title, value, subValue, icon, color }) => (
  <Card>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
        <h2 className="text-3xl font-black mt-1 text-gray-900 tabular-nums">{value}</h2>
        {subValue && <p className="text-xs text-gray-400 mt-1 font-medium">{subValue}</p>}
      </div>
      <div className={`p-4 rounded-2xl ${color} text-white shadow-lg`}>
        {icon}
      </div>
    </div>
  </Card>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reconcile' | 'costs' | 'purchases' | 'inventory'>('dashboard');
  
  // State from LocalStorage
  const [orders, setOrders] = useState<OrderRecord[]>(() => JSON.parse(localStorage.getItem('bd_orders') || '[]'));
  const [payments, setPayments] = useState<PaymentRecord[]>(() => JSON.parse(localStorage.getItem('bd_payments') || '[]'));
  const [purchases, setPurchases] = useState<PurchaseRecord[]>(() => JSON.parse(localStorage.getItem('bd_purchases') || '[]'));
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>(() => JSON.parse(localStorage.getItem('bd_fixedCosts') || '[]'));
  const [monthlyIncomes, setMonthlyIncomes] = useState<MonthlyManualIncome[]>(() => JSON.parse(localStorage.getItem('bd_monthlyIncomes') || '[]'));
  
  // Context for Costs Tab
  const [costFilterShopId, setCostFilterShopId] = useState<string>('hj');

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Editing state for Purchase items
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editPurchaseForm, setEditPurchaseForm] = useState<Partial<PurchaseRecord>>({});

  // Persistence
  useEffect(() => { localStorage.setItem('bd_orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('bd_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('bd_purchases', JSON.stringify(purchases)); }, [purchases]);
  useEffect(() => { localStorage.setItem('bd_fixedCosts', JSON.stringify(fixedCosts)); }, [fixedCosts]);
  useEffect(() => { localStorage.setItem('bd_monthlyIncomes', JSON.stringify(monthlyIncomes)); }, [monthlyIncomes]);

  // Global Derived Data
  const dailySummary = useMemo(() => aggregateDailySummary(orders, payments), [orders, payments]);
  
  const recent10DaysTableData = useMemo(() => {
    return dailySummary.slice(0, 10).map(d => ({
      date: d.date,
      book: d.categories.book || 0,
      drink: d.categories.drink || 0,
      alcohol: d.categories.alcohol || 0,
      membership: d.categories.membership || 0,
      event: d.categories.event || 0,
      total: (d.categories.book || 0) + (d.categories.drink || 0) + (d.categories.alcohol || 0) + (d.categories.membership || 0) + (d.categories.event || 0)
    }));
  }, [dailySummary]);

  // 月度分类占比数据
  const monthlyProportionData = useMemo(() => {
    const months: Record<string, { total: number; categories: Record<OrderCategory, number> }> = {};
    
    orders.forEach(order => {
      const month = order.date.substring(0, 7); // YYYY-MM
      if (!months[month]) {
        months[month] = { 
          total: 0, 
          categories: { book: 0, drink: 0, alcohol: 0, event: 0, membership: 0 } 
        };
      }
      months[month].total += order.price;
      months[month].categories[order.category] += order.price;
    });

    return Object.entries(months)
      .sort((a, b) => b[0].localeCompare(a[0])) // 按月份降序
      .map(([month, data]) => ({
        month,
        total: data.total,
        book: { val: data.categories.book, pct: data.total ? (data.categories.book / data.total) * 100 : 0 },
        drink: { val: data.categories.drink, pct: data.total ? (data.categories.drink / data.total) * 100 : 0 },
        alcohol: { val: data.categories.alcohol, pct: data.total ? (data.categories.alcohol / data.total) * 100 : 0 },
        membership: { val: data.categories.membership, pct: data.total ? (data.categories.membership / data.total) * 100 : 0 },
        event: { val: data.categories.event, pct: data.total ? (data.categories.event / data.total) * 100 : 0 },
      }));
  }, [orders]);

  // 耗材月度汇总数据
  const purchaseMonthlySummary = useMemo(() => {
    const months: Record<string, { total: number; categories: Record<string, number> }> = {};
    
    purchases.forEach(p => {
      const m = p.date.substring(0, 7); // YYYY-MM
      if (!months[m]) {
        months[m] = { 
          total: 0, 
          categories: { '饮品耗材': 0, '清洁耗材': 0, '书': 0, '其他': 0 } 
        };
      }
      months[m].total += p.amount;
      months[m].categories[p.category] = (months[m].categories[p.category] || 0) + p.amount;
    });

    return Object.entries(months)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, data]) => ({
        month,
        total: data.total,
        details: [
          { label: '饮品耗材', val: data.categories['饮品耗材'] || 0 },
          { label: '清洁耗材', val: data.categories['清洁耗材'] || 0 },
          { label: '书籍采购', val: data.categories['书'] || 0 },
          { label: '其他', val: data.categories['其他'] || 0 },
        ].map(item => ({
          ...item,
          pct: data.total ? (item.val / data.total) * 100 : 0
        }))
      }));
  }, [purchases]);

  const totalRevenue = useMemo(() => 
    orders.reduce((sum, o) => sum + o.price, 0) + monthlyIncomes.reduce((sum, m) => sum + m.amount, 0),
    [orders, monthlyIncomes]
  );

  const totalPurchase = useMemo(() => purchases.reduce((sum, p) => sum + p.amount, 0), [purchases]);
  const totalFixedCostsGlobal = useMemo(() => fixedCosts.reduce((sum, f) => sum + f.amount, 0), [fixedCosts]);
  
  const hjFixedCosts = useMemo(() => fixedCosts.filter(f => f.shopId === 'hj'), [fixedCosts]);
  const zbFixedCosts = useMemo(() => fixedCosts.filter(f => f.shopId === 'zb'), [fixedCosts]);

  const activeShopNameForCost = useMemo(() => INITIAL_SHOPS.find(s => s.id === costFilterShopId)?.name || '', [costFilterShopId]);

  const handleOrderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true);
    setStatusMsg(`正在导入小程序订单...`);
    try {
      const parsed = await parseOrderExcel(e.target.files[0]);
      const newOrders = parsed.map(o => ({ ...o, shopId: 'global' }));
      setOrders(prev => [...prev, ...newOrders]);
      alert(`🎉 成功导入 ${newOrders.length} 条订单`);
    } catch (err: any) {
      alert(`导入失败: ${err.message}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handlePaymentUpload = async (e: React.ChangeEvent<HTMLInputElement>, source: 'wechat' | 'alipay' | 'you') => {
    if (!e.target.files?.[0]) return;
    setLoading(true);
    const sourceLabel = source === 'wechat' ? '微信' : source === 'alipay' ? '支付宝' : '友店';
    setStatusMsg(`正在解析${sourceLabel}支付流水...`);
    try {
      const parsed = await parsePaymentCSV(e.target.files[0], source);
      const newPayments = parsed.map(p => ({ ...p, shopId: 'global' }));
      setPayments(prev => [...prev, ...newPayments]);
      alert(`✅ 导入成功：${newPayments.length} 笔${sourceLabel}流水记录已加入总账`);
    } catch (err: any) {
      alert(`解析失败: ${err.message}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handlePurchaseExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true);
    setStatusMsg('正在解析耗材采购 Excel...');
    try {
      const parsed = await parsePurchaseExcel(e.target.files[0]);
      setPurchases(prev => [...prev, ...parsed]);
      alert(`✅ 成功导入 ${parsed.length} 笔采购记录`);
    } catch (err: any) {
      alert(`导入失败: ${err.message}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleAddCost = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cost: FixedCost = {
      id: `cost-${Date.now()}`,
      shopId: costFilterShopId,
      date: fd.get('date') as string,
      type: fd.get('type') as any,
      amount: parseFloat(fd.get('amount') as string)
    };
    setFixedCosts(prev => [...prev, cost]);
    e.currentTarget.reset();
  };

  const addManualIncome = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const inc: MonthlyManualIncome = {
      shopId: 'global',
      month: fd.get('month') as string,
      amount: parseFloat(fd.get('amount') as string),
      note: fd.get('note') as string
    };
    setMonthlyIncomes(prev => [...prev, inc]);
    e.currentTarget.reset();
  };

  const clearReconciliationData = () => {
    const confirmClear = window.confirm('确定要清空所有已导入的订单和流水数据吗？该操作不可撤销。');
    if (confirmClear) {
      localStorage.removeItem('bd_orders');
      localStorage.removeItem('bd_payments');
      setOrders([]);
      setPayments([]);
      alert('已成功清空对账数据。');
    }
  };

  const resetAllData = () => {
    const confirmReset = window.confirm('确定要重置所有数据吗？这将清除所有支出、采购及收入记录。');
    if (confirmReset) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const startEditingPurchase = (item: PurchaseRecord) => {
    setEditingPurchaseId(item.id);
    setEditPurchaseForm({ ...item });
  };

  const cancelEditingPurchase = () => {
    setEditingPurchaseId(null);
    setEditPurchaseForm({});
  };

  const saveEditedPurchase = () => {
    if (!editingPurchaseId) return;
    setPurchases(prev => prev.map(p => 
      p.id === editingPurchaseId ? (editPurchaseForm as PurchaseRecord) : p
    ));
    setEditingPurchaseId(null);
    setEditPurchaseForm({});
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0F172A] text-white flex flex-col shadow-2xl">
        <div className="p-10 mb-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2.5 bg-indigo-500 rounded-2xl shadow-xl shadow-indigo-500/20">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">白读大脑</h1>
              <p className="text-slate-500 text-[9px] uppercase tracking-[0.3em] font-bold">Dual Shop Manager</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-6 space-y-2">
          {[
            { id: 'dashboard', label: '经营看板', icon: LayoutDashboard },
            { id: 'reconcile', label: '流水对账', icon: ArrowLeftRight },
            { id: 'costs', label: '分店支出 (人工房租)', icon: Wallet },
            { id: 'purchases', label: '耗材采购 (Excel)', icon: ShoppingBag },
            { id: 'inventory', label: '销售洞察', icon: TrendingUp },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${
                activeTab === item.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 translate-x-1' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-slate-800/50 space-y-4">
           <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-700/50">
              <div className="flex justify-between items-center mb-4">
                 <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">分店活跃</span>
              </div>
              <div className="space-y-3">
                 {INITIAL_SHOPS.map(shop => (
                   <div key={shop.id} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${shop.id === 'hj' ? 'bg-orange-400' : 'bg-blue-400'} animate-pulse`}></div>
                      <span className="text-xs font-bold text-slate-300">{shop.name}</span>
                   </div>
                 ))}
              </div>
           </div>
           <button onClick={resetAllData} className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all">
             Reset All Data
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {loading && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full animate-in zoom-in-95">
               <div className="relative">
                 <div className="animate-spin rounded-full h-20 w-20 border-[3px] border-indigo-50 border-t-indigo-600"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-indigo-600" />
                 </div>
               </div>
               <div className="text-center">
                  <h4 className="font-black text-slate-800 text-xl mb-1">正在加载...</h4>
                  <p className="text-slate-400 text-xs font-medium">{statusMsg}</p>
               </div>
            </div>
          </div>
        )}

        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-10 py-5 flex justify-between items-center z-50">
          <div className="flex items-center gap-4">
             <h2 className="text-lg font-black text-slate-800">数据导入</h2>
             <div className="h-4 w-px bg-slate-200"></div>
             <div className="flex gap-2">
                <label className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl cursor-pointer hover:bg-indigo-100 transition-colors border border-indigo-100">
                  <Upload className="w-3.5 h-3.5" />
                  <span className="text-xs font-black uppercase">订单 Excel</span>
                  <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleOrderUpload} />
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl cursor-pointer hover:bg-orange-100 transition-colors border border-orange-100">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="text-xs font-black uppercase">采购 Excel</span>
                  <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handlePurchaseExcelUpload} />
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors border border-emerald-100">
                  <Upload className="w-3.5 h-3.5" />
                  <span className="text-xs font-black uppercase">微信流水</span>
                  <input type="file" className="hidden" accept=".csv" onChange={(e) => handlePaymentUpload(e, 'wechat')} />
                </label>
             </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="text-right mr-4">
                <p className="text-[10px] text-slate-400 font-black uppercase">数据更新至</p>
                <p className="text-xs font-bold text-slate-700">{new Date().toLocaleDateString()}</p>
             </div>
             <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-lg">BD</div>
          </div>
        </header>

        <div className="p-10 space-y-10">
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-4 gap-6">
                <StatCard title="总营收 (合并)" value={`¥${totalRevenue.toLocaleString()}`} subValue="全店订单 + 手动收入" icon={<TrendingUp />} color="bg-emerald-500" />
                <StatCard title="耗材采购 (合并)" value={`¥${totalPurchase.toLocaleString()}`} subValue="全店通用补货支出" icon={<ShoppingBag />} color="bg-orange-500" />
                <StatCard title="分店固定支出" value={`¥${totalFixedCostsGlobal.toLocaleString()}`} subValue="海椒市 + 棕北 (房租人工)" icon={<Wallet />} color="bg-indigo-500" />
                <StatCard title="预估总盈余" value={`¥${(totalRevenue - totalPurchase - totalFixedCostsGlobal).toLocaleString()}`} subValue="未计入税费和其他杂支" icon={<Ticket />} color="bg-slate-900" />
              </div>

              {/* Monthly Proportion Table */}
              <Card title="月度分类销售占比 (金额 & 百分比)" extra={<div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg text-[10px] font-bold text-indigo-600 uppercase tracking-wider"><PieIcon className="w-3 h-3" /> 结构分析</div>}>
                 <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">月份</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-indigo-600 text-right">书籍销售</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-amber-600 text-right">饮品占比</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-600 text-right">酒精占比</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-rose-600 text-right">会籍占比</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">月度订单总额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {monthlyProportionData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-black text-slate-700">{row.month}</td>
                            <td className="px-6 py-4 text-right">
                               <p className="font-black text-indigo-500 tabular-nums">¥{row.book.val.toLocaleString()}</p>
                               <p className="text-[10px] font-bold text-indigo-300">{row.book.pct.toFixed(1)}%</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <p className="font-black text-amber-500 tabular-nums">¥{row.drink.val.toLocaleString()}</p>
                               <p className="text-[10px] font-bold text-amber-300">{row.drink.pct.toFixed(1)}%</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <p className="font-black text-emerald-500 tabular-nums">¥{row.alcohol.val.toLocaleString()}</p>
                               <p className="text-[10px] font-bold text-emerald-300">{row.alcohol.pct.toFixed(1)}%</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <p className="font-black text-rose-500 tabular-nums">¥{row.membership.val.toLocaleString()}</p>
                               <p className="text-[10px] font-bold text-rose-300">{row.membership.pct.toFixed(1)}%</p>
                            </td>
                            <td className="px-6 py-4 text-right bg-slate-50/50">
                               <p className="font-black text-slate-900 tabular-nums text-lg">¥{row.total.toLocaleString()}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </Card>

              {/* Recent Income Breakdown Table */}
              <Card title="最近10日分类收入明细">
                 <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">日期</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-indigo-600 text-right">书</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-amber-600 text-right">饮品</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-600 text-right">酒精</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-rose-600 text-right">会籍</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">活动/其他</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-900 text-right">当日总计</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {recent10DaysTableData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{row.date}</td>
                            <td className="px-6 py-4 text-right font-black text-indigo-500 tabular-nums">¥{row.book.toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                            <td className="px-6 py-4 text-right font-black text-amber-500 tabular-nums">¥{row.drink.toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                            <td className="px-6 py-4 text-right font-black text-emerald-500 tabular-nums">¥{row.alcohol.toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                            <td className="px-6 py-4 text-right font-black text-rose-500 tabular-nums">¥{row.membership.toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                            <td className="px-6 py-4 text-right font-bold text-slate-400 tabular-nums">¥{row.event.toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                            <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums bg-slate-50/50">¥{row.total.toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </Card>
            </div>
          )}

          {activeTab === 'costs' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <header className="flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">分店固定成本核算</h3>
                    <p className="text-slate-500 font-medium">房租、人工、水电须在此指定分店录入</p>
                  </div>
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                    {INITIAL_SHOPS.map(shop => (
                      <button
                        key={shop.id}
                        onClick={() => setCostFilterShopId(shop.id)}
                        className={`px-8 py-2.5 rounded-xl text-sm font-black transition-all ${
                          costFilterShopId === shop.id 
                          ? 'bg-white text-indigo-600 shadow-md translate-y-[-1px]' 
                          : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {shop.name}
                      </button>
                    ))}
                  </div>
               </header>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <Card title={`录入 [${activeShopNameForCost}] 支出`}>
                    <form onSubmit={handleAddCost} className="space-y-6">
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">日期</label>
                            <input type="date" name="date" required className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">类别</label>
                            <select name="type" className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 appearance-none">
                              <option>人工</option><option>房租</option><option>水电</option><option>其他</option>
                            </select>
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">金额 (元)</label>
                          <input type="number" step="0.01" name="amount" required className="w-full p-6 bg-slate-50 rounded-3xl border-none focus:ring-2 focus:ring-indigo-500 font-black text-3xl text-slate-900" placeholder="0.00" />
                       </div>
                       <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl flex items-center justify-center gap-3">
                          <Plus className="w-5 h-5" /> 确认保存到 {activeShopNameForCost}
                       </button>
                    </form>
                  </Card>

                  <Card title={`${activeShopNameForCost} 支出明细`}>
                     <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {fixedCosts.filter(f => f.shopId === costFilterShopId).sort((a,b)=>b.date.localeCompare(a.date)).map(cost => (
                          <div key={cost.id} className="flex justify-between items-center p-5 bg-white rounded-3xl border border-slate-100 group hover:border-indigo-100 transition-all">
                             <div className="flex items-center gap-5">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                  cost.type === '人工' ? 'bg-indigo-50 text-indigo-500' :
                                  cost.type === '房租' ? 'bg-purple-50 text-purple-500' :
                                  'bg-blue-50 text-blue-500'
                                }`}>
                                   {cost.type === '人工' ? <Plus className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                                </div>
                                <div>
                                   <p className="font-black text-slate-800">{cost.type}</p>
                                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{cost.date}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-6">
                                <span className="text-xl font-black text-rose-500 tabular-nums">-¥{cost.amount.toLocaleString()}</span>
                                <button onClick={() => setFixedCosts(prev => prev.filter(f => f.id !== cost.id))} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:bg-rose-50 transition-all flex items-center justify-center">
                                   <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                          </div>
                        ))}
                     </div>
                  </Card>
               </div>
            </div>
          )}

          {activeTab === 'purchases' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <Card title="月度耗材分类汇总 (金额 & 百分比)">
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">月份</th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-blue-600 text-right">饮品耗材</th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-600 text-right">清洁耗材</th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-amber-600 text-right">书籍采购</th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">其他</th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-900 text-right">月度总采购</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {purchaseMonthlySummary.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-5 text-sm font-black text-slate-700">{row.month}</td>
                            {row.details.map((detail, dIdx) => (
                              <td key={dIdx} className="px-8 py-5 text-right">
                                <p className="font-black text-slate-800 tabular-nums">¥{detail.val.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-slate-400">{detail.pct.toFixed(1)}%</p>
                              </td>
                            ))}
                            <td className="px-8 py-5 text-right bg-slate-50/50">
                               <p className="font-black text-orange-600 tabular-nums text-lg">¥{row.total.toLocaleString()}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </Card>

               <Card title="导入耗材采购清单 (Excel 批量导入)">
                  <div className="mt-4 border-[6px] border-dashed border-slate-50 rounded-[50px] p-24 text-center hover:border-orange-100 hover:bg-orange-50/20 transition-all group relative overflow-hidden bg-white">
                     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" accept=".xlsx,.xls" onChange={handlePurchaseExcelUpload} />
                     <div className="flex flex-col items-center relative z-0">
                        <div className="w-28 h-28 bg-orange-100 text-orange-600 rounded-[35px] flex items-center justify-center mb-10 group-hover:scale-110 transition-transform shadow-lg shadow-orange-200/50">
                           <FileSpreadsheet className="w-14 h-14" />
                        </div>
                        <h4 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">点击或拖拽 Excel 文件上传</h4>
                        <p className="text-slate-400 max-w-sm mx-auto font-medium leading-relaxed">
                          支持包含日期、项目名称、金额和分类（饮品耗材、清洁耗材、书、其他）的 Excel 表格。
                        </p>
                     </div>
                  </div>
               </Card>

               <Card title="全局耗材采购明细">
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">日期</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">商品</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">分类</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">金额</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {purchases.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(p => (
                          <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${editingPurchaseId === p.id ? 'bg-indigo-50/50' : ''}`}>
                            <td className="px-8 py-6 text-sm font-bold text-slate-500">
                              {editingPurchaseId === p.id ? (
                                <input 
                                  type="date" 
                                  value={editPurchaseForm.date} 
                                  onChange={(e) => setEditPurchaseForm({...editPurchaseForm, date: e.target.value})}
                                  className="p-2 border rounded-xl text-xs font-black"
                                />
                              ) : p.date}
                            </td>
                            <td className="px-8 py-6 font-black text-slate-800">
                              {editingPurchaseId === p.id ? (
                                <input 
                                  type="text" 
                                  value={editPurchaseForm.item} 
                                  onChange={(e) => setEditPurchaseForm({...editPurchaseForm, item: e.target.value})}
                                  className="w-full p-2 border rounded-xl text-sm font-black"
                                />
                              ) : p.item}
                            </td>
                            <td className="px-8 py-6">
                              {editingPurchaseId === p.id ? (
                                <select 
                                  value={editPurchaseForm.category}
                                  onChange={(e) => setEditPurchaseForm({...editPurchaseForm, category: e.target.value as any})}
                                  className="p-2 border rounded-xl text-[10px] font-black uppercase"
                                >
                                  <option value="饮品耗材">饮品耗材</option>
                                  <option value="清洁耗材">清洁耗材</option>
                                  <option value="书">书</option>
                                  <option value="其他">其他</option>
                                </select>
                              ) : (
                                <span className="px-4 py-1.5 rounded-full bg-slate-100 text-[10px] font-black uppercase text-slate-600">{p.category}</span>
                              )}
                            </td>
                            <td className="px-8 py-6 text-right font-black text-slate-900 text-lg tabular-nums">
                              {editingPurchaseId === p.id ? (
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={editPurchaseForm.amount} 
                                  onChange={(e) => setEditPurchaseForm({...editPurchaseForm, amount: parseFloat(e.target.value)})}
                                  className="w-24 p-2 border rounded-xl text-right text-sm font-black"
                                />
                              ) : `¥${p.amount.toFixed(2)}`}
                            </td>
                            <td className="px-8 py-6 text-right">
                               <div className="flex justify-end gap-2">
                                  {editingPurchaseId === p.id ? (
                                    <>
                                      <button onClick={saveEditedPurchase} className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-colors">
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button onClick={cancelEditingPurchase} className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-colors">
                                        <X className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => startEditingPurchase(p)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => setPurchases(prev => prev.filter(x=>x.id!==p.id))} className="p-2 text-slate-200 hover:text-rose-500 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </Card>
            </div>
          )}

          {activeTab === 'reconcile' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-slate-800">全局收支核对明细</h3>
                </div>
                <button 
                  onClick={clearReconciliationData}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase border border-rose-100 transition-all active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 清空对账数据
                </button>
              </div>
              
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">日期</th>
                        <th className="px-6 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest">小程序订单 (A)</th>
                        <th className="px-6 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest">支付流水汇总 (B)</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">差额 (B-A)</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">对账状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {dailySummary.map((summary) => {
                        const diff = summary.paymentTotal - summary.orderTotal;
                        const isMatched = Math.abs(diff) < 1.0;
                        return (
                          <tr key={summary.date} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-5 text-sm font-black text-slate-700">{summary.date}</td>
                            <td className="px-6 py-5 font-black text-indigo-600">¥{summary.orderTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="px-6 py-5 font-black text-emerald-600">¥{summary.paymentTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className={`px-6 py-5 text-right font-black tabular-nums ${isMatched ? 'text-slate-400' : diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <div className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                isMatched ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                              }`}>
                                {isMatched ? 'MATCHED' : 'ERROR'}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="grid grid-cols-2 gap-10">
               <Card title="全局热销排行 (Top 30)">
                  <div className="space-y-4 mt-6 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                     {Object.entries(orders.filter(o=>o.category==='book')
                          .reduce((acc: any, cur) => {
                             acc[cur.productName] = (acc[cur.productName] || 0) + 1;
                             return acc;
                          }, {}))
                          .sort((a: any, b: any) => b[1] - a[1])
                          .slice(0, 30)
                          .map(([name, count], idx) => (
                            <div key={name} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl group transition-all hover:bg-white hover:shadow-lg border border-transparent hover:border-indigo-100">
                               <div className="flex items-center gap-5">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${idx < 3 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-white'}`}>
                                    {idx + 1}
                                  </div>
                                  <span className="font-bold text-slate-800 truncate max-w-[240px]">{name}</span>
                               </div>
                               <span className="font-black text-indigo-600 tabular-nums">{count as number} 本</span>
                            </div>
                          ))
                     }
                  </div>
               </Card>
               <div className="space-y-10">
                  <Card title="手动录入其他收入 (如租金返还/活动结算)">
                    <form onSubmit={addManualIncome} className="space-y-4 mt-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase text-slate-400">月份</label>
                             <input type="month" name="month" required className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase text-slate-400">金额</label>
                             <input type="number" step="0.01" name="amount" placeholder="0.00" required className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold" />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400">备注</label>
                          <input type="text" name="note" placeholder="来源备注" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold" />
                       </div>
                       <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all">添加收入记录</button>
                    </form>
                  </Card>
                  <Card title="手动收入历史">
                     <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {monthlyIncomes.slice().sort((a,b)=>b.month.localeCompare(a.month)).map((inc, idx) => (
                          <div key={idx} className="flex justify-between items-center p-4 bg-violet-50 rounded-2xl border border-violet-100">
                             <div><p className="font-bold text-violet-900">{inc.month}</p><p className="text-[10px] text-violet-500 font-bold uppercase">{inc.note}</p></div>
                             <span className="font-black text-violet-700 tabular-nums">¥{inc.amount.toLocaleString()}</span>
                          </div>
                        ))}
                     </div>
                  </Card>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
