// src/utils/drcEngine.js

const arePinsCompatible = (p1 = '', p2 = '') => {
  const a = String(p1).toUpperCase();
  const b = String(p2).toUpperCase();

  if (a === b) return true;
  if ((a.includes('TX') && b.includes('RX')) || (a.includes('RX') && b.includes('TX'))) return true;
  if ((a.includes('OUT') || a.includes('3V3') || a.includes('VCC') || a.includes('IN')) && 
      (b.includes('OUT') || b.includes('3V3') || b.includes('VCC') || b.includes('IN'))) return true;
  if ((a.includes('GND') || a.includes('VSS') || a === '-') && (b.includes('GND') || b.includes('VSS') || b === '-')) return true;
  return false;
};

export function runDRCCheck(nodes, edges) {
  if (!nodes || nodes.length === 0) return [];

  const errors = [];
  const connectedHandles = new Set();

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
    let hasActiveConnection = false;

    pins.forEach((pin) => {
      const pinId = String(typeof pin === 'string' ? pin : (pin.id || pin.label));
      const handleKey = `${node.id}:${pinId}`;

      // Check direct or alias connection
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

      // Ignore optional/unconnected expansion GPIOs or USB differential lines in DRC checks
      const upperPin = pinId.toUpperCase();
      const isOptionalPin = upperPin.includes('SDA') || upperPin.includes('SCL') || upperPin.includes('IO') || upperPin.includes('D+') || upperPin.includes('D-');

      if (isConnected) {
        hasActiveConnection = true;
      } else if (!isOptionalPin) {
        errors.push({
          id: `floating_${node.id}_${pinId}`,
          severity: 'warning',
          message: `${node.id.toUpperCase()}: ${node.data?.label || ''} → Pin "${pinId}" is floating (unconnected).`
        });
      }
    });

    if (!hasActiveConnection && pins.length > 0) {
      errors.push({
        id: `nopower_${node.id}`,
        severity: 'error',
        message: `${node.id.toUpperCase()}: ${node.data?.label || ''} has no active power connections!`
      });
    }
  });

  return errors;
}