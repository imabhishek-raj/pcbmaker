// src/components/ICNode.jsx
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const ICNode = memo(({ id, data, selected }) => {
  const pins = data?.pins || [];

  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: '8px',
      backgroundColor: '#18181b',
      border: selected ? '2px solid #00E5FF' : '1px solid #27272a',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      minWidth: '170px',
      fontFamily: 'monospace',
      color: '#f4f4f5',
      position: 'relative'
    }}>
      {/* Component Title */}
      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#22d3ee', marginBottom: '8px', borderBottom: '1px solid #27272a', paddingBottom: '4px' }}>
        {data?.label || id}
      </div>

      {/* Pin List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {pins.map((pin) => {
          const pinId = String(typeof pin === 'string' ? pin : (pin.id || pin.label));
          const pinLabel = String(typeof pin === 'string' ? pin : (pin.label || pin.id));

          return (
            <div key={pinId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', height: '18px' }}>
              
              {/* Left Terminal Handle */}
              <Handle
                type="target"
                position={Position.Left}
                id={`${pinId}_in`}
                isConnectableStart={true}
                isConnectableEnd={true}
                style={{ left: '-19px', width: '8px', height: '8px', backgroundColor: '#00E5FF', borderRadius: '50%', border: '2px solid #09090b' }}
              />

              <span style={{ fontSize: '10px', color: '#a1a1aa', margin: '0 auto' }}>{pinLabel}</span>

              {/* Right Terminal Handle */}
              <Handle
                type="source"
                position={Position.Right}
                id={`${pinId}_out`}
                isConnectableStart={true}
                isConnectableEnd={true}
                style={{ right: '-19px', width: '8px', height: '8px', backgroundColor: '#00E5FF', borderRadius: '50%', border: '2px solid #09090b' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default ICNode;