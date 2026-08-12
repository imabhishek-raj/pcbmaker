// src/utils/deepseek.js

export async function generateCircuitFromPrompt(userPrompt, currentCanvasState = null, apiKey = null) {
  // If apiKey was passed as 2nd argument instead of 3rd, shift arguments gracefully
  if (typeof currentCanvasState === 'string' && !apiKey) {
    apiKey = currentCanvasState;
    currentCanvasState = null;
  }

  if (!apiKey) {
    throw new Error("Missing DeepSeek API Key. Please configure your API key to use live AI synthesis.");
  }

  try {
    const existingNodes = currentCanvasState?.nodes || [];
    const existingEdges = currentCanvasState?.edges || [];

    const systemPrompt = `
You are an expert EDA Hardware Copilot for PCB Maker. Your job is to design accurate, production-grade electronic schematics based on user prompts.

${existingNodes.length > 0 ? `
CURRENT CANVAS NETLIST STATE:
- Nodes: ${JSON.stringify(existingNodes)}
- Edges: ${JSON.stringify(existingEdges)}

INSTRUCTIONS FOR INCREMENTAL EDITS:
1. PRESERVE EXISTING NODES: Retain all active component nodes currently on the canvas unless explicitly asked to delete them.
2. APPEND NEW COMPONENTS: Generate new unique IDs (e.g., u2, d2, sw2) for newly added components.
3. CLOSE CIRCUIT LOOPS: Ensure every new component's pins are connected via valid edges. Never leave orphan/unrouted power or signal pins.
` : `
INSTRUCTIONS FOR NEW CIRCUIT:
Generate a complete, fully connected schematic netlist with 0 DRC errors. Ensure power (VCC/BAT) and ground return (GND) loops are fully closed. Always include specific MCU nodes, regulators, and decoupling passives when requested.
`}

RESPONSE RULES:
Return ONLY a valid JSON object. No markdown formatting, no conversational text, no reasoning text outside the JSON.
JSON Structure:
{
  "explanation": "A short, 1-sentence summary of what was generated or added.",
  "nodes": [ ...all existing + new node objects with id, label, position {x, y}, and pins array... ],
  "edges": [ ...all existing + new edge objects with id, source, sourceHandle, target, targetHandle, label... ]
}
`;

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // 👈 Use 'deepseek-chat' (V3) for structured JSON tasks instead of deepseek-reasoner to avoid think-tag parsing overhead
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1, // Lower temperature forces rigid adherence to schema
        response_format: { type: "json_object" } // 👈 Forces DeepSeek to guarantee a valid JSON response
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    let rawText = data.choices[0]?.message?.content || "";
    
    // Clean out any residual markdown just in case
    rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Model failed to output a parsable JSON object structure.");
    }

    const parsedData = JSON.parse(jsonMatch[0]);

    // Validate structure integrity
    if (!parsedData.nodes || !Array.isArray(parsedData.nodes)) {
      throw new Error("Invalid netlist format: 'nodes' array missing from AI response.");
    }

    return parsedData;

  } catch (e) {
    console.error("DeepSeek API Synthesis Failed:", e);
    // Throw error upward so UI displays the real issue rather than silently dropping a generic fallback box
    throw e;
  }
}