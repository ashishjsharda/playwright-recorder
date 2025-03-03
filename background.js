let isRecording = false;

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.command === 'start') {
    isRecording = true;
    // Notify all tabs that recording has started
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(function(tab) {
        chrome.tabs.sendMessage(tab.id, {command: 'startRecording'});
      });
    });

    // Record initial navigation
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        addAction({
          type: 'navigate',
          value: tabs[0].url
        });
      }
    });
  }
  else if (message.command === 'stop') {
    isRecording = false;
    // Notify all tabs that recording has stopped
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(function(tab) {
        chrome.tabs.sendMessage(tab.id, {command: 'stopRecording'});
      });
    });
  }
  else if (message.type === 'action' && isRecording) {
    addAction(message.action);
  }
});

function addAction(action) {
  chrome.storage.local.get(['actions'], function(result) {
    const actions = result.actions || [];
    actions.push(action);
    chrome.storage.local.set({actions: actions});

    // Notify popup that actions have been updated
    chrome.runtime.sendMessage({
      type: 'actionsUpdated',
      actions: actions
    });
  });
}