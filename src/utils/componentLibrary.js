// src/utils/componentLibrary.js

export const COMPONENT_LIBRARY = {
  // Microcontrollers & CPUs (4-bit, 8-bit, 16-bit, 32-bit)
  'ATMEGA': ['VCC', 'GND', 'RESET', 'XTAL1', 'XTAL2', 'PD0_RX', 'PD1_TX'],
  'AVR': ['VCC', 'GND', 'RESET', 'XTAL1', 'XTAL2', 'PD0_RX', 'PD1_TX'],
  'ESP32': ['3V3', 'GND', 'EN', 'TX', 'RX', 'SDA', 'SCL', 'IO4'],
  'STM32': ['VDD', 'VSS', 'NRST', 'TX', 'RX', 'SDA', 'SCL'],
  'CPU': ['VCC', 'GND', 'CLK', 'RESET', 'BUS0', 'BUS1'],
  'MCU': ['3V3', 'GND', 'EN', 'TX', 'RX', 'SDA', 'SCL'],
  
  // Power & Regulators
  'CP2102': ['VBUS', 'GND', 'TXD', 'RXD', 'D+', 'D-'],
  'CH340': ['VCC', 'GND', 'TXD', 'RXD', 'UD+', 'UD-'],
  'AMS1117': ['IN', 'OUT', 'GND'],
  'AP2112': ['IN', 'OUT', 'GND'],
  'REGULATOR': ['IN', 'OUT', 'GND'],

  // BMS & Battery
  'DW01': ['VCC', 'GND', 'CS', 'OD', 'OC', 'TD'],
  'AO8810': ['G1', 'S1', 'D1', 'G2', 'S2', 'D2'],
  'BQ76930': ['BAT', 'VC1', 'VC2', 'SDA', 'SCL', 'CHG', 'DSG', 'VSS'],
  'TP4056': ['VIN+', 'GND', 'BAT+', 'BAT-', 'TEMP', 'CE'],
  'CELL': ['+', '-'],
  'BAT': ['+', '-'],
  'LIPO': ['+', '-'],
  'LI-ION': ['+', '-'],
  
  // Transistors & Passives
  'CSD17313': ['DRAIN', 'GATE', 'SOURCE'],
  'MOSFET': ['DRAIN', 'GATE', 'SOURCE'],
  'FET': ['DRAIN', 'GATE', 'SOURCE'],
  'XTAL': ['1', '2'],
  'CRYSTAL': ['1', '2'],
  
  // Sensors & Modules
  'MPU': ['VCC', 'GND', 'SDA', 'SCL', 'INT'],
  'IMU': ['VCC', 'GND', 'SDA', 'SCL'],
  'SWD': ['VDD', 'GND', 'SWDIO', 'SWCLK'],
  'HEADER': ['1', '2'],
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

  // Strict Passive Isolation (Prevents C1/R1/SW1/XTAL from adopting IC pins)
  if (/^C\d+:/i.test(name) || name.includes('CAPACITOR') || name.includes('CAP') || /^R\d+:/i.test(name) || name.includes('RESISTOR')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }
  if (/^SW\d+:/i.test(name) || name.includes('SWITCH') || name.includes('TACTILE')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }
  if (/^XTAL\d+:/i.test(name) || name.includes('CRYSTAL') || name.includes('OSCILLATOR')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }

  for (const [key, pins] of Object.entries(COMPONENT_LIBRARY)) {
    if (name.includes(key)) {
      return pins.map((p) => ({ id: p, label: p }));
    }
  }

  return [{ id: 'VCC', label: 'VCC' }, { id: 'GND', label: 'GND' }, { id: '1', label: '1' }, { id: '2', label: '2' }];
}