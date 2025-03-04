let isRecording = false;
let recorderWindowId = null;
let recorderURL = '';  // Store the recorder URL to filter it out
let recordedTabs = new Set(); // Track which tabs we've recorded the URL for

console.log('Background script loaded');

// Helper function to check if a URL should be recorded
function shouldRecordURL(url) {
  if (!url) return false;

  // Don't record extension URLs, chrome URLs, or about URLs
  if (url.startsWith('chrome-extension://') ||
      url.startsWith('chrome://') ||
      url.startsWith('about:')) {
    return false;
  }

  // Don't record the recorder window URL
  if (recorderURL && url === recorderURL) {
    return false;
  }

  return true;
}

// Helper function to safely send messages to tabs
function safelySendMessageToTab(tabId, message) {
  console.log(`Sending message to tab ${tabId}:`, message);
  chrome.tabs.sendMessage(tabId, message, function(response) {
    if (chrome.runtime.lastError) {
      console.log(`Error sending message to tab ${tabId}:`, chrome.runtime.lastError.message);

      // If content script is not available, we need to inject it first
      if (chrome.runtime.lastError.message.includes('receiving end does not exist')) {
        console.log(`Injecting content script into tab ${tabId}`);
        injectContentScript(tabId, function() {
          // Try sending the message again after injection
          chrome.tabs.sendMessage(tabId, message);
        });
      }
    } else {
      console.log(`Response from tab ${tabId}:`, response);
    }
  });
}

// Function to explicitly inject content script
function injectContentScript(tabId, callback) {
  chrome.scripting.executeScript({
    target: {tabId: tabId},
    files: ['content.js']
  }, result => {
    if (chrome.runtime.lastError) {
      console.error('Error injecting content script:', chrome.runtime.lastError);
    } else {
      console.log('Content script injection successful:', result);
      if (callback) callback();
    }
  });
}

// Helper function to safely send messages to extensions
function safelySendMessageToExtension(message) {
  console.log('Sending message to extension:', message);
  try {
    chrome.runtime.sendMessage(message, function(response) {
      if (chrome.runtime.lastError) {
        console.log("Error sending message:", chrome.runtime.lastError.message);
      } else {
        console.log('Message sent successfully, response:', response);
      }
    });
  } catch (e) {
    console.log("Exception sending message:", e);
  }
}

// Record URL for a tab
function recordTabURL(tab) {
  if (!tab || !tab.url || !shouldRecordURL(tab.url)) {
    console.log("Tab URL not recordable:", tab?.url);
    return;
  }

  // Don't record the same tab's URL more than once
  if (recordedTabs.has(tab.id)) {
    console.log(`Already recorded URL for tab ${tab.id}`);
    return;
  }

  console.log(`Recording navigation to: ${tab.url} for tab ${tab.id}`);
  addAction({
    type: 'navigate',
    value: tab.url
  });

  recordedTabs.add(tab.id);
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Background received message:', message);
  console.log('Sender:', sender);

  try {
    // Handle recorder window commands
    if (message.command === 'openRecorderWindow') {
      openRecorderWindow(sendResponse);
      return true; // Keep message channel open for async response
    }

    if (message.command === 'checkRecorderWindow') {
      console.log('Checking recorder window, ID:', recorderWindowId);
      sendResponse({windowOpen: recorderWindowId !== null});
      return;
    }

    if (message.command === 'getStatus') {
      console.log('Getting recording status:', isRecording);
      sendResponse({isRecording: isRecording});
      return;
    }

    // Handle recording commands
    if (message.command === 'start') {
      isRecording = true;
      recordedTabs = new Set(); // Reset recorded tabs
      console.log('Recording started');

      // Record initial navigation for the active tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs[0]) {
          const activeTab = tabs[0];
          recordTabURL(activeTab);

          // Ensure content script is injected in active tab
          if (shouldRecordURL(activeTab.url)) {
            injectContentScript(activeTab.id, function() {
              // Notify this tab that recording has started
              safelySendMessageToTab(activeTab.id, {command: 'startRecording'});
            });
          }
        } else {
          console.log("No active tab found");
        }
      });

      // Notify all tabs that recording has started
      chrome.tabs.query({}, function(tabs) {
        console.log(`Notifying ${tabs.length} tabs that recording has started`);
        tabs.forEach(function(tab) {
          if (shouldRecordURL(tab.url)) {
            // Inject content script in all tabs to ensure it's available
            injectContentScript(tab.id, function() {
              safelySendMessageToTab(tab.id, {command: 'startRecording'});
            });
          } else {
            console.log(`Skipping tab ${tab.id} (${tab.url})`);
          }
        });
      });

      sendResponse({success: true});
    }
    else if (message.command === 'stop') {
      isRecording = false;
      recordedTabs = new Set(); // Reset recorded tabs
      console.log('Recording stopped');

      // Notify all tabs that recording has stopped
      chrome.tabs.query({}, function(tabs) {
        console.log(`Notifying ${tabs.length} tabs that recording has stopped`);
        tabs.forEach(function(tab) {
          if (shouldRecordURL(tab.url)) {
            safelySendMessageToTab(tab.id, {command: 'stopRecording'});
          }
        });
      });

      sendResponse({success: true});
    }
    else if (message.type === 'action' && isRecording) {
      console.log('Action received:', message.action);

      // For navigate actions, filter out chrome-extension URLs
      if (message.action.type === 'navigate') {
        if (!shouldRecordURL(message.action.value)) {
          console.log('Ignoring navigation to extension URL:', message.action.value);
          return;
        }
      }

      addAction(message.action);
    }
  } catch (e) {
    console.error("Error handling message:", e);
    sendResponse({error: e.message});
  }
});

// Track tab creation
chrome.tabs.onCreated.addListener(function(tab) {
  if (!isRecording) return;
  console.log('New tab created:', tab);

  // We don't immediately record the URL because new tabs often start with about:blank
  // Instead, we'll wait for the onUpdated event to get the final URL
});

// Listen for tab updates to inject content script in new tabs and record URL changes
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (!isRecording) return;

  // If the URL has completed loading and should be recorded
  if (changeInfo.status === 'complete' && shouldRecordURL(tab.url)) {
    console.log(`Tab ${tabId} completed loading URL: ${tab.url}`);

    // Record this tab's URL if we haven't already
    recordTabURL(tab);

    // Make sure the content script is injected
    injectContentScript(tabId, function() {
      safelySendMessageToTab(tabId, {command: 'startRecording'});
    });
  }

  // If just the URL changed (like when typing in the address bar and hitting enter)
  if (changeInfo.url && shouldRecordURL(changeInfo.url)) {
    console.log(`Tab ${tabId} URL changed to: ${changeInfo.url}`);

    // Always record URL changes as new navigation actions
    addAction({
      type: 'navigate',
      value: changeInfo.url
    });

    // Reset this tab in our tracking since it's a new page
    recordedTabs.delete(tabId);
  }
});

// Track when the active tab changes
chrome.tabs.onActivated.addListener(function(activeInfo) {
  if (!isRecording) return;

  console.log('Tab activated:', activeInfo);
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (chrome.runtime.lastError) {
      console.error('Error getting tab info:', chrome.runtime.lastError);
      return;
    }

    // Record URL for the newly activated tab if it's recordable and we haven't already
    recordTabURL(tab);
  });
});

function openRecorderWindow(sendResponse) {
  console.log('Opening recorder window, current ID:', recorderWindowId);

  // If window already exists, focus it
  if (recorderWindowId !== null) {
    console.log('Window exists, focusing it');
    chrome.windows.update(recorderWindowId, {focused: true}, function() {
      if (chrome.runtime.lastError) {
        console.log('Error focusing window:', chrome.runtime.lastError);
        // Window was closed without us knowing
        recorderWindowId = null;
        openRecorderWindow(sendResponse);
      } else {
        console.log('Window focused successfully');
        sendResponse({success: true});
      }
    });
    return;
  }

  // Create a new window for the recorder
  console.log('Creating new recorder window');
  const recorderHtmlUrl = chrome.runtime.getURL('recorder.html');
  // Store the recorder URL to filter it out from recording
  recorderURL = recorderHtmlUrl;

  chrome.windows.create({
    url: recorderHtmlUrl,
    type: 'popup',
    width: 600,
    height: 700
  }, function(window) {
    if (chrome.runtime.lastError) {
      console.error("Error creating window:", chrome.runtime.lastError);
      sendResponse({success: false, error: chrome.runtime.lastError.message});
      return;
    }

    console.log('Window created:', window);
    recorderWindowId = window.id;
    sendResponse({success: true});

    // Monitor when the window is closed
    chrome.windows.onRemoved.addListener(function(windowId) {
      if (windowId === recorderWindowId) {
        console.log('Recorder window closed');
        recorderWindowId = null;
      }
    });
  });
}

function addAction(action) {
  console.log('Adding action to storage:', action);
  chrome.storage.local.get(['actions'], function(result) {
    if (chrome.runtime.lastError) {
      console.error("Error getting actions from storage:", chrome.runtime.lastError);
      return;
    }

    const actions = result.actions || [];
    console.log('Current actions:', actions.length);

    // Special handling for navigations - keep most recent ones
    if (action.type === 'navigate') {
      // Find the last navigation action
      const lastNavigateIndex = actions.findIndex(a => a.type === 'navigate');

      // If this is a navigation to the same URL as the last one, skip it
      if (lastNavigateIndex >= 0 && actions[lastNavigateIndex].value === action.value) {
        console.log('Skipping duplicate navigation to same URL');
        return;
      }
    }

    actions.push(action);

    chrome.storage.local.set({actions: actions}, function() {
      if (chrome.runtime.lastError) {
        console.error("Error saving actions to storage:", chrome.runtime.lastError);
        return;
      }

      console.log('Actions saved to storage, now notifying recorder');
      // Notify recorder that actions have been updated
      safelySendMessageToExtension({
        type: 'actionsUpdated',
        actions: actions
      });
    });
  });
}