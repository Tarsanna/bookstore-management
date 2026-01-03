
import { OrderRecord, PaymentRecord, DailySummary, OrderCategory, PurchaseRecord } from '../types';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const CATEGORY_MAP: Record<string, OrderCategory> = {
  '书': 'book',
  '书籍': 'book',
  '饮品': 'drink',
  '饮料': 'drink',
  '咖啡': 'drink',
  '茶': 'drink',
  '酒': 'alcohol',
  '特调': 'alcohol',
  '微醺': 'alcohol',
  '酒精': 'alcohol',
  '活动': 'event',
  '沙龙': 'event',
  '会员': 'membership',
  '储值': 'membership',
  '会籍': 'membership'
};

const mapCategory = (rawType: string, productName: string): OrderCategory => {
  const combined = `${rawType || ''} ${productName || ''}`.toLowerCase();
  const match = Object.entries(CATEGORY_MAP).find(([key]) => combined.includes(key.toLowerCase()));
  return match ? match[1] : 'book';
};

/**
 * 核心修复：强制日期补零对齐
 * 确保 "2024-12-9" 变成 "2024-12-09"
 */
const standardizeDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return dateStr;
  }
};

/**
 * 处理 Excel 日期。可能是字符串也可能是数字（Excel 序列号）
 */
const formatExcelDate = (val: any): string => {
  if (!val) return standardizeDate(new Date().toISOString());
  if (typeof val === 'number') {
    // Excel 序列号转 JS Date
    const date = new Date(Math.round((val - 25569) * 864e5));
    return standardizeDate(date.toISOString());
  }
  return standardizeDate(String(val).trim());
};

/**
 * 清洗 CSV 单元格中的特殊字符（如微信/支付宝导出的反引号 `）
 */
const cleanValue = (val: any): string => {
  if (typeof val !== 'string') return String(val || '');
  return val.replace(/^`/, '').trim();
};

export const parseOrderExcel = (file: File): Promise<OrderRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        const records: OrderRecord[] = rows.map((row, index) => {
          const rawDate = row['订单日期'] || row['下单时间'] || row['付款时间'] || row['日期'];
          const date = formatExcelDate(rawDate);
          
          const unitPrice = parseFloat(row['单价(销售价)'] || 0);
          const quantity = parseFloat(row['数量'] || 1);
          const price = unitPrice * quantity;

          const productName = row['商品名称'] || row['商品详情'] || '未知商品';
          const rawCategory = row['商品类型'] || '';
          
          const status = row['订单状态'];
          if (status === '已取消' || status === '待付款') return null;

          return {
            id: `ord-${Date.now()}-${index}-${Math.random()}`,
            shopId: 'global',
            date,
            price,
            category: mapCategory(rawCategory, productName),
            productName
          };
        }).filter((r): r is OrderRecord => r !== null && r.price > 0);

        resolve(records);
      } catch (err) {
        reject(new Error('Excel 解析失败，请检查文件格式是否与模板一致'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取出错'));
    reader.readAsArrayBuffer(file);
  });
};

export const parsePurchaseExcel = (file: File): Promise<PurchaseRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        const records: PurchaseRecord[] = rows.map((row, index) => {
          const date = formatExcelDate(row['日期'] || row['采购日期'] || row['时间']);
          const item = row['项目'] || row['名称'] || row['商品名称'] || '未知耗材';
          const amount = parseFloat(row['金额'] || row['金额(元)'] || row['实付'] || 0);
          
          let category = row['分类'] || row['类别'] || '其他';
          if (!['饮品耗材', '清洁耗材', '书', '其他'].includes(category)) {
            category = '其他';
          }

          return {
            id: `purch-${Date.now()}-${index}-${Math.random()}`,
            shopId: 'global',
            date,
            item,
            category: category as any,
            amount
          };
        }).filter(r => r.amount > 0);

        resolve(records);
      } catch (err) {
        reject(new Error('耗材 Excel 解析失败，请检查列名（需包含日期、项目、金额、分类）'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取出错'));
    reader.readAsArrayBuffer(file);
  });
};

export const parsePaymentCSV = (file: File, source: 'wechat' | 'alipay' | 'you'): Promise<PaymentRecord[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rawRows = results.data as string[][];
          const records: PaymentRecord[] = [];

          if (source === 'wechat') {
            for (let i = 0; i < rawRows.length; i++) {
              const row = rawRows[i].map(cleanValue);
              if (row[0] === '交易时间' || row[0].includes('总交易单数') || !row[0]) continue;

              if (row[0].match(/^\d{4}/)) {
                const date = standardizeDate(row[0].split(' ')[0]);
                const amount = parseFloat(row[24] || row[12] || '0');
                const status = row[9];

                if (!isNaN(amount) && amount > 0 && (status === 'SUCCESS' || status === '支付成功' || !status)) {
                  records.push({
                    shopId: 'global',
                    date,
                    amount,
                    source: 'wechat'
                  });
                }
              }
            }
          } else if (source === 'alipay') {
            for (let i = 0; i < rawRows.length; i++) {
              const row = rawRows[i].map(cleanValue);
              if (row[0]?.match(/^\d{4}/)) {
                const date = standardizeDate(row[0].split(' ')[0]);
                const amount = parseFloat(row.find((v, idx) => idx > 5 && !isNaN(parseFloat(v)) && parseFloat(v) > 0) || '0');
                if (date && amount > 0) {
                  records.push({
                    shopId: 'global',
                    date,
                    amount,
                    source: 'alipay'
                  });
                }
              }
            }
          }

          resolve(records);
        } catch (err) {
          reject(new Error('CSV 解析过程中出错'));
        }
      },
      error: (err) => reject(new Error('CSV 读取失败: ' + err.message))
    });
  });
};

export const aggregateDailySummary = (orders: OrderRecord[], payments: PaymentRecord[]): DailySummary[] => {
  const summaryMap: Record<string, DailySummary> = {};

  const initDay = (date: string): DailySummary => ({
    date,
    orderTotal: 0,
    paymentTotal: 0,
    wechatTotal: 0,
    alipayTotal: 0,
    youTotal: 0,
    reconciled: false,
    categories: { book: 0, drink: 0, alcohol: 0, event: 0, membership: 0 }
  });

  orders.forEach(order => {
    const d = standardizeDate(order.date);
    if (!summaryMap[d]) summaryMap[d] = initDay(d);
    summaryMap[d].orderTotal += order.price;
    summaryMap[d].categories[order.category] = (summaryMap[d].categories[order.category] || 0) + order.price;
  });

  payments.forEach(payment => {
    const d = standardizeDate(payment.date);
    if (!summaryMap[d]) summaryMap[d] = initDay(d);
    summaryMap[d].paymentTotal += payment.amount;
    if (payment.source === 'wechat') summaryMap[d].wechatTotal += payment.amount;
    else if (payment.source === 'alipay') summaryMap[d].alipayTotal += payment.amount;
    else if (payment.source === 'you') summaryMap[d].youTotal += payment.amount;
  });

  // 严格按 YYYY-MM-DD 字符串降序排列
  return Object.values(summaryMap).sort((a, b) => b.date.localeCompare(a.date));
};
