// src/utils/promptEnhancer.js
import { retrieveRAGContext } from './componentKnowledgeBase';

export function buildRAGPrompt(userPrompt) {
  const ragContext = retrieveRAGContext(userPrompt) || '';

  // Minimal, direct hardware spec injection
  if (ragContext) {
    return `${userPrompt}\n${ragContext}\nOutput ONLY valid schematic JSON.`;
  }

  return `${userPrompt}\nOutput ONLY valid schematic JSON with components and connections.`;
}