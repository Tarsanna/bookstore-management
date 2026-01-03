
/**
 * Google Apps Script 参考代码 (部署为 Web App 并设置为 "Anyone" 访问):
 * 
 * function doPost(e) {
 *   var data = JSON.parse(e.postData.contents);
 *   var ss = SpreadsheetApp.getActiveSpreadsheet();
 *   
 *   // 1. 同步每日营收
 *   var sheetDaily = getOrCreateSheet(ss, "1_每日营收");
 *   sheetDaily.clear();
 *   sheetDaily.appendRow(["日期", "书籍", "饮品", "出杯量", "酒精", "会籍储值", "活动其他", "营收总额"]);
 *   data.daily.forEach(function(r) {
 *     sheetDaily.appendRow([r.date, r.book, r.drink, r.drinkCount, r.alcohol, r.membership, r.event, r.total]);
 *   });
 *
 *   // 2. 同步采购明细
 *   var sheetPurchases = getOrCreateSheet(ss, "2_采购明细");
 *   sheetPurchases.clear();
 *   sheetPurchases.appendRow(["日期", "项目", "分类", "金额"]);
 *   data.purchases.forEach(function(r) {
 *     sheetPurchases.appendRow([r.date, r.item, r.category, r.amount]);
 *   });
 *
 *   // 3. 同步分店支出
 *   var sheetCosts = getOrCreateSheet(ss, "3_分店支出");
 *   sheetCosts.clear();
 *   sheetCosts.appendRow(["日期", "分店", "类型", "金额"]);
 *   data.costs.forEach(function(r) {
 *     sheetCosts.appendRow([r.date, r.shopId, r.type, r.amount]);
 *   });
 *
 *   return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
 * }
 *
 * function getOrCreateSheet(ss, name) {
 *   var sheet = ss.getSheetByName(name);
 *   if (!sheet) sheet = ss.insertSheet(name);
 *   return sheet;
 * }
 */

import { DailySummary, PurchaseRecord, FixedCost, MonthlyManualIncome } from '../types';

export const syncToGoogleSheet = async (
  webhookUrl: string,
  payload: {
    daily: any[];
    purchases: PurchaseRecord[];
    costs: FixedCost[];
    manualIncomes: MonthlyManualIncome[];
  }
) => {
  if (!webhookUrl) throw new Error('未配置 Webhook URL');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    mode: 'no-cors', // Apps Script 通常需要 no-cors
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response;
};
