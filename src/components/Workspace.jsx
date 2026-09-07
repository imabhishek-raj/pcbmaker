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

class FlowErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("Canvas Error:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#f87171', textAlign: 'center', fontFamily: 'monospace', backgroundColor: '#09090b', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h3>Canvas re-initialized safely.</h3>
          <button onClick={() => this.setState({ hasError: false })} style={{ background: '#00E5FF', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '12px' }}>Reload Canvas</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const HERO_SLOGANS = [
  "Transform Natural Language into KiCad Schematics in Seconds...",
  "Zero Floating Pins with Real-Time DRC Rule Validation...",
  "Synthesize Audio Amps, BMS Protection, and MCU Nodes Instantaneously...",
  "Democratizing Electronics Prototyping for Hardware Creators..."
];

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
        if (pinId.includes('VCC') || pinId.includes('3V3') || pinId.includes('VDD') || pinId.includes('+')) {
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
        } else if (pinId.includes('GND') || pinId.includes('VSS') || pinId === '-') {
          patchedEdges.push({
            id: `auto_gnd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            source: node.id,
            sourceHandle: `${pinId}_out`,
            target: powerNode.id,
            targetHandle: 'GND_in',
            type: 'step',
            animated: true,
            style: { stroke: '#10B981', strokeWidth: 2.5, strokeDasharray: '4' },
            label: 'GND RETURN'
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
  
  const [searchQueryInput, setSearchQueryInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingFlywheel, setIsSearchingFlywheel] = useState(false);

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
    setSearchResults([]);
  };

  useEffect(() => {
    const warnings = runDRCCheck(nodes, edges);
    setDrcErrors(warnings);
  }, [edges, nodes.length, setDrcErrors]);

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
        if (name.includes('USB') || name.includes('BAT') || name.includes('CELL') || name.includes('PWR')) { col = 0; }
        else if (name.includes('AMS1117') || name.includes('REG') || name.includes('RESISTOR')) { col = 1; }
        else if (name.includes('ESP') || name.includes('MCU') || name.includes('STM32') || name.includes('LED')) { col = 2; }
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
      setDrcErrors(runDRCCheck(nodes, updatedEdges));
      addChatMessage({ sender: 'AI Copilot', text: `Manual trace connected.` });
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
    let fileContent = `(kicad_sch (version 20231120) (generator pcbmaker_in)\n  (paper "A4")\n);\n`;
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `circuit_${Date.now()}.kicad_sch`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onDragOver = useCallback((event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);

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
        data: { label: `${newId}: ${item.name}`, pins: cleanNodePins(item.name, item.pins) }
      };
      setNodes((nds) => [...nds, newNode]);
    },
    []
  );

  const handleManualAddComponent = (item) => {
    const newId = `${item.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
    const newNode = {
      id: newId,
      type: 'icNode',
      position: { x: 120 + (nodes.length % 3) * 320, y: 120 + Math.floor(nodes.length / 3) * 200 },
      data: { label: `${newId}: ${item.name}`, pins: cleanNodePins(item.name, item.pins) }
    };
    setNodes((nds) => [...nds, newNode]);
    setIsPaletteOpen(false);
  };

  // 🚀 SECURE NGINX PROXY SEARCH ENDPOINT
  const handleFlywheelSearch = async (queryText) => {
    const q = queryText || searchQueryInput;
    if (!q.trim() || isSearchingFlywheel) return;

    setIsSearchingFlywheel(true);
    addChatMessage({ sender: 'User', text: `Searching S3 Flywheel for: "${q}"` });

    try {
      const response = await fetch("/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, limit: 5 })
      });

      if (!response.ok) throw new Error(`Search API returned status ${response.status}`);
      const data = await response.json();
      setSearchResults(data.matches || []);
      addChatMessage({ sender: 'AI Copilot', text: `Found ${data.total_results || 0} matching schematics from S3 Flywheel index.` });
    } catch (error) {
      console.error("Flywheel Search Error:", error);
      addChatMessage({ sender: 'AI Copilot', text: `Search connection error: ${error.message}` });
    } finally {
      setIsSearchingFlywheel(false);
    }
  };

  // 🚀 ROBUST GENERATION PIPELINE WITH MULTI-SCHEMA SAFEGUARDS
  const executeGenerationQuery = async (queryText) => {
    if (!queryText.trim() || isLoading) return;

    if (isMobile) setIsLeftCopilotOpen(true);

    addChatMessage({ sender: 'User', text: queryText });
    setIsLoading(true);

    try {
      const ragEnhancedPrompt = typeof buildRAGPrompt === 'function' ? buildRAGPrompt(queryText) : queryText;
      const response = await generatePcbFromAmplify(ragEnhancedPrompt);
      const result = extractJsonFromOutput(response);

      addChatMessage({ sender: 'AI Copilot', text: result?.explanation || "Circuit netlist updated on canvas." });

      // Support all potential model schema variations (components, nodes, parts)
      const rawComponents = result?.components || result?.nodes || result?.parts || [];
      const rawConnections = result?.connections || result?.edges || result?.wires || [];

      const existingNodeMap = {};
      nodes.forEach(n => { existingNodeMap[n.id] = n; });
      const formattedNodes = [...nodes];
      const nodePinMap = {};

      nodes.forEach(n => {
        nodePinMap[n.id] = (n.data?.pins || []).map(p => p.id || p);
      });

      let primaryPowerNode = null;
      const columnYOffsets = { 0: 80, 1: 80, 2: 80, 3: 80 };

      if (Array.isArray(rawComponents) && rawComponents.length > 0) {
        rawComponents.forEach((c, index) => {
          const nodeId = c.id || `node_${index}`;
          const compName = c.name || c.label || c.type || c.part || 'Component';
          const formattedPins = cleanNodePins(compName, c.pins || c.terminals);
          nodePinMap[nodeId] = formattedPins.map(p => p.id);

          const upper = compName.toUpperCase();
          if (upper.includes('BAT') || upper.includes('CELL') || upper.includes('PWR') || upper.includes('AMS1117')) {
            primaryPowerNode = nodeId;
          }

          let col = 1;
          if (upper.includes('BAT') || upper.includes('CELL') || upper.includes('USB')) col = 0;
          else if (upper.includes('AMS1117') || upper.includes('REG') || upper.includes('RESISTOR')) col = 1;
          else if (upper.includes('ESP') || upper.includes('MCU') || upper.includes('LED')) col = 2;
          else col = 3;

          const cardHeight = Math.max(140, 60 + formattedPins.length * 26);
          const currentY = columnYOffsets[col];
          columnYOffsets[col] += cardHeight + 40;

          if (!existingNodeMap[nodeId]) {
            formattedNodes.push({
              id: nodeId,
              type: 'icNode',
              position: c.position || { x: 80 + col * 380, y: currentY },
              data: { label: `${nodeId}: ${compName}`, pins: formattedPins }
            });
          }
        });
      }

      if (!primaryPowerNode && formattedNodes.length > 0) primaryPowerNode = formattedNodes[0].id;

      const formattedEdges = [...edges];
      const addedKeys = new Set();
      edges.forEach(e => addedKeys.add(`${e.source}:${e.sourceHandle}->${e.target}:${e.targetHandle}`));

      const pushEdge = (src, sPin, tgt, tPin) => {
        if (!src || !tgt || src === tgt) return;
        const edgeKey = `${src}:${sPin}->${tgt}:${tPin}`;
        if (addedKeys.has(edgeKey)) return;
        addedKeys.add(edgeKey);

        const netStyle = getNetStyle(sPin, tPin);
        formattedEdges.push({
          id: `edge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          source: src,
          sourceHandle: `${sPin}_out`,
          target: tgt,
          targetHandle: `${tPin}_in`,
          type: 'step',
          animated: true,
          style: netStyle,
          label: `${sPin} ──► ${tPin}`,
          labelStyle: { fill: netStyle.stroke, fontWeight: 600, fontSize: 10, fontFamily: 'monospace' },
          labelBgStyle: { fill: '#18181b', rx: 4, ry: 4 }
        });
      };

      if (Array.isArray(rawConnections)) {
        rawConnections.forEach((conn) => {
          pushEdge(conn.source || conn.from, conn.sourcePin || conn.fromPin, conn.target || conn.to, conn.targetPin || conn.toPin);
        });
      }

      const verifiedEdges = autoPatchFloatingPins(formattedNodes, formattedEdges);

      setNodes(formattedNodes);
      setEdges(verifiedEdges);
      setTimeout(() => handleAutoLayout(), 50);

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
        filter: isSelected ? 'drop-shadow(0 0 6px #00E5FF)' : 'none'
      }
    };
  });

  const headerBtnStyle = {
    height: '32px', padding: '0 10px', fontSize: '11px', fontWeight: '600', borderRadius: '6px',
    border: '1px solid #27272a', backgroundColor: '#18181b', color: '#e4e4e7', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw', backgroundColor: '#09090b', color: '#f4f4f5', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* TOOLBOX DRAWER */}
      {isPaletteOpen && (
        <div style={{ position: 'fixed', top: '60px', right: isMobile ? '12px' : '80px', left: isMobile ? '12px' : 'auto', zIndex: 90, backgroundColor: '#18181b', border: '1px solid #00E5FF', borderRadius: '8px' }}>
          <ComponentPalette isOpen={true} onToggle={() => setIsPaletteOpen(false)} onAddComponent={handleManualAddComponent} />
        </div>
      )}

      {/* HEADER */}
      <header style={{ height: '52px', minHeight: '52px', borderBottom: '1px solid #27272a', backgroundColor: '#18181b', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '800', fontSize: '18px' }}>
            <span style={{ color: '#FF6B00' }}>pcb</span><span style={{ color: '#FFFFFF' }}>maker</span><span style={{ color: '#10B981' }}>.in</span>
          </span>
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => setIsRightDrawerOpen(!isRightDrawerOpen)} style={{ ...headerBtnStyle, color: drcErrors.length > 0 ? '#ef4444' : '#34d399' }}>
              🔍 DRC ({drcErrors.length})
            </button>
            <button onClick={handleAutoLayout} style={{ ...headerBtnStyle, color: '#38bdf8' }}>✨ Layout</button>
            <button onClick={exportFlywheelDataset} style={{ ...headerBtnStyle, backgroundColor: '#0284c7', color: '#ffffff', border: 'none' }}>📥 Dataset</button>
            <button onClick={() => setIsPaletteOpen(!isPaletteOpen)} style={{ ...headerBtnStyle, color: '#00E5FF', borderColor: '#00E5FF' }}>🧩 Toolbox</button>
            <button onClick={handleExportKiCad} style={{ ...headerBtnStyle, backgroundColor: '#0891b2', color: '#ffffff', border: 'none' }}>KiCad (.kicad_sch)</button>
            <button onClick={() => setIsAboutModalOpen(true)} style={{ ...headerBtnStyle, color: '#a1a1aa' }}>ℹ️ About</button>
          </div>
        )}
      </header>

      {/* WORKSPACE AREA */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', height: 'calc(100dvh - 52px)' }}>
        
        {/* LEFT COPILOT */}
        <aside style={{ width: isMobile ? '100vw' : '320px', borderRight: '1px solid #27272a', backgroundColor: '#18181b', display: 'flex', flexDirection: 'column', zIndex: 40, position: isMobile ? 'absolute' : 'relative', top: 0, bottom: 0, left: 0, height: '100%', transform: isLeftCopilotOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.3s ease' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #27272a', fontWeight: 'bold', fontSize: '11px', color: '#a1a1aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>AI Hardware Copilot</span>
            <button onClick={handleFullReset} style={{ backgroundColor: '#27272a', color: '#f43f5e', border: 'none', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>🗑️ Clear</button>
          </div>

          <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'monospace', fontSize: '11px' }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: m.sender.includes('AI') ? '#27272a' : '#083344', color: m.sender.includes('AI') ? '#67e8f9' : '#f4f4f5' }}>
                <div style={{ fontSize: '9px', color: '#71717a', marginBottom: '4px', fontWeight: 'bold' }}>{m.sender}</div>
                {m.text}
              </div>
            ))}
            {isLoading && (
              <div style={{ padding: '10px', color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚙️ Synthesizing components & netlist wires...</span>
              </div>
            )}
          </div>

          <div style={{ padding: '12px', borderTop: '1px solid #27272a', display: 'flex', gap: '8px' }}>
            <input value={inputMsg} disabled={isLoading} onChange={(e) => setInputMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Type design prompt..." style={{ flex: 1, backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '11px', padding: '10px', borderRadius: '6px', color: '#f4f4f5', outline: 'none' }} />
            <button onClick={handleSendMessage} disabled={isLoading} style={{ backgroundColor: '#0891b2', fontSize: '11px', padding: '0 14px', borderRadius: '6px', color: '#ffffff', border: 'none', cursor: 'pointer' }}>Send</button>
          </div>
        </aside>

        {/* CANVAS */}
        <main onDragOver={onDragOver} onDrop={onDrop} style={{ flex: 1, width: '100%', height: '100%', backgroundColor: '#09090b', position: 'relative' }}>
          
          {nodes.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', pointerEvents: 'none' }}>
              <div style={{ pointerEvents: 'auto', maxWidth: '540px', width: '100%', backgroundColor: 'rgba(24, 24, 27, 0.9)', backdropFilter: 'blur(16px)', border: '1px solid #27272a', borderRadius: '20px', padding: '36px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#ffffff', margin: 0 }}>Dream It. Design It. Deploy It.</h1>
                <div style={{ minHeight: '28px' }}><TypewriterText texts={HERO_SLOGANS} /></div>

                <form onSubmit={handleHeroSubmit} style={{ width: '100%', display: 'flex', gap: '8px' }}>
                  <input value={heroPromptInput} disabled={isLoading} onChange={(e) => setHeroPromptInput(e.target.value)} placeholder="e.g., design a 3.7v lithium ion charger..." style={{ flex: 1, backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '12px', padding: '12px', borderRadius: '8px', color: '#f4f4f5', outline: 'none' }} />
                  <button type="submit" disabled={isLoading} style={{ backgroundColor: '#00E5FF', color: '#09090b', fontWeight: '700', fontSize: '12px', padding: '0 18px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Build ⚡</button>
                </form>

                {/* S3 FLYWHEEL SEARCH WIDGET */}
                <div style={{ width: '100%', borderTop: '1px solid #27272a', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={searchQueryInput} disabled={isSearchingFlywheel} onChange={(e) => setSearchQueryInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFlywheelSearch()} placeholder="Search S3 Flywheel schematics..." style={{ flex: 1, backgroundColor: '#09090b', border: '1px solid #10b981', fontSize: '11px', padding: '10px', borderRadius: '6px', color: '#34d399', outline: 'none' }} />
                    <button type="button" onClick={() => handleFlywheelSearch()} disabled={isSearchingFlywheel} style={{ backgroundColor: '#10b981', color: '#09090b', fontWeight: '700', fontSize: '11px', padding: '0 14px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>🔍 Search Index</button>
                  </div>
                  {searchResults.length > 0 && (
                    <div style={{ maxHeight: '100px', overflowY: 'auto', backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '6px', padding: '6px', textAlign: 'left' }}>
                      {searchResults.map((res, i) => (
                        <div key={i} style={{ fontSize: '10px', color: '#67e8f9', padding: '2px 0' }}>[{res.source}] (Distance: {res.distance?.toFixed(2)})</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <FlowErrorBoundary>
            <ReactFlow nodes={nodes} edges={styledEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onEdgeClick={handleEdgeClick} onNodeClick={handleNodeClick} nodeTypes={nodeTypes} colorMode="dark" fitView>
              <Background color="#27272a" gap={20} size={1} />
              <Controls style={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }} />
            </ReactFlow>
          </FlowErrorBoundary>
        </main>

        {/* RIGHT INSPECTOR DRAWER */}
        <aside style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: isMobile ? '100vw' : '320px', backgroundColor: '#18181b', borderLeft: '1px solid #27272a', padding: '16px', fontFamily: 'monospace', fontSize: '11px', zIndex: 30, overflowY: 'auto', transform: isRightDrawerOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #27272a', paddingBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', color: '#a1a1aa' }}>DRC & Inspector</span>
            <button onClick={() => setIsRightDrawerOpen(false)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ color: '#34d399' }}>{drcErrors.length === 0 ? '✓ No DRC errors detected.' : `${drcErrors.length} issue(s) found.`}</div>
        </aside>
      </div>
      
      <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
    </div>
  );
}