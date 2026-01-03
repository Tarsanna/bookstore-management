
export type OrderCategory = 'book' | 'drink' | 'alcohol' | 'event' | 'membership';

export interface Shop {
  id: string;
  name: string;
}

export interface OrderRecord {
  id: string;
  shopId: string;
  date: string;
  price: number;
  category: OrderCategory;
  productName: string;
}

export interface PaymentRecord {
  shopId: string;
  date: string;
  amount: number;
  source: 'wechat' | 'alipay' | 'you';
}

export interface PurchaseRecord {
  id: string;
  shopId: string;
  date: string;
  item: string;
  category: '饮品耗材' | '清洁耗材' | '书' | '其他';
  amount: number;
}

export interface FixedCost {
  id: string;
  shopId: string;
  date: string;
  type: '人工' | '房租' | '水电' | '其他';
  amount: number;
}

export interface MonthlyManualIncome {
  shopId: string;
  month: string; // YYYY-MM
  amount: number;
  note: string;
}

export interface DailySummary {
  date: string;
  orderTotal: number;
  paymentTotal: number;
  wechatTotal: number;
  alipayTotal: number;
  youTotal: number;
  reconciled: boolean;
  categories: Record<OrderCategory, number>;
  drinkCount: number;
}

export interface SyncConfig {
  webhookUrl: string;
  lastSyncedAt?: string;
}
