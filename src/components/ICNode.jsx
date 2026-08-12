// src/components/ICNode.jsx
import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function ICNode({ data }) {
  const pins = data?.pins || [];

  return (
    <div 
      style={{ 
        background: '#18181b', 
        border: '1px solid #27272a', 
        borderRadius: '8px', 
        padding: '12px', 
        color: '#f4f4f5',
        minWidth: '180px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        fontFamily: 'monospace'
      }}
    >
      {/* Node Header */}
      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#00E5FF', marginBottom: '8px', borderBottom: '1px solid #27272a', paddingBottom: '6px' }}>
        {data.label}
      </div>

      {/* Pins List container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {pins.map((pin, index) => {
          const pinId = typeof pin === 'object' ? (pin.id || pin.label) : pin;
          return (
            <div 
              key={index} 
              style={{ 
                fontSize: '10px', 
                color: '#a1a1aa', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItem: 'center',
                position: 'relative',
                padding: '4px 0'
              }}
            >
              <span>Pin: {pinId}</span>
              <span style={{ color: '#10b981' }}>●</span>
              
              {/* TARGET HANDLE (LEFT) */}
              <Handle 
                type="target" 
                position={Position.Left} 
                id={`${pinId}_in`} 
                style={{ 
                  background: '#00E5FF', 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%',
                  left: '-16px' 
                }} 
              />
              
              {/* SOURCE HANDLE (RIGHT) */}
              <Handle 
                type="source" 
                position={Position.Right} 
                id={`${pinId}_out`} 
                style={{ 
                  background: '#00E5FF', 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%',
                  right: '-16px' 
                }} 
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}