// src/utils/promptEnhancer.js
import { retrieveRAGContext } from './componentKnowledgeBase';

export function buildRAGPrompt(userPrompt) {
  const ragContext = retrieveRAGContext(userPrompt) || '';

  const systemInstructions = `
You are a Principal Hardware EDA Engineer. Your job is to output a strictly valid JSON netlist for electronic schematics.

RULES:
1. Output ONLY valid JSON matching the schema below. No conversational text outside JSON.
2. Every active IC MUST have explicit power (VCC/3V3/VDD) and ground (GND/VSS) connections.
3. Use exact pin names provided in the Knowledge Base context.
4. Passives (Resistors, Capacitors, Switches, LEDs) must use pin "1" and pin "2".

FEW-SHOT JSON EXAMPLE:
{
  "explanation": "ESP32 breakout with USB power, AMS1117 regulator, EN reset button, and CP2102 UART.",
  "components": [
    {"id": "MCU1", "name": "ESP32-WROOM-32", "pins": ["3V3", "GND", "EN", "TX", "RX"]},
    {"id": "U1", "name": "AMS1117-3.3V", "pins": ["IN", "OUT", "GND"]},
    {"id": "SW1", "name": "Reset Switch", "pins": ["1", "2"]}
  ],
  "connections": [
    {"source": "U1", "sourcePin": "OUT", "target": "MCU1", "targetPin": "3V3"},
    {"source": "U1", "sourcePin": "GND", "target": "MCU1", "targetPin": "GND"},
    {"source": "MCU1", "sourcePin": "EN", "target": "SW1", "targetPin": "1"},
    {"source": "SW1", "sourcePin": "2", "target": "MCU1", "targetPin": "GND"}
  ]
}
`;

  return `${systemInstructions}\n${ragContext}\nUSER PROMPT: "${userPrompt}"`;
}