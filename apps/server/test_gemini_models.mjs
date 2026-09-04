// test_gemini_models.mjs - list available models
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';

// Try different model names
const modelsToTry = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
  'gemini-pro',
];

for (const modelName of modelsToTry) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Say OK');
    const text = result.response.text().trim();
    console.log(`SUCCESS with model ${modelName}:`, text.substring(0, 50));
    break;
  } catch (e) {
    const status = e.status || '?';
    console.log(`FAIL [${status}] ${modelName}: ${e.message.substring(0, 100)}`);
  }
}
