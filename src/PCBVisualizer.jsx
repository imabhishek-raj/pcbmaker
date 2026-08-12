// src/components/PCBVisualizer.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export default function PCBVisualizer({ designData }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const nodes = useMemo(() => {
    if (!designData?.components) return [];
    return designData.components.map((comp, index) => ({
      id: comp.id,
      position: { x: (index % 3) * 260 + 50, y: Math.floor(index / 3) * 180 + 50 },
      data: {
        label: (
          <div style={{ padding: '8px', borderRadius: '6px', background: '#ffffff', color: '#000000', border: '1px solid #ccc', userSelect: 'none', WebkitUserSelect: 'none' }}>
            <strong style={{ color: '#2563eb' }}>{comp.id}</strong>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{comp.name}</div>
            <div style={{ fontSize: '10px', background: '#eee', padding: '2px 4px', borderRadius: '3px', marginTop: '4px' }}>
              {comp.type}
            </div>
          </div>
        )
      },
      style: { width: 180 }
    }));
  }, [designData]);

  const edges = useMemo(() => {
    if (!designData?.connections) return [];
    return designData.connections.map((conn, index) => ({
      id: `trace-${index}`,
      source: conn.source,
      target: conn.target,
      label: `${conn.sourcePin || ''} -> ${conn.targetPin || ''}`,
      animated: true,
      style: { stroke: '#10b981', strokeWidth: 3 },
    }));
  }, [designData]);

  return (
    <div style={{ width: '100%', height: '550px', background: '#09090b', borderRadius: '12px', border: '1px solid #27272a', position: 'relative', touchAction: 'none' }}>
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        fitView
        nodesDraggable={!isMobile} // 👈 Prevents mobile touch-release crashes on the visualizer canvas too
        panOnScroll={true}
        zoomOnPinch={true}
        panOnDrag={true}
        preventScrolling={false}
      >
        <Background color="#3f3f46" gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}