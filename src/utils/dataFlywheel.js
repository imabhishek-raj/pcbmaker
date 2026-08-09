// src/utils/dataFlywheel.js

/**
 * Data Flywheel Logger
 * Captures user queries & generated netlists when DRC validation passes with 0 errors.
 */
export async function logTrainingPair(userQuery, netlistResult, drcErrorCount) {
  // Only collect high-quality pairs with 0 DRC errors
  if (drcErrorCount > 0 || !userQuery || !netlistResult) return;

  try {
    const payload = {
      timestamp: new Date().toISOString(),
      prompt: userQuery,
      completion: JSON.stringify(netlistResult)
    };

    // Send payload to local storage cache / analytics endpoint
    const existingLogs = JSON.parse(localStorage.getItem('pcb_training_flywheel') || '[]');
    existingLogs.push(payload);
    
    // Keep up to 100 recent pairs locally before syncing
    if (existingLogs.length > 100) existingLogs.shift();
    
    localStorage.setItem('pcb_training_flywheel', JSON.stringify(existingLogs));
    console.log("💾 Data Flywheel: Logged 0-DRC error schematic pair for future fine-tuning!");
  } catch (err) {
    console.warn("Data Flywheel log failed:", err);
  }
}

/**
 * Export collected user pairs as JSONL format
 */
export function exportFlywheelDataset() {
  const logs = JSON.parse(localStorage.getItem('pcb_training_flywheel') || '[]');
  if (logs.length === 0) {
    alert("No flywheel training logs collected yet! Generate some 0-DRC schematics first.");
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