
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
  FileSpreadsheet,
  Coffee,
  CloudUpload,
  RefreshCw,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Share2,
  DownloadCloud,
  Library,
  Layers,
  ChevronDown,
  Wine
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { OrderRecord, PaymentRecord, PurchaseRecord, FixedCost, DailySummary, MonthlyManualIncome, Shop, OrderCategory, SyncConfig } from './types';
import { parseOrderExcel, parsePaymentCSV, aggregateDailySummary, parsePurchaseExcel } from './utils/dataProcessors';
import { syncToGoogleSheet, fetchFromGoogleSheet } from './services/googleSheetService';

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
        {title && <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">{title}</h3>}
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
        <h2 className="text-2xl font-black mt-1 text-gray-900 tabular-nums">{value}</h2>
        {subValue && <p className="text-[10px] text-slate-400 mt-1 font-bold">{subValue}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color} text-white shadow-lg`}>
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
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => JSON.parse(localStorage.getItem('bd_syncConfig') || '{"webhookUrl":"","spreadsheetUrl":""}'));
  
  const [costFilterShopId, setCostFilterShopId] = useState<string>('hj');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Persistence
  useEffect(() => { localStorage.setItem('bd_orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('bd_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('bd_purchases', JSON.stringify(purchases)); }, [purchases]);
  useEffect(() => { localStorage.setItem('bd_fixedCosts', JSON.stringify(fixedCosts)); }, [fixedCosts]);
  useEffect(() => { localStorage.setItem('bd_monthlyIncomes', JSON.stringify(monthlyIncomes)); }, [monthlyIncomes]);
  useEffect(() => { localStorage.setItem('bd_syncConfig', JSON.stringify(syncConfig)); }, [syncConfig]);

  // Derived Data
  const dailySummary = useMemo(() => aggregateDailySummary(orders, payments), [orders, payments]);
  
  /**
   * 计算历史月度分类统计 (拆分酒精与饮品)
   */
  const monthlyCategoryHistory = useMemo(() => {
    const history: Record<string, { book: number, drink: number, alcohol: number, membership: number, other: number, total: number }> = {};
    
    // Process Orders
    orders.forEach(o => {
      const month = o.date.substring(0, 7); // YYYY-MM
      if (!history[month]) history[month] = { book: 0, drink: 0, alcohol: 0, membership: 0, other: 0, total: 0 };
      
      if (o.category === 'book') history[month].book += o.price;
      else if (o.category === 'drink') history[month].drink += o.price;
      else if (o.category === 'alcohol') history[month].alcohol += o.price;
      else if (o.category === 'membership') history[month].membership += o.price;
      else history[month].other += o.price;
      
      history[month].total += o.price;
    });

    // Process Manual Incomes
    monthlyIncomes.forEach(m => {
      const month = m.month;
      if (!history[month]) history[month] = { book: 0, drink: 0, alcohol: 0, membership: 0, other: 0, total: 0 };
      history[month].other += m.amount;
      history[month].total += m.amount;
    });

    // Sort by month descending
    return Object.entries(history)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [orders, monthlyIncomes]);

  const totalRevenue = useMemo(() => 
    orders.reduce((sum, o) => sum + o.price, 0) + monthlyIncomes.reduce((sum, m) => sum + m.amount, 0),
    [orders, monthlyIncomes]
  );

  const totalPurchase = useMemo(() => purchases.reduce((sum, p) => sum + p.amount, 0), [purchases]);
  const totalFixedCostsGlobal = useMemo(() => fixedCosts.reduce((sum, f) => sum + f.amount, 0), [fixedCosts]);

  // Handlers
  const handleOrderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true); setStatusMsg(`正在同步小程序订单...`);
    try {
      const parsed = await parseOrderExcel(e.target.files[0]);
      setOrders(prev => [...prev, ...parsed.map(o => ({ ...o, shopId: 'global' }))]);
    } catch (err: any) { alert(`错误: ${err.message}`); } finally { setLoading(false); e.target.value = ''; }
  };

  const handlePurchaseExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true); setStatusMsg(`正在解析采购清单...`);
    try {
      const parsed = await parsePurchaseExcel(e.target.files[0]);
      setPurchases(prev => [...prev, ...parsed]);
    } catch (err: any) { alert(`错误: ${err.message}`); } finally { setLoading(false); e.target.value = ''; }
  };

  const handlePaymentUpload = async (e: React.ChangeEvent<HTMLInputElement>, source: 'wechat' | 'alipay' | 'you') => {
    if (!e.target.files?.[0]) return;
    setLoading(true); setStatusMsg(`解析支付账单...`);
    try {
      const parsed = await parsePaymentCSV(e.target.files[0], source);
      setPayments(prev => [...prev, ...parsed.map(p => ({ ...p, shopId: 'global' }))]);
    } catch (err: any) { alert(`解析失败: ${err.message}`); } finally { setLoading(false); e.target.value = ''; }
  };

  const handleSyncToSheet = async () => {
    if (!syncConfig.webhookUrl) return alert('请先在「大家爱买什么书」配置 URL');
    setSyncing(true);
    try {
      await syncToGoogleSheet(syncConfig.webhookUrl, {
        daily: dailySummary,
        purchases,
        costs: fixedCosts,
        manualIncomes: monthlyIncomes,
        orders,
        payments
      });
      setSyncConfig(prev => ({ ...prev, lastSyncedAt: new Date().toLocaleString() }));
      alert('✅ 已推送到 Google Sheets');
    } catch (err: any) { alert(`同步失败: ${err.message}`); } finally { setSyncing(false); }
  };

  const handleRestoreFromCloud = async () => {
    if (!syncConfig.webhookUrl) return alert('URL 未填');
    if (!confirm('这会覆盖此电脑所有本地数据，确定吗？')) return;
    setSyncing(true);
    try {
      const data = await fetchFromGoogleSheet(syncConfig.webhookUrl);
      if (data.orders) setOrders(data.orders.map((o: any) => ({
        id: o.ID || o.id, shopId: o.分店 || o.shopId, date: o.日期 || o.date, price: parseFloat(o.价格 || o.price), category: o.分类 || o.category, productName: o.商品名 || o.productName
      })));
      if (data.payments) setPayments(data.payments.map((p: any) => ({
        shopId: p.分店 || p.shopId, date: p.日期 || p.date, amount: parseFloat(p.金额 || p.amount), source: p.来源 || p.source
      })));
      if (data.purchases) setPurchases(data.purchases.map((p: any) => ({
        id: p.ID || p.id, shopId: p.分店 || p.shopId, date: p.日期 || p.date, item: p.项目 || p.item, category: p.分类 || p.category, amount: parseFloat(p.金额 || p.amount)
      })));
      if (data.costs) setFixedCosts(data.costs.map((c: any) => ({
        id: c.ID || c.id, shopId: c.分店 || c.shopId, date: c.日期 || c.date, type: c.类型 || c.type, amount: parseFloat(c.金额 || c.amount)
      })));
      alert('✅ 恢复成功');
    } catch (err: any) { alert(`恢复失败: ${err.message}`); } finally { setSyncing(false); }
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
            { id: 'costs', label: '分店支出', icon: Wallet },
            { id: 'purchases', label: '耗材采购', icon: ShoppingBag },
            { id: 'inventory', label: '大家爱买什么书', icon: Library },
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
           <button onClick={handleSyncToSheet} disabled={syncing} className="w-full py-4 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
             {syncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
             {syncing ? 'Syncing...' : 'Sync to Cloud'}
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {loading && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full animate-in zoom-in-95">
               <div className="relative animate-spin rounded-full h-20 w-20 border-[3px] border-indigo-50 border-t-indigo-600"></div>
               <div className="text-center">
                  <h4 className="font-black text-slate-800 text-xl mb-1">加载中</h4>
                  <p className="text-slate-400 text-xs font-medium">{statusMsg}</p>
               </div>
            </div>
          </div>
        )}

        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-10 py-5 flex justify-between items-center z-50">
          <div className="flex items-center gap-4">
             <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">经营概览</h2>
             <div className="h-4 w-px bg-slate-200"></div>
             <div className="flex gap-2">
                <label className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl cursor-pointer hover:bg-indigo-100 border border-indigo-100">
                  <Upload className="w-3.5 h-3.5" /><span className="text-xs font-black uppercase">录入订单</span>
                  <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleOrderUpload} />
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl cursor-pointer hover:bg-emerald-100 border border-emerald-100">
                  <Upload className="w-3.5 h-3.5" /><span className="text-xs font-black uppercase">核对流水</span>
                  <input type="file" className="hidden" accept=".csv" onChange={(e) => handlePaymentUpload(e, 'wechat')} />
                </label>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right">
                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">系统就绪</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Status: Connected</p>
             </div>
             <div className="w-10 h-10 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/20 flex items-center justify-center text-white font-black">B</div>
          </div>
        </header>

        <div className="p-10 space-y-10">
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Top Stats */}
              <div className="grid grid-cols-4 gap-6">
                <StatCard title="历史累计营收" value={`¥${totalRevenue.toLocaleString()}`} subValue="订单 + 其他收入" icon={<TrendingUp />} color="bg-emerald-500" />
                <StatCard title="累计采购支出" value={`¥${totalPurchase.toLocaleString()}`} subValue="全店补货总额" icon={<ShoppingBag />} color="bg-orange-500" />
                <StatCard title="累计分店支出" value={`¥${totalFixedCostsGlobal.toLocaleString()}`} subValue="房租/人工/水电" icon={<Wallet />} color="bg-indigo-500" />
                <StatCard title="预估总净盈余" value={`¥${(totalRevenue - totalPurchase - totalFixedCostsGlobal).toLocaleString()}`} subValue="毛利润预估" icon={<Ticket />} color="bg-slate-900" />
              </div>

              {/* Monthly Historical Statistics */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-8">
                  <Card title="历史月度分类营收明细" extra={<BarChart3 className="w-4 h-4 text-slate-300" />}>
                     <div className="overflow-x-auto mt-4">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">月份</th>
                              <th className="px-4 py-4 text-[10px] font-black uppercase text-indigo-500 text-right">书籍收入</th>
                              <th className="px-4 py-4 text-[10px] font-black uppercase text-amber-500 text-right">饮品收入</th>
                              <th className="px-4 py-4 text-[10px] font-black uppercase text-rose-700 text-right">酒精收入</th>
                              <th className="px-4 py-4 text-[10px] font-black uppercase text-rose-500 text-right">会籍收入</th>
                              <th className="px-4 py-4 text-[10px] font-black uppercase text-slate-500 text-right">其他收入</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-900 text-right">月度合计</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {monthlyCategoryHistory.map((row) => (
                              <tr key={row.month} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-5 text-sm font-black text-slate-800">{row.month}</td>
                                <td className="px-4 py-5 text-right font-bold text-indigo-600">¥{row.book.toLocaleString()}</td>
                                <td className="px-4 py-5 text-right font-bold text-amber-600">¥{row.drink.toLocaleString()}</td>
                                <td className="px-4 py-5 text-right font-bold text-rose-700">¥{row.alcohol.toLocaleString()}</td>
                                <td className="px-4 py-5 text-right font-bold text-rose-600">¥{row.membership.toLocaleString()}</td>
                                <td className="px-4 py-5 text-right font-bold text-slate-500">¥{row.other.toLocaleString()}</td>
                                <td className="px-6 py-5 text-right font-black text-slate-900 bg-slate-50/30">¥{row.total.toLocaleString()}</td>
                              </tr>
                            ))}
                            {monthlyCategoryHistory.length === 0 && (
                              <tr>
                                <td colSpan={7} className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">暂无历史月度数据</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                     </div>
                  </Card>

                  <Card title="最近10日经营曲线">
                    <div className="h-80 mt-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailySummary.slice(0, 10).reverse()}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                              <Tooltip 
                                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                              />
                              <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 'bold'}} />
                              <Bar name="每日总应收" dataKey="orderTotal" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                    </div>
                  </Card>
                </div>

                <div className="space-y-8">
                   <Card title="每日营收明细列表" extra={<History className="w-4 h-4 text-slate-300" />}>
                      <div className="mt-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                         {dailySummary.map((day) => (
                           <div key={day.date} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
                              <div className="flex justify-between items-center mb-3">
                                 <span className="text-xs font-black text-slate-800">{day.date}</span>
                                 <span className="text-sm font-black text-indigo-600 tabular-nums">¥{day.orderTotal.toLocaleString()}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                 <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase">书</span>
                                    <span className="text-[10px] font-bold text-slate-600">¥{day.categories.book?.toLocaleString() || 0}</span>
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-amber-500 uppercase">饮</span>
                                    <span className="text-[10px] font-bold text-slate-600">¥{day.categories.drink?.toLocaleString() || 0}</span>
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-rose-700 uppercase">酒</span>
                                    <span className="text-[10px] font-bold text-slate-600">¥{day.categories.alcohol?.toLocaleString() || 0}</span>
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-rose-500 uppercase">会</span>
                                    <span className="text-[10px] font-bold text-slate-600">¥{day.categories.membership?.toLocaleString() || 0}</span>
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-indigo-400 uppercase">活</span>
                                    <span className="text-[10px] font-bold text-slate-600">¥{day.categories.event?.toLocaleString() || 0}</span>
                                 </div>
                              </div>
                           </div>
                         ))}
                         {dailySummary.length === 0 && (
                            <div className="py-20 text-center">
                               <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">暂无每日数据</p>
                            </div>
                         )}
                      </div>
                   </Card>

                   <Card title="今日实时状态">
                      <div className="space-y-6 mt-4">
                         {dailySummary[0] ? (
                           <div className="flex flex-col gap-6">
                              <div className="flex justify-between items-center">
                                 <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">今日应收 (A)</p>
                                    <h4 className="text-3xl font-black text-slate-900">¥{dailySummary[0].orderTotal.toLocaleString()}</h4>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">今日实收 (B)</p>
                                    <h4 className="text-2xl font-black text-emerald-500">¥{dailySummary[0].paymentTotal.toLocaleString()}</h4>
                                 </div>
                              </div>
                              <div className={`p-5 rounded-2xl flex items-center justify-between transition-colors ${Math.abs(dailySummary[0].paymentTotal - dailySummary[0].orderTotal) < 1 ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-rose-50 border border-rose-100 text-rose-700'}`}>
                                 <div className="flex items-center gap-3">
                                    {Math.abs(dailySummary[0].paymentTotal - dailySummary[0].orderTotal) < 1 
                                      ? <CheckCircle2 className="w-5 h-5" /> 
                                      : <AlertCircle className="w-5 h-5" />}
                                    <span className="text-xs font-black uppercase tracking-widest">
                                      {Math.abs(dailySummary[0].paymentTotal - dailySummary[0].orderTotal) < 1 ? '今日对账完成' : '存在未平账项'}
                                    </span>
                                 </div>
                                 <ChevronRight className="w-4 h-4 opacity-30" />
                              </div>
                           </div>
                         ) : (
                           <div className="py-10 text-center space-y-3">
                              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300"><Calendar className="w-6 h-6" /></div>
                              <p className="text-xs font-bold text-slate-400">尚未同步今日订单数据</p>
                           </div>
                         )}
                      </div>
                   </Card>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <Card title="云端同步与灾难恢复" extra={<Settings className="w-4 h-4 text-slate-300" />}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-4">
                    <div className="space-y-6">
                        <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                            <LinkIcon className="w-3 h-3" /> Google Apps Script Web App URL
                          </label>
                          <input 
                            type="text" 
                            value={syncConfig.webhookUrl} 
                            onChange={(e) => setSyncConfig({ ...syncConfig, webhookUrl: e.target.value })}
                            placeholder="https://script.google.com/macros/s/.../exec"
                            className="w-full p-4 bg-white rounded-2xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-600 shadow-sm transition-all text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <button onClick={handleSyncToSheet} disabled={syncing} className="py-6 bg-indigo-600 text-white rounded-[28px] font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex flex-col items-center justify-center gap-2">
                              {syncing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CloudUpload className="w-6 h-6" />}
                              <span>上传备份数据</span>
                           </button>
                           <button onClick={handleRestoreFromCloud} disabled={syncing} className="py-6 bg-emerald-600 text-white rounded-[28px] font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex flex-col items-center justify-center gap-2">
                              {syncing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <DownloadCloud className="w-6 h-6" />}
                              <span>换机数据恢复</span>
                           </button>
                        </div>
                    </div>
                    <div className="bg-indigo-50/50 rounded-[32px] p-8 border border-indigo-100 flex flex-col justify-center">
                       <h5 className="font-black text-indigo-900 mb-4 flex items-center gap-2 uppercase tracking-widest text-xs"><Info className="w-4 h-4" /> 协作与迁移指南</h5>
                       <ul className="space-y-3 text-xs font-bold text-indigo-700 leading-relaxed">
                          <li className="flex gap-2"><span>•</span> <span>点击「上传备份」会将所有原始订单、历史支出同步至 Google Sheet。</span></li>
                          <li className="flex gap-2"><span>•</span> <span>在另一台电脑登录时，只需填入相同的 URL 并点击「换机恢复」即可找回所有历史。</span></li>
                       </ul>
                    </div>
                  </div>
               </Card>

               <div className="grid grid-cols-2 gap-10">
                 <Card title="大家爱买什么书 (Top 30 排行榜)">
                    <div className="space-y-2 mt-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                       {Object.entries(orders.filter(o=>o.category==='book').reduce((acc:any, cur)=>{ acc[cur.productName] = (acc[cur.productName]||0)+1; return acc;}, {})).sort((a:any,b:any)=>b[1]-a[1]).slice(0, 30).map(([name, count], idx) => (
                         <div key={name} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-colors group">
                            <div className="flex items-center gap-4 truncate">
                               <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-xs ${idx < 3 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-500'}`}>
                                 {idx+1}
                               </span>
                               <span className="font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{name}</span>
                            </div>
                            <span className="font-black text-indigo-600 flex-shrink-0 ml-4 tabular-nums">{count as number} 本</span>
                         </div>
                       ))}
                       {orders.filter(o=>o.category==='book').length === 0 && (
                          <div className="py-20 text-center text-slate-300 font-bold text-xs uppercase tracking-widest">暂无销售书籍记录</div>
                       )}
                    </div>
                 </Card>

                 <div className="space-y-10">
                    <Card title="本月其他收入录入">
                       <form onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          setMonthlyIncomes(prev => [...prev, {
                             shopId: 'global', month: fd.get('month') as string, amount: parseFloat(fd.get('amount') as string), note: fd.get('note') as string
                          }]);
                          e.currentTarget.reset();
                       }} className="space-y-4 mt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <input type="month" name="month" required defaultValue={new Date().toISOString().substring(0, 7)} className="p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 ring-indigo-500/20" />
                            <input type="number" step="0.01" name="amount" placeholder="金额 ¥" required className="p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 ring-indigo-500/20" />
                          </div>
                          <input type="text" name="note" placeholder="备注 (如：场地租赁)" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 ring-indigo-500/20" />
                          <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                             <Plus className="w-4 h-4" /> 添加记录
                          </button>
                       </form>
                    </Card>

                    <Card title="历史其他收入">
                       <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {monthlyIncomes.slice().reverse().map((income, idx) => (
                            <div key={idx} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all">
                               <div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase">{income.month}</p>
                                 <p className="text-sm font-black text-slate-800">{income.note}</p>
                               </div>
                               <div className="flex items-center gap-4">
                                 <span className="font-black text-emerald-600 tabular-nums">¥{income.amount.toLocaleString()}</span>
                                 <button onClick={() => setMonthlyIncomes(prev => prev.filter((_, i) => i !== (monthlyIncomes.length - 1 - idx)))} className="text-slate-200 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                               </div>
                            </div>
                          ))}
                       </div>
                    </Card>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'reconcile' && (
            <Card title="经营数据对账明细 (A:小程序 B:实收流水)" extra={<ArrowLeftRight className="w-4 h-4 text-slate-300" />}>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase">交易日期</th>
                      <th className="px-6 py-5 text-[10px] font-black text-indigo-600 uppercase">小程序记录 (A)</th>
                      <th className="px-6 py-5 text-[10px] font-black text-emerald-600 uppercase">实收汇总 (B)</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase text-right">差额 (B-A)</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase text-center">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {dailySummary.map((summary) => {
                      const diff = summary.paymentTotal - summary.orderTotal;
                      const isMatched = Math.abs(diff) < 1.0;
                      return (
                        <tr key={summary.date} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-5 text-sm font-black text-slate-700">{summary.date}</td>
                          <td className="px-6 py-5 font-black text-indigo-600 tabular-nums">¥{summary.orderTotal.toLocaleString()}</td>
                          <td className="px-6 py-5 font-black text-emerald-600 tabular-nums">¥{summary.paymentTotal.toLocaleString()}</td>
                          <td className={`px-6 py-5 text-right font-black tabular-nums ${isMatched ? 'text-slate-300' : diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase ${isMatched ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                              {isMatched ? '平账' : '异常'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'costs' && (
             <div className="grid grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card title="录入分店固定支出" extra={<Wallet className="w-4 h-4 text-slate-300" />}>
                   <header className="flex bg-slate-100 p-1 rounded-xl mb-6">
                     {INITIAL_SHOPS.map(shop => (
                       <button key={shop.id} onClick={() => setCostFilterShopId(shop.id)} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${costFilterShopId === shop.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                         {shop.name}
                       </button>
                     ))}
                   </header>
                   <form onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      setFixedCosts(prev => [...prev, {
                         id: `cost-${Date.now()}`, shopId: costFilterShopId, date: fd.get('date') as string,
                         type: fd.get('type') as any, amount: parseFloat(fd.get('amount') as string)
                      }]);
                      e.currentTarget.reset();
                   }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <input type="date" name="date" required className="p-4 bg-slate-50 rounded-xl border-none font-bold text-sm outline-none" />
                        <select name="type" className="p-4 bg-slate-50 rounded-xl border-none font-bold text-sm outline-none">
                          <option>人工</option><option>房租</option><option>水电</option><option>其他</option>
                        </select>
                      </div>
                      <input type="number" step="0.01" name="amount" required className="w-full p-4 bg-slate-50 rounded-xl border-none font-black text-2xl outline-none" placeholder="金额 ¥" />
                      <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all">保存此笔支出</button>
                   </form>
                </Card>
                <Card title="近期分店支出流水">
                   <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {fixedCosts.filter(f => f.shopId === costFilterShopId).sort((a,b)=>b.date.localeCompare(a.date)).map(cost => (
                        <div key={cost.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 group">
                           <div><p className="font-black text-slate-800">{cost.type}</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{cost.date}</p></div>
                           <div className="flex items-center gap-4">
                              <span className="text-lg font-black text-rose-500 tabular-nums">-¥{cost.amount.toLocaleString()}</span>
                              <button onClick={() => setFixedCosts(prev => prev.filter(f => f.id !== cost.id))} className="text-slate-200 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                           </div>
                        </div>
                      ))}
                   </div>
                </Card>
             </div>
          )}

          {activeTab === 'purchases' && (
             <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card title="导入平台采购清单 (Excel)" extra={<ShoppingBag className="w-4 h-4 text-slate-300" />}>
                   <div className="mt-4 border-4 border-dashed border-slate-100 rounded-[40px] p-20 text-center hover:border-orange-200 hover:bg-orange-50/20 transition-all group relative overflow-hidden">
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" accept=".xlsx,.xls" onChange={handlePurchaseExcelUpload} />
                      <div className="flex flex-col items-center">
                         <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-[28px] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-orange-100"><FileSpreadsheet className="w-10 h-10" /></div>
                         <h4 className="text-2xl font-black text-slate-800 mb-2">点击或拖拽 Excel 文件</h4>
                         <p className="text-slate-400 text-xs font-bold leading-relaxed px-10">支持淘宝、拼多多导出的账单 Excel。</p>
                      </div>
                   </div>
                </Card>
                <Card title="耗材采购明细">
                   <div className="overflow-x-auto">
                     <table className="w-full text-left">
                       <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                         <tr>
                           <th className="px-6 py-4">日期</th>
                           <th className="px-6 py-4">项目</th>
                           <th className="px-6 py-4">分类</th>
                           <th className="px-6 py-4 text-right">金额</th>
                           <th className="px-6 py-4 text-right">操作</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                         {purchases.sort((a,b)=>b.date.localeCompare(a.date)).map(p => (
                           <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="px-6 py-4 text-xs font-bold text-slate-500">{p.date}</td>
                             <td className="px-6 py-4 font-black text-slate-800">{p.item}</td>
                             <td className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{p.category}</td>
                             <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">¥{p.amount.toFixed(2)}</td>
                             <td className="px-6 py-4 text-right">
                                <button onClick={()=>setPurchases(prev=>prev.filter(x=>x.id!==p.id))} className="text-slate-200 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                </Card>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
