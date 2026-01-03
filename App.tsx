
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
  DownloadCloud
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

  // Editing state for Purchase items
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editPurchaseForm, setEditPurchaseForm] = useState<Partial<PurchaseRecord>>({});

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
      alert('请先在设置中配置 Google Apps Script Webhook URL');
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
        orders: orders, // 发送原始订单用于备份
        payments: payments // 发送流水明细用于备份
      });
      
      setSyncConfig(prev => ({ ...prev, lastSyncedAt: new Date().toLocaleString() }));
      alert('✅ 数据已成功同步，云端已备份。');
    } catch (err: any) {
      alert(`同步失败: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!syncConfig.webhookUrl) return alert('未配置 URL');
    if (!confirm('确定要从云端恢复吗？这将覆盖本台电脑上的所有当前数据！')) return;
    
    setSyncing(true);
    try {
      const data = await fetchFromGoogleSheet(syncConfig.webhookUrl);
      
      // 数据映射回 App 类型 (注意：从 Google Sheet 回来的数据字段名是中文或特定的，需要转换)
      if (data.orders) setOrders(data.orders.map((o: any) => ({
        id: o.ID, shopId: o.分店, date: o.日期, price: parseFloat(o.价格), category: o.分类, productName: o.商品名
      })));
      
      if (data.payments) setPayments(data.payments.map((p: any) => ({
        shopId: p.分店, date: p.日期, amount: parseFloat(p.金额), source: p.来源
      })));

      if (data.purchases) setPurchases(data.purchases.map((p: any) => ({
        id: p.ID, shopId: p.分店, date: p.日期, item: p.项目, category: p.分类, amount: parseFloat(p.金额)
      })));

      if (data.costs) setFixedCosts(data.costs.map((c: any) => ({
        id: c.ID, shopId: c.分店, date: c.日期, type: c.类型, amount: parseFloat(c.金额)
      })));

      alert('✅ 数据恢复成功！');
    } catch (err: any) {
      alert(`恢复失败，请检查 URL 或云端是否有 Raw 数据页签: ${err.message}`);
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

  const startEditingPurchase = (item: PurchaseRecord) => { setEditingPurchaseId(item.id); setEditPurchaseForm({ ...item }); };
  const cancelEditingPurchase = () => { setEditingPurchaseId(null); setEditPurchaseForm({}); };
  const saveEditedPurchase = () => {
    if (!editingPurchaseId) return;
    setPurchases(prev => prev.map(p => p.id === editingPurchaseId ? (editPurchaseForm as PurchaseRecord) : p));
    setEditingPurchaseId(null);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar (省略重复部分) */}
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
            { id: 'inventory', label: '云端同步与恢复', icon: TrendingUp },
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
           <button onClick={() => { if(confirm('重置所有数据？')) { localStorage.clear(); location.reload(); } }} className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-rose-500 transition-all">
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
                  <h4 className="font-black text-slate-800 text-xl mb-1">正在加载...</h4>
                  <p className="text-slate-400 text-xs font-medium">{statusMsg}</p>
               </div>
            </div>
          </div>
        )}

        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-10 py-5 flex justify-between items-center z-50">
          <div className="flex items-center gap-4">
             <h2 className="text-lg font-black text-slate-800">数据中心</h2>
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
               <Card title="Google Sheet 云端同步与灾难恢复" extra={<div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Settings className="w-4 h-4" /></div>}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start mt-4">
                    <div className="space-y-8">
                      <div className="space-y-6">
                        <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                            <LinkIcon className="w-3 h-3" /> Web App URL (必须)
                          </label>
                          <input 
                            type="text" 
                            value={syncConfig.webhookUrl} 
                            onChange={(e) => setSyncConfig({ ...syncConfig, webhookUrl: e.target.value })}
                            placeholder="https://script.google.com/macros/s/.../exec"
                            className="w-full p-4 bg-white rounded-2xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-600 shadow-sm transition-all text-sm"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <button onClick={handleSyncToSheet} disabled={syncing} className="py-6 bg-indigo-600 text-white rounded-[28px] font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex flex-col items-center justify-center gap-2 disabled:opacity-50">
                            {syncing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CloudUpload className="w-6 h-6" />}
                            <span>上传并备份</span>
                         </button>
                         <button onClick={handleRestoreFromCloud} disabled={syncing} className="py-6 bg-emerald-600 text-white rounded-[28px] font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex flex-col items-center justify-center gap-2 disabled:opacity-50">
                            {syncing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <DownloadCloud className="w-6 h-6" />}
                            <span>换机恢复数据</span>
                         </button>
                      </div>

                      {syncConfig.lastSyncedAt && (
                        <div className="flex items-center justify-center gap-2 text-emerald-500 text-xs font-black">
                          <CheckCircle2 className="w-4 h-4" /> 云端同步保持在： {syncConfig.lastSyncedAt}
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                       <div className="bg-emerald-500 p-6 text-white flex justify-between items-center">
                         <h5 className="font-black flex items-center gap-2 uppercase tracking-widest text-[11px]">
                           <ExternalLink className="w-4 h-4" /> 换电脑搬迁指南
                         </h5>
                       </div>
                       <div className="p-8 space-y-6">
                         <div className="space-y-4">
                            {[
                              { s: "1. 备份", t: "在旧电脑上，点击“上传并备份”。这会在云端生成 Raw 数据页签。" },
                              { s: "2. 新机", t: "在新电脑上打开此 App，填入同样的 Web App URL。" },
                              { s: "3. 恢复", t: "点击“换机恢复数据”，App 会自动抓取 Raw 页签中的历史记录。" },
                              { s: "4. 安全", t: "建议每完成一次大数据导入（如年度流水）后都点一次备份。" },
                            ].map(step => (
                              <div key={step.s} className="flex gap-4">
                                <span className="flex-shrink-0 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-[10px] font-black">步骤 {step.s.split('.')[0]}</span>
                                <p className="text-xs font-bold text-slate-600 leading-relaxed">{step.t}</p>
                              </div>
                            ))}
                         </div>
                       </div>
                    </div>
                  </div>
               </Card>
            </div>
          )}
          {/* 其他 Tab 的内容保持不变... */}
        </div>
      </main>
    </div>
  );
};

export default App;
