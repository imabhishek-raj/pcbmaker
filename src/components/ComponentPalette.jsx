// src/components/ComponentPalette.jsx
import React, { useState } from 'react';

const EXTENDED_CATALOG = [
  // MICROCONTROLLERS & SOCs
  { id: 'mcu_esp32_s3', type: 'MCU', name: 'ESP32-S3-WROOM-1', category: 'Microcontrollers', pins: ['3V3', 'GND', 'IO1', 'IO2', 'IO3', 'IO4', 'TX', 'RX'] },
  { id: 'mcu_esp32_c3', type: 'MCU', name: 'ESP32-C3-Mini-1', category: 'Microcontrollers', pins: ['3V3', 'GND', 'IO0', 'IO1', 'IO8', 'IO9'] },
  { id: 'mcu_stm32f103', type: 'MCU', name: 'STM32F103C8T6 (BluePill)', category: 'Microcontrollers', pins: ['3V3', 'GND', 'PA0', 'PA1', 'PB0', 'PB1', 'NRST'] },
  { id: 'mcu_rp2040', type: 'MCU', name: 'Raspberry Pi RP2040', category: 'Microcontrollers', pins: ['3V3', 'GND', 'GP0', 'GP1', 'GP2', 'GP3'] },
  { id: 'mcu_atmega328', type: 'MCU', name: 'ATmega328P-PU', category: 'Microcontrollers', pins: ['VCC', 'GND', 'PB0', 'PB1', 'PD0', 'PD1', 'RESET'] },

  // POWER MANAGEMENT & BATTERY CHARGERS
  { id: 'pwr_bat_3v7', type: 'PWR', name: '3.7V Li-ion 2000mAh', category: 'Power', pins: ['+', '-'] },
  { id: 'pwr_tp4056', type: 'PWR', name: 'TP4056 Battery Charger', category: 'Power', pins: ['IN+', 'IN-', 'BAT+', 'BAT-', 'OUT+', 'OUT-'] },
  { id: 'pwr_ams1117_3v3', type: 'PWR', name: 'AMS1117-3.3V LDO Regulator', category: 'Power', pins: ['VIN', 'VOUT', 'GND'] },
  { id: 'pwr_lm7805', type: 'PWR', name: 'LM7805 5V Regulator', category: 'Power', pins: ['INPUT', 'OUTPUT', 'GND'] },
  { id: 'pwr_mt3608', type: 'PWR', name: 'MT3608 Step-Up Boost Convert', category: 'Power', pins: ['VIN+', 'VIN-', 'VOUT+', 'VOUT-'] },
  { id: 'pwr_buck_lm2596', type: 'PWR', name: 'LM2596 Step-Down Buck', category: 'Power', pins: ['IN+', 'IN-', 'OUT+', 'OUT-'] },

  // TRANSISTORS & SWITCHING
  { id: 'fet_ao3400', type: 'SW', name: 'AO3400 N-Channel MOSFET', category: 'Switches & Relays', pins: ['GATE', 'DRAIN', 'SOURCE'] },
  { id: 'fet_irfz44n', type: 'SW', name: 'IRFZ44N Power MOSFET', category: 'Switches & Relays', pins: ['GATE', 'DRAIN', 'SOURCE'] },
  { id: 'relay_5v_module', type: 'SW', name: '5V Single Relay Module', category: 'Switches & Relays', pins: ['VCC', 'GND', 'IN', 'NO', 'COM', 'NC'] },
  { id: 'sw_spst_slide', type: 'SW', name: 'SPST Slide Switch', category: 'Switches & Relays', pins: ['1', '2'] },
  { id: 'sw_tactile_btn', type: 'SW', name: 'Tactile Push Button', category: 'Switches & Relays', pins: ['1', '2'] },

  // PASSIVES (RESISTORS, CAPACITORS, INDUCTORS)
  { id: 'pass_res_10k', type: 'PASS', name: '10kΩ Resistor (0805)', category: 'Passives', pins: ['1', '2'] },
  { id: 'pass_res_220r', type: 'PASS', name: '220Ω Resistor (0805)', category: 'Passives', pins: ['1', '2'] },
  { id: 'pass_cap_100nf', type: 'PASS', name: '100nF Ceramic Capacitor', category: 'Passives', pins: ['1', '2'] },
  { id: 'pass_cap_100uf', type: 'PASS', name: '100µF Electrolytic Cap', category: 'Passives', pins: ['+', '-'] },

  // SENSORS & MODULES
  { id: 'sen_mpu6050', type: 'SENS', name: 'MPU6050 Accelerometer/Gyro', category: 'Sensors', pins: ['VCC', 'GND', 'SCL', 'SDA', 'INT'] },
  { id: 'sen_dht11', type: 'SENS', name: 'DHT11 Temp & Humidity', category: 'Sensors', pins: ['VCC', 'DATA', 'NC', 'GND'] },
  { id: 'sen_ultrasonic', type: 'SENS', name: 'HC-SR04 Ultrasonic Sensor', category: 'Sensors', pins: ['VCC', 'TRIG', 'ECHO', 'GND'] },

  // OPTOELECTRONICS & DISPLAYS
  { id: 'opt_led_red', type: 'OPT', name: 'Standard Red LED 5mm', category: 'Optoelectronics', pins: ['ANODE', 'CATHODE'] },
  { id: 'opt_oled_i2c', type: 'OPT', name: '0.96" OLED Display (I2C)', category: 'Optoelectronics', pins: ['VCC', 'GND', 'SCL', 'SDA'] },

  // CONNECTORS & INTERFACES
  { id: 'conn_usbc', type: 'CONN', name: 'USB-C Female Receptacle', category: 'Connectors', pins: ['VBUS', 'GND', 'CC1', 'CC2', 'D+', 'D-'] },
  { id: 'conn_header_4p', type: 'CONN', name: '4-Pin Male Header', category: 'Connectors', pins: ['1', '2', '3', '4'] }
];

const CATEGORIES = ['All', 'Microcontrollers', 'Power', 'Passives', 'Sensors', 'Switches & Relays', 'Optoelectronics', 'Connectors'];

export default function ComponentPalette({ isOpen, onToggle, onAddComponent }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredItems = EXTENDED_CATALOG.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleDragStart = (event, item) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{ borderBottom: '1px solid #27272a', backgroundColor: '#141417' }}>
      
      {/* TOGGLE BUTTON HEADER */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '10px 12px',
          backgroundColor: isOpen ? '#18181b' : '#141417',
          color: '#22d3ee',
          border: 'none',
          borderBottom: isOpen ? '1px solid #27272a' : 'none',
          textAlign: 'left',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          fontFamily: 'monospace'
        }}
      >
        <span>🧩 Component Toolbox {isOpen ? '(Active)' : ''}</span>
        <span style={{ fontSize: '10px', backgroundColor: '#27272a', padding: '2px 8px', borderRadius: '4px', color: '#a1a1aa' }}>
          {isOpen ? '▲ Hide Library' : '▼ Open Library'}
        </span>
      </button>

      {/* COLLAPSIBLE PALETTE BODY */}
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '280px', paddingBottom: '10px' }}>
          
          {/* SEARCH BAR */}
          <div style={{ padding: '8px 12px 6px 12px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search ESP32, USB-C, MOSFET, OLED..."
              style={{
                width: '100%',
                backgroundColor: '#09090b',
                border: '1px solid #27272a',
                fontSize: '11px',
                padding: '6px 10px',
                borderRadius: '4px',
                color: '#f4f4f5',
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* CATEGORY TABS */}
          <div style={{ display: 'flex', gap: '4px', padding: '0 12px 6px 12px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  backgroundColor: selectedCategory === cat ? '#0891b2' : '#18181b',
                  color: selectedCategory === cat ? '#ffffff' : '#a1a1aa',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: selectedCategory === cat ? 'bold' : 'normal'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* GRID */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => onAddComponent(item)}
                  style={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    fontSize: '10px',
                    color: '#f4f4f5',
                    cursor: 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#22d3ee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '9px', color: '#71717a', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.type}</span>
                    <span>{item.pins.length} Pins</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: 'span 2', color: '#71717a', fontSize: '11px', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                No components found. Try another search term!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}