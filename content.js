/**
 * Content script for monitoring text input on web pages
 */

// Track if the extension is enabled
let isExtensionEnabled = true;

// Store the last processed text to avoid redundant processing
let lastProcessedText = '';

// Store detected similarities
let currentSimilarities = [];

// Store the notification element
let notificationElement = null;

// Initialize content script
function initialize() {
  // Check if the extension is enabled
  chrome.runtime.sendMessage({ type: 'GET_EXTENSION_STATE' }, response => {
    isExtensionEnabled = response.isEnabled;
    setupListeners();
  });
  
  // Listen for state changes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATE_CHANGED') {
      isExtensionEnabled = message.isEnabled;
      
      // Hide notification if extension is disabled
      if (!isExtensionEnabled && notificationElement) {
        notificationElement.style.display = 'none';
      }
      
      sendResponse({ success: true });
      return true;
    }
    
    if (message.type === 'GET_CURRENT_TEXT') {
      sendResponse({ text: getCurrentPageText() });
      return true;
    }
  });
}

// Set up event listeners based on the current site
function setupListeners() {
  const hostname = window.location.hostname;
  
  if (hostname.includes('docs.google.com')) {
    // Google Docs specific handling
    setupGoogleDocsListener();
  } else {
    // Generic content editable and input fields
    setupGenericInputListeners();
  }
}

// Set up listener for Google Docs
function setupGoogleDocsListener() {
  // Google Docs uses a complex iframe structure
  // We need to monitor the main editable area
  
  // Wait for the editor to load
  const checkInterval = setInterval(() => {
    const editorContainer = document.querySelector('.kix-appview-editor');
    if (editorContainer) {
      clearInterval(checkInterval);
      
      // Monitor for changes using MutationObserver
      const observer = new MutationObserver(debounce(() => {
        if (!isExtensionEnabled) return;
        processCurrentText();
      }, 1000));
      
      observer.observe(editorContainer, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }, 1000);
}

// Set up listeners for generic input fields and contentEditable elements
function setupGenericInputListeners() {
  // Monitor for keyup events on the whole document
  document.addEventListener('keyup', debounce(event => {
    if (!isExtensionEnabled) return;
    
    // Check if the target is an input field or contentEditable
    const target = event.target;
    if (
      target.tagName === 'TEXTAREA' || 
      target.tagName === 'INPUT' && target.type === 'text' ||
      target.contentEditable === 'true'
    ) {
      processCurrentText();
    }
  }, 1000));
}

// Get the current text content being edited
function getCurrentPageText() {
  const hostname = window.location.hostname;
  
  if (hostname.includes('docs.google.com')) {
    // For Google Docs, extract text from the editor
    const textElements = document.querySelectorAll('.kix-paragraphrenderer');
    return Array.from(textElements)
      .map(el => el.textContent)
      .join('\n');
  }
  
  // For generic pages, try to get text from active element
  const activeElement = document.activeElement;
  
  if (activeElement) {
    if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
      return activeElement.value;
    } else if (activeElement.contentEditable === 'true') {
      return activeElement.textContent;
    }
  }
  
  return '';
}

// Process the current text content
function processCurrentText() {
  const currentText = getCurrentPageText();
  
  // Skip if no text or same as last processed
  if (!currentText || currentText === lastProcessedText) {
    return;
  }
  
  // Update last processed text
  lastProcessedText = currentText;
  
  // Send to background script for similarity check
  chrome.runtime.sendMessage(
    { type: 'CHECK_SIMILARITY', text: currentText },
    response => {
      if (response.error) {
        console.error('Error checking similarity:', response.error);
        return;
      }
      
      currentSimilarities = response.similarities;
      
      // Show notification if similarities found
      if (currentSimilarities.length > 0) {
        showSimilarityNotification(currentSimilarities);
      }
    }
  );
}

// Show notification for detected similarities
function showSimilarityNotification(similarities) {
  // Remove existing notification if present
  if (notificationElement) {
    document.body.removeChild(notificationElement);
  }
  
  // Create notification element
  notificationElement = document.createElement('div');
  notificationElement.className = 'similarity-guard-notification';
  
  // Add notification content
  notificationElement.innerHTML = `
    <div class="similarity-guard-header">
      <span class="similarity-guard-logo">SimilarityGuard</span>
      <button class="similarity-guard-close">&times;</button>
    </div>
    <div class="similarity-guard-content">
      <p class="similarity-guard-alert">
        <strong>⚠️ Similarity Detected</strong>
      </p>
      <p class="similarity-guard-details">
        ${similarities.length} sentence${similarities.length > 1 ? 's' : ''} 
        with high similarity to existing content found.
      </p>
      <div class="similarity-guard-matches">
        ${similarities.map(sim => `
          <div class="similarity-guard-match">
            <div class="similarity-guard-match-text">"${sim.sentence}"</div>
            <div class="similarity-guard-match-source">Source: ${sim.source}</div>
            <div class="similarity-guard-match-score">
              Similarity: ${Math.round(sim.score * 100)}%
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="similarity-guard-footer">
      <button class="similarity-guard-settings">Settings</button>
      <button class="similarity-guard-view-all">View All</button>
    </div>
  `;
  
  // Add event listeners
  notificationElement.querySelector('.similarity-guard-close').addEventListener('click', () => {
    notificationElement.classList.add('similarity-guard-hiding');
    setTimeout(() => {
      if (notificationElement && notificationElement.parentNode) {
        document.body.removeChild(notificationElement);
        notificationElement = null;
      }
    }, 300);
  });
  
  notificationElement.querySelector('.similarity-guard-settings').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
  });
  
  notificationElement.querySelector('.similarity-guard-view-all').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
  });
  
  // Add to body
  document.body.appendChild(notificationElement);
  
  // Trigger animation
  setTimeout(() => {
    notificationElement.classList.add('similarity-guard-visible');
  }, 10);
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (notificationElement) {
      notificationElement.classList.add('similarity-guard-hiding');
      setTimeout(() => {
        if (notificationElement && notificationElement.parentNode) {
          document.body.removeChild(notificationElement);
          notificationElement = null;
        }
      }, 300);
    }
  }, 10000);
}

// Debounce function to limit processing frequency
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Start the content script
initialize();