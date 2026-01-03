
import { OrderRecord, PaymentRecord, PurchaseRecord, FixedCost, MonthlyManualIncome } from '../types';

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

export const fetchFromGoogleSheet = async (webhookUrl: string) => {
  if (!webhookUrl) throw new Error('未配置 Webhook URL');
  
  const response = await fetch(webhookUrl);
  if (!response.ok) throw new Error('网络请求失败');
  const data = await response.json();
  return data;
};
