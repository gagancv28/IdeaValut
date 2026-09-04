// test_gemini_v1.mjs - try v1 API and list models
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';

// Try listing available models
try {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  const json = await response.json();
  if (json.models) {
    console.log('Available models:');
    json.models.forEach(m => console.log(' -', m.name, '|', m.supportedGenerationMethods?.join(', ')));
  } else {
    console.log('Response:', JSON.stringify(json, null, 2));
  }
} catch (e) {
  console.error('List models error:', e.message);
}
