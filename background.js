import { similarityCheck } from './utils/similarity.js';
import { getThreshold, getSiteSettings } from './utils/storage.js';
import { fetchDatabaseContent } from './utils/api.js';

// Initialize extension state
let knownContent = [];
let isEnabled = true;

// Fetch the database of known content on startup
async function initializeDatabase() {
  try {
    knownContent = await fetchDatabaseContent();
    console.log('Database initialized with content');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_SIMILARITY') {
    if (!isEnabled) {
      sendResponse({ similarities: [] });
      return true;
    }
    
    processSimilarityCheck(message.text, sender.tab.id)
      .then(similarities => {
        sendResponse({ similarities });
      })
      .catch(error => {
        console.error('Error processing similarity check:', error);
        sendResponse({ similarities: [], error: error.message });
      });
    return true; // Required for async sendResponse
  }
  
  if (message.type === 'GET_EXTENSION_STATE') {
    sendResponse({ isEnabled });
    return true;
  }
  
  if (message.type === 'SET_EXTENSION_STATE') {
    isEnabled = message.isEnabled;
    chrome.storage.local.set({ isEnabled });
    sendResponse({ success: true });
    return true;
  }
});

// Process similarity check for text
async function processSimilarityCheck(text, tabId) {
  try {
    const threshold = await getThreshold();
    const siteSettings = await getSiteSettings();
    
    // Get hostname from tabId
    const tab = await chrome.tabs.get(tabId);
    const url = new URL(tab.url);
    const hostname = url.hostname;
    
    // Check if site is disabled
    if (siteSettings[hostname] && !siteSettings[hostname].enabled) {
      return [];
    }
    
    // Split text into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length === 0) return [];
    
    // Check each sentence for similarity
    const similarities = [];
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length < 10) continue; // Skip short sentences
      
      // Check against database
      for (const item of knownContent) {
        const score = await similarityCheck(trimmedSentence, item.text);
        
        if (score >= threshold) {
          similarities.push({
            sentence: trimmedSentence,
            matchedText: item.text,
            source: item.source,
            score: score,
            timestamp: Date.now()
          });
          break; // Stop after first match above threshold
        }
      }
    }
    
    // Store detection in history if any found
    if (similarities.length > 0) {
      storeDetectionInHistory(similarities, text);
    }
    
    return similarities;
  } catch (error) {
    console.error('Error in similarity processing:', error);
    throw error;
  }
}

// Store detection in history
async function storeDetectionInHistory(similarities, contextText) {
  const now = Date.now();
  const history = await chrome.storage.local.get('detectionHistory').then(data => data.detectionHistory || []);
  
  const newEntry = {
    id: `detection-${now}`,
    timestamp: now,
    similarities,
    contextText: contextText.substring(0, 500) // Store limited context
  };
  
  // Limit history to 100 entries
  const updatedHistory = [newEntry, ...history].slice(0, 100);
  
  await chrome.storage.local.set({ detectionHistory: updatedHistory });
}

// Initialize the extension
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.local.set({
    isEnabled: true,
    threshold: 0.8, // 80% similarity threshold by default
    siteSettings: {},
    detectionHistory: []
  });
  
  // Initialize database
  initializeDatabase();
});

// Re-initialize database periodically (every 24 hours)
setInterval(initializeDatabase, 24 * 60 * 60 * 1000);