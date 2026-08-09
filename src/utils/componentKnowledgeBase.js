// src/utils/componentKnowledgeBase.js

export const COMPONENT_KNOWLEDGE_BASE = {
  // 1. 4-bit / 8-bit / 32-bit Micro-architectures
  '4-BIT CPU': {
    name: '4-Bit SAP-1 CPU Core',
    type: 'microarchitecture',
    pins: ['VCC', 'GND', 'CLK', 'CLR', 'A0', 'A1', 'A2', 'A3', 'OUT0', 'OUT1', 'OUT2', 'OUT3'],
    rules: 'Requires clock signal from 555 timer or crystal, common GND bus, and 100nF decoupling capacitor on VCC.'
  },
  'ATMEGA328P': {
    name: 'ATmega328P-PU 8-Bit AVR Microcontroller',
    type: 'microcontroller',
    pins: ['VCC', 'GND', 'AVCC', 'RESET', 'XTAL1', 'XTAL2', 'PD0_RX', 'PD1_TX', 'PB0', 'PB1'],
    rules: 'RESET pin MUST have a 10k pull-up resistor to VCC and a tactile switch to GND. XTAL1 and XTAL2 connect to a 16MHz crystal with 22pF load capacitors to GND.'
  },
  'ESP32': {
    name: 'ESP32-WROOM-32 / ESP32-S3 Wi-Fi/BT Module',
    type: 'microcontroller',
    pins: ['3V3', 'GND', 'EN', 'TX', 'RX', 'SDA', 'SCL', 'IO0', 'IO4'],
    rules: 'EN pin requires a 10k pull-up resistor to 3V3 and a tactile switch to GND for reset. IO0 requires a tactile boot switch to GND. SDA and SCL require 4.7k pull-up resistors to 3V3.'
  },
  'STM32': {
    name: 'STM32H743XI / STM32F103 32-Bit ARM Cortex MCU',
    type: 'microcontroller',
    pins: ['VDD', 'VSS', 'NRST', 'PA9_TX', 'PA10_RX', 'PA13_SWDIO', 'PA14_SWCLK', 'PB6_SCL', 'PB7_SDA'],
    rules: 'NRST pin requires 10k pull-up to VDD. SWDIO and SWCLK connect to a 4-pin SWD programming header. Dual decoupling capacitors (100nF + 10uF) required on VDD/VSS.'
  },

  // 2. Power Management & BMS
  'AMS1117': {
    name: 'AMS1117-3.3V / AMS1117-5.0V LDO Voltage Regulator',
    type: 'regulator',
    pins: ['IN', 'OUT', 'GND'],
    rules: 'IN accepts VBUS/5V. OUT produces regulated 3.3V. GND connects to common ground plane. Requires 10uF bulk capacitor on OUT.'
  },
  'DW01A': {
    name: 'DW01A Single-Cell Lithium Battery Protection IC',
    type: 'bms_ic',
    pins: ['VCC', 'GND', 'CS', 'OD', 'OC', 'TD'],
    rules: 'OD controls Discharge MOSFET Gate (S1/G1). OC controls Charge MOSFET Gate (S2/G2). CS connects to 1k resistor for current sensing.'
  },
  'AO8810': {
    name: 'AO8810 Dual N-Channel Power MOSFET',
    type: 'mosfet',
    pins: ['G1', 'S1', 'D1', 'G2', 'S2', 'D2'],
    rules: 'G1 connects to DW01A OD pin. G2 connects to DW01A OC pin. D1 and D2 are shorted together internally.'
  },

  // 3. Sensors & Peripherals
  'MPU6050': {
    name: 'MPU-6050 6-Axis Motion Tracking IMU',
    type: 'sensor',
    pins: ['VCC', 'GND', 'SDA', 'SCL', 'INT', 'AD0'],
    rules: 'Communicates via I2C. SDA and SCL connect to MCU I2C bus with 4.7k pull-up resistors to VCC.'
  },
  'CP2102': {
    name: 'CP2102 USB-to-UART Bridge Controller',
    type: 'interface',
    pins: ['VBUS', 'GND', 'TXD', 'RXD', 'D+', 'D-'],
    rules: 'VBUS receives 5V from USB port. TXD connects to MCU RX. RXD connects to MCU TX. D+ and D- connect to USB D+/D- lines.'
  }
};

/**
 * RAG Context Retriever Function
 * Searches user query against Knowledge Base and builds explicit AI system rules
 */
export function retrieveRAGContext(userQuery = '') {
  const query = userQuery.toUpperCase();
  const matchedContexts = [];

  for (const [key, details] of Object.entries(COMPONENT_KNOWLEDGE_BASE)) {
    if (query.includes(key) || (key === '4-BIT CPU' && (query.includes('4 BIT') || query.includes('4-BIT') || query.includes('CPU')))) {
      matchedContexts.push(details);
    }
  }

  if (matchedContexts.length === 0) {
    return null;
  }

  let promptContext = `\n--- 🔍 HARDWARE KNOWLEDGE BASE CONTEXT (RAG RETRIEVED) ---\n`;
  matchedContexts.forEach((item, index) => {
    promptContext += `Component ${index + 1}: ${item.name}\n`;
    promptContext += `- Pins: [${item.pins.join(', ')}]\n`;
    promptContext += `- Wiring Rules: ${item.rules}\n`;
  });
  promptContext += `---------------------------------------------------------\n`;

  return promptContext;
}