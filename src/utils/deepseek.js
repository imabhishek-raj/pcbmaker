// src/utils/deepseek.js

export async function generateCircuitFromPrompt(userPrompt, currentCanvasState = null, apiKey = null) {
  // If apiKey was passed as 2nd argument instead of 3rd, shift arguments gracefully
  if (typeof currentCanvasState === 'string' && !apiKey) {
    apiKey = currentCanvasState;
    currentCanvasState = null;
  }

  if (apiKey) {
    try {
      // 1. Build context-aware prompt payload
      const existingNodes = currentCanvasState?.nodes || [];
      const existingEdges = currentCanvasState?.edges || [];

      const systemPrompt = `
You are an expert EDA Hardware Copilot for PCB Maker.

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
Generate a complete, fully connected schematic netlist with 0 DRC errors. Ensure power (VCC/BAT) and ground return (GND) loops are fully closed.
`}

RESPONSE RULES:
Return ONLY a valid JSON object. No raw text or markdown outside JSON.
JSON Structure:
{
  "explanation": "A short, 1-sentence summary of what was generated or added.",
  "nodes": [ ...all existing + new node objects... ],
  "edges": [ ...all existing + new edge objects... ]
}
`;

      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-reasoner",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2
        })
      });

      if (response.ok) {
        const data = await response.json();
        let rawText = data.choices[0]?.message?.content || "";
        
        // Clean out markdown code blocks and reasoning tags
        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        // Extract JSON if model returned wrapped text
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

        return parsedData;
      }
    } catch (e) {
      console.warn("Direct API call failed, switching to local circuit generator", e);
    }
  }

  // Fallback Simulation Engine (Used when no API Key is active)
  await new Promise((resolve) => setTimeout(resolve, 800));

  // If adding to existing local state, append an extra LED demo
  if (currentCanvasState && currentCanvasState.nodes?.length > 0) {
    const existing = JSON.parse(JSON.stringify(currentCanvasState));
    const newId = `d${existing.nodes.length + 1}`;
    
    existing.nodes.push({
      id: newId,
      label: `D${existing.nodes.length}: Status LED`,
      position: { x: 300, y: 450 },
      pins: [
        { id: "anode", label: "1: ANODE", type: "power", pos: "left" },
        { id: "cathode", label: "2: CATHODE", type: "ground", pos: "right" }
      ]
    });

    return {
      explanation: `Appended new status indicator node (${newId}) to canvas.`,
      nodes: existing.nodes,
      edges: existing.edges
    };
  }

  // Default initial circuit fallback
  return {
    explanation: `Generated schematic structure for: "${userPrompt}"`,
    nodes: [
      {
        id: "u1",
        label: "U1: ESP32-S3 Core",
        position: { x: 100, y: 120 },
        pins: [
          { id: "vcc", label: "1: VCC (3.3V)", type: "power", pos: "left" },
          { id: "gnd", label: "2: GND", type: "ground", pos: "right" },
          { id: "tx", label: "3: TXD0", type: "signal", pos: "right" },
          { id: "rx", label: "4: RXD0", type: "signal", pos: "left" }
        ]
      },
      {
        id: "u2",
        label: "U2: CP2102 Serial Bridge",
        position: { x: 480, y: 120 },
        pins: [
          { id: "vcc", label: "1: VDD", type: "power", pos: "left" },
          { id: "gnd", label: "2: GND", type: "ground", pos: "right" },
          { id: "tx", label: "3: TXD", type: "signal", pos: "left" },
          { id: "rx", label: "4: RXD", type: "signal", pos: "right" }
        ]
      },
      {
        id: "u3",
        label: "U3: AMS1117-3.3 LDO",
        position: { x: 300, y: 350 },
        pins: [
          { id: "vin", label: "1: VIN (5V)", type: "power", pos: "left" },
          { id: "gnd", label: "2: GND", type: "ground", pos: "right" },
          { id: "vout", label: "3: VOUT (3.3V)", type: "power", pos: "right" }
        ]
      }
    ],
    edges: [
      {
        id: "e1",
        source: "u2",
        sourceHandle: "tx",
        target: "u1",
        targetHandle: "rx",
        label: "UART_RX"
      },
      {
        id: "e2",
        source: "u1",
        sourceHandle: "tx",
        target: "u2",
        targetHandle: "rx",
        label: "UART_TX"
      },
      {
        id: "e3",
        source: "u3",
        sourceHandle: "vout",
        target: "u1",
        targetHandle: "vcc",
        label: "3V3_POWER"
      }
    ]
  };
}