document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('start-recording');
    const stopButton = document.getElementById('stop-recording');
    const clearButton = document.getElementById('clear-recording');
    const exportButton = document.getElementById('export-script');
    const statusDiv = document.getElementById('status');
    const actionsDiv = document.getElementById('recorded-actions');
    const recordingIndicator = document.getElementById('recording-indicator');
    const scriptTextarea = document.getElementById('script-textarea');

    let actions = [];

    console.log('Recorder interface loaded');

    // Immediately disable Stop button
    stopButton.disabled = true;

    // Check if recording is already active
    console.log('Checking recording status...');
    chrome.runtime.sendMessage({command: 'getStatus'}, function(response) {
        console.log('Status response:', response);
        if (response && response.isRecording) {
            console.log('Recording is active, updating UI');
            startRecordingUI();
        } else {
            console.log('Not recording');
        }

        // Load any existing recorded actions
        console.log('Loading existing actions...');
        chrome.storage.local.get(['actions'], function(result) {
            console.log('Storage result:', result);
            if (result.actions && result.actions.length > 0) {
                console.log(`Loaded ${result.actions.length} actions`);
                actions = result.actions;
                updateActionsList(actions);
                updateScriptPreview(actions);
                clearButton.disabled = false;
                exportButton.disabled = false;
            } else {
                console.log('No existing actions found');
            }
        });
    });

    startButton.addEventListener('click', function() {
        console.log('Start button clicked');
        chrome.runtime.sendMessage({command: 'start'}, function(response) {
            console.log('Start response:', response);
            startRecordingUI();
        });
    });

    stopButton.addEventListener('click', function() {
        console.log('Stop button clicked');
        chrome.runtime.sendMessage({command: 'stop'}, function(response) {
            console.log('Stop response:', response);
            stopRecordingUI();
        });
    });

    clearButton.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all recorded actions?')) {
            console.log('Clearing actions');
            chrome.storage.local.set({actions: []}, function() {
                console.log('Actions cleared in storage');
                actions = [];
                actionsDiv.innerHTML = '';
                clearButton.disabled = true;
                exportButton.disabled = true;
                updateScriptPreview(actions);
            });
        }
    });

    exportButton.addEventListener('click', function() {
        if (actions.length > 0) {
            console.log('Exporting script');
            const playwrightScript = generatePlaywrightScript(actions);

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

    // Listen for new actions being recorded
    console.log('Setting up action listener');
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        console.log('Received message:', message);
        if (message.type === 'actionsUpdated') {
            console.log('Actions updated:', message.actions);
            actions = message.actions;
            updateActionsList(actions);
            updateScriptPreview(actions);
            clearButton.disabled = false;
            exportButton.disabled = false;
        }
    });

    function startRecordingUI() {
        console.log('Setting UI to recording state');
        startButton.disabled = true;
        stopButton.disabled = false;
        statusDiv.textContent = 'Recording...';
        recordingIndicator.classList.add('active');
    }

    function stopRecordingUI() {
        console.log('Setting UI to stopped state');
        startButton.disabled = false;
        stopButton.disabled = true;
        statusDiv.textContent = 'Not recording';
        recordingIndicator.classList.remove('active');
    }

    function updateActionsList(actions) {
        console.log(`Updating actions list with ${actions.length} actions`);
        actionsDiv.innerHTML = '';

        if (actions.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'No actions recorded yet. Click "Start Recording" and interact with your web page.';
            emptyMessage.style.padding = '20px';
            emptyMessage.style.color = '#666';
            emptyMessage.style.textAlign = 'center';
            actionsDiv.appendChild(emptyMessage);
            return;
        }

        actions.forEach(function(action, index) {
            const actionElement = document.createElement('div');
            actionElement.className = 'action-item';

            const numberSpan = document.createElement('span');
            numberSpan.className = 'action-number';
            numberSpan.textContent = index + 1;

            const typeSpan = document.createElement('span');
            typeSpan.className = 'action-type';
            typeSpan.textContent = action.type;

            const detailsSpan = document.createElement('span');
            detailsSpan.className = 'action-details';

            if (action.type === 'navigate') {
                detailsSpan.textContent = 'to ';
                const valueSpan = document.createElement('span');
                valueSpan.className = 'action-value';
                valueSpan.textContent = `"${action.value || ''}"`;
                detailsSpan.appendChild(valueSpan);
            } else if (action.selector) {
                detailsSpan.textContent = action.selector;

                if (action.value) {
                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'action-value';
                    valueSpan.textContent = ` "${action.value}"`;
                    detailsSpan.appendChild(valueSpan);
                }
            }

            actionElement.appendChild(numberSpan);
            actionElement.appendChild(typeSpan);
            actionElement.appendChild(detailsSpan);

            actionsDiv.appendChild(actionElement);
        });

        // Auto-scroll to the latest action
        actionsDiv.scrollTop = actionsDiv.scrollHeight;
    }

    function updateScriptPreview(actions) {
        console.log('Updating script preview for', actions.length, 'actions');
        if (actions.length > 0) {
            scriptTextarea.value = generatePlaywrightScript(actions);
        } else {
            scriptTextarea.value = '// No actions recorded yet\n// Click "Start Recording" and interact with your web page';
        }
    }

    function generatePlaywrightScript(actions) {
        console.log('Generating script for actions:', actions);

        let script = `const { chromium } = require('playwright');\n\n`;
        script += `(async () => {\n`;
        script += `  const browser = await chromium.launch({ headless: false });\n`;
        script += `  const context = await browser.newContext();\n`;
        script += `  const page = await context.newPage();\n\n`;

        // Process all actions
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];

            switch (action.type) {
                case 'navigate':
                    script += `  await page.goto('${action.value}');\n`;
                    break;
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

        console.log('Generated script:', script);
        return script;
    }
});