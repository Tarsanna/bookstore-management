
import { OrderRecord, PaymentRecord, PurchaseRecord, FixedCost, MonthlyManualIncome } from '../types';

/**
 * 同步数据到 Google Sheets
 * 除了汇总数据，我们还发送 orders 和 payments 的原始数据，
 * 这样在更换电脑时可以从 Google Sheet 完整恢复。
 */
export const syncToGoogleSheet = async (
  webhookUrl: string,
  payload: {
    daily: any[];
    purchases: PurchaseRecord[];
    costs: FixedCost[];
    manualIncomes: MonthlyManualIncome[];
    orders: OrderRecord[];
    payments: PaymentRecord[];
  }
) => {
  if (!webhookUrl) throw new Error('未配置 Webhook URL');

  // 由于 Google Apps Script 的 CORS 限制，通常使用 no-cors 模式发送 POST。
  // 注意：no-cors 模式下无法读取 response 的内容。
  const response = await fetch(webhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response;
};

/**
 * 从 Google Sheets 获取备份数据
 * 用于换机恢复。
 */
export const fetchFromGoogleSheet = async (webhookUrl: string) => {
  if (!webhookUrl) throw new Error('未配置 Webhook URL');
  
  // Apps Script 的 doGet 应该返回存储在隐藏 Raw 页签中的 JSON 数据
  const response = await fetch(webhookUrl);
  if (!response.ok) throw new Error('无法连接到云端脚本');
  const data = await response.json();
  return data;
};
