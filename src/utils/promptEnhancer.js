// src/utils/promptEnhancer.js
import { retrieveRAGContext } from './componentKnowledgeBase';

export function buildRAGPrompt(userPrompt) {
  const ragContext = retrieveRAGContext(userPrompt) || '';
  
  // Minimal spec injection so the LLM doesn't echo paragraphs
  if (ragContext) {
    return `${userPrompt}. Rules: ${ragContext}`;
  }

  return userPrompt;
}