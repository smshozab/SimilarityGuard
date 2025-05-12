/**
 * Options page script for SimilarityGuard
 */

import { 
  getThreshold, 
  setThreshold, 
  getSiteSettings, 
  getExtensionState 
} from './utils/storage.js';

// Default settings
const DEFAULT_SETTINGS = {
  threshold: 0.8,
  detectionSources: ['ai-generated', 'web-content', 'academic'],
  notificationStyle: 'detailed',
  autoHideNotification: '10',
  playSound: true,
  monitoredEditors: ['google-docs', 'microsoft-word', 'text-inputs'],
  minSentenceLength: 10
};

// Initialize options page
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

// Load current settings
async function loadSettings() {
  try {
    // Get settings from storage
    const threshold = await getThreshold();
    
    // Update UI with current settings
    document.getElementById('threshold-slider').value = threshold * 100;
    document.getElementById('threshold-value').textContent = `${Math.round(threshold * 100)}%`;
    
    // We would normally load the rest of the settings here
    // For demonstration, we'll just use the default settings
    
    const detectionSources = document.querySelectorAll('input[name="detection-sources"]');
    detectionSources.forEach(checkbox => {
      checkbox.checked = DEFAULT_SETTINGS.detectionSources.includes(checkbox.value);
    });
    
    const notificationStyle = document.querySelector(`input[name="notification-style"][value="${DEFAULT_SETTINGS.notificationStyle}"]`);
    if (notificationStyle) {
      notificationStyle.checked = true;
    }
    
    const autoHide = document.querySelector(`input[name="notification-hide"][value="${DEFAULT_SETTINGS.autoHideNotification}"]`);
    if (autoHide) {
      autoHide.checked = true;
    }
    
    document.getElementById('play-sound').checked = DEFAULT_SETTINGS.playSound;
    
    const monitoredEditors = document.querySelectorAll('input[name="monitored-editors"]');
    monitoredEditors.forEach(checkbox => {
      checkbox.checked = DEFAULT_SETTINGS.monitoredEditors.includes(checkbox.value);
    });
    
    document.getElementById('min-sentence-length').value = DEFAULT_SETTINGS.minSentenceLength;
    
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Set up event listeners
function setupEventListeners() {
  // Threshold slider
  const thresholdSlider = document.getElementById('threshold-slider');
  const thresholdValue = document.getElementById('threshold-value');
  
  thresholdSlider.addEventListener('input', () => {
    thresholdValue.textContent = `${thresholdSlider.value}%`;
  });
  
  // Save button
  document.getElementById('save-button').addEventListener('click', async () => {
    try {
      await saveSettings();
      showSaveAnimation();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  });
  
  // Reset button
  document.getElementById('reset-button').addEventListener('click', async () => {
    try {
      await resetSettings();
    } catch (error) {
      console.error('Error resetting settings:', error);
    }
  });
}

// Save settings
async function saveSettings() {
  try {
    // Threshold
    const threshold = parseInt(document.getElementById('threshold-slider').value) / 100;
    await setThreshold(threshold);
    
    // In a full implementation, we would save all settings to storage
    // For demonstration, we'll just show a success message
    showMessage('Settings saved successfully!');
  } catch (error) {
    console.error('Error saving settings:', error);
    showMessage('Error saving settings. Please try again.', true);
  }
}

// Reset settings to defaults
async function resetSettings() {
  try {
    // Reset threshold
    await setThreshold(DEFAULT_SETTINGS.threshold);
    
    // Reload settings to update UI
    await loadSettings();
    
    showMessage('Settings reset to defaults.');
  } catch (error) {
    console.error('Error resetting settings:', error);
    showMessage('Error resetting settings. Please try again.', true);
  }
}

// Show save animation
function showSaveAnimation() {
  const sections = document.querySelectorAll('.settings-section');
  
  sections.forEach(section => {
    section.classList.add('setting-highlight');
    
    setTimeout(() => {
      section.classList.remove('setting-highlight');
    }, 1500);
  });
}

// Show a message to the user
function showMessage(message, isError = false) {
  // Check if a message element already exists
  let messageElement = document.querySelector('.message');
  
  if (!messageElement) {
    // Create new message element
    messageElement = document.createElement('div');
    messageElement.className = 'message';
    document.querySelector('.container').prepend(messageElement);
  }
  
  // Update class and content
  messageElement.className = `message ${isError ? 'error' : 'success'}`;
  messageElement.textContent = message;
  
  // Show the message
  messageElement.style.display = 'block';
  
  // Create dismiss button
  const dismissButton = document.createElement('button');
  dismissButton.className = 'dismiss-button';
  dismissButton.innerHTML = '&times;';
  dismissButton.addEventListener('click', () => {
    messageElement.style.display = 'none';
  });
  
  messageElement.appendChild(dismissButton);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (messageElement.parentNode) {
      messageElement.style.display = 'none';
    }
  }, 5000);
}