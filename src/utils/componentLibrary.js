// src/utils/componentLibrary.js

export const COMPONENT_LIBRARY = {
  // -----------------------------------------------------------------
  // 1. AUDIO AMPLIFIERS & SOUND DRIVERS
  // -----------------------------------------------------------------
  'TPA3116D2': ['VCC', 'GND', 'INPL', 'INNL', 'OUTPL', 'OUTNL', 'INPR', 'INNR', 'OUTPR', 'OUTNR', 'AM0', 'AM1', 'FAULT'],
  'TPA3116': ['VCC', 'GND', 'INPL', 'INNL', 'OUTPL', 'OUTNL', 'INPR', 'INNR'],
  'PAM8403': ['VDD', 'GND', 'L_IN', 'R_IN', 'OUT_L+', 'OUT_L-', 'OUT_R+', 'OUT_R-', 'MUTE', 'SW'],
  'LM386': ['GAIN1', 'GAIN8', 'IN-', 'IN+', 'GND', 'VCC', 'BYPASS', 'OUT'],
  'MAX98357A': ['VIN', 'GND', 'SD_MODE', 'GAIN', 'DIN', 'BCLK', 'LRCLK', 'OUT+', 'OUT-'],
  'TDA2030A': ['IN+', 'IN-', 'VSS', 'OUTPUT', 'VDD'],
  'TDA2030': ['IN+', 'IN-', 'VSS', 'OUTPUT', 'VDD'],

  // -----------------------------------------------------------------
  // 2. MICROCONTROLLERS & SOC CORES
  // -----------------------------------------------------------------
  'ESP32-S3': ['3V3', 'GND', 'EN', 'TX', 'RX', 'IO0', 'IO1', 'SDA', 'SCL', 'D+', 'D-'],
  'ESP32-WROOM': ['3V3', 'GND', 'EN', 'TX', 'RX', 'IO0', 'IO2', 'IO4', 'IO12', 'IO13', 'IO14', 'IO15', 'IO21', 'IO22', 'IO23'],
  'ESP32': ['3V3', 'GND', 'EN', 'TX', 'RX', 'SDA', 'SCL', 'IO4', 'IO2', 'VP', 'VN'],
  'ESP8266': ['3V3', 'GND', 'EN', 'TX', 'RX', 'RST', 'IO0', 'IO15', 'IO2'],
  'ATMEGA328P': ['VCC', 'GND', 'RESET', 'XTAL1', 'XTAL2', 'PD0_RX', 'PD1_TX', 'PB0', 'PB1', 'ADC0'],
  'ATMEGA': ['VCC', 'GND', 'RESET', 'XTAL1', 'XTAL2', 'PD0_RX', 'PD1_TX'],
  'STM32H743XI': ['VDD', 'VSS', 'NRST', 'PA9_TX', 'PA10_RX', 'PB6_SCL', 'PB7_SDA', 'BOOT0'],
  'STM32F103': ['VDD', 'VSS', 'NRST', 'PA9_TX', 'PA10_RX', 'PB6_SCL', 'PB7_SDA', 'SWDIO', 'SWCLK'],
  'STM32': ['VDD', 'VSS', 'NRST', 'TX', 'RX', 'SDA', 'SCL'],
  'RP2040': ['IOVDD', 'GND', 'RUN', 'QSPI_SS', 'GPIO0_TX', 'GPIO1_RX', 'GPIO2_SDA', 'GPIO3_SCL', 'SWCLK', 'SWDIO'],
  'ATTINY85': ['VCC', 'GND', 'PB0', 'PB1', 'PB2', 'RESET'],
  'AVR': ['VCC', 'GND', 'RESET', 'XTAL1', 'XTAL2', 'PD0_RX', 'PD1_TX'],
  'MCU': ['3V3', 'GND', 'EN', 'TX', 'RX', 'SDA', 'SCL'],

  // -----------------------------------------------------------------
  // 3. POWER REGULATORS, BUCK/BOOST & CONVERTERS
  // -----------------------------------------------------------------
  'AMS1117-3.3': ['IN', 'OUT', 'GND'],
  'AMS1117-5.0': ['IN', 'OUT', 'GND'],
  'AMS1117': ['IN', 'OUT', 'GND'],
  'AP2112K': ['IN', 'GND', 'EN', 'NC', 'OUT'],
  'AP2112': ['IN', 'OUT', 'GND'],
  'LM2596': ['VIN', 'OUTPUT', 'GND', 'FEEDBACK', 'ON_OFF'],
  'XL6009': ['IN+', 'IN-', 'OUT+', 'OUT-'],
  'MT3608': ['VIN', 'GND', 'EN', 'FB', 'SW'],
  'MP2307': ['IN', 'SW', 'GND', 'FB', 'EN', 'COMP'],
  'TP4056': ['VIN+', 'GND', 'BAT+', 'BAT-', 'TEMP', 'CE', 'STDBY', 'CHRG'],
  'REGULATOR': ['IN', 'OUT', 'GND'],
  'LDO': ['IN', 'OUT', 'GND'],

  // -----------------------------------------------------------------
  // 4. BMS & BATTERY PROTECTION
  // -----------------------------------------------------------------
  'DW01A': ['VCC', 'GND', 'CS', 'OD', 'OC', 'TD'],
  'DW01': ['VCC', 'GND', 'CS', 'OD', 'OC', 'TD'],
  'AO8810': ['G1', 'S1', 'D1', 'G2', 'S2', 'D2'],
  'BQ76930': ['BAT', 'VC1', 'VC2', 'SDA', 'SCL', 'CHG', 'DSG', 'VSS'],
  'MAX17043': ['VDD', 'GND', 'SDA', 'SCL', 'CELL', 'ALT'],
  'CELL': ['+', '-'],
  'BAT': ['+', '-'],
  'LIPO': ['+', '-'],
  'LI-ION': ['+', '-'],

  // -----------------------------------------------------------------
  // 5. MOTOR DRIVERS & H-BRIDGES
  // -----------------------------------------------------------------
  'L298N': ['VS', 'GND', 'VSS', 'IN1', 'IN2', 'IN3', 'IN4', 'ENA', 'ENB', 'OUT1', 'OUT2', 'OUT3', 'OUT4'],
  'L293D': ['VCC1', 'VCC2', 'GND', 'IN1', 'IN2', 'IN3', 'IN4', 'EN1', 'EN2', 'OUT1', 'OUT2', 'OUT3', 'OUT4'],
  'DRV8825': ['VMOT', 'GND', 'DIR', 'STEP', 'SLEEP', 'RESET', 'MS1', 'MS2', 'MS3', 'A1', 'A2', 'B1', 'B2'],
  'A4988': ['VDD', 'GND', 'VMOT', 'DIR', 'STEP', 'SLEEP', 'RESET', 'MS1', 'MS2', 'MS3', '1A', '1B', '2A', '2B'],
  'TB6612FNG': ['VM', 'VCC', 'GND', 'AIN1', 'AIN2', 'BIN1', 'AIN2', 'PWMA', 'PWMB', 'STBY', 'A01', 'A02', 'B01', 'B02'],

  // -----------------------------------------------------------------
  // 6. USB BRIDGES & CONNECTORS
  // -----------------------------------------------------------------
  'CP2102': ['VBUS', 'VDD', 'GND', 'TXD', 'RXD', 'D+', 'D-'],
  'CH340G': ['VCC', 'GND', 'TXD', 'RXD', 'UD+', 'UD-', 'XI', 'XO'],
  'CH340': ['VCC', 'GND', 'TXD', 'RXD', 'UD+', 'UD-'],
  'USB-C': ['VBUS', 'GND', 'CC1', 'CC2', 'D+', 'D-'],
  'USB': ['VBUS', 'GND', 'D+', 'D-'],
  'DC JACK': ['1', '2'],
  'SPEAKER': ['1', '2'],

  // -----------------------------------------------------------------
  // 7. OP-AMPS & COMPARATORS
  // -----------------------------------------------------------------
  'LM358': ['OUT1', 'IN1-', 'IN1+', 'GND', 'IN2+', 'IN2-', 'OUT2', 'VCC'],
  'TL072': ['OUT1', 'IN1-', 'IN1+', 'V-', 'IN2+', 'IN2-', 'OUT2', 'V+'],
  'NE555': ['GND', 'TRIG', 'OUT', 'RESET', 'CONTROL', 'THRESH', 'DISCH', 'VCC'],
  'LM393': ['OUT1', 'IN1-', 'IN1+', 'GND', 'IN2+', 'IN2-', 'OUT2', 'VCC'],

  // -----------------------------------------------------------------
  // 8. DISPLAY DRIVERS & MODULES
  // -----------------------------------------------------------------
  'SSD1306': ['VCC', 'GND', 'SCL', 'SDA'],
  'ST7789': ['VCC', 'GND', 'SCL', 'SDA', 'RES', 'DC', 'CS', 'BLK'],
  'LCD1602': ['VSS', 'VDD', 'V0', 'RS', 'RW', 'E', 'D4', 'D5', 'D6', 'D7', 'A', 'K'],

  // -----------------------------------------------------------------
  // 9. SENSORS & IMUS
  // -----------------------------------------------------------------
  'MPU-6050': ['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT'],
  'MPU6050': ['VCC', 'GND', 'SCL', 'SDA', 'INT'],
  'MPU': ['VCC', 'GND', 'SDA', 'SCL', 'INT'],
  'BME280': ['VIN', 'GND', 'SCL', 'SDA', 'CSB', 'SDO'],
  'DHT11': ['VCC', 'DATA', 'NC', 'GND'],
  'DHT22': ['VCC', 'DATA', 'NC', 'GND'],
  'INA219': ['VCC', 'GND', 'SCL', 'SDA', 'VIN+', 'VIN-'],
  'ADS1115': ['VDD', 'GND', 'SCL', 'SDA', 'ADDR', 'ALRT', 'A0', 'A1', 'A2', 'A3'],

  // -----------------------------------------------------------------
  // 10. TRANSISTORS, PASSIVES & MISC
  // -----------------------------------------------------------------
  'CSD17313': ['DRAIN', 'GATE', 'SOURCE'],
  'MOSFET': ['DRAIN', 'GATE', 'SOURCE'],
  'FET': ['DRAIN', 'GATE', 'SOURCE'],
  'XTAL': ['1', '2'],
  'CRYSTAL': ['1', '2'],
  'LED': ['ANODE', 'CATHODE'],
  'DIODE': ['ANODE', 'CATHODE'],
  '1N4007': ['ANODE', 'CATHODE'],
  'SWITCH': ['1', '2'],
  'SW': ['1', '2'],
  'RESISTOR': ['1', '2'],
  'CAPACITOR': ['1', '2'],
  'INDUCTOR': ['1', '2']
};

export function getComponentPins(compName = '') {
  const name = compName.toUpperCase().trim();

  // 🛡️ ABSOLUTE PRIORITY: Passives MUST have strictly 2 pins (1 and 2)
  if (/^R\d+/i.test(name) || name.includes('RESISTOR') || name.includes('RES')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }
  if (/^C\d+/i.test(name) || name.includes('CAPACITOR') || name.includes('CAP')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }
  if (/^L\d+/i.test(name) || name.includes('INDUCTOR')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }

  // Diodes
  if (/^D\d+/i.test(name) || name.includes('DIODE') || name.includes('1N4007')) {
    return [{ id: '1', label: 'ANODE' }, { id: '2', label: 'CATHODE' }];
  }

  // Switches & Crystals
  if (/^SW\d+/i.test(name) || name.includes('SWITCH') || name.includes('TACTILE')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }
  if (/^XTAL\d+/i.test(name) || name.includes('CRYSTAL') || name.includes('OSCILLATOR')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }

  // LEDs & Indicators
  if (/^LED\d+/i.test(name) || name.includes('INDICATOR') || name.includes('LED')) {
    return [{ id: 'ANODE', label: 'ANODE' }, { id: 'CATHODE', label: 'CATHODE' }];
  }

  // Connectors / Jacks / Terminals
  if (/^J\d+/i.test(name) || /^PWR\d+/i.test(name) || name.includes('AUDIO') || name.includes('SPEAKER') || name.includes('JACK') || name.includes('CONNECTOR') || name.includes('TERMINAL')) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }

  // IC Key Match Lookup from COMPONENT_LIBRARY
  for (const [key, pins] of Object.entries(COMPONENT_LIBRARY)) {
    if (name.includes(key)) {
      return pins.map((p) => ({ id: p, label: p }));
    }
  }

  // Fallback for unidentified active ICs only
  return [{ id: 'VCC', label: 'VCC' }, { id: 'GND', label: 'GND' }, { id: '1', label: '1' }, { id: '2', label: '2' }];
}