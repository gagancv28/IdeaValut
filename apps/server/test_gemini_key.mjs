// test_gemini.mjs - test from server directory
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
console.log('Testing Gemini with key prefix:', apiKey.substring(0, 10) + '...');

try {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent('Respond with just: {"status":"ok"}');
  const text = result.response.text().trim();
  console.log('SUCCESS:', text);
} catch (e) {
  console.error('GEMINI ERROR:', e.message);
  if (e.status) console.error('HTTP Status:', e.status);
  if (e.statusText) console.error('StatusText:', e.statusText);
  // Log the full error to see details
  console.error('Full error:', JSON.stringify(e, null, 2));
}
