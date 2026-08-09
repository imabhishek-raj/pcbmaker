// src/store/useBoardStore.js
import { create } from 'zustand';

const LOCAL_CHAT_KEY = 'pcbmaker_chat_history_v1';

const getInitialChat = () => {
  const saved = localStorage.getItem(LOCAL_CHAT_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load saved chat history:", e);
    }
  }
  return [
    { sender: 'AI Copilot', text: 'Welcome back to pcbmaker.in! Describe your circuit requirement or drag components onto the canvas.' }
  ];
};

export const useBoardStore = create((set) => ({
  selectedNode: null,
  setSelectedNode: (node) => set({ selectedNode: node }),

  // Persistent Chat History
  chatMessages: getInitialChat(),
  addChatMessage: (msg) => set((state) => {
    const updated = [...state.chatMessages, msg];
    localStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify(updated));
    return { chatMessages: updated };
  }),
  clearChatHistory: () => set(() => {
    localStorage.removeItem(LOCAL_CHAT_KEY);
    return {
      chatMessages: [
        { sender: 'AI Copilot', text: 'Chat history cleared. What would you like to build next?' }
      ]
    };
  }),

  // DRC Warnings State
  drcErrors: [],
  setDrcErrors: (errors) => set({ drcErrors: errors }),
}));