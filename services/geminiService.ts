
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractPurchaseFromImage = async (base64Image: string) => {
  // 使用性能更强、视觉理解更敏锐的 gemini-3-flash-preview
  const model = 'gemini-3-flash-preview';
  
  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        {
          text: `你是一个专业的财务对账专家。这张图片是电商平台（如拼多多、淘宝、京东）的“订单历史”列表长截图。
          
          请遵循以下提取规则：
          1. **识别订单块**：图中包含多个并列的订单块。每个块通常包含商品图片、名称、件数，以及以“实付”或“合计”开头的金额。
          2. **日期提取**：图中日期通常在块的顶部（如 12/31 11:01）。请将其补全为 YYYY-MM-DD 格式（优先假设年份为 2024，若月份大于当前月份则为 2023）。
          3. **商品归类**：
             - **饮品耗材**：牛奶(A25/纯牛奶等)、柠檬、水果、茶叶、糖浆、咖啡豆、吸管。
             - **清洁耗材**：洗洁精、垃圾袋、抹布、纸巾、洗手液。
             - **书**：书籍、杂志、画册。
             - **其他**：以上皆不是。
          4. **金额提取**：请提取每一个订单块最后的“实付”金额。忽略“红包”或“优惠”等中间数字。
          
          请务必识别出截图中看到的**每一个**有效的已完成订单块。输出 JSON 数组。`
        },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image
          }
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, description: 'YYYY-MM-DD format' },
                name: { type: Type.STRING, description: 'Core product name' },
                category: { 
                  type: Type.STRING, 
                  enum: ['饮品耗材', '清洁耗材', '书', '其他']
                },
                price: { type: Type.NUMBER, description: 'The final total paid amount' }
              },
              required: ["date", "name", "category", "price"]
            }
          }
        },
        required: ["items"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("AI 未返回有效数据");
  return JSON.parse(text);
};
