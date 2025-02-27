let isRecording = false;

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.command === 'startRecording') {
    isRecording = true;
    addEventListeners();
  } 
  else if (message.command === 'stopRecording') {
    isRecording = false;
    removeEventListeners();
  }
});

function addEventListeners() {
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('change', handleChange, true);
}

function removeEventListeners() {
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('change', handleChange, true);
}

function handleClick(event) {
  if (!isRecording) return;
  
  const selector = generateSelector(event.target);
  if (selector) {
    chrome.runtime.sendMessage({
      type: 'action',
      action: {
        type: 'click',
        selector: selector
      }
    });
  }
}

function handleInput(event) {
  if (!isRecording) return;
  
  const selector = generateSelector(event.target);
  if (selector && event.target.value !== undefined) {
    chrome.runtime.sendMessage({
      type: 'action',
      action: {
        type: 'type',
        selector: selector,
        value: event.target.value
      }
    });
  }
}

function handleChange(event) {
  if (!isRecording) return;
  
  const selector = generateSelector(event.target);
  if (!selector) return;
  
  if (event.target.type === 'checkbox') {
    chrome.runtime.sendMessage({
      type: 'action',
      action: {
        type: event.target.checked ? 'check' : 'uncheck',
        selector: selector
      }
    });
  } 
  else if (event.target.tagName === 'SELECT') {
    const value = event.target.value;
    chrome.runtime.sendMessage({
      type: 'action',
      action: {
        type: 'select',
        selector: selector,
        value: value
      }
    });
  }
}

// Generate a unique CSS selector for the element
function generateSelector(element) {
  if (!element || element === document || element === document.documentElement) {
    return null;
  }
  
  // Try ID first
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Try data-testid if available (good for React apps)
  if (element.getAttribute('data-testid')) {
    return `[data-testid="${element.getAttribute('data-testid')}"]`;
  }
  
  // Try specific attributes for input elements
  if (element.name) {
    return `${element.tagName.toLowerCase()}[name="${element.name}"]`;
  }
  
  // Simple approach for buttons with text
  if (element.tagName === 'BUTTON' && element.textContent.trim()) {
    return `text=${element.textContent.trim()}`;
  }
  
  // Use classes if available
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).join('.');
    if (classes) {
      return `.${classes}`;
    }
  }
  
  // Fallback to position-based selector (less stable but usable)
  let path = [];
  let current = element;
  
  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    let nth = 1;
    let sibling = current;
    
    while (sibling = sibling.previousElementSibling) {
      if (sibling.tagName === current.tagName) {
        nth++;
      }
    }
    
    if (nth > 1) {
      selector += `:nth-of-type(${nth})`;
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}