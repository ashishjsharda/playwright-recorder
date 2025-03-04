let isRecording = false;
let isExtensionConnected = true;

console.log('Playwright Recorder: Content script loaded on', window.location.href);

// Check if extension is still connected
function checkConnection() {
  if (!chrome.runtime) {
    isExtensionConnected = false;
    return false;
  }
  return true;
}

// Safely send message to background script
function sendMessageSafely(message) {
  if (!checkConnection()) {
    console.log('Extension connection lost, not sending message');
    return;
  }

  console.log('Sending message to background:', message);
  try {
    chrome.runtime.sendMessage(message, function(response) {
      if (chrome.runtime.lastError) {
        console.log("Connection error:", chrome.runtime.lastError.message);
      } else {
        console.log('Message sent successfully, response:', response);
      }
    });
  } catch (e) {
    console.log("Failed to send message:", e);
    isExtensionConnected = false;
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Content script received message:', message, 'on page:', window.location.href);

  if (message.command === 'startRecording') {
    isRecording = true;
    addEventListeners();
    console.log('Recording started on', window.location.href);
    sendResponse({status: 'recording_started', url: window.location.href});
  }
  else if (message.command === 'stopRecording') {
    isRecording = false;
    removeEventListeners();
    console.log('Recording stopped');
    sendResponse({status: 'recording_stopped'});
  }
});

function addEventListeners() {
  console.log('Adding event listeners on', window.location.href);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('change', handleChange, true);
}

function removeEventListeners() {
  console.log('Removing event listeners');
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('change', handleChange, true);
}

function handleClick(event) {
  console.log('Click event detected:', event.target);

  if (!isRecording || !isExtensionConnected) {
    console.log('Not recording or not connected, ignoring click');
    return;
  }

  const selector = generateSelector(event.target);
  if (selector) {
    console.log('Click recorded with selector:', selector);
    sendMessageSafely({
      type: 'action',
      action: {
        type: 'click',
        selector: selector
      }
    });
  } else {
    console.log('Could not generate selector for clicked element');
  }
}

function handleInput(event) {
  if (!isRecording || !isExtensionConnected) return;

  console.log('Input event detected:', event.target);

  // Only record input event when it's finished (debounce)
  if (event.target._inputTimer) {
    clearTimeout(event.target._inputTimer);
  }

  event.target._inputTimer = setTimeout(() => {
    console.log('Input event finalized on:', event.target);
    const selector = generateSelector(event.target);
    if (selector && event.target.value !== undefined) {
      console.log('Input recorded with selector:', selector, 'and value:', event.target.value);
      sendMessageSafely({
        type: 'action',
        action: {
          type: 'type',
          selector: selector,
          value: event.target.value
        }
      });
    } else {
      console.log('Could not generate selector for input element');
    }
  }, 500); // Wait 500ms after last input before recording
}

function handleChange(event) {
  if (!isRecording || !isExtensionConnected) return;

  console.log('Change event detected:', event.target);

  const selector = generateSelector(event.target);
  if (!selector) {
    console.log('Could not generate selector for changed element');
    return;
  }

  if (event.target.type === 'checkbox') {
    console.log('Checkbox change recorded:', selector, event.target.checked);
    sendMessageSafely({
      type: 'action',
      action: {
        type: event.target.checked ? 'check' : 'uncheck',
        selector: selector
      }
    });
  }
  else if (event.target.tagName === 'SELECT') {
    const value = event.target.value;
    console.log('Select change recorded:', selector, value);
    sendMessageSafely({
      type: 'action',
      action: {
        type: 'select',
        selector: selector,
        value: value
      }
    });
  }
}

// Generate a CSS selector for the element
function generateSelector(element) {
  console.log('Generating selector for element:', element);

  if (!element || element === document || element === document.documentElement) {
    return null;
  }

  // 1. Try ID - most reliable
  if (element.id && !element.id.includes(' ')) {
    return `#${element.id}`;
  }

  // 2. Try data attributes - good for React and modern frameworks
  const dataAttrs = ['data-testid', 'data-test', 'data-id', 'data-automation'];
  for (const attr of dataAttrs) {
    if (element.hasAttribute(attr)) {
      return `[${attr}="${element.getAttribute(attr)}"]`;
    }
  }

  // 3. Try standard attributes for form elements
  if (element.name) {
    const tag = element.tagName.toLowerCase();
    return `${tag}[name="${element.name}"]`;
  }

  // 4. Try for buttons and links with text
  if ((element.tagName === 'BUTTON' || element.tagName === 'A') && element.textContent.trim()) {
    const text = element.textContent.trim().replace(/\s+/g, ' ').substring(0, 30);
    return `text=${text}`;
  }

  // 5. Try aria-label
  if (element.hasAttribute('aria-label')) {
    return `[aria-label="${element.getAttribute('aria-label')}"]`;
  }

  // 6. Try classes - but filter out dynamic classes
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/);
    // Filter out likely dynamic classes (those with random hashes, etc.)
    const stableClasses = classes.filter(cls =>
        !cls.match(/^[a-z0-9]{5,}$/) && // Avoid auto-generated hash classes
        !cls.includes('__') && // Avoid CSS module classes
        !cls.includes('--') && // Avoid modifier classes
        cls.length > 2 // Avoid very short classes
    );

    if (stableClasses.length > 0) {
      const classSelector = '.' + stableClasses.join('.');
      // Verify this selector doesn't match too many elements
      try {
        const matchCount = document.querySelectorAll(classSelector).length;
        if (matchCount < 5) { // If selector matches fewer than 5 elements
          return classSelector;
        }
      } catch (e) {
        console.error("Error checking selector:", e);
      }
    }
  }

  // 7. Fallback - use a simple tag + position selector
  return generateSimpleSelector(element);
}

// Generate a simpler selector that works better with Playwright
function generateSimpleSelector(element) {
  if (!element || element === document.documentElement) {
    return 'html';
  }

  // Try tag name first
  const tagName = element.tagName.toLowerCase();

  // If this is a common element like div or span, make it more specific
  if (['div', 'span', 'p', 'li', 'ul', 'ol', 'a'].includes(tagName)) {
    // Try with text content
    if (element.textContent && element.textContent.trim()) {
      const text = element.textContent.trim().replace(/\s+/g, ' ').substring(0, 30);
      return `${tagName}:has-text("${text}")`;
    }

    // Try with position
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(element) + 1;
        return `${parent.tagName.toLowerCase()} ${tagName}:nth-child(${index})`;
      }
    }
  }

  // Simple tag fallback
  return tagName;
}

// Make it obvious this content script is running by adding a visual indicator when recording
function showRecordingIndicator() {
  // Remove existing indicator if any
  const existingIndicator = document.getElementById('playwright-recorder-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }

  // Create a small recording indicator
  const indicator = document.createElement('div');
  indicator.id = 'playwright-recorder-indicator';
  indicator.style.position = 'fixed';
  indicator.style.top = '5px';
  indicator.style.right = '5px';
  indicator.style.width = '15px';
  indicator.style.height = '15px';
  indicator.style.borderRadius = '50%';
  indicator.style.backgroundColor = 'red';
  indicator.style.zIndex = '9999999';
  indicator.style.animation = 'playwright-recorder-pulse 1.5s infinite';

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes playwright-recorder-pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(indicator);
}

function hideRecordingIndicator() {
  const indicator = document.getElementById('playwright-recorder-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Update recording state
chrome.runtime.sendMessage({command: 'getStatus'}, function(response) {
  if (response && response.isRecording) {
    isRecording = true;
    addEventListeners();
    showRecordingIndicator();
    console.log('Recording was already active, listeners added');
  }
});

// Handle extension context invalidation
window.addEventListener('error', function(event) {
  if (event.error && event.error.message &&
      event.error.message.includes('Extension context invalidated')) {
    console.log('Extension context was invalidated. This is normal during development.');
    isExtensionConnected = false;
    hideRecordingIndicator();
    removeEventListeners();
  }
});

// Additional listeners for recording state changes
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && isRecording) {
    console.log('Page became visible, ensuring recording is active');
    showRecordingIndicator();
  }
});

console.log('Playwright Recorder: Content script initialization complete on', window.location.href);