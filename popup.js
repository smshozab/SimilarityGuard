/**
 * Popup script for SimilarityGuard
 */

import { 
  getExtensionState, 
  setExtensionState, 
  getThreshold, 
  setThreshold, 
  getSiteSettings, 
  updateSiteSetting,
  getDetectionHistory,
  clearDetectionHistory,
  exportHistory
} from './utils/storage.js';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize UI
  await initializeToggle();
  await initializeTabs();
  await initializeThresholdControl();
  await initializeCurrentSite();
  await initializeHistory();
  await initializeStats();
  await initializeEventListeners();
});

// Initialize the extension toggle switch
async function initializeToggle() {
  const toggle = document.getElementById('extension-toggle');
  const isEnabled = await getExtensionState();
  
  toggle.checked = isEnabled;
  
  const toggleLabel = document.querySelector('.toggle-label');
  toggleLabel.textContent = isEnabled ? 'Enabled' : 'Disabled';
  
  toggle.addEventListener('change', async () => {
    const newState = toggle.checked;
    await setExtensionState(newState);
    
    // Update label
    toggleLabel.textContent = newState ? 'Enabled' : 'Disabled';
    
    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'STATE_CHANGED', 
        isEnabled: newState 
      });
    });
  });
}

// Initialize tabs
async function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Update active button
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
      
      // Update active pane
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
      });
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}

// Initialize threshold control
async function initializeThresholdControl() {
  const slider = document.getElementById('threshold-slider');
  const value = document.getElementById('threshold-value');
  
  // Get current threshold
  const threshold = await getThreshold();
  
  // Set initial values
  slider.value = threshold * 100;
  value.textContent = `${Math.round(threshold * 100)}%`;
  
  // Update on change
  slider.addEventListener('input', () => {
    value.textContent = `${slider.value}%`;
  });
  
  slider.addEventListener('change', async () => {
    const newThreshold = parseInt(slider.value) / 100;
    await setThreshold(newThreshold);
  });
}

// Initialize current site settings
async function initializeCurrentSite() {
  const siteToggle = document.getElementById('site-toggle');
  const siteNameElement = document.getElementById('current-site-name');
  
  // Get current site
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(tabs[0].url);
  const hostname = url.hostname;
  
  // Update site name
  siteNameElement.textContent = hostname;
  
  // Get site settings
  const siteSettings = await getSiteSettings();
  const currentSiteSettings = siteSettings[hostname] || { enabled: true };
  
  // Set toggle
  siteToggle.checked = currentSiteSettings.enabled;
  
  // Add event listener
  siteToggle.addEventListener('change', async () => {
    await updateSiteSetting(hostname, { enabled: siteToggle.checked });
    
    // Notify content script if needed
    chrome.tabs.sendMessage(tabs[0].id, { 
      type: 'SITE_SETTINGS_CHANGED', 
      settings: { enabled: siteToggle.checked }
    });
  });
}

// Initialize history view
async function initializeHistory() {
  const historyList = document.getElementById('history-list');
  const recentList = document.getElementById('recent-list');
  
  // Get history
  const history = await getDetectionHistory();
  
  // Update history list
  if (history.length > 0) {
    historyList.innerHTML = '';
    
    for (const entry of history) {
      const detectionItem = createDetectionItem(entry);
      historyList.appendChild(detectionItem);
    }
    
    // Update recent list with last 3 items
    recentList.innerHTML = '';
    
    const recentItems = history.slice(0, 3);
    
    if (recentItems.length > 0) {
      for (const entry of recentItems) {
        const detectionItem = createDetectionItem(entry);
        recentList.appendChild(detectionItem);
      }
    } else {
      recentList.innerHTML = '<div class="empty-state">No recent detections</div>';
    }
  }
}

// Create a detection item element
function createDetectionItem(entry) {
  const detectionItem = document.createElement('div');
  detectionItem.className = 'detection-item';
  
  const similarity = entry.similarities[0]; // Get first similarity
  
  detectionItem.innerHTML = `
    <div class="detection-text">"${truncateText(similarity.sentence, 80)}"</div>
    <div class="detection-meta">
      <div class="detection-source">Source: ${similarity.source}</div>
      <div class="detection-score">${Math.round(similarity.score * 100)}%</div>
    </div>
  `;
  
  return detectionItem;
}

// Initialize stats
async function initializeStats() {
  const currentPageElement = document.getElementById('current-page-detections');
  const todayElement = document.getElementById('today-detections');
  const totalElement = document.getElementById('total-detections');
  
  // Get history
  const history = await getDetectionHistory();
  
  // Calculate stats
  const total = history.length;
  
  // Calculate today's detections
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  
  const todayCount = history.filter(entry => entry.timestamp >= todayTimestamp).length;
  
  // Get current page detections
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_CURRENT_TEXT' }, response => {
    if (chrome.runtime.lastError) {
      // Content script not available
      currentPageElement.textContent = '0';
      return;
    }
    
    // Count similarities for current page
    let currentPageCount = 0;
    
    if (response && response.text) {
      // We'd normally ask the background script to check, but for demo just show 1 if there's text
      currentPageCount = response.text.length > 50 ? 1 : 0;
    }
    
    currentPageElement.textContent = currentPageCount.toString();
  });
  
  // Update UI
  todayElement.textContent = todayCount.toString();
  totalElement.textContent = total.toString();
}

// Initialize event listeners
async function initializeEventListeners() {
  // Clear history button
  document.getElementById('clear-history').addEventListener('click', async () => {
    await clearDetectionHistory();
    
    // Update UI
    document.getElementById('history-list').innerHTML = '<div class="empty-state">No detection history</div>';
    document.getElementById('recent-list').innerHTML = '<div class="empty-state">No recent detections</div>';
    
    // Update stats
    document.getElementById('today-detections').textContent = '0';
    document.getElementById('total-detections').textContent = '0';
  });
  
  // Export history button
  document.getElementById('export-history').addEventListener('click', async () => {
    const exportData = await exportHistory();
    
    // Create download link
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `similarity-guard-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });
  
  // Help, feedback, and privacy links
  document.getElementById('help-link').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://similarityguard.example.com/help' });
  });
  
  document.getElementById('feedback-link').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://similarityguard.example.com/feedback' });
  });
  
  document.getElementById('privacy-link').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://similarityguard.example.com/privacy' });
  });
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}