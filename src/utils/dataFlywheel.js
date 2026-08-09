// src/utils/dataFlywheel.js

// 🚀 Live AWS Lambda Function URL Endpoint
const AWS_FLYWHEEL_ENDPOINT = "https://vymp64t6naexrdp2xu7cuy6q2m0ogsth.lambda-url.ap-south-1.on.aws/";

export async function logTrainingPair(userQuery, netlistResult, drcErrorCount) {
  // 1. Guard Clause: Only save verified schematics with 0 DRC errors
  if (drcErrorCount > 0 || !userQuery || !netlistResult) return;

  const payload = {
    timestamp: new Date().toISOString(),
    prompt: userQuery,
    completion: typeof netlistResult === 'string' ? netlistResult : JSON.stringify(netlistResult)
  };

  // 2. Local Fallback: Save to browser storage
  try {
    const existingLogs = JSON.parse(localStorage.getItem('pcb_training_flywheel') || '[]');
    existingLogs.push(payload);
    if (existingLogs.length > 100) existingLogs.shift();
    localStorage.setItem('pcb_training_flywheel', JSON.stringify(existingLogs));
  } catch (e) {
    console.warn("Local storage flywheel error:", e);
  }

  // 3. ☁️ Global Silent Auto-Sync to AWS S3
  try {
    fetch(AWS_FLYWHEEL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors'
    }).catch(() => {
      // Fails silently in background so user flow is never interrupted
    });
  } catch (_) {}
}

export function exportFlywheelDataset() {
  const logs = JSON.parse(localStorage.getItem('pcb_training_flywheel') || '[]');
  if (logs.length === 0) {
    alert("No flywheel training logs collected in browser storage yet! Generate some 0-DRC schematics first.");
    return;
  }

  const jsonlLines = logs.map(item => JSON.stringify({
    prompt: `Generate a production-grade EDA schematic netlist JSON for: "${item.prompt}"`,
    completion: item.completion
  })).join('\n');

  const blob = new Blob([jsonlLines], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `flywheel_user_dataset_${Date.now()}.jsonl`;
  link.click();
  URL.revokeObjectURL(url);
}