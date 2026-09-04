// test_find_working_model.mjs - find a model that actually works right now
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';

const modelsToTry = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

for (const modelName of modelsToTry) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Say OK in one word');
    const text = result.response.text().trim();
    console.log(`✅ SUCCESS: ${modelName} => ${text.substring(0, 60)}`);
    break;
  } catch (e) {
    const status = e.status || '?';
    const msg = e.message?.replace(/\[GoogleGenerativeAI Error\]:/g, '').substring(0, 100);
    console.log(`❌ [${status}] ${modelName}: ${msg}`);
  }
}
