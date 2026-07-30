import React, { useState } from 'react';
import PCBVisualizer from './PCBVisualizer';
import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);
const client = generateClient();

const initialBlueprint = {
  components: [
    { id: "MCU1", name: "ESP32-S3", type: "microcontroller" },
    { id: "REG1", name: "AMS1117-3.3V", type: "voltage-regulator" },
    { id: "CONN1", name: "USB-C 24-Pin", type: "connector" }
  ],
  connections: [
    { source: "CONN1", sourcePin: "VBUS", target: "REG1", targetPin: "VIN" },
    { source: "REG1", sourcePin: "VOUT", target: "MCU1", targetPin: "3V3" },
    { source: "CONN1", sourcePin: "GND", target: "MCU1", targetPin: "GND" }
  ]
};

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [designData, setDesignData] = useState(initialBlueprint);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      const response = await client.queries.generatePcb({ prompt });
      
      if (response?.data) {
        let raw = response.data;
        if (typeof raw === 'string') {
          // Clean up markdown fences and extra whitespace
          raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          
          const start = raw.indexOf('{');
          const end = raw.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) {
            raw = raw.substring(start, end + 1);
          }
          
          const parsedData = JSON.parse(raw);
          setDesignData(parsedData);
        } else {
          setDesignData(raw);
        }
      }
    } catch (err) {
      console.error("Backend AI call failed:", err);
      alert("AI response received, but had formatting issues. Try clicking Generate again!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#18181b', color: '#f4f4f5', fontFamily: 'sans-serif' }}>
      <header style={{ padding: '16px 32px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>
          pcbmaker.in <span style={{ fontSize: '12px', background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: '12px', marginLeft: '8px' }}>🇮🇳 India Hardware AI</span>
        </h2>
      </header>

      <div style={{ display: 'flex', gap: '24px', padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ width: '380px', background: '#09090b', padding: '24px', borderRadius: '12px', border: '1px solid #27272a' }}>
          <h3 style={{ marginTop: 0 }}>Prompt Assistant</h3>
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ fontSize: '14px', color: '#a1a1aa' }}>Describe the PCB you want to manufacture:</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Design a quadcopter flight controller board with an ESP32-S3 and four 8520 coreless motor FET drivers..."
              style={{ height: '140px', padding: '12px', background: '#18181b', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px', resize: 'none', fontSize: '14px' }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {loading ? "DeepSeek AI is Generating..." : "Generate Schematic"}
            </button>
          </form>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0 }}>Interactive Blueprint Preview</h3>
          <PCBVisualizer designData={designData} />
        </div>
      </div>
    </div>
  );
}