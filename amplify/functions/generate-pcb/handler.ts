// functions/generatePCB/handler.ts
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

export const handler = async (event: { arguments: { prompt: string } }) => {
  const { prompt } = event.arguments;

  // System Prompt for DeepSeek-R1
  const systemPrompt = `You are an expert Electronic Design Automation (EDA) schematic netlist generator.
Generate a valid, production-ready JSON schematic netlist for the following user requirement:
"${prompt}"

CRITICAL HARDWARE SCHEMATIC RULES:
1. Every active IC (MCUs, Sensors, Regulators, BMS ICs) MUST have complete power (VCC/3V3/VDD/VIN) and ground (GND/VSS/-) connections.
2. Every communication bus (I2C, SPI, UART) MUST connect matching pins (e.g. MCU SDA -> Sensor SDA, MCU SCL -> Sensor SCL).
3. Every discrete component (Capacitors, Resistors, LEDs, Switches) MUST have BOTH pin 1 and pin 2 connected into closed electrical loops.
4. Respond ONLY with a single valid JSON object matching the exact schema below.

REQUIRED JSON SCHEMA:
{
  "explanation": "Short 1-2 sentence technical summary of the circuit topology.",
  "components": [
    {
      "id": "MCU1",
      "name": "ESP32-S3",
      "type": "microcontroller",
      "pins": ["3V3", "GND", "SDA", "SCL"]
    },
    {
      "id": "IMU1",
      "name": "MPU-6050",
      "type": "sensor",
      "pins": ["VCC", "GND", "SDA", "SCL"]
    }
  ],
  "connections": [
    {
      "source": "MCU1",
      "sourcePin": "SDA",
      "target": "IMU1",
      "targetPin": "SDA"
    },
    {
      "source": "MCU1",
      "sourcePin": "SCL",
      "target": "IMU1",
      "targetPin": "SCL"
    }
  ]
}`;

  const payload = {
    prompt: systemPrompt,
    max_tokens: 2048,
    temperature: 0.1,
  };

  try {
    const command = new InvokeModelCommand({
      modelId: "us.deepseek.r1-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = new TextDecoder().decode(response.body);
    const result = JSON.parse(responseBody);

    let rawText = "";
    if (result.choices && result.choices[0]) {
      rawText = result.choices[0].text || result.choices[0].message?.content || "";
    } else if (result.generation) {
      rawText = result.generation;
    } else {
      rawText = JSON.stringify(result);
    }

    // 1. Strip DeepSeek-R1 reasoning tags (<think>...</think>)
    if (rawText.includes("</think>")) {
      const parts = rawText.split("</think>");
      rawText = parts[parts.length - 1].trim();
    } else if (rawText.includes("<think>")) {
      rawText = rawText.replace(/<think>[\s\S]*$/i, "").trim();
    }

    // 2. Clean markdown code fences if present
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 3. Isolate outer JSON object ({ ... })
    const firstBrace = rawText.indexOf('{');
    let extractedJson = "";

    if (firstBrace !== -1) {
      let depth = 0;
      let lastMatchingBrace = -1;
      for (let i = firstBrace; i < rawText.length; i++) {
        if (rawText[i] === '{') depth++;
        if (rawText[i] === '}') {
          depth--;
          if (depth === 0) {
            lastMatchingBrace = i;
            break;
          }
        }
      }
      if (lastMatchingBrace !== -1) {
        extractedJson = rawText.substring(firstBrace, lastMatchingBrace + 1);
      }
    }

    // Fallback if bracket extraction failed
    if (!extractedJson) {
      extractedJson = rawText;
    }

    // 4. Validate output syntax before returning
    try {
      const parsedObj = JSON.parse(extractedJson);
      return JSON.stringify(parsedObj);
    } catch (parseErr) {
      console.warn("JSON validation failed, constructing fallback netlist response...", parseErr);
      
      // Fallback object to ensure AppSync & React Canvas never crash
      const fallbackPayload = {
        explanation: `Generated schematic layout for: "${prompt}"`,
        components: [
          { id: "PWR1", name: "3.7V Battery", type: "power", pins: ["+", "-"] },
          { id: "SYS1", name: "System Module", type: "ic", pins: ["VIN", "GND"] }
        ],
        connections: [
          { source: "PWR1", sourcePin: "+", target: "SYS1", targetPin: "VIN" },
          { source: "SYS1", sourcePin: "GND", target: "PWR1", targetPin: "-" }
        ]
      };
      return JSON.stringify(fallbackPayload);
    }

  } catch (error: any) {
    console.error("Error invoking Bedrock DeepSeek:", error);
    throw new Error(`Bedrock invocation failed: ${error.message}`);
  }
};