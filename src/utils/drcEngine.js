// src/utils/drcEngine.js

export function runDRCCheck(nodes, edges) {
  if (!nodes || nodes.length === 0) return [];

  const errors = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  edges.forEach((edge, index) => {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);

    if (!srcNode || !tgtNode) return;

    // Get clean pin names
    const srcPin = (edge.sourceHandle || '').replace(/_(in|out)$/, '').toUpperCase();
    const tgtPin = (edge.targetHandle || '').replace(/_(in|out)$/, '').toUpperCase();

    const srcLabel = (srcNode.data?.label || srcNode.id).toUpperCase();
    const tgtLabel = (tgtNode.data?.label || tgtNode.id).toUpperCase();

    // Helper classification
    const isPower = (label, pin) => pin.includes('VCC') || pin.includes('VDD') || pin.includes('3V3') || pin.includes('5V') || pin.includes('VIN');
    const isGround = (label, pin) => pin.includes('GND') || pin.includes('VSS');
    const isDataOrTxRx = (label, pin) => pin.includes('TX') || pin.includes('RX') || pin.includes('SDA') || pin.includes('SCL') || pin.includes('D+') || pin.includes('D-');

    // 🔴 RULE 1: Short circuit (Power to Ground)
    if ((isPower(srcLabel, srcPin) && isGround(tgtLabel, tgtPin)) || (isGround(srcLabel, srcPin) && isPower(tgtLabel, tgtPin))) {
      errors.push({
        id: `drc_short_${edge.id || index}`,
        severity: 'error',
        message: `🔴 DRC SHORT CIRCUIT: Power rail (${srcPin}) shorted to Ground (${tgtPin}) between ${srcNode.id.toUpperCase()} and ${tgtNode.id.toUpperCase()}!`
      });
    }

    // 🔴 RULE 2: UART/I2C Data line crossed into a Capacitor or Power rail
    const isCapacitor = label => label.includes('CAPACITOR') || label.includes('C1') || label.includes('C2');
    if ((isDataOrTxRx(srcLabel, srcPin) && isCapacitor(tgtLabel)) || (isDataOrTxRx(tgtLabel, tgtPin) && isCapacitor(srcLabel))) {
      errors.push({
        id: `drc_data_cap_${edge.id || index}`,
        severity: 'error',
        message: `🔴 DRC TOPOLOGY ERROR: Communication/Data line (${srcPin}) cannot be wired directly into a Capacitor terminal on ${tgtNode.id.toUpperCase()}!`
      });
    }
  });

  return errors;
}