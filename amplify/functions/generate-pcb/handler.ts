import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

export const handler = async (event: { arguments: { prompt: string } }) => {
  const { prompt } = event.arguments;

  const payload = {
    prompt: `You are an expert PCB designer. Generate a JSON object representing components and net connections for this request:\n"${prompt}"\n\nCRITICAL INSTRUCTION: Respond ONLY with a valid JSON object. Do not include markdown tags, code blocks, or explanatory text before or after the JSON.\n\nSchema:\n{\n  "components": [\n    {"id": "MCU1", "name": "ESP32-S3", "type": "microcontroller"},\n    {"id": "FET1", "name": "SI2302 FET", "type": "transistor"}\n  ],\n  "connections": [\n    {"source": "MCU1", "sourcePin": "GPIO1", "target": "FET1", "targetPin": "GATE"}\n  ]\n}`,
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

    // Strip DeepSeek-R1 reasoning tags (<think>...</think>)
    if (rawText.includes("</think>")) {
      rawText = rawText.split("</think>")[1];
    }

    // Clean markdown code blocks if present
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Isolate first { to matching closing }
    const firstBrace = rawText.indexOf('{');
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
        return rawText.substring(firstBrace, lastMatchingBrace + 1);
      }
    }

    return rawText;
  } catch (error: any) {
    console.error("Error invoking Bedrock DeepSeek:", error);
    throw new Error(`Bedrock invocation failed: ${error.message}`);
  }
};