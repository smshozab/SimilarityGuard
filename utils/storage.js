/**
 * Storage utility functions for the extension
 */

// Get current similarity threshold
export async function getThreshold() {
  const data = await chrome.storage.local.get('threshold');
  return data.threshold || 0.8; // Default to 0.8 (80%)
}

// Set similarity threshold
export async function setThreshold(threshold) {
  await chrome.storage.local.set({ threshold });
  return { success: true };
}

// Get site-specific settings
export async function getSiteSettings() {
  const data = await chrome.storage.local.get('siteSettings');
  return data.siteSettings || {};
}

// Update settings for a specific site
export async function updateSiteSetting(hostname, settings) {
  const siteSettings = await getSiteSettings();
  
  siteSettings[hostname] = {
    ...siteSettings[hostname],
    ...settings
  };
  
  await chrome.storage.local.set({ siteSettings });
  return { success: true };
}

// Get detection history
export async function getDetectionHistory() {
  const data = await chrome.storage.local.get('detectionHistory');
  return data.detectionHistory || [];
}

// Clear detection history
export async function clearDetectionHistory() {
  await chrome.storage.local.set({ detectionHistory: [] });
  return { success: true };
}

// Get extension state (enabled/disabled)
export async function getExtensionState() {
  const data = await chrome.storage.local.get('isEnabled');
  return data.isEnabled !== undefined ? data.isEnabled : true;
}

// Set extension state
export async function setExtensionState(isEnabled) {
  await chrome.storage.local.set({ isEnabled });
  return { success: true };
}

// Export detection history as JSON
export async function exportHistory() {
  const history = await getDetectionHistory();
  
  const exportData = {
    timestamp: Date.now(),
    history: history
  };
  
  return JSON.stringify(exportData, null, 2);
}