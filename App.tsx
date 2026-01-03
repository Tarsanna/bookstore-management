
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
  Library
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
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
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => JSON.parse(localStorage.getItem('bd_syncConfig') || '{"webhookUrl":"","spreadsheetUrl":""}'));
  
  // Context for Costs Tab
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
      drinkCount: d.drinkCount || 0,
      total: (d.categories.book || 0) + (d.categories.drink || 0) + (d.categories.alcohol || 0) + (d.categories.membership || 0) + (d.categories.event || 0)
    }));
  }, [dailySummary]);

  const totalRevenue = useMemo(() => 
    orders.reduce((sum, o) => sum + o.price, 0) + monthlyIncomes.reduce((sum, m) => sum + m.amount, 0),
    [orders, monthlyIncomes]
  );

  const totalPurchase = useMemo(() => purchases.reduce((sum, p) => sum + p.amount, 0), [purchases]);
  const totalFixedCostsGlobal = useMemo(() => fixedCosts.reduce((sum, f) => sum + f.amount, 0), [fixedCosts]);
  const activeShopNameForCost = useMemo(() => INITIAL_SHOPS.find(s => s.id === costFilterShopId)?.name || '', [costFilterShopId]);

  const handleOrderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true); setStatusMsg(`正在导入小程序订单...`);
    try {
      const parsed = await parseOrderExcel(e.target.files[0]);
      setOrders(prev => [...prev, ...parsed.map(o => ({ ...o, shopId: 'global' }))]);
    } catch (err: any) { alert(`导入失败: ${err.message}`); } finally { setLoading(false); e.target.value = ''; }
  };

  const handlePaymentUpload = async (e: React.ChangeEvent<HTMLInputElement>, source: 'wechat' | 'alipay' | 'you') => {
    if (!e.target.files?.[0]) return;
    setLoading(true); setStatusMsg(`正在解析支付流水...`);
    try {
      const parsed = await parsePaymentCSV(e.target.files[0], source);
      setPayments(prev => [...prev, ...parsed.map(p => ({ ...p, shopId: 'global' }))]);
    } catch (err: any) { alert(`解析失败: ${err.message}`); } finally { setLoading(false); e.target.value = ''; }
  };

  const handlePurchaseExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true); setStatusMsg('正在解析耗材采购 Excel...');
    try {
      const parsed = await parsePurchaseExcel(e.target.files[0]);
      setPurchases(prev => [...prev, ...parsed]);
    } catch (err: any) { alert(`导入失败: ${err.message}`); } finally { setLoading(false); e.target.value = ''; }
  };

  const handleSyncToSheet = async () => {
    if (!syncConfig.webhookUrl) {
      alert('请先在「大家爱买什么书」页签中配置 Google Apps Script URL');
      setActiveTab('inventory');
      return;
    }
    setSyncing(true);
    try {
      const formattedDaily = dailySummary.map(d => ({
        date: d.date,
        book: d.categories.book,
        drink: d.categories.drink,
        drinkCount: d.drinkCount,
        alcohol: d.categories.alcohol,
        membership: d.categories.membership,
        event: d.categories.event,
        total: (d.categories.book || 0) + (d.categories.drink || 0) + (d.categories.alcohol || 0) + (d.categories.membership || 0) + (d.categories.event || 0)
      }));

      await syncToGoogleSheet(syncConfig.webhookUrl, {
        daily: formattedDaily,
        purchases: purchases,
        costs: fixedCosts,
        manualIncomes: monthlyIncomes,
        orders: orders,     // 用于换机恢复
        payments: payments  // 用于换机恢复
      });
      
      setSyncConfig(prev => ({ ...prev, lastSyncedAt: new Date().toLocaleString() }));
      alert('✅ 数据同步成功。您可以在 Google Sheet 协作，也可以在另一台电脑通过此 URL 恢复。');
    } catch (err: any) {
      alert(`同步失败: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!syncConfig.webhookUrl) return alert('请先配置 Web Big App URL');
    if (!confirm('警告：此操作将清空本地数据，并从 Google Sheet 的备份中恢复所有历史订单和支出记录。确定继续吗？')) return;
    
    setSyncing(true);
    try {
      const cloudData = await fetchFromGoogleSheet(syncConfig.webhookUrl);
      
      // 注意：恢复逻辑需要与 Google Apps Script 返回的格式一一对应
      // 这里假设 Apps Script 返回了名为 orders, payments, purchases, costs 的数组
      if (cloudData.orders) setOrders(cloudData.orders.map((o: any) => ({
        id: o.ID || o.id, shopId: o.分店 || o.shopId, date: o.日期 || o.date, price: parseFloat(o.价格 || o.price), category: o.分类 || o.category, productName: o.商品名 || o.productName
      })));
      
      if (cloudData.payments) setPayments(cloudData.payments.map((p: any) => ({
        shopId: p.分店 || p.shopId, date: p.日期 || p.date, amount: parseFloat(p.金额 || p.amount), source: p.来源 || p.source
      })));

      if (cloudData.purchases) setPurchases(cloudData.purchases.map((p: any) => ({
        id: p.ID || p.id, shopId: p.分店 || p.shopId, date: p.日期 || p.date, item: p.项目 || p.item, category: p.分类 || p.category, amount: parseFloat(p.金额 || p.amount)
      })));

      if (cloudData.costs) setFixedCosts(cloudData.costs.map((c: any) => ({
        id: c.ID || c.id, shopId: c.分店 || c.shopId, date: c.日期 || c.date, type: c.类型 || c.type, amount: parseFloat(c.金额 || c.amount)
      })));

      alert('✅ 云端数据恢复成功！');
    } catch (err: any) {
      alert(`恢复失败: ${err.message}。请确保脚本已发布 doGet 函数，并设置权限为“任何人”。`);
    } finally {
      setSyncing(false);
    }
  };

  const handleAddCost = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setFixedCosts(prev => [...prev, {
      id: `cost-${Date.now()}`, shopId: costFilterShopId, date: fd.get('date') as string,
      type: fd.get('type') as any, amount: parseFloat(fd.get('amount') as string)
    }]);
    e.currentTarget.reset();
  };

  const addManualIncome = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMonthlyIncomes(prev => [...prev, {
      shopId: 'global', month: fd.get('month') as string, amount: parseFloat(fd.get('amount') as string), note: fd.get('note') as string
    }]);
    e.currentTarget.reset();
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
           <button onClick={() => { if(confirm('重置所有本地数据？（建议先备份）')) { localStorage.clear(); location.reload(); } }} className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-rose-500 transition-all">
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
                 <div className="absolute inset-0 flex items-center justify-center"><Upload className="w-8 h-8 text-indigo-600" /></div>
               </div>
               <div className="text-center">
                  <h4 className="font-black text-slate-800 text-xl mb-1">正在处理...</h4>
                  <p className="text-slate-400 text-xs font-medium">{statusMsg}</p>
               </div>
            </div>
          </div>
        )}

        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-10 py-5 flex justify-between items-center z-50">
          <div className="flex items-center gap-4">
             <h2 className="text-lg font-black text-slate-800">数据导入中心</h2>
             <div className="h-4 w-px bg-slate-200"></div>
             <div className="flex gap-2">
                <label className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl cursor-pointer hover:bg-indigo-100 border border-indigo-100">
                  <Upload className="w-3.5 h-3.5" /><span className="text-xs font-black uppercase">订单 Excel</span>
                  <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleOrderUpload} />
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl cursor-pointer hover:bg-orange-100 border border-orange-100">
                  <FileSpreadsheet className="w-3.5 h-3.5" /><span className="text-xs font-black uppercase">采购 Excel</span>
                  <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handlePurchaseExcelUpload} />
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl cursor-pointer hover:bg-emerald-100 border border-emerald-100">
                  <Upload className="w-3.5 h-3.5" /><span className="text-xs font-black uppercase">支付流水</span>
                  <input type="file" className="hidden" accept=".csv" onChange={(e) => handlePaymentUpload(e, 'wechat')} />
                </label>
             </div>
          </div>

          <div className="flex items-center gap-6">
             {syncConfig.lastSyncedAt && (
               <div className="text-right">
                 <p className="text-[10px] text-emerald-500 font-black uppercase">最近同步</p>
                 <p className="text-[10px] font-bold text-slate-400">{syncConfig.lastSyncedAt}</p>
               </div>
             )}
             <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-lg">BD</div>
          </div>
        </header>

        <div className="p-10 space-y-10">
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-4 gap-6">
                <StatCard title="总营收 (合并)" value={`¥${totalRevenue.toLocaleString()}`} subValue="订单 + 手动收入" icon={<TrendingUp />} color="bg-emerald-500" />
                <StatCard title="耗材采购 (合并)" value={`¥${totalPurchase.toLocaleString()}`} subValue="全店补货支出" icon={<ShoppingBag />} color="bg-orange-500" />
                <StatCard title="分店固定支出" value={`¥${totalFixedCostsGlobal.toLocaleString()}`} subValue="房租 + 人工" icon={<Wallet />} color="bg-indigo-500" />
                <StatCard title="预估总盈余" value={`¥${(totalRevenue - totalPurchase - totalFixedCostsGlobal).toLocaleString()}`} subValue="毛利润预估" icon={<Ticket />} color="bg-slate-900" />
              </div>

              <Card title="最近10日分类收入明细">
                 <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">日期</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-indigo-600 text-right">书</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-amber-600 text-right">饮品</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-blue-400 text-center">今日出杯</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-emerald-600 text-right">酒精</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-rose-600 text-right">会籍</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-900 text-right">当日总计</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {recent10DaysTableData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{row.date}</td>
                            <td className="px-6 py-4 text-right font-black text-indigo-500">¥{row.book.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-black text-amber-500">¥{row.drink.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                               <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black"><Coffee className="w-3 h-3" /> {row.drinkCount}</div>
                            </td>
                            <td className="px-6 py-4 text-right font-black text-emerald-500">¥{row.alcohol.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-black text-rose-500">¥{row.membership.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-black text-slate-900 bg-slate-50/50">¥{row.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </Card>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {/* Enhanced Sync & Restore Card */}
               <Card title="云端同步与多端协作" extra={<div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><CloudUpload className="w-4 h-4" /></div>}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start mt-4">
                    <div className="space-y-8">
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

                        <div className="p-6 bg-indigo-50/30 rounded-[32px] border border-indigo-100 space-y-4">
                          <label className="flex items-center justify-between text-[10px] font-black uppercase text-indigo-400 tracking-widest">
                            <div className="flex items-center gap-2"><ExternalLink className="w-3 h-3" /> 协作表格直达链接 (可选)</div>
                            {syncConfig.spreadsheetUrl && (
                               <a href={syncConfig.spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline">
                                 立即前往 <ExternalLink className="w-2.5 h-2.5" />
                               </a>
                            )}
                          </label>
                          <input 
                            type="text" 
                            value={syncConfig.spreadsheetUrl || ''} 
                            onChange={(e) => setSyncConfig({ ...syncConfig, spreadsheetUrl: e.target.value })}
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            className="w-full p-4 bg-white rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none font-bold text-slate-600 shadow-sm transition-all text-sm"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <button onClick={handleSyncToSheet} disabled={syncing} className="py-6 bg-indigo-600 text-white rounded-[28px] font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex flex-col items-center justify-center gap-2">
                            {syncing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CloudUpload className="w-6 h-6" />}
                            <span>上传并备份</span>
                         </button>
                         <button onClick={handleRestoreFromCloud} disabled={syncing} className="py-6 bg-emerald-600 text-white rounded-[28px] font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex flex-col items-center justify-center gap-2">
                            {syncing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <DownloadCloud className="w-6 h-6" />}
                            <span>换机恢复数据</span>
                         </button>
                      </div>

                      {syncConfig.lastSyncedAt && (
                        <div className="flex items-center justify-center gap-2 text-emerald-500 text-xs font-black">
                          <CheckCircle2 className="w-4 h-4" /> 已同步于： {syncConfig.lastSyncedAt}
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm p-8 space-y-6">
                       <h5 className="font-black flex items-center gap-2 uppercase tracking-widest text-[11px] text-indigo-500">
                         <Info className="w-4 h-4" /> 多端同步与协作指南
                       </h5>
                       <div className="space-y-4">
                          {[
                            { s: "备份", t: "当您导入了大量订单或录入了支出，请务必点击「上传并备份」。" },
                            { s: "协作", t: "您的合伙人可以在 Google Sheet 直接看到每日汇总，无需登录此 App。" },
                            { s: "换机", t: "如果您在另一台电脑登录，只需填入相同的 URL，点击「换机恢复」即可找回所有历史。" },
                          ].map(step => (
                            <div key={step.s} className="flex gap-4">
                              <span className="flex-shrink-0 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-black">{step.s}</span>
                              <p className="text-xs font-bold text-slate-600 leading-relaxed">{step.t}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
               </Card>

               <div className="grid grid-cols-2 gap-10">
                 <Card title="大家爱买什么书 (Top 30 排行)">
                    <div className="space-y-3 mt-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                       {Object.entries(orders.filter(o=>o.category==='book').reduce((acc:any, cur)=>{ acc[cur.productName] = (acc[cur.productName]||0)+1; return acc;}, {})).sort((a:any,b:any)=>b[1]-a[1]).slice(0, 30).map(([name, count], idx) => (
                         <div key={name} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-indigo-50/50 transition-colors">
                            <div className="flex items-center gap-4 truncate">
                               <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-xs ${idx < 3 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-500'}`}>
                                 {idx+1}
                               </span>
                               <span className="font-bold text-slate-700 truncate">{name}</span>
                            </div>
                            <span className="font-black text-indigo-600 flex-shrink-0 ml-4">{count as number} 本</span>
                         </div>
                       ))}
                    </div>
                 </Card>

                 <div className="space-y-10">
                   <Card title="手动录入其他收入 (如租金返还/活动收入)">
                     <form onSubmit={addManualIncome} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <input type="month" name="month" required className="p-4 bg-slate-50 rounded-2xl border-none font-bold" />
                          <input type="number" step="0.01" name="amount" placeholder="金额 ¥0.00" required className="p-4 bg-slate-50 rounded-2xl border-none font-bold" />
                        </div>
                        <input type="text" name="note" placeholder="来源备注 (例如：场地租赁、合作分成)" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold" />
                        <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-indigo-700 transition-all">添加收入记录</button>
                     </form>
                   </Card>

                   <Card title="最近录入的其他收入">
                      <div className="space-y-2 mt-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {monthlyIncomes.slice().reverse().map((income, idx) => (
                          <div key={idx} className="flex justify-between items-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                             <div>
                               <p className="text-xs font-black text-emerald-800">{income.month}</p>
                               <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{income.note}</p>
                             </div>
                             <div className="flex items-center gap-4">
                               <span className="font-black text-emerald-700">¥{income.amount.toLocaleString()}</span>
                               <button onClick={() => setMonthlyIncomes(prev => prev.filter((_, i) => i !== (monthlyIncomes.length - 1 - idx)))} className="text-emerald-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                             </div>
                          </div>
                        ))}
                      </div>
                   </Card>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'costs' && (
            <div className="grid grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <Card title="录入分店固定支出">
                  <header className="flex bg-slate-100 p-1 rounded-xl mb-6">
                    {INITIAL_SHOPS.map(shop => (
                      <button key={shop.id} onClick={() => setCostFilterShopId(shop.id)} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${costFilterShopId === shop.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                        {shop.name}
                      </button>
                    ))}
                  </header>
                  <form onSubmit={handleAddCost} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <input type="date" name="date" required className="p-4 bg-slate-50 rounded-xl border-none font-bold text-sm" />
                      <select name="type" className="p-4 bg-slate-50 rounded-xl border-none font-bold text-sm">
                        <option>人工</option><option>房租</option><option>水电</option><option>其他</option>
                      </select>
                    </div>
                    <input type="number" step="0.01" name="amount" required className="w-full p-4 bg-slate-50 rounded-xl border-none font-black text-2xl" placeholder="金额 ¥0.00" />
                    <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all">确认保存</button>
                  </form>
               </Card>
               <Card title={`${activeShopNameForCost} 历史明细`}>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                     {fixedCosts.filter(f => f.shopId === costFilterShopId).sort((a,b)=>b.date.localeCompare(a.date)).map(cost => (
                       <div key={cost.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 group">
                          <div><p className="font-black text-slate-800">{cost.type}</p><p className="text-[10px] text-slate-400 font-black uppercase">{cost.date}</p></div>
                          <div className="flex items-center gap-4">
                             <span className="text-lg font-black text-rose-500">-¥{cost.amount.toLocaleString()}</span>
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
               <Card title="导入耗材采购清单 (Excel)">
                  <div className="mt-4 border-4 border-dashed border-slate-100 rounded-[40px] p-20 text-center hover:border-orange-200 hover:bg-orange-50/20 transition-all group relative overflow-hidden">
                     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" accept=".xlsx,.xls" onChange={handlePurchaseExcelUpload} />
                     <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-[28px] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-orange-100"><FileSpreadsheet className="w-10 h-10" /></div>
                        <h4 className="text-2xl font-black text-slate-800 mb-2">点击或拖拽采购 Excel</h4>
                        <p className="text-slate-400 text-xs font-medium px-4 leading-relaxed">支持列名：日期/采购日期、项目/名称、分类、金额/实付</p>
                     </div>
                  </div>
               </Card>
               <Card title="最近采购记录">
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">日期</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">项目</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">分类</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">金额</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {purchases.sort((a,b)=>b.date.localeCompare(a.date)).map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 text-xs font-bold text-slate-500">{p.date}</td>
                            <td className="px-6 py-4 font-black text-slate-800">{p.item}</td>
                            <td className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">{p.category}</td>
                            <td className="px-6 py-4 text-right font-black text-slate-900">¥{p.amount.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right">
                               <button onClick={()=>setPurchases(prev=>prev.filter(x=>x.id!==p.id))} className="text-slate-200 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
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
              <Card title="核对汇总 (A:小程序 B:流水实收)">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase">日期</th>
                        <th className="px-6 py-5 text-[10px] font-black text-indigo-600 uppercase">小程序订单 (A)</th>
                        <th className="px-6 py-5 text-[10px] font-black text-emerald-600 uppercase">流水汇总 (B)</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase text-right">差额 (B-A)</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase text-center">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {dailySummary.map((summary) => {
                        const diff = summary.paymentTotal - summary.orderTotal;
                        const isMatched = Math.abs(diff) < 1.0;
                        return (
                          <tr key={summary.date}>
                            <td className="px-6 py-5 text-sm font-black text-slate-700">{summary.date}</td>
                            <td className="px-6 py-5 font-black text-indigo-600">¥{summary.orderTotal.toLocaleString()}</td>
                            <td className="px-6 py-5 font-black text-emerald-600">¥{summary.paymentTotal.toLocaleString()}</td>
                            <td className={`px-6 py-5 text-right font-black ${isMatched ? 'text-slate-300' : diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase ${isMatched ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{isMatched ? 'OK' : 'DIFF'}</span>
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
        </div>
      </main>
    </div>
  );
};

export default App;
