// src/utils/drcEngine.js

const arePinsCompatible = (p1 = '', p2 = '') => {
  const a = String(p1).toUpperCase();
  const b = String(p2).toUpperCase();

  if (a === b) return true;
  if ((a.includes('TX') && b.includes('RX')) || (a.includes('RX') && b.includes('TX'))) return true;
  if ((a.includes('OUT') || a.includes('3V3') || a.includes('VCC') || a.includes('VDD') || a.includes('AVCC') || a.includes('IN') || a === '+') && 
      (b.includes('OUT') || b.includes('3V3') || b.includes('VCC') || b.includes('VDD') || b.includes('AVCC') || b.includes('IN') || b === '+')) return true;
  if ((a.includes('GND') || a.includes('VSS') || a === '-') && (b.includes('GND') || b.includes('VSS') || b === '-')) return true;
  return false;
};

export function runDRCCheck(nodes, edges) {
  if (!nodes || nodes.length === 0) return [];

  const errors = [];
  const connectedHandles = new Set();

  // Track all connected pins across edges
  edges.forEach((edge) => {
    if (edge.source && edge.sourceHandle) {
      const cleanSource = edge.sourceHandle.replace(/_(in|out)$/, '');
      connectedHandles.add(`${edge.source}:${cleanSource}`);
    }
    if (edge.target && edge.targetHandle) {
      const cleanTarget = edge.targetHandle.replace(/_(in|out)$/, '');
      connectedHandles.add(`${edge.target}:${cleanTarget}`);
    }
  });

  nodes.forEach((node) => {
    const pins = node.data?.pins || [];
    const nodeLabel = (node.data?.label || node.id).toUpperCase();

    // Determine if component is passive or discrete switch (MOSFETs, Switches, Resistors, LEDs, Fuses)
    const isPassiveOrDiscrete = 
      nodeLabel.includes('RESISTOR') || /^R\d+/i.test(node.id) ||
      nodeLabel.includes('CAPACITOR') || /^C\d+/i.test(node.id) ||
      nodeLabel.includes('SWITCH') || /^SW\d+/i.test(node.id) ||
      nodeLabel.includes('LED') || nodeLabel.includes('DIODE') || /^D\d+/i.test(node.id) ||
      nodeLabel.includes('MOSFET') || /^MOS\d+/i.test(node.id) || /^Q\d+/i.test(node.id) ||
      nodeLabel.includes('FUSE') || /^F\d+/i.test(node.id) ||
      nodeLabel.includes('XTAL') || nodeLabel.includes('CRYSTAL') || /^X\d+/i.test(node.id);

    let connectedPinCount = 0;
    let hasActivePower = false;

    pins.forEach((pin) => {
      const pinId = String(typeof pin === 'string' ? pin : (pin.id || pin.label));
      const handleKey = `${node.id}:${pinId}`;

      let isConnected = connectedHandles.has(handleKey);

      if (!isConnected) {
        for (const connKey of connectedHandles) {
          if (connKey.startsWith(`${node.id}:`)) {
            const connPin = connKey.split(':')[1];
            if (arePinsCompatible(connPin, pinId)) {
              isConnected = true;
              break;
            }
          }
        }
      }

      if (isConnected) {
        connectedPinCount++;
      }

      const upperPin = pinId.toUpperCase();
      const isPowerOrGnd = upperPin.includes('VCC') || upperPin.includes('3V3') || upperPin.includes('VDD') || 
                            upperPin.includes('AVCC') || upperPin.includes('GND') || upperPin.includes('VSS') || 
                            upperPin.includes('IN') || upperPin.includes('OUT') || upperPin === '+' || upperPin === '-';

      if (isConnected && isPowerOrGnd) {
        hasActivePower = true;
      }

      // Optional / GPIO / Debug / Test Pin Exemption List
      const isOptionalPin = upperPin.includes('TD') || upperPin.includes('NC') ||
                            upperPin.includes('SDA') || upperPin.includes('SCL') || upperPin.includes('IO') || 
                            upperPin.includes('TX') || upperPin.includes('RX') || upperPin.includes('EN') || 
                            upperPin.includes('NRST') || upperPin.includes('RESET') || upperPin.includes('XTAL') || 
                            upperPin.includes('D+') || upperPin.includes('D-') || upperPin.includes('INT') ||
                            upperPin.includes('SWD') || upperPin.includes('SWC') || upperPin.includes('CLK') ||
                            upperPin.includes('BUS');

      if (!isConnected && !isOptionalPin && !isPassiveOrDiscrete) {
        errors.push({
          id: `floating_${node.id}_${pinId}`,
          severity: 'warning',
          message: `${node.id.toUpperCase()}: ${node.data?.label || ''} → Pin "${pinId}" is floating (unconnected).`
        });
      }
    });

    // PASSIVE RULE: Passives / MOSFETs are valid as long as at least 1 pin is wired into the net trace
    if (isPassiveOrDiscrete) {
      if (connectedPinCount > 0) {
        hasActivePower = true;
      }
    }

    // ACTIVE IC RULE: Active ICs must have power rail connections
    if (!hasActivePower && pins.length > 0) {
      errors.push({
        id: `nopower_${node.id}`,
        severity: 'error',
        message: `${node.id.toUpperCase()}: ${node.data?.label || ''} has no active power connections!`
      });
    }
  });

  return errors;
}