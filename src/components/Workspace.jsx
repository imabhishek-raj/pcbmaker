// src/components/Workspace.jsx
import React, { useState, useCallback, useEffect, Component } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useBoardStore } from '../store/useBoardStore';
import ICNode from './ICNode';
import ComponentPalette from './ComponentPalette';
import { runDRCCheck } from '../utils/drcEngine';
import { generatePcbFromAmplify } from '../utils/amplifyApi';
import { getComponentPins } from '../utils/componentLibrary';
import { buildRAGPrompt } from '../utils/promptEnhancer';
import { logTrainingPair, exportFlywheelDataset } from '../utils/dataFlywheel';

const nodeTypes = { icNode: ICNode };

// Simple Error Boundary to catch canvas rendering crashes on mobile touch
class FlowErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("Canvas Error:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#f87171', textAlign: 'center', fontFamily: 'monospace' }}>
          Canvas re-initialized safely. <button onClick={() => this.setState({ hasError: false })} style={{ background: '#00E5FF', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '10px' }}>Reload Canvas</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Dynamic Slogans for Floating Canvas Banner
const HERO_SLOGANS = [
  "Transform Natural Language into KiCad Schematics in Seconds...",
  "Zero Floating Pins with Real-Time DRC Rule Validation...",
  "Synthesize Audio Amps, BMS Protection, and MCU Nodes Instantaneously...",
  "Democratizing Electronics Prototyping for Hardware Creators..."
];

// Typewriter Component for Smooth Animated Text on Hero Overlay
const TypewriterText = ({ texts }) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fullText = texts[currentTextIndex];
    const speed = isDeleting ? 30 : 60;

    const timeout = setTimeout(() => {
      if (!isDeleting && currentText === fullText) {
        setTimeout(() => setIsDeleting(true), 1800);
      } else if (isDeleting && currentText === '') {
        setIsDeleting(false);
        setCurrentTextIndex((prev) => (prev + 1) % texts.length);
      } else {
        setCurrentText(
          fullText.substring(0, currentText.length + (isDeleting ? -1 : 1))
        );
      }
    }, speed);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentTextIndex, texts]);

  return (
    <span style={{ color: '#00E5FF', fontFamily: 'monospace', fontWeight: '600' }}>
      {currentText}
      <span style={{ animation: 'blink 1s infinite', color: '#00E5FF' }}>|</span>
    </span>
  );
};

// Signal Color Engine
const getNetStyle = (srcPin = '', tgtPin = '') => {
  const p = `${srcPin} ${tgtPin}`.toUpperCase();

  if (p.includes('3V3') || p.includes('VCC') || p.includes('VDD') || p.includes('AVCC') || p.includes('VIN') || p.includes('OUT') || p.includes('BAT') || p.includes('VBUS') || p.includes('+')) {
    return { stroke: '#EF4444', strokeWidth: 3 };
  }
  if (p.includes('GND') || p.includes('VSS') || p.includes('CS') || p.includes('-')) {
    return { stroke: '#10B981', strokeWidth: 2.5, strokeDasharray: '4' };
  }
  if (p.includes('SDA') || p.includes('SCL') || p.includes('TX') || p.includes('RX') || p.includes('D+') || p.includes('D-')) {
    return { stroke: '#F59E0B', strokeWidth: 2.5 };
  }
  return { stroke: '#00E5FF', strokeWidth: 2.5 };
};

const arePinsCompatible = (p1 = '', p2 = '') => {
  const a = String(p1).toUpperCase();
  const b = String(p2).toUpperCase();

  if (a === b) return true;
  if ((a.includes('TX') && b.includes('RX')) || (a.includes('RX') && b.includes('TX'))) return true;
  if ((a.includes('OUT') || a.includes('3V3') || a.includes('VCC') || a.includes('VDD') || a.includes('AVCC')) && 
      (b.includes('OUT') || b.includes('3V3') || b.includes('VCC') || b.includes('VDD') || b.includes('AVCC'))) return true;
  if ((a.includes('IN') || a.includes('VBUS') || a.includes('VIN')) && (b.includes('IN') || b.includes('VBUS') || b.includes('VIN'))) return true;
  if ((a.includes('GND') || a.includes('VSS') || a === '-') && (b.includes('GND') || b.includes('VSS') || b === '-')) return true;
  if ((a.includes('RESET') || a.includes('NRST') || a.includes('EN')) && (b.includes('RESET') || b.includes('NRST') || b.includes('EN'))) return true;
  return false;
};

// 🛡️ FIREWALL PIN SANITIZER: Forces passives to strictly have pins 1 and 2, NO VCC/GND
const cleanNodePins = (compName, rawPins) => {
  const name = String(compName || '').toUpperCase();
  
  if (
    name.includes('RESISTOR') || /^R\d+/i.test(name) ||
    name.includes('CAPACITOR') || /^C\d+/i.test(name) ||
    name.includes('INDUCTOR') || /^L\d+/i.test(name)
  ) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }
  if (name.includes('SWITCH') || /^SW\d+/i.test(name)) {
    return [{ id: '1', label: '1' }, { id: '2', label: '2' }];
  }
  if (name.includes('LED') || /^LED\d+/i.test(name)) {
    return [{ id: 'ANODE', label: 'ANODE' }, { id: 'CATHODE', label: 'CATHODE' }];
  }

  if (Array.isArray(rawPins) && rawPins.length > 0) {
    return rawPins.map(p => {
      const pId = typeof p === 'string' ? p : (p.id || p.label);
      return { id: pId, label: pId };
    });
  }

  const libPins = getComponentPins(name);
  return libPins.map(p => ({ id: p.id || p, label: p.label || p }));
};

const optimizePromptSpec = (rawQuery, previousHistory = []) => {
  const baseQuery = rawQuery.split('— Specs:')[0].trim();
  const q = baseQuery.toLowerCase();

  let contextContextStr = '';
  if (previousHistory.length > 0) {
    const cleanHistory = previousHistory
      .filter(m => !m.text.includes('✨ Refined Specs:'))
      .slice(-4)
      .map(m => `${m.sender}: ${m.text.replace(/\[Active Session Context:[\s\S]*?\]/g, '').trim()}`)
      .join(' | ');
    if (cleanHistory) {
      contextContextStr = ` [Active Session Context: ${cleanHistory}]`;
    }
  }

  if (q.includes('4 bit') || q.includes('4-bit') || q.includes('8 bit') || q.includes('8-bit') || q.includes('atmega') || q.includes('avr') || q.includes('cpu')) {
    return `${baseQuery}${contextContextStr} — Specs: Include ATmega328P MCU (MCU1), AMS1117-3.3V Regulator (U1), 16MHz Crystal Oscillator (XTAL1), 10k Reset Resistor (R1), Reset Tactile Switch (SW1), and 100nF Cap (C1). Connect VCC, GND, RESET, XTAL1, and XTAL2.`;
  }
  if (q.includes('32 bit') || q.includes('32-bit') || q.includes('stm32') || q.includes('arm')) {
    return `${baseQuery}${contextContextStr} — Specs: Include STM32H743XI MCU (MCU1), AP2112K-3.3V LDO (U1), 8MHz Crystal (X1), 10k NRST Resistor (R1), 100nF Cap (C1), and 10uF Cap (C2). Connect VDD, VSS, NRST, TX, and RX.`;
  }
  if (q.includes('flight controller') || q.includes('esp 32 mini') || q.includes('itself') || q.includes('bare') || (q.includes('esp') && !q.includes('bms') && !q.includes('led'))) {
    return `${baseQuery}${contextContextStr} — Specs: Include ESP32-S3 MCU (MCU1), MPU-6050 IMU (IMU1 connected via I2C SDA/SCL), AMS1117-3.3V Regulator (REG1), CP2102 USB-UART Bridge (U2), EN Reset Switch (SW1), 100nF Cap (C1), and 10uF Cap (C2). Connect 3V3, GND, TX, RX, EN, SDA, and SCL.`;
  }
  if (q.includes('bms') || q.includes('battery protection') || q.includes('protection circuit')) {
    return `${baseQuery}${contextContextStr} — Specs: Include 3.7V Cell (BAT1), DW01A Protection IC (IC1), AO8810 Dual N-Channel MOSFET (MOS1), 100nF decoupling capacitor (C1), and 1kΩ CS current resistor (R1). Connect VCC, GND, OD, and OC control nets.`;
  }

  return `${baseQuery}${contextContextStr} — Specs: Standard EDA netlist layout with decoupling, verified pin routing, and continuous power/GND return loop.`;
};

const extractJsonFromOutput = (rawResult) => {
  if (typeof rawResult === 'object' && rawResult !== null) return rawResult;
  let text = String(rawResult || '').trim().replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn("JSON parse fallback:", e);
  }

  try { return JSON.parse(text); } catch (e) { return {}; }
};

// UNIVERSAL PIN ROLE DETECTOR
const getPinRole = (pinName, compLabel) => {
  const p = String(pinName || '').toUpperCase();
  const c = String(compLabel || '').toUpperCase();

  if (['VCC', 'VDD', '3V3', '5V', '12V', 'VIN', 'VBUS', 'VBAT', 'VDDA', 'VCC1', 'VCC2'].some(k => p.includes(k))) return 'power_pos';
  if (['GND', 'VSS', 'AGND', 'DGND', 'PGND', 'EP', 'PAD', '-'].some(k => p.includes(k))) return 'power_neg';
  if (['FAULT', 'MUTE', 'SD', 'SHDN', 'EN', 'RESET', 'NRST', 'AM0', 'AM1', 'GAIN', 'MODE', 'CE'].some(k => p.includes(k))) return 'logic_high';
  if (['NC', 'RSVD', 'RESERVED'].some(k => p.includes(k))) return 'no_connect';
  if (c.includes('JACK') || c.includes('CONNECTOR') || c.includes('TERMINAL') || c.includes('HEADER')) {
    return p === '1' ? 'power_pos' : 'power_neg';
  }
  return 'signal';
};

// UNIVERSAL DRC PIN AUTO-PATCHER
const autoPatchFloatingPins = (currentNodes, currentEdges) => {
  const patchedEdges = [...currentEdges];
  const connectedPinKeys = new Set();

  currentEdges.forEach(e => {
    connectedPinKeys.add(`${e.source}:${e.sourceHandle?.replace(/_(in|out)$/, '')}`);
    connectedPinKeys.add(`${e.target}:${e.targetHandle?.replace(/_(in|out)$/, '')}`);
  });

  const powerNode = currentNodes.find(n => {
    const label = (n.data?.label || '').toUpperCase();
    return label.includes('BAT') || label.includes('USB') || label.includes('AMS1117') || label.includes('AP2112') || label.includes('DC') || label.includes('PWR') || label.includes('JACK');
  });

  if (!powerNode) return patchedEdges;

  currentNodes.forEach((node) => {
    const pins = node.data?.pins || [];
    const compLabel = node.data?.label || '';

    pins.forEach((pin) => {
      const pinId = String(pin.id || pin);
      const pinKey = `${node.id}:${pinId}`;

      if (!connectedPinKeys.has(pinKey) && node.id !== powerNode.id) {
        const role = getPinRole(pinId, compLabel);

        if (role === 'power_pos') {
          patchedEdges.push({
            id: `auto_pwr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            source: powerNode.id,
            sourceHandle: 'VCC_out',
            target: node.id,
            targetHandle: `${pinId}_in`,
            type: 'step',
            animated: true,
            style: { stroke: '#EF4444', strokeWidth: 3 },
            label: 'VCC AUTO-RAIL'
          });
          connectedPinKeys.add(pinKey);
        } else if (role === 'power_neg' || role === 'logic_high') {
          patchedEdges.push({
            id: `auto_gnd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            source: node.id,
            sourceHandle: `${pinId}_out`,
            target: powerNode.id,
            targetHandle: 'GND_in',
            type: 'step',
            animated: true,
            style: { stroke: '#10B981', strokeWidth: 2.5, strokeDasharray: '4' },
            label: role === 'logic_high' ? 'PULL-CONFIG' : 'GND RETURN'
          });
          connectedPinKeys.add(pinKey);
        }
      }
    });
  });

  return patchedEdges;
};

export default function Workspace() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [isLeftCopilotOpen, setIsLeftCopilotOpen] = useState(true);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [heroPromptInput, setHeroPromptInput] = useState('');

  const { 
    selectedNode, 
    setSelectedNode, 
    chatMessages, 
    addChatMessage, 
    clearChatHistory, 
    drcErrors, 
    setDrcErrors 
  } = useBoardStore();

  const [inputMsg, setInputMsg] = useState('');

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsRightDrawerOpen(false);
        setIsLeftCopilotOpen(false);
      } else {
        setIsLeftCopilotOpen(true);
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFullReset = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setSelectedEdge(null);
    clearChatHistory();
  };

  useEffect(() => {
    const warnings = runDRCCheck(nodes, edges);
    setDrcErrors(warnings);
  }, [nodes, edges, setDrcErrors]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => {
      const columnYOffsets = { 0: 80, 1: 80, 2: 80, 3: 80 };

      return nds.map((node) => {
        const name = (node.data?.label || '').toUpperCase();
        const pinCount = node.data?.pins?.length || 2;
        const cardHeight = Math.max(140, 60 + pinCount * 26);

        let col = 1;
        if (name.includes('USB') || name.includes('BAT') || name.includes('CELL') || name.includes('3.7V') || name.includes('PWR')) { col = 0; }
        else if (name.includes('AMS1117') || name.includes('AP2112') || name.includes('REG') || name.includes('CP2102') || name.includes('RESISTOR') || name.includes('R1') || name.includes('R2')) { col = 1; }
        else if (name.includes('ESP') || name.includes('MCU') || name.includes('STM32') || name.includes('ATMEGA') || name.includes('CPU') || name.includes('LED')) { col = 2; }
        else { col = 3; }

        const currentY = columnYOffsets[col];
        columnYOffsets[col] += cardHeight + 40;

        return {
          ...node,
          position: { x: 80 + col * 380, y: currentY }
        };
      });
    });
    if (isMobile) setIsMobileMenuOpen(false);
  }, [isMobile]);

  const onConnect = useCallback(
    (params) => {
      const srcLabel = params.sourceHandle ? params.sourceHandle.replace(/_(in|out)$/, '') : '';
      const tgtLabel = params.targetHandle ? params.targetHandle.replace(/_(in|out)$/, '') : '';
      const netStyle = getNetStyle(srcLabel, tgtLabel);

      const newEdge = {
        ...params,
        id: `manual_edge_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: 'step',
        animated: true,
        style: netStyle,
        label: `${srcLabel} ──► ${tgtLabel}`,
        labelStyle: { fill: netStyle.stroke, fontWeight: 600, fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#18181b', rx: 4, ry: 4 }
      };

      const updatedEdges = addEdge(newEdge, edges);
      setEdges(updatedEdges);
      
      const validationErrors = runDRCCheck(nodes, updatedEdges);
      setDrcErrors(validationErrors);

      addChatMessage({ 
        sender: 'AI Copilot', 
        text: `Manual trace connected: ${params.source} (${srcLabel}) ➔ ${params.target} (${tgtLabel})` 
      });
    },
    [nodes, edges, setDrcErrors, addChatMessage]
  );

  const handleEdgeClick = useCallback((_, edge) => {
    setSelectedNode(null);
    setSelectedEdge(edge);
    setIsRightDrawerOpen(true);
  }, [setSelectedNode]);

  const handleNodeClick = useCallback((_, node) => {
    setSelectedEdge(null);
    setSelectedNode(node);
    setIsRightDrawerOpen(true);
  }, [setSelectedNode]);

  const handleExportKiCad = () => {
    if (!nodes || nodes.length === 0) {
      alert("Canvas is empty! Generate or manually wire a circuit first.");
      return;
    }

    let fileContent = `(kicad_sch (version 20231120) (generator pcbmaker_in)\n`;
    fileContent += `  (paper "A4")\n`;
    fileContent += `  (title_block\n    (title "AI Generated Schematic")\n    (company "pcbmaker.in - Made for the world, by India")\n  )\n\n`;

    nodes.forEach((node) => {
      const xPos = Math.round(node.position.x);
      const yPos = Math.round(node.position.y);
      const label = node.data?.label || node.id;

      fileContent += `  (symbol (lib_id "Device:U_Component") (at ${xPos} ${yPos} 0) (unit 1)\n`;
      fileContent += `    (in_bom yes) (on_board yes)\n`;
      fileContent += `    (property "Reference" "${node.id.toUpperCase()}" (at ${xPos} ${yPos - 20} 0))\n`;
      fileContent += `    (property "Value" "${label}" (at ${xPos} ${yPos + 20} 0))\n`;
      fileContent += `  )\n`;
    });

    edges.forEach(() => {
      fileContent += `  (wire (pts (xy 0 0) (xy 100 100)) (stroke (width 0) (type default)))\n`;
    });

    fileContent += `)\n`;

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `circuit_${Date.now()}.kicad_sch`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (isMobile) setIsMobileMenuOpen(false);
  };

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const rawData = event.dataTransfer.getData('application/reactflow');
      if (!rawData) return;

      const item = JSON.parse(rawData);
      const newId = `${item.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
      const formattedPins = cleanNodePins(item.name, item.pins);

      const newNode = {
        id: newId,
        type: 'icNode',
        position: { x: event.clientX - 200, y: event.clientY - 100 },
        data: {
          label: `${newId}: ${item.name}`,
          pins: formattedPins
        }
      };

      setNodes((nds) => [...nds, newNode]);
      addChatMessage({ sender: 'AI Copilot', text: `Added component: ${item.name} to canvas.` });
    },
    [addChatMessage]
  );

  const handleManualAddComponent = (item) => {
    const newId = `${item.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
    const formattedPins = cleanNodePins(item.name, item.pins);
    const newNode = {
      id: newId,
      type: 'icNode',
      position: { x: 120 + (nodes.length % 3) * 320, y: 120 + Math.floor(nodes.length / 3) * 200 },
      data: {
        label: `${newId}: ${item.name}`,
        pins: formattedPins
      }
    };
    setNodes((nds) => [...nds, newNode]);
    addChatMessage({ sender: 'AI Copilot', text: `Added component: ${item.name} to canvas.` });
    setIsPaletteOpen(false);
    if (isMobile) setIsMobileMenuOpen(false);
  };

  const executeGenerationQuery = async (queryText) => {
    if (!queryText.trim() || isLoading) return;

    if (isMobile) {
      setIsLeftCopilotOpen(true);
    }

    addChatMessage({ sender: 'User', text: queryText });
    setIsLoading(true);

    try {
      const specRefinedPrompt = optimizePromptSpec(queryText, chatMessages);
      const ragEnhancedPrompt = typeof buildRAGPrompt === 'function' ? buildRAGPrompt(specRefinedPrompt) : specRefinedPrompt;

      const response = await generatePcbFromAmplify(ragEnhancedPrompt);
      const result = extractJsonFromOutput(response);

      let cleanExplanation = result?.explanation || "Circuit netlist updated on canvas.";
      cleanExplanation = cleanExplanation
        .replace(/\[Active Session Context:[\s\S]*?\]/g, '')
        .replace(/Refined Specs:[\s\S]*?\|/g, '')
        .trim();

      addChatMessage({ 
        sender: 'AI Copilot', 
        text: cleanExplanation 
      });

      const rawComponents = result?.components || result?.nodes || [];
      let rawConnections = result?.connections || result?.edges || [];

      const existingNodeMap = {};
      nodes.forEach(n => { existingNodeMap[n.id] = n; });

      const formattedNodes = [...nodes];
      const nodePinMap = {};

      nodes.forEach(n => {
        nodePinMap[n.id] = (n.data?.pins || []).map(p => p.id || p);
      });

      let primaryPowerNode = null;
      let primaryMcuNode = null;
      let usbNode = null;

      const columnYOffsets = { 0: 80, 1: 80, 2: 80, 3: 80 };

      if (Array.isArray(rawComponents) && rawComponents.length > 0) {
        rawComponents.forEach((c, index) => {
          const nodeId = c.id || `node_${index}`;
          const compName = c.name || c.label || c.type || '';
          
          const formattedPins = cleanNodePins(compName, c.pins);
          nodePinMap[nodeId] = formattedPins.map(p => p.id);

          const upper = compName.toUpperCase();
          if (upper.includes('BAT') || upper.includes('CELL') || upper.includes('3.7V') || upper.includes('PWR') || upper.includes('AMS1117') || upper.includes('AP2112') || upper.includes('REG')) {
            primaryPowerNode = nodeId;
          }
          if (upper.includes('ESP') || upper.includes('MCU') || upper.includes('STM32') || upper.includes('ATMEGA') || upper.includes('CPU')) {
            primaryMcuNode = nodeId;
          }
          if (upper.includes('CP2102') || upper.includes('CH340') || upper.includes('USB')) {
            usbNode = nodeId;
          }

          let col = 1;
          if (upper.includes('BAT') || upper.includes('CELL') || upper.includes('USB') || upper.includes('PWR')) { col = 0; }
          else if (upper.includes('AMS1117') || upper.includes('AP2112') || upper.includes('REG') || upper.includes('CP2102') || upper.includes('R1') || upper.includes('R2') || upper.includes('RESISTOR')) { col = 1; }
          else if (upper.includes('ESP') || upper.includes('MCU') || upper.includes('STM32') || upper.includes('ATMEGA') || upper.includes('CPU') || upper.includes('LED')) { col = 2; }
          else { col = 3; }

          const cardHeight = Math.max(140, 60 + formattedPins.length * 26);
          const currentY = columnYOffsets[col];
          columnYOffsets[col] += cardHeight + 40;

          if (!existingNodeMap[nodeId]) {
            formattedNodes.push({
              id: nodeId,
              type: 'icNode',
              position: c.position || { x: 80 + col * 380, y: currentY },
              data: {
                label: `${nodeId}: ${compName}`,
                pins: formattedPins
              }
            });
          }
        });
      }

      if (!primaryPowerNode && formattedNodes.length > 0) {
        primaryPowerNode = formattedNodes[0].id;
      }

      const formattedEdges = [...edges];
      const addedKeys = new Set();
      edges.forEach(e => addedKeys.add(`${e.source}:${e.sourceHandle}->${e.target}:${e.targetHandle}`));

      const pushEdge = (src, sPin, tgt, tPin) => {
        if (!src || !tgt || src === tgt) return;
        const edgeKey = `${src}:${sPin}->${tgt}:${tPin}`;
        if (addedKeys.has(edgeKey)) return;
        addedKeys.add(edgeKey);

        const srcPins = nodePinMap[src] || ['1'];
        const tgtPins = nodePinMap[tgt] || ['1'];

        const validSPin = srcPins.find(p => arePinsCompatible(p, sPin)) || sPin || srcPins[0] || '1';
        const validTPin = tgtPins.find(p => arePinsCompatible(p, tPin)) || tPin || tgtPins[0] || '1';
        const netStyle = getNetStyle(validSPin, validTPin);

        formattedEdges.push({
          id: `edge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          source: src,
          sourceHandle: `${validSPin}_out`,
          target: tgt,
          targetHandle: `${validTPin}_in`,
          type: 'step',
          animated: true,
          style: netStyle,
          label: `${validSPin} ──► ${validTPin}`,
          labelStyle: { fill: netStyle.stroke, fontWeight: 600, fontSize: 10, fontFamily: 'monospace' },
          labelBgStyle: { fill: '#18181b', rx: 4, ry: 4 }
        });
      };

      if (Array.isArray(rawConnections) && rawConnections.length > 0) {
        rawConnections.forEach((conn) => {
          pushEdge(conn.source, conn.sourcePin, conn.target, conn.targetPin);
        });
      }

      if (primaryPowerNode && usbNode && primaryPowerNode !== usbNode) {
        pushEdge(usbNode, 'VBUS', primaryPowerNode, 'IN');
      }

      formattedNodes.forEach((node) => {
        const pins = nodePinMap[node.id] || [];
        pins.forEach((pId) => {
          const isConnected = formattedEdges.some(
            (e) => (e.source === node.id && e.sourceHandle.includes(pId)) || (e.target === node.id && e.targetHandle.includes(pId))
          );

          if (!isConnected) {
            if (primaryPowerNode) {
              const powerPins = nodePinMap[primaryPowerNode] || ['1', '2'];
              const posPin = powerPins.find(p => p === '+' || p.includes('OUT') || p.includes('3V3') || p.includes('VCC') || p.includes('VDD') || p === '1') || powerPins[0];
              const negPin = powerPins.find(p => p === '-' || p.includes('GND') || p.includes('VSS') || p === '2') || powerPins[1] || powerPins[0];

              if (pId === '1' || pId === '+' || pId.includes('VCC') || pId.includes('3V3') || pId.includes('VDD') || pId.includes('AVCC') || pId.includes('IN') || pId.includes('ANODE')) {
                if (node.id !== primaryPowerNode) pushEdge(primaryPowerNode, posPin, node.id, pId);
              } else if (pId === '2' || pId === '-' || pId.includes('GND') || pId.includes('VSS') || pId.includes('CATHODE')) {
                if (node.id !== primaryPowerNode) pushEdge(node.id, pId, primaryPowerNode, negPin);
              }
            }

            if (primaryMcuNode && node.id !== primaryMcuNode) {
              const mcuPins = nodePinMap[primaryMcuNode] || [];
              const matchPin = mcuPins.find(mPin => arePinsCompatible(mPin, pId));
              if (matchPin) {
                pushEdge(primaryMcuNode, matchPin, node.id, pId);
              }
            }
          }
        });
      });

      const verifiedEdges = autoPatchFloatingPins(formattedNodes, formattedEdges);

      setNodes(formattedNodes);
      setEdges(verifiedEdges);

      setTimeout(() => {
        handleAutoLayout();
      }, 50);

      const currentErrors = runDRCCheck(formattedNodes, verifiedEdges);
      if (currentErrors.length === 0 && typeof logTrainingPair === 'function') {
        logTrainingPair(queryText, result, currentErrors.length);
      }

    } catch (error) {
      console.error("Pipeline Error:", error);
      addChatMessage({ sender: 'AI Copilot', text: `Backend error: ${error.message || 'Failed to process request.'}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!inputMsg.trim()) return;
    const q = inputMsg;
    setInputMsg('');
    executeGenerationQuery(q);
  };

  const handleHeroSubmit = (e) => {
    e.preventDefault();
    if (!heroPromptInput.trim()) return;
    const q = heroPromptInput;
    setHeroPromptInput('');
    executeGenerationQuery(q);
  };

  const styledEdges = edges.map((edge) => {
    const isSelected = selectedEdge?.id === edge.id;
    return {
      ...edge,
      style: {
        ...edge.style,
        strokeWidth: isSelected ? 4.5 : edge.style?.strokeWidth || 2.5,
        filter: isSelected ? 'drop-shadow(0 0 6px #00E5FF)' : 'none',
        transition: 'stroke-width 0.2s ease, stroke 0.2s ease'
      }
    };
  });

  const headerBtnStyle = {
    height: '32px',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '6px',
    border: '1px solid #27272a',
    backgroundColor: '#18181b',
    color: '#e4e4e7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  };

  const partnerLogos = [
    "⚡ KiCad EDA", "☁️ AWS Amplify", "🧠 DeepSeek R1", "🛡️ STMicroelectronics", "📶 Espressif ESP32", "🔌 Texas Instruments", "🔋 DW01A BMS"
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw', backgroundColor: '#09090b', color: '#f4f4f5', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* TOOLBOX FLOATING DRAWER OVERLAY */}
      {isPaletteOpen && (
        <div style={{
          position: 'fixed', top: '60px', right: isMobile ? '12px' : '80px', left: isMobile ? '12px' : 'auto', zIndex: 90,
          backgroundColor: '#18181b', border: '1px solid #00E5FF', borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden'
        }}>
          <ComponentPalette 
            isOpen={true} 
            onToggle={() => setIsPaletteOpen(false)} 
            onAddComponent={handleManualAddComponent} 
          />
        </div>
      )}

      {/* COMPACT MOBILE-FIRST HEADER */}
      <header style={{ 
        height: '52px', 
        minHeight: '52px', 
        borderBottom: '1px solid #27272a', 
        backgroundColor: '#18181b', 
        padding: '0 12px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        zIndex: 50,
        position: 'relative'
      }}>
        
        {/* LOGO BRANDING */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '800', fontSize: '18px', letterSpacing: '-0.4px', fontFamily: 'sans-serif' }}>
            <span style={{ color: '#FF6B00' }}>pcb</span>
            <span style={{ color: '#FFFFFF' }}>maker</span>
            <span style={{ color: '#7171AA' }}>.</span>
            <span style={{ color: '#10B981' }}>in</span>
          </span>
        </div>

        {/* DESKTOP TOOLBAR (HORIZONTAL) */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              onClick={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
              style={{ 
                ...headerBtnStyle,
                borderColor: drcErrors.length > 0 ? '#ef4444' : '#10b981', 
                backgroundColor: drcErrors.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', 
                color: drcErrors.length > 0 ? '#ef4444' : '#34d399' 
              }}
            >
              <span>{isRightDrawerOpen ? '➡️ Hide DRC' : '🔍 DRC Inspector'}</span>
              <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '10px', backgroundColor: drcErrors.length > 0 ? '#ef4444' : '#10b981', color: '#ffffff', fontWeight: 'bold' }}>
                {drcErrors.length}
              </span>
            </button>

            <button onClick={handleAutoLayout} style={{ ...headerBtnStyle, backgroundColor: '#27272a', color: '#38bdf8' }}>
              ✨ Layout
            </button>
            
            <button onClick={exportFlywheelDataset} style={{ ...headerBtnStyle, backgroundColor: '#0284c7', color: '#ffffff', border: 'none' }}>
              📥 Dataset
            </button>

            <button onClick={() => setIsPaletteOpen(!isPaletteOpen)} style={{ ...headerBtnStyle, backgroundColor: '#27272a', color: '#00E5FF', borderColor: '#00E5FF' }}>
              🧩 Toolbox
            </button>
            
            <button onClick={handleExportKiCad} style={{ ...headerBtnStyle, backgroundColor: '#0891b2', color: '#ffffff', border: 'none' }}>
              KiCad (.kicad_sch)
            </button>

            <button onClick={() => setIsAboutModalOpen(true)} style={{ ...headerBtnStyle, backgroundColor: '#27272a', color: '#a1a1aa' }}>
              ℹ️ About
            </button>
          </div>
        )}

        {/* MOBILE CONTROLS (DRC BADGE + VERTICAL MENU TOGGLE) */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
              style={{ 
                ...headerBtnStyle,
                borderColor: drcErrors.length > 0 ? '#ef4444' : '#10b981', 
                backgroundColor: drcErrors.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', 
                color: drcErrors.length > 0 ? '#ef4444' : '#34d399',
                padding: '0 8px'
              }}
            >
              🔍 DRC ({drcErrors.length})
            </button>

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{ ...headerBtnStyle, backgroundColor: '#27272a', borderColor: '#00E5FF', color: '#00E5FF', padding: '0 10px', fontSize: '13px' }}
            >
              {isMobileMenuOpen ? '✕ Close' : '☰ Tools'}
            </button>
          </div>
        )}
      </header>

      {/* MOBILE VERTICAL ACTION BAR (DROPS DOWN FROM TOP-LEFT) */}
      {isMobile && isMobileMenuOpen && (
        <div style={{
          position: 'absolute',
          top: '52px',
          left: '12px',
          zIndex: 80,
          width: '210px',
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.8)'
        }}>
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', marginBottom: '2px' }}>
            ⚡ Mobile Action Bar
          </span>

          <button onClick={handleAutoLayout} style={{ ...headerBtnStyle, width: '100%', justifyContent: 'flex-start', backgroundColor: '#27272a', color: '#38bdf8' }}>
            ✨ Layout Canvas
          </button>
          
          <button onClick={() => { setIsPaletteOpen(!isPaletteOpen); setIsMobileMenuOpen(false); }} style={{ ...headerBtnStyle, width: '100%', justifyContent: 'flex-start', backgroundColor: '#27272a', color: '#00E5FF', borderColor: '#00E5FF' }}>
            🧩 Component Toolbox
          </button>

          <button onClick={handleExportKiCad} style={{ ...headerBtnStyle, width: '100%', justifyContent: 'flex-start', backgroundColor: '#0891b2', color: '#ffffff', border: 'none' }}>
            📄 KiCad (.kicad_sch)
          </button>

          <button onClick={exportFlywheelDataset} style={{ ...headerBtnStyle, width: '100%', justifyContent: 'flex-start', backgroundColor: '#0284c7', color: '#ffffff', border: 'none' }}>
            📥 Dataset Export
          </button>

          <button onClick={() => { setIsAboutModalOpen(true); setIsMobileMenuOpen(false); }} style={{ ...headerBtnStyle, width: '100%', justifyContent: 'flex-start', backgroundColor: '#27272a', color: '#a1a1aa' }}>
            ℹ️ About pcbmaker
          </button>
        </div>
      )}

      {/* WORKSPACE AREA */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', height: 'calc(100dvh - 52px)' }}>
        
        {/* LEFT COPILOT DRAWER (SLIDES IN FROM LEFT) */}
        <aside style={{ 
          width: isMobile ? '100vw' : '320px', 
          minWidth: isMobile ? '100vw' : '300px', 
          maxWidth: isMobile ? '100vw' : '340px', 
          borderRight: '1px solid #27272a', 
          backgroundColor: '#18181b', 
          display: 'flex', 
          flexDirection: 'column', 
          zIndex: 40,
          position: isMobile ? 'absolute' : 'relative',
          top: 0, bottom: 0, left: 0,
          height: '100%',
          transform: isLeftCopilotOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>

          <div style={{ padding: '12px 14px', borderBottom: '1px solid #27272a', fontWeight: 'bold', fontSize: '11px', color: '#a1a1aa', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              AI Hardware Copilot
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isLoading ? '#f59e0b' : '#10b981' }}></span>
            </span>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                onClick={handleFullReset}
                style={{ backgroundColor: '#27272a', color: '#f43f5e', border: '1px solid #3f3f46', fontSize: '10px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                title="Clear chat and reset canvas"
              >
                🗑️ Clear
              </button>
              <button 
                onClick={() => setIsLeftCopilotOpen(false)}
                style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#f4f4f5', cursor: 'pointer', fontSize: '12px', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Close drawer"
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'monospace', fontSize: '11px' }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: m.sender.includes('AI') ? '#27272a' : '#083344', color: m.sender.includes('AI') ? '#67e8f9' : '#f4f4f5', marginLeft: m.sender.includes('AI') ? '0' : '12px' }}>
                <div style={{ fontSize: '9px', color: '#71717a', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>{m.sender}</div>
                {m.text}
              </div>
            ))}
            {isLoading && (
              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ animation: 'spin 1s linear infinite' }}>⚙️</span>
                <span>Thinking & synthesizing netlist wires...</span>
              </div>
            )}
          </div>

          {/* CHAT INPUT AREA FIXED TO BOTTOM */}
          <div style={{ padding: '12px', borderTop: '1px solid #27272a', display: 'flex', gap: '8px', backgroundColor: '#18181b', paddingBottom: isMobile ? '24px' : '12px' }}>
            <input 
              value={inputMsg}
              disabled={isLoading}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="e.g., design a 5w usb speaker using pam8403..."
              style={{ flex: 1, backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '11px', padding: '10px', borderRadius: '6px', color: '#f4f4f5', fontFamily: 'monospace', outline: 'none', width: '100%' }}
            />
            <button 
              onClick={handleSendMessage}
              disabled={isLoading}
              style={{ backgroundColor: '#0891b2', fontSize: '11px', padding: '0 14px', borderRadius: '6px', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: '600' }}
            >
              Send
            </button>
          </div>
        </aside>

        {/* CENTER REACTFLOW CANVAS */}
        <main 
          onDragOver={onDragOver}
          onDrop={onDrop}
          style={{ flex: 1, width: '100%', height: '100%', backgroundColor: '#09090b', position: 'relative' }}
        >
          {/* FLOATING ACTION COPILOT TRIGGER (ON THE RIGHT SIDE) */}
          {!isLeftCopilotOpen && (
            <button
              onClick={() => setIsLeftCopilotOpen(true)}
              style={{
                position: 'absolute',
                bottom: '24px',
                right: '24px',
                zIndex: 35,
                backgroundColor: '#18181b',
                border: '1px solid #00E5FF',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                padding: '12px 20px',
                borderRadius: '30px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(0, 229, 255, 0.25)',
                backdropFilter: 'blur(8px)'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
              <span>💬 AI Copilot</span>
            </button>
          )}

          {/* HERO EMPTY-STATE OVERLAY (SHOWN WHEN CANVAS IS EMPTY) */}
          {nodes.length === 0 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{
                pointerEvents: 'auto',
                maxWidth: '540px',
                width: '100%',
                backgroundColor: 'rgba(24, 24, 27, 0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(39, 39, 42, 0.8)',
                borderRadius: '20px',
                padding: isMobile ? '24px 16px' : '36px 28px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '18px'
              }}>
                {/* CLEAN BADGE */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(0, 229, 255, 0.08)',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  color: '#00E5FF',
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase'
                }}>
                  <span>India's 1st Autonomous AI EDA Engine</span>
                </div>

                {/* MAIN TITLE */}
                <h1 style={{
                  fontSize: isMobile ? '22px' : '28px',
                  fontWeight: '800',
                  margin: 0,
                  color: '#ffffff',
                  letterSpacing: '-0.5px',
                  lineHeight: '1.2'
                }}>
                  Dream It. Design It. Deploy It.
                </h1>

                {/* ANIMATED TYPEWRITER SLOGAN */}
                <div style={{
                  minHeight: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? '11px' : '13px',
                  lineHeight: '1.4'
                }}>
                  <TypewriterText texts={HERO_SLOGANS} />
                </div>

                {/* HERO PROMPT FORM FOR DIRECT GENERATION */}
                <form 
                  onSubmit={handleHeroSubmit} 
                  style={{
                    width: '100%',
                    display: 'flex',
                    gap: '8px',
                    marginTop: '8px'
                  }}
                >
                  <input
                    value={heroPromptInput}
                    disabled={isLoading}
                    onChange={(e) => setHeroPromptInput(e.target.value)}
                    placeholder="Type to build e.g. 5W USB Speaker, ESP32 Flight Controller..."
                    style={{
                      flex: 1,
                      backgroundColor: '#09090b',
                      border: '1px solid #27272a',
                      fontSize: '12px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontFamily: 'monospace',
                      outline: 'none',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                      backgroundColor: '#00E5FF',
                      color: '#09090b',
                      fontWeight: '700',
                      fontSize: '12px',
                      padding: '0 18px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Build ⚡
                  </button>
                </form>
              </div>
            </div>
          )}

          <FlowErrorBoundary>
  <ReactFlow
    nodes={nodes}
    edges={styledEdges}
    onNodesChange={onNodesChange}
    onEdgesChange={onEdgesChange}
    onConnect={onConnect}
    onEdgeClick={handleEdgeClick}
    onNodeClick={handleNodeClick}
    nodeTypes={nodeTypes}
    colorMode="dark"
    fitView
    panOnScroll={true}
    zoomOnPinch={true}
    panOnDrag={true}
    preventScrolling={false}
    nodesDraggable={true} // 👈 Keep it TRUE for mobile and desktop!
    nodesConnectable={true}
    elementsSelectable={true}
    selectNodesOnDrag={false}
    elevateNodesOnSelect={true}
    onlyRenderVisibleElements={true} // 👈 CRITICAL: Prevents heavy mobile DOM re-renders during fast drags
    fitViewOptions={{ padding: 0.2 }}
    isValidConnection={() => true}
    connectionLineType="step"
    connectionRadius={35}
    connectionLineStyle={{ stroke: '#00E5FF', strokeWidth: 2.5, strokeDasharray: '6' }}
  >
    <Background color="#27272a" gap={20} size={1} />
    <Controls style={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }} />
  </ReactFlow>
</FlowErrorBoundary>
        </main>

        {/* RIGHT DRC & INSPECTOR DRAWER */}
        <aside 
          style={{ 
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: isMobile ? '100vw' : '320px', 
            backgroundColor: '#18181b', 
            borderLeft: '1px solid #27272a',
            padding: '16px', 
            fontFamily: 'monospace', 
            fontSize: '11px', 
            zIndex: 30, 
            overflowY: 'auto',
            transform: isRightDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isRightDrawerOpen ? '-4px 0 20px rgba(0,0,0,0.5)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #27272a', paddingBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', color: '#a1a1aa', textTransform: 'uppercase' }}>DRC & Inspector</span>
            <button 
              onClick={() => setIsRightDrawerOpen(false)}
              style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>DRC Validation Check</span>
              <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '10px', backgroundColor: drcErrors.length > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: drcErrors.length > 0 ? '#ef4444' : '#10b981' }}>
                {drcErrors.length} Issue{drcErrors.length !== 1 ? 's' : ''}
              </span>
            </div>

            {drcErrors.length === 0 ? (
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '4px', color: '#34d399', fontSize: '11px' }}>
                ✓ No DRC errors detected. All active components & power paths are valid.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {drcErrors.map((err) => (
                  <div key={err.id} style={{ backgroundColor: err.severity === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: `1px solid ${err.severity === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`, padding: '8px', borderRadius: '4px', color: err.severity === 'error' ? '#f87171' : '#fbbf24', fontSize: '10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{err.severity === 'error' ? '🔴 DRC ERROR' : '⚠️ DRC WARNING'}</div>
                    {err.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #27272a', paddingTop: '16px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '12px' }}>
              Inspector Panel
            </div>

            {/* COMPONENT INSPECTOR */}
            {selectedNode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ backgroundColor: '#09090b', padding: '8px', borderRadius: '4px', border: '1px solid #27272a' }}>
                  <span style={{ color: '#71717a', fontSize: '9px', display: 'block', textTransform: 'uppercase' }}>Selected Component</span>
                  <div style={{ color: '#22d3ee', fontWeight: 'bold', fontSize: '12px', marginTop: '2px' }}>{selectedNode.id.toUpperCase()}</div>
                </div>
                <div style={{ backgroundColor: '#09090b', padding: '8px', borderRadius: '4px', border: '1px solid #27272a' }}>
                  <span style={{ color: '#71717a', fontSize: '9px', display: 'block', textTransform: 'uppercase' }}>Part Name</span>
                  <div style={{ color: '#f4f4f5', marginTop: '2px' }}>{selectedNode.data?.label}</div>
                </div>
                <div style={{ backgroundColor: '#09090b', padding: '8px', borderRadius: '4px', border: '1px solid #27272a' }}>
                  <span style={{ color: '#71717a', fontSize: '9px', display: 'block', textTransform: 'uppercase' }}>Active Pin Terminals</span>
                  <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {selectedNode.data?.pins?.map((pin, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#a1a1aa', borderBottom: '1px solid #27272a', paddingBottom: '3px' }}>
                        <span>{pin.label || pin.id}</span>
                        <span style={{ color: '#34d399' }}>● active</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* WIRE TRACE / NET INSPECTOR */}
            {selectedEdge && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ backgroundColor: '#09090b', padding: '8px', borderRadius: '4px', border: '1px solid #27272a' }}>
                  <span style={{ color: '#71717a', fontSize: '9px', display: 'block', textTransform: 'uppercase' }}>Selected Net Trace</span>
                  <div style={{ color: selectedEdge.style?.stroke || '#00E5FF', fontWeight: 'bold', fontSize: '11px', marginTop: '4px' }}>
                    {selectedEdge.label || selectedEdge.id}
                  </div>
                </div>

                <div style={{ backgroundColor: '#09090b', padding: '8px', borderRadius: '4px', border: '1px solid #27272a' }}>
                  <span style={{ color: '#71717a', fontSize: '9px', display: 'block', textTransform: 'uppercase' }}>Net Origin (From)</span>
                  <div style={{ color: '#f4f4f5', fontWeight: 'bold', fontSize: '10px', marginTop: '2px' }}>
                    {selectedEdge.source.toUpperCase()} → Pin {selectedEdge.sourceHandle?.replace(/_(in|out)$/, '')}
                  </div>
                </div>

                <div style={{ backgroundColor: '#09090b', padding: '8px', borderRadius: '4px', border: '1px solid #27272a' }}>
                  <span style={{ color: '#71717a', fontSize: '9px', display: 'block', textTransform: 'uppercase' }}>Net Destination (To)</span>
                  <div style={{ color: '#f4f4f5', fontWeight: 'bold', fontSize: '10px', marginTop: '2px' }}>
                    {selectedEdge.target.toUpperCase()} → Pin {selectedEdge.targetHandle?.replace(/_(in|out)$/, '')}
                  </div>
                </div>

                <div style={{ backgroundColor: '#09090b', padding: '8px', borderRadius: '4px', border: '1px solid #27272a' }}>
                  <span style={{ color: '#71717a', fontSize: '9px', display: 'block', textTransform: 'uppercase' }}>Signal Rail Type</span>
                  <div style={{ color: selectedEdge.style?.stroke || '#00E5FF', fontWeight: 'bold', fontSize: '10px', marginTop: '2px' }}>
                    {selectedEdge.style?.stroke === '#EF4444' ? '🔴 POWER RAIL (VCC/BAT+)' : 
                     selectedEdge.style?.stroke === '#10B981' ? '🟢 GROUND RETURN (GND/VSS)' : 
                     selectedEdge.style?.stroke === '#F59E0B' ? '🟠 COMMUNICATION BUS (I2C/UART)' : 
                     '🔵 CONTROL / SIGNAL TRACE'}
                  </div>
                </div>
              </div>
            )}

            {!selectedNode && !selectedEdge && (
              <div style={{ color: '#71717a', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                Click any component card OR wire trace on the canvas to inspect details.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ABOUT US, OUR MISSION & ANIMATED PARTNERS MODAL */}
      {isAboutModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)', padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px',
            padding: '24px', width: '100%', maxWidth: '540px', maxHeight: '88vh',
            display: 'flex', flexDirection: 'column', fontFamily: 'monospace', color: '#f4f4f5',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            {/* MODAL HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #27272a', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '800', fontSize: '18px' }}>
                  <span style={{ color: '#FF6B00' }}>pcb</span>
                  <span style={{ color: '#FFFFFF' }}>maker</span>
                  <span style={{ color: '#7171AA' }}>.</span>
                  <span style={{ color: '#10B981' }}>in</span>
                </span>
              </div>
              <button onClick={() => setIsAboutModalOpen(false)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>✕</button>
            </div>

            {/* SCROLLABLE BODY CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* MISSION STATEMENT */}
              <div style={{ backgroundColor: '#09090b', padding: '12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                <span style={{ fontSize: '11px', color: '#FF6B00', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  🎯 Our Mission
                </span>
                <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#f4f4f5', margin: 0 }}>
                  <strong>Democratizing Hardware Innovation:</strong> Building India's first fully autonomous, AI-driven EDA platform to bridge natural language prompts directly into production-grade electronic schematics with 0 DRC errors.
                </p>
              </div>

              {/* SERVICES LIST SECTION */}
              <div style={{ borderTop: '1px solid #27272a', paddingTop: '12px' }}>
                <span style={{ fontSize: '11px', color: '#00E5FF', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                  ⚡ Platform Capabilities & Services
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ backgroundColor: '#09090b', padding: '10px', borderRadius: '6px', border: '1px solid #27272a' }}>
                    <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '11px', marginBottom: '2px' }}>🤖 AI Natural Language Copilot</div>
                    <div style={{ color: '#a1a1aa', fontSize: '10px', lineHeight: '1.4' }}>Instant text-to-schematic synthesis for Microcontrollers, BMS protection circuits, IoT nodes, and custom hardware.</div>
                  </div>

                  <div style={{ backgroundColor: '#09090b', padding: '10px', borderRadius: '6px', border: '1px solid #27272a' }}>
                    <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '11px', marginBottom: '2px' }}>🔍 Automated Design Rule Checking (DRC)</div>
                    <div style={{ color: '#a1a1aa', fontSize: '10px', lineHeight: '1.4' }}>Real-time netlist validation checking power/GND loops, current-limiting resistors, and signal integrity.</div>
                  </div>

                  <div style={{ backgroundColor: '#09090b', padding: '10px', borderRadius: '6px', border: '1px solid #27272a' }}>
                    <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '11px', marginBottom: '2px' }}>📂 KiCad EDA Native Export</div>
                    <div style={{ color: '#a1a1aa', fontSize: '10px', lineHeight: '1.4' }}>Generates standard `.kicad_sch` schematics compatible with KiCad for immediate PCB routing & manufacturing.</div>
                  </div>

                  <div style={{ backgroundColor: '#09090b', padding: '10px', borderRadius: '6px', border: '1px solid #27272a' }}>
                    <div style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '11px', marginBottom: '2px' }}>🔄 Cloud Training Data Flywheel</div>
                    <div style={{ color: '#a1a1aa', fontSize: '10px', lineHeight: '1.4' }}>Seamlessly streams verified 0-DRC circuit netlists directly to Amazon S3 for continuous AI model fine-tuning.</div>
                  </div>
                </div>
              </div>

              {/* ANIMATED ECOSYSTEM PARTNERS MARQUEE */}
              <div style={{ borderTop: '1px solid #27272a', paddingTop: '12px', overflow: 'hidden' }}>
                <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  🤝 Ecosystem Compatibility & Integrations
                </span>

                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', backgroundColor: '#09090b', padding: '8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                  <div style={{
                    display: 'inline-block',
                    animation: 'marquee 18s linear infinite',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#00E5FF',
                    letterSpacing: '1px'
                  }}>
                    {partnerLogos.join(" ──► ")} ──► {partnerLogos.join(" ──► ")}
                  </div>
                </div>
              </div>

              {/* DIRECT SUPPORT BOX */}
              <div style={{ backgroundColor: '#09090b', padding: '12px', borderRadius: '6px', border: '1px solid #27272a', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Direct Inquiries & Technical Support</span>
                <a href="mailto:support@pcbmaker.in" style={{ color: '#00E5FF', fontWeight: 'bold', textDecoration: 'none', fontSize: '13px' }}>
                  ✉️ support@pcbmaker.in
                </a>
              </div>

            </div>
          </div>

          <style>{`
            @keyframes marquee {
              0% { transform: translateX(0%); }
              100% { transform: translateX(-50%); }
            }
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

    </div>
  );
}