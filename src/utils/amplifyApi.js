// src/utils/amplifyApi.js
import { generateClient } from 'aws-amplify/data';

const client = generateClient();

export async function generatePcbFromAmplify(promptText) {
  const response = await client.queries.generatePcb({ prompt: promptText });
  
  if (!response?.data) {
    throw new Error("No data received from AWS Amplify backend");
  }

  let raw = response.data;

  // 1. Unwrap GraphQL / Data client object envelopes if nested
  if (typeof raw === 'object' && raw !== null) {
    raw = raw.body || raw.result || raw.output || raw.generatePcb || raw;
  }

  // 2. Ensure we convert to string to perform regex slicing
  let text = typeof raw === 'string' ? raw : JSON.stringify(raw);

  // Clean markdown backticks
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  // 3. Slice ONLY the inner JSON object (Safely strips "KNOWLEDGE..." pre-text)
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start !== -1 && end !== -1 && end > start) {
    const jsonSubstring = text.substring(start, end + 1);
    try {
      return JSON.parse(jsonSubstring);
    } catch (e) {
      console.warn("amplifyApi substring JSON parse fallback:", e);
    }
  }

  // 4. Fallback parser
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("amplifyApi failed to parse clean JSON:", text);
    return typeof raw === 'object' ? raw : {};
  }
}