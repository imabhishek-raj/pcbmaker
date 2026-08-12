// src/components/ICNode.jsx
import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function ICNode({ data }) {
  return (
    <div 
      style={{ 
        background: '#18181b', 
        border: '1px solid #27272a', 
        borderRadius: '8px', 
        padding: '12px', 
        color: '#f4f4f5',
        minWidth: '160px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
      }}
    >
      {/* Node Header / Title (Safe for dragging) */}
      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#00E5FF', marginBottom: '8px' }}>
        {data.label}
      </div>

      {/* Interactive content container MUST have 'nodrag' so touch events don't crash */}
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {data.pins?.map((pin, index) => {
          const pinId = typeof pin === 'object' ? (pin.id || pin.label) : pin;
          return (
            <div key={index} style={{ fontSize: '10px', color: '#a1a1aa', display: 'flex', justifyContent: 'space-between' }}>
              <span>Pin: {pinId}</span>
              <span style={{ color: '#10b981' }}>●</span>
              
              {/* Handles */}
              <Handle 
                type="target" 
                position={Position.Left} 
                id={`${pinId}_in`} 
                style={{ background: '#00E5FF', borderRadius: '4px' }} 
              />
              <Handle 
                type="source" 
                position={Position.Right} 
                id={`${pinId}_out`} 
                style={{ background: '#00E5FF', borderRadius: '4px' }} 
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}