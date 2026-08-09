// src/utils/componentLibrary.js

export const COMPONENT_LIBRARY = {
  // Microcontrollers
  'ESP32': ['3V3', 'GND', 'EN', 'TX', 'RX', 'SDA', 'SCL', 'IO4'],
  'STM32': ['VDD', 'VSS', 'NRST', 'TX', 'RX', 'SDA', 'SCL'],
  'MCU': ['3V3', 'GND', 'EN', 'TX', 'RX', 'SDA', 'SCL'],
  
  // USB-UART Bridges & Regulators
  'CP2102': ['VBUS', 'GND', 'TXD', 'RXD', 'D+', 'D-'],
  'CH340': ['VCC', 'GND', 'TXD', 'RXD', 'UD+', 'UD-'],
  'AMS1117': ['IN', 'OUT', 'GND'],
  'REGULATOR': ['IN', 'OUT', 'GND'],

  // BMS & Power Management
  'DW01': ['VCC', 'GND', 'CS', 'OD', 'OC', 'TD'],
  'AO8810': ['G1', 'S1', 'D1', 'G2', 'S2', 'D2'],
  'BQ76930': ['BAT', 'VC1', 'VC2', 'SDA', 'SCL', 'CHG', 'DSG', 'VSS'],
  'TP4056': ['VIN+', 'GND', 'BAT+', 'BAT-', 'TEMP', 'CE'],
  'CELL': ['+', '-'],
  'BAT': ['+', '-'],
  'LIPO': ['+', '-'],
  'LI-ION': ['+', '-'],
  
  // Transistors
  'CSD17313': ['DRAIN', 'GATE', 'SOURCE'],
  'MOSFET': ['DRAIN', 'GATE', 'SOURCE'],
  'FET': ['DRAIN', 'GATE', 'SOURCE'],
  
  // Sensors
  'MPU': ['VCC', 'GND', 'SDA', 'SCL', 'INT'],
  'IMU': ['VCC', 'GND', 'SDA', 'SCL'],
  
  // Passives & Indicators
  'LED': ['ANODE', 'CATHODE'],
  'DIODE': ['ANODE', 'CATHODE'],
  'SWITCH': ['1', '2'],
  'SW': ['1', '2'],
  'RESISTOR': ['1', '2'],
  'CAPACITOR': ['1', '2'],
  'INDUCTOR': ['1', '2']
};

export function getComponentPins(compName = '') {
  const name = compName.toUpperCase().trim();

  // Strict Passive Filtering (Prevents C1/C2/R1/SW1 from adopting IC pins)
  if (/^C\d+:/i.test(name) || name.includes('CAPACITOR') || name.includes('CAP') || /^R\d+:/i.test(name) || name.includes('RESISTOR')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }
  if (/^SW\d+:/i.test(name) || name.includes('SWITCH') || name.includes('TACTILE')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }

  for (const [key, pins] of Object.entries(COMPONENT_LIBRARY)) {
    if (name.includes(key)) {
      return pins.map((p) => ({ id: p, label: p }));
    }
  }

  return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
}