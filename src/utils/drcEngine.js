// src/utils/drcEngine.js

export function runDRCCheck(nodes, edges) {
  if (!nodes || nodes.length === 0) return [];

  const errors = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Track connections per node & pin for isolation/floating analysis
  const connectedPins = new Set();
  const netLabels = new Set();

  edges.forEach((edge, index) => {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);

    if (!srcNode || !tgtNode) return;

    // Normalize pins and labels
    const srcPin = (edge.sourceHandle || '').replace(/_(in|out)$/, '').toUpperCase();
    const tgtPin = (edge.targetHandle || '').replace(/_(in|out)$/, '').toUpperCase();

    const srcLabel = (srcNode.data?.label || srcNode.id).toUpperCase();
    const tgtLabel = (tgtNode.data?.label || tgtNode.id).toUpperCase();

    connectedPins.add(`${srcNode.id}:${srcPin}`);
    connectedPins.add(`${tgtNode.id}:${tgtPin}`);
    
    if (edge.label) netLabels.add(edge.label.toUpperCase());

    // Helper classification checks
    const isPower = pin => ['VCC', 'VDD', '3V3', '5V', '12V', 'VIN', 'VBUS', 'VBAT', '+'].some(k => pin.includes(k));
    const isGround = pin => ['GND', 'VSS', 'AGND', 'DGND', '-'].some(k => pin.includes(k));
    const isDataBus = pin => ['TX', 'RX', 'SDA', 'SCL', 'MOSI', 'MISO', 'SCK', 'D+', 'D-'].some(k => pin.includes(k));
    
    const isCapacitor = label => label.includes('CAPACITOR') || /^C\d+/i.test(label);
    const isResistor = label => label.includes('RESISTOR') || /^R\d+/i.test(label);
    const isLed = label => label.includes('LED') || /^LED\d+/i.test(label);
    const isMcu = label => label.includes('ESP') || label.includes('STM32') || label.includes('ATMEGA') || label.includes('MCU') || label.includes('CPU');

    // 🔴 RULE 1: Short Circuit (Power tied directly to Ground)
    if ((isPower(srcPin) && isGround(tgtPin)) || (isGround(srcPin) && isPower(tgtPin))) {
      errors.push({
        id: `drc_short_${edge.id || index}`,
        severity: 'error',
        message: `🔴 DRC SHORT CIRCUIT: Power rail pin (${srcPin}) directly shorted to Ground pin (${tgtPin}) between ${srcNode.id.toUpperCase()} and ${tgtNode.id.toUpperCase()}!`
      });
    }

    // 🔴 RULE 2: Data/Communication Line Crossed into Capacitor Terminal
    if ((isDataBus(srcPin) && isCapacitor(tgtLabel)) || (isDataBus(tgtPin) && isCapacitor(srcLabel))) {
      errors.push({
        id: `drc_data_cap_${edge.id || index}`,
        severity: 'error',
        message: `🔴 DRC TOPOLOGY ERROR: Communication bus line cannot be terminated directly into a filter Capacitor on node ${tgtNode.id.toUpperCase()}!`
      });
    }

    // ⚠️ RULE 3: LED Protection Warning (Direct power without current-limiting series resistor)
    if ((isLed(srcLabel) && isPower(tgtPin)) || (isLed(tgtLabel) && isPower(srcPin))) {
      errors.push({
        id: `drc_led_direct_${edge.id || index}`,
        severity: 'warning',
        message: `⚠️ DRC COMPONENT WARNING: LED on ${isLed(srcLabel) ? srcNode.id : tgtNode.id} is connected directly to power without an intermediate current-limiting resistor.`
      });
    }
  });

  // 🧠 PASS 2: Global Board Topology & System Health Rules
  
  // Check A: Microcontroller Decoupling Verification
  const mcuNodes = nodes.filter(n => {
    const l = (n.data?.label || '').toUpperCase();
    return l.includes('ESP') || l.includes('STM32') || l.includes('ATMEGA') || l.includes('MCU');
  });

  const hasCapacitorNode = nodes.some(n => {
    const l = (n.data?.label || '').toUpperCase();
    return l.includes('CAPACITOR') || /^C\d+/i.test(l);
  });

  if (mcuNodes.length > 0 && !hasCapacitorNode) {
    errors.push({
      id: 'drc_global_decoupling',
      severity: 'error',
      message: `🔴 DRC POWER INTEGRITY: Microcontroller architecture lacks local decoupling capacitors (100nF) for high-frequency noise filtration.`
    });
  }

  // Check B: I2C Communication Bus Pull-Up Check
  const hasI2CNet = Array.from(netLabels).some(n => n.includes('SDA') || n.includes('SCL'));
  const hasResistorNode = nodes.some(n => {
    const l = (n.data?.label || '').toUpperCase();
    return l.includes('RESISTOR') || /^R\d+/i.test(l);
  });

  if (hasI2CNet && !hasResistorNode) {
    errors.push({
      id: 'drc_global_i2c_pullup',
      severity: 'warning',
      message: `⚠️ DRC PROTOCOL WARNING: I2C bus detected on canvas without pull-up resistors (recommended 4.7kΩ to 3V3).`
    });
  }

  // Check C: Floating / Unconnected Pins (Orphan Check)
  nodes.forEach(node => {
    const pins = node.data?.pins || [];
    const label = (node.data?.label || node.id).toUpperCase();
    
    // Skip passive generic components for orphan checks
    if (label.includes('RESISTOR') || label.includes('CAPACITOR')) return;

    pins.forEach(pin => {
      const pinId = String(pin.id || pin).toUpperCase();
      const pinKey = `${node.id}:${pinId}`;
      const isConnected = connectedPins.has(pinKey);

      if (!isConnected && !pinId.includes('NC') && !pinId.includes('RESERVED')) {
        errors.push({
          id: `drc_orphan_${node.id}_${pinId}`,
          severity: 'warning',
          message: `⚠️ FLOATING PIN: Pin [${pinId}] on component ${node.id.toUpperCase()} (${label}) is unrouted / floating.`
        });
      }
    });
  });

  return errors;
}