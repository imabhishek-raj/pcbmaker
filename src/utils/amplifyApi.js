// src/utils/amplifyApi.js
import { generateClient } from 'aws-amplify/data';

const client = generateClient();

export async function generatePcbFromAmplify(promptText) {
  const response = await client.queries.generatePcb({ prompt: promptText });
  
  if (!response?.data) {
    throw new Error("No data received from AWS Amplify backend");
  }

  let raw = response.data;
  if (typeof raw === 'string') {
    raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      raw = raw.substring(start, end + 1);
    }
    
    return JSON.parse(raw);
  }
  
  return raw;
}