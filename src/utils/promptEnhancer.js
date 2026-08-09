// src/utils/promptEnhancer.js

export async function enhanceUserPrompt(rawInput) {
  const enhancementSystemPrompt = `
You are an expert Electronics & Hardware Systems Engineer.
Your task is to take a raw, informal user request for a circuit and expand it into a precise, production-grade hardware engineering prompt.

RULES:
1. Identify all required components, their standard reference designators (BAT1, SW1, R1, LED1, U1, etc.).
2. Specify ideal operating voltages, pinout references, and passive component values (e.g. calculate current-limiting resistor values using Ohm's Law).
3. Specify exact ground paths, power rails, and signal lines.
4. Keep the output concise (2-3 sentences), technical, and direct. Do NOT add conversational filler.

Example Input: "led circuit with 3.7v battery switch and resistor"
Example Output: "Design a 3.7V LiPo-powered circuit featuring a 1S battery (BAT1), SPST switch (SW1) on the high side, a 220Ω current-limiting resistor (R1) calculated for 10mA LED forward current, and a 5mm indicator LED (LED1). Ensure a closed loop from LED Cathode back to BAT1 negative terminal."
`;

  try {
    // If you have a direct API endpoint or AWS Bedrock call for fast prompt expansion:
    const response = await fetch('/api/enhance-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        systemPrompt: enhancementSystemPrompt,
        userPrompt: rawInput 
      })
    });

    if (!response.ok) throw new Error("Enhancement fallback");
    const data = await response.json();
    return data.enhancedPrompt || rawInput;
  } catch (error) {
    console.warn("Auto-enhancement bypassed, using original prompt:", error);
    // Local client-side fallback enhancer if API is offline
    return `${rawInput} — Optimized: Include proper decoupling, exact pin routing, and power return lines.`;
  }
}