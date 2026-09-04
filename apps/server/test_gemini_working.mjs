// test_gemini_working.mjs - verify model works
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';

try {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent('Respond with ONLY valid JSON (no markdown): {"status": "ok", "vault_score": 8}');
  const text = result.response.text().trim();
  console.log('SUCCESS with gemini-2.5-flash:');
  console.log(text);
} catch (e) {
  console.error('ERROR:', e.message);
}
