document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('start-recording');
    const stopButton = document.getElementById('stop-recording');
    const clearButton = document.getElementById('clear-recording');
    const exportButton = document.getElementById('export-script');
    const statusDiv = document.getElementById('status');
    const actionsDiv = document.getElementById('recorded-actions');
    
    // Load any existing recorded actions
    chrome.storage.local.get(['actions'], function(result) {
      if (result.actions && result.actions.length > 0) {
        updateActionsList(result.actions);
        clearButton.disabled = false;
        exportButton.disabled = false;
      }
    });
    
    startButton.addEventListener('click', function() {
      chrome.runtime.sendMessage({command: 'start'});
      startButton.disabled = true;
      stopButton.disabled = false;
      statusDiv.textContent = 'Recording...';
      statusDiv.style.color = 'green';
    });
    
    stopButton.addEventListener('click', function() {
      chrome.runtime.sendMessage({command: 'stop'});
      startButton.disabled = false;
      stopButton.disabled = true;
      statusDiv.textContent = 'Recording stopped';
      statusDiv.style.color = '#666';
    });
    
    clearButton.addEventListener('click', function() {
      chrome.storage.local.set({actions: []});
      actionsDiv.innerHTML = '';
      clearButton.disabled = true;
      exportButton.disabled = true;
    });
    
    exportButton.addEventListener('click', function() {
      chrome.storage.local.get(['actions'], function(result) {
        if (result.actions && result.actions.length > 0) {
          const playwrightScript = generatePlaywrightScript(result.actions);
          
          // Create a blob and download the script
          const blob = new Blob([playwrightScript], {type: 'text/javascript'});
          const url = URL.createObjectURL(blob);
          
          chrome.downloads.download({
            url: url,
            filename: 'playwright-script.js',
            saveAs: true
          });
        }
      });
    });
    
    // Listen for new actions being recorded
    chrome.runtime.onMessage.addListener(function(message) {
      if (message.type === 'actionsUpdated') {
        updateActionsList(message.actions);
        clearButton.disabled = false;
        exportButton.disabled = false;
      }
    });
    
    function updateActionsList(actions) {
      actionsDiv.innerHTML = '';
      actions.forEach(function(action, index) {
        const actionElement = document.createElement('div');
        actionElement.textContent = `${index + 1}. ${action.type}: ${action.selector} ${action.value ? '- "' + action.value + '"' : ''}`;
        actionsDiv.appendChild(actionElement);
      });
    }
    
    function generatePlaywrightScript(actions) {
      let script = `const { chromium } = require('playwright');\n\n`;
      script += `(async () => {\n`;
      script += `  const browser = await chromium.launch({ headless: false });\n`;
      script += `  const context = await browser.newContext();\n`;
      script += `  const page = await context.newPage();\n\n`;
      
      if (actions[0] && actions[0].type === 'navigate') {
        script += `  await page.goto('${actions[0].value}');\n`;
      }
      
      for (let i = 1; i < actions.length; i++) {
        const action = actions[i];
        switch (action.type) {
          case 'click':
            script += `  await page.click('${action.selector}');\n`;
            break;
          case 'type':
            script += `  await page.fill('${action.selector}', '${action.value}');\n`;
            break;
          case 'select':
            script += `  await page.selectOption('${action.selector}', '${action.value}');\n`;
            break;
          case 'check':
            script += `  await page.check('${action.selector}');\n`;
            break;
          case 'uncheck':
            script += `  await page.uncheck('${action.selector}');\n`;
            break;
          case 'wait':
            script += `  await page.waitForSelector('${action.selector}');\n`;
            break;
        }
      }
      
      script += `\n  // Add assertions here\n`;
      script += `  // await expect(page).toHaveTitle('Expected Title');\n`;
      script += `\n  await browser.close();\n`;
      script += `})();\n`;
      
      return script;
    }
  });