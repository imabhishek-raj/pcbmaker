// src/components/Workspace.jsx
import React, { useState, useCallback, useEffect } from 'react';
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

const optimizePromptSpec = (rawQuery, previousHistory = []) => {
  const baseQuery = rawQuery.split('— Specs:')[0].trim();
  const q = baseQuery.toLowerCase();

  // Multi-turn context thread construction
  let contextContextStr = '';
  if (previousHistory.length > 0) {
    const lastSummary = previousHistory.slice(-4).map(m => `${m.sender}: ${m.text}`).join(' | ');
    contextContextStr = ` [Active Session Context: ${lastSummary}]`;
  }

  // 1. 4-bit / 8-bit CPUs & MCUs
  if (q.includes('4 bit') || q.includes('4-bit') || q.includes('8 bit') || q.includes('8-bit') || q.includes('atmega') || q.includes('avr') || q.includes('cpu')) {
    return `${baseQuery}${contextContextStr} — Specs: Include ATmega328P MCU (MCU1), AMS1117-3.3V Regulator (U1), 16MHz Crystal Oscillator (XTAL1), 10k Reset Resistor (R1), Reset Tactile Switch (SW1), and 100nF Cap (C1). Connect VCC, GND, RESET, XTAL1, and XTAL2.`;
  }

  // 2. 32-Bit Microcontrollers
  if (q.includes('32 bit') || q.includes('32-bit') || q.includes('stm32') || q.includes('arm')) {
    return `${baseQuery}${contextContextStr} — Specs: Include STM32H743XI MCU (MCU1), AP2112K-3.3V LDO (U1), 8MHz Crystal (X1), 10k NRST Resistor (R1), 100nF Cap (C1), and 10uF Cap (C2). Connect VDD, VSS, NRST, TX, and RX.`;
  }

  // 3. Flight Controller / ESP32
  if (q.includes('flight controller') || q.includes('esp 32 mini') || q.includes('itself') || q.includes('bare') || (q.includes('esp') && !q.includes('bms') && !q.includes('led'))) {
    return `${baseQuery}${contextContextStr} — Specs: Include ESP32-S3 MCU (MCU1), MPU-6050 IMU (IMU1 connected via I2C SDA/SCL), AMS1117-3.3V Regulator (REG1), CP2102 USB-UART Bridge (U2), EN Reset Switch (SW1), 100nF Cap (C1), and 10uF Cap (C2). Connect 3V3, GND, TX, RX, EN, SDA, and SCL.`;
  }

  // 4. BMS / Protection
  if (q.includes('bms') || q.includes('battery protection') || q.includes('protection circuit')) {
    return `${baseQuery}${contextContextStr} — Specs: Include 3.7V Cell (BAT1), DW01A Protection IC (IC1), AO8810 Dual N-Channel MOSFET (MOS1), 100nF decoupling capacitor (C1), and 1kΩ CS current resistor (R1). Connect VCC, GND, OD, and OC control nets.`;
  }

  // 5. Default Fallback with Context
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

export default function Workspace() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState(null);

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

  // Complete Reset Handler
  const handleFullReset = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setSelectedEdge(null);
    clearChatHistory();
  };

  // Live DRC Check Engine
  useEffect(() => {
    const warnings = runDRCCheck(nodes, edges);
    setDrcErrors(warnings);
  }, [nodes, edges, setDrcErrors]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const handleAutoLayout = () => {
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
    addChatMessage({ sender: 'AI Copilot', text: "Auto-arranged canvas components into clean EDA schematic columns." });
  };

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

      setEdges((eds) => addEdge(newEdge, eds));
      addChatMessage({ 
        sender: 'AI Copilot', 
        text: `Manual trace connected: ${params.source} (${srcLabel}) ➔ ${params.target} (${tgtLabel})` 
      });
    },
    [addChatMessage]
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

    let fileContent = `(kicad_sch (version 20231120) (generator pcbmaker_org)\n`;
    fileContent += `  (paper "A4")\n`;
    fileContent += `  (title_block\n    (title "AI Generated Schematic")\n    (company "pcbmaker.org - Made for the world, by India")\n  )\n\n`;

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

      const newNode = {
        id: newId,
        type: 'icNode',
        position: { x: event.clientX - 200, y: event.clientY - 100 },
        data: {
          label: `${newId}: ${item.name}`,
          pins: item.pins.map((p) => ({ id: p, label: p }))
        }
      };

      setNodes((nds) => [...nds, newNode]);
      addChatMessage({ sender: 'AI Copilot', text: `Added component: ${item.name} to canvas.` });
    },
    [addChatMessage]
  );

  const handleManualAddComponent = (item) => {
    const newId = `${item.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
    const newNode = {
      id: newId,
      type: 'icNode',
      position: { x: 120 + (nodes.length % 3) * 320, y: 120 + Math.floor(nodes.length / 3) * 200 },
      data: {
        label: `${newId}: ${item.name}`,
        pins: item.pins.map((p) => ({ id: p, label: p }))
      }
    };
    setNodes((nds) => [...nds, newNode]);
    addChatMessage({ sender: 'AI Copilot', text: `Added component: ${item.name} to canvas.` });
  };

  // MULTI-TURN PERSISTENT GENERATION PIPELINE
  const handleSendMessage = async () => {
    if (!inputMsg.trim() || isLoading) return;

    const rawUserQuery = inputMsg;
    setInputMsg('');
    
    addChatMessage({ sender: 'User', text: rawUserQuery });
    setIsLoading(true);

    try {
      // Pass chat history so the AI remembers previous prompts & components!
      const specRefinedPrompt = optimizePromptSpec(rawUserQuery, chatMessages);
      const ragEnhancedPrompt = typeof buildRAGPrompt === 'function' ? buildRAGPrompt(specRefinedPrompt) : specRefinedPrompt;
      
      addChatMessage({ 
        sender: 'AI Copilot', 
        text: `✨ Refined Specs: "${specRefinedPrompt}"` 
      });

      const response = await generatePcbFromAmplify(ragEnhancedPrompt);
      const result = extractJsonFromOutput(response);

      addChatMessage({ 
        sender: 'AI Copilot', 
        text: result?.explanation || "Circuit netlist updated on canvas." 
      });

      const rawComponents = result?.components || result?.nodes || [];
      let rawConnections = result?.connections || result?.edges || [];

      // Preserve existing nodes if this is a follow-up refinement
      const existingNodeMap = {};
      nodes.forEach(n => { existingNodeMap[n.id] = n; });

      const formattedNodes = [...nodes];
      const nodePinMap = {};

      // Seed pin map from existing canvas
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
          
          const formattedPins = getComponentPins(compName);
          nodePinMap[nodeId] = formattedPins.map(p => p.id);

          const upper = compName.toUpperCase();
          if (upper.includes('BAT') || upper.includes('CELL') || upper.includes('3.7V') || upper.includes('PWR') || upper.includes('AMS1117') || upper.includes('AP2112') || upper.includes('REG')) {
            primaryPowerNode = nodeId;
          }
          if (upper.includes('ESP') || upper.includes('MCU') || upper.includes('STM32') || upper.includes('ATMEGA') || upper.includes('AVR') || upper.includes('CPU')) {
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

          // Only add if not already present
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

      // 1. LLM Connections
      if (Array.isArray(rawConnections) && rawConnections.length > 0) {
        rawConnections.forEach((conn) => {
          pushEdge(conn.source, conn.sourcePin, conn.target, conn.targetPin);
        });
      }

      // 2. Regulator IN Pin to USB VBUS
      if (primaryPowerNode && usbNode && primaryPowerNode !== usbNode) {
        pushEdge(usbNode, 'VBUS', primaryPowerNode, 'IN');
      }

      // 3. Universal Alias Net Resolver
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

      setNodes(formattedNodes);
      setEdges(formattedEdges);

      // Data Flywheel logging
      const currentErrors = runDRCCheck(formattedNodes, formattedEdges);
      if (currentErrors.length === 0 && typeof logTrainingPair === 'function') {
        logTrainingPair(rawUserQuery, result, currentErrors.length);
      }

    } catch (error) {
      console.error("Pipeline Error:", error);
      addChatMessage({ sender: 'AI Copilot', text: `Backend error: ${error.message || 'Failed to process request.'}` });
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#09090b', color: '#f4f4f5', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <header style={{ height: '48px', minHeight: '48px', borderBottom: '1px solid #27272a', backgroundColor: '#18181b', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 20, flexWrap: 'nowrap', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 'max-content' }}>
          <span style={{ fontWeight: 'bold', color: '#22d3ee', fontSize: '16px' }}>pcbmaker.org</span>
          <span style={{ fontSize: '10px', backgroundColor: '#2563eb', color: '#ffffff', padding: '2px 8px', borderRadius: '12px', fontWeight: '500', display: 'inline-block' }}>
            🇮🇳 India
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 'max-content' }}>
          <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '9px', padding: '2px 6px', borderRadius: '12px', fontFamily: 'monospace' }}>
            AWS: ACTIVE
          </span>
          
          <button 
            onClick={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
            style={{ 
              backgroundColor: drcErrors.length > 0 ? 'rgba(239, 68, 68, 0.15)' : '#1e293b', 
              color: drcErrors.length > 0 ? '#ef4444' : '#38bdf8', 
              fontSize: '11px', 
              padding: '5px 10px', 
              borderRadius: '4px', 
              border: `1px solid ${drcErrors.length > 0 ? '#ef4444' : '#0284c7'}`, 
              cursor: 'pointer', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{isRightDrawerOpen ? '➡️ Hide DRC' : '🔍 DRC Inspector'}</span>
            <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '8px', backgroundColor: drcErrors.length > 0 ? '#ef4444' : '#10b981', color: '#ffffff' }}>
              {drcErrors.length}
            </span>
          </button>

          <button 
            onClick={handleAutoLayout}
            style={{ backgroundColor: '#1e293b', color: '#38bdf8', fontSize: '11px', padding: '5px 8px', borderRadius: '4px', border: '1px solid #0284c7', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✨ Layout
          </button>
          
          <button 
            onClick={exportFlywheelDataset}
            style={{ backgroundColor: '#0284c7', color: '#ffffff', fontSize: '11px', padding: '5px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            title="Export captured 0-DRC user prompts for LLM fine-tuning"
          >
            📥 Dataset
          </button>
          
          <button 
            onClick={handleExportKiCad}
            style={{ backgroundColor: '#0891b2', color: '#ffffff', fontSize: '11px', padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '500' }}
          >
            KiCad (.kicad_sch)
          </button>
        </div>
      </header>

      {/* MAIN RESPONSIVE WORKSPACE CONTAINER */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* LEFT COPILOT PANEL */}
        <aside style={{ width: '320px', minWidth: '280px', maxWidth: '340px', borderRight: '1px solid #27272a', backgroundColor: '#18181b', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
          
          <ComponentPalette 
            isOpen={isPaletteOpen} 
            onToggle={() => setIsPaletteOpen(!isPaletteOpen)} 
            onAddComponent={handleManualAddComponent} 
          />

          <div style={{ padding: '8px 12px', borderBottom: '1px solid #27272a', fontWeight: 'bold', fontSize: '11px', color: '#a1a1aa', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              AI Hardware Copilot
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isLoading ? '#f59e0b' : '#10b981' }}></span>
            </span>
            
            {/* RESTORED CLEAR CHAT & RESET BUTTON */}
            <button 
              onClick={handleFullReset}
              style={{ backgroundColor: '#27272a', color: '#f43f5e', border: '1px solid #3f3f46', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              title="Clear chat and reset canvas"
            >
              🗑️ Clear
            </button>
          </div>

          <div style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'monospace', fontSize: '11px' }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: m.sender.includes('AI') ? '#27272a' : '#083344', color: m.sender.includes('AI') ? '#67e8f9' : '#f4f4f5', marginLeft: m.sender.includes('AI') ? '0' : '12px' }}>
                <div style={{ fontSize: '9px', color: '#71717a', marginBottom: '3px', fontWeight: 'bold', textTransform: 'uppercase' }}>{m.sender}</div>
                {m.text}
              </div>
            ))}
            {isLoading && (
              <div style={{ color: '#f59e0b', fontSize: '11px', fontStyle: 'italic' }}>
                Refining specs & updating netlist wires...
              </div>
            )}
          </div>

          <div style={{ padding: '10px', borderTop: '1px solid #27272a', display: 'flex', gap: '6px' }}>
            <input 
              value={inputMsg}
              disabled={isLoading}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="e.g., now add a switch or status LED..."
              style={{ flex: 1, backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '11px', padding: '8px', borderRadius: '4px', color: '#f4f4f5', fontFamily: 'monospace', outline: 'none', width: '100%' }}
            />
            <button 
              onClick={handleSendMessage}
              disabled={isLoading}
              style={{ backgroundColor: '#0891b2', fontSize: '11px', padding: '0 10px', borderRadius: '4px', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: '500' }}
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
            isValidConnection={() => true}
            connectionLineType="step"
            connectionRadius={35}
            connectionLineStyle={{ stroke: '#00E5FF', strokeWidth: 2.5, strokeDasharray: '6' }}
          >
            <Background color="#27272a" gap={20} size={1} />
            <Controls style={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }} />
          </ReactFlow>
        </main>

        {/* RIGHT SLIDING DRAWER PANEL */}
        <aside 
          style={{ 
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '320px', 
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
    </div>
  );
}