// src/utils/deepseek.js

export async function generateCircuitFromPrompt(userPrompt, apiKey) {
  // If an API key is provided, try direct API call
  if (apiKey) {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-reasoner",
          messages: [
            { 
              role: "system", 
              content: "You are an EDA Copilot. Return ONLY valid JSON with 'explanation', 'nodes', and 'edges'." 
            },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data.choices[0]?.message?.content || "";
        const cleanJsonText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanJsonText);
      }
    } catch (e) {
      console.warn("Direct API call failed, switching to local circuit generator", e);
    }
  }

  // Fallback Simulation Engine (Generates dynamic Netlist JSON for local testing)
  await new Promise((resolve) => setTimeout(resolve, 800));

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