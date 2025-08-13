document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('start-recording');
    const stopButton = document.getElementById('stop-recording');
    const clearButton = document.getElementById('clear-recording');
    const exportButton = document.getElementById('export-script');
    const statusDiv = document.getElementById('status');
    const actionsDiv = document.getElementById('recorded-actions');
    const actionsCountSpan = document.getElementById('actions-count');
    const recordingIndicator = document.getElementById('recording-indicator');
    const scriptTextarea = document.getElementById('script-textarea');
    const languageSelect = document.getElementById('language-select');
    const languageIndicator = document.getElementById('language-indicator');
    
    // Script preview resizing functionality
    const scriptResizer = document.getElementById('script-resizer');
    const scriptPreview = document.querySelector('.script-preview');
    
    // Actions container resizing functionality
    const actionsResizer = document.getElementById('actions-resizer');
    const actionsContainer = document.getElementById('actions-container');
    
    let startY, startHeight, currentResizer;
    
    // Setup both resizers with the same event handling
    function setupResizer(resizer, container) {
        resizer.addEventListener('mousedown', function(e) {
            e.preventDefault();
            startY = e.clientY;
            startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);
            currentResizer = {resizer, container};
            document.documentElement.addEventListener('mousemove', doDrag, false);
            document.documentElement.addEventListener('mouseup', stopDrag, false);
        });
    }
    
    setupResizer(scriptResizer, scriptPreview);
    setupResizer(actionsResizer, actionsContainer);
    
    function doDrag(e) {
        if (!currentResizer) return;
        
        const newHeight = startHeight + e.clientY - startY;
        // Prevent it from getting too small
        if (newHeight > 100) {
            currentResizer.container.style.height = newHeight + 'px';
        }
    }
    
    function stopDrag() {
        currentResizer = null;
        document.documentElement.removeEventListener('mousemove', doDrag, false);
        document.documentElement.removeEventListener('mouseup', stopDrag, false);
    }

    let actions = [];
    let currentLanguage = languageSelect.value;

    console.log('Recorder interface loaded');

    // Add a filename input field
    const exportControls = document.createElement('div');
    exportControls.className = 'export-controls';
    exportControls.style.marginTop = '10px';
    exportControls.style.display = 'flex';
    exportControls.style.alignItems = 'center';
    exportControls.style.gap = '10px';
    
    const filenameLabel = document.createElement('label');
    filenameLabel.textContent = 'Filename:';
    filenameLabel.style.fontWeight = 'bold';
    
    const filenameInput = document.createElement('input');
    filenameInput.type = 'text';
    filenameInput.id = 'filename-input';
    filenameInput.value = 'playwright-test';
    filenameInput.style.padding = '6px 10px';
    filenameInput.style.borderRadius = '4px';
    filenameInput.style.border = '1px solid #ccc';
    filenameInput.style.flexGrow = '1';
    
    const extensionSpan = document.createElement('span');
    extensionSpan.id = 'extension-display';
    extensionSpan.textContent = '.js';
    extensionSpan.style.backgroundColor = '#eee';
    extensionSpan.style.padding = '6px 10px';
    extensionSpan.style.borderRadius = '4px';
    extensionSpan.style.fontFamily = 'monospace';
    
    exportControls.appendChild(filenameLabel);
    exportControls.appendChild(filenameInput);
    exportControls.appendChild(extensionSpan);
    
    // Insert the export controls before the script preview
    const scriptPreviewElement = document.querySelector('.script-preview');
    document.body.insertBefore(exportControls, scriptPreviewElement);

    // Immediately disable Stop button
    stopButton.disabled = true;

    // Update file extension when language changes
    function updateExtension() {
        const extensionDisplay = document.getElementById('extension-display');
        switch(currentLanguage) {
            case 'javascript':
                extensionDisplay.textContent = '.js';
                break;
            case 'typescript':
                extensionDisplay.textContent = '.ts';
                break;
            case 'python':
                extensionDisplay.textContent = '.py';
                break;
            case 'java':
                extensionDisplay.textContent = '.java';
                break;
            case 'csharp':
                extensionDisplay.textContent = '.cs';
                break;
        }
    }

    // Language select change handler
    languageSelect.addEventListener('change', function() {
        currentLanguage = languageSelect.value;
        languageIndicator.textContent = languageSelect.options[languageSelect.selectedIndex].text;
        updateExtension();
        updateScriptPreview(actions);
    });

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
                actionsCountSpan.textContent = '0 actions';
                clearButton.disabled = true;
                exportButton.disabled = false;
                updateScriptPreview(actions);
            });
        }
    });

    exportButton.addEventListener('click', function() {
        if (actions.length > 0) {
            console.log('Exporting script in', currentLanguage);
            let script;
            let extension;
            let customFilename = document.getElementById('filename-input').value.trim();
            
            // Fallback to default if empty
            if (!customFilename) {
                customFilename = 'playwright-test';
            }
            
            // Remove any file extension the user might have added
            customFilename = customFilename.replace(/\.\w+$/, '');
            
            switch (currentLanguage) {
                case 'javascript':
                    script = generateJavaScriptScript(actions);
                    extension = '.js';
                    break;
                case 'typescript':
                    script = generateTypeScriptScript(actions);
                    extension = '.ts';
                    break;
                case 'python':
                    script = generatePythonScript(actions);
                    extension = '.py';
                    break;
                case 'java':
                    script = generateJavaScript(actions);
                    extension = '.java';
                    break;
                case 'csharp':
                    script = generateCSharpScript(actions);
                    extension = '.cs';
                    break;
                default:
                    script = generateJavaScriptScript(actions);
                    extension = '.js';
            }

            const filename = customFilename + extension;

            // Create a blob and download the script
            const blob = new Blob([script], {type: 'text/plain'});
            const url = URL.createObjectURL(blob);

            chrome.downloads.download({
                url: url,
                filename: filename,
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
        actionsCountSpan.textContent = actions.length + (actions.length === 1 ? ' action' : ' actions');

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
            let script;
            switch (currentLanguage) {
                case 'javascript':
                    script = generateJavaScriptScript(actions);
                    break;
                case 'typescript':
                    script = generateTypeScriptScript(actions);
                    break;
                case 'python':
                    script = generatePythonScript(actions);
                    break;
                case 'java':
                    script = generateJavaScript(actions);
                    break;
                case 'csharp':
                    script = generateCSharpScript(actions);
                    break;
                default:
                    script = generateJavaScriptScript(actions);
            }
            scriptTextarea.value = script;
        } else {
            let placeholder;
            switch (currentLanguage) {
                case 'csharp':
                    placeholder = `// No actions recorded yet\n// Click "Start Recording" and interact with your web page`;
                    break;
                case 'python':
                    placeholder = `# No actions recorded yet\n# Click "Start Recording" and interact with your web page`;
                    break;
                case 'java':
                    placeholder = `// No actions recorded yet\n// Click "Start Recording" and interact with your web page`;
                    break;
                default:
                    placeholder = `// No actions recorded yet\n// Click "Start Recording" and interact with your web page`;
            }
            scriptTextarea.value = placeholder;
        }
    }

    // Initialize the extension display
    updateExtension();

    // JavaScript Generator
    function generateJavaScriptScript(actions) {
        console.log('Generating JavaScript script for actions:', actions);

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

        return script;
    }

    // TypeScript Generator
    function generateTypeScriptScript(actions) {
        console.log('Generating TypeScript script for actions:', actions);

        let script = `import { chromium, Browser, BrowserContext, Page } from 'playwright';\n\n`;
        script += `(async () => {\n`;
        script += `  let browser: Browser;\n`;
        script += `  let context: BrowserContext;\n`;
        script += `  let page: Page;\n\n`;
        script += `  try {\n`;
        script += `    browser = await chromium.launch({ headless: false });\n`;
        script += `    context = await browser.newContext();\n`;
        script += `    page = await context.newPage();\n\n`;

        // Process all actions
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];

            switch (action.type) {
                case 'navigate':
                    script += `    await page.goto('${action.value}');\n`;
                    break;
                case 'click':
                    script += `    await page.click('${action.selector}');\n`;
                    break;
                case 'type':
                    script += `    await page.fill('${action.selector}', '${action.value}');\n`;
                    break;
                case 'select':
                    script += `    await page.selectOption('${action.selector}', '${action.value}');\n`;
                    break;
                case 'check':
                    script += `    await page.check('${action.selector}');\n`;
                    break;
                case 'uncheck':
                    script += `    await page.uncheck('${action.selector}');\n`;
                    break;
                case 'wait':
                    script += `    await page.waitForSelector('${action.selector}');\n`;
                    break;
            }
        }

        script += `\n    // Add assertions here\n`;
        script += `    // await expect(page).toHaveTitle('Expected Title');\n`;
        script += `  } finally {\n`;
        script += `    await browser?.close();\n`;
        script += `  }\n`;
        script += `})();\n`;

        return script;
    }

    // Python Generator
    function generatePythonScript(actions) {
        console.log('Generating Python script for actions:', actions);

        let script = `import asyncio\nfrom playwright.async_api import async_playwright\n\n`;
        script += `async def run():\n`;
        script += `    async with async_playwright() as playwright:\n`;
        script += `        browser = await playwright.chromium.launch(headless=False)\n`;
        script += `        context = await browser.new_context()\n`;
        script += `        page = await context.new_page()\n\n`;

        // Process all actions
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];

            switch (action.type) {
                case 'navigate':
                    script += `        await page.goto("${action.value}")\n`;
                    break;
                case 'click':
                    script += `        await page.click("${action.selector}")\n`;
                    break;
                case 'type':
                    script += `        await page.fill("${action.selector}", "${action.value}")\n`;
                    break;
                case 'select':
                    script += `        await page.select_option("${action.selector}", "${action.value}")\n`;
                    break;
                case 'check':
                    script += `        await page.check("${action.selector}")\n`;
                    break;
                case 'uncheck':
                    script += `        await page.uncheck("${action.selector}")\n`;
                    break;
                case 'wait':
                    script += `        await page.wait_for_selector("${action.selector}")\n`;
                    break;
            }
        }

        script += `\n        # Add assertions here\n`;
        script += `        # expect(page).to_have_title("Expected Title")\n`;
        script += `\n        await browser.close()\n\n`;
        script += `asyncio.run(run())\n`;

        return script;
    }

    // Java Generator
    function generateJavaScript(actions) {
        console.log('Generating Java script for actions:', actions);

        let script = `import com.microsoft.playwright.*;\n\n`;
        script += `public class PlaywrightTest {\n`;
        script += `    public static void main(String[] args) {\n`;
        script += `        try (Playwright playwright = Playwright.create()) {\n`;
        script += `            Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions()\n`;
        script += `                    .setHeadless(false));\n`;
        script += `            BrowserContext context = browser.newContext();\n`;
        script += `            Page page = context.newPage();\n\n`;

        // Process all actions
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];

            switch (action.type) {
                case 'navigate':
                    script += `            page.navigate("${action.value}");\n`;
                    break;
                case 'click':
                    script += `            page.click("${action.selector}");\n`;
                    break;
                case 'type':
                    script += `            page.fill("${action.selector}", "${action.value}");\n`;
                    break;
                case 'select':
                    script += `            page.selectOption("${action.selector}", "${action.value}");\n`;
                    break;
                case 'check':
                    script += `            page.check("${action.selector}");\n`;
                    break;
                case 'uncheck':
                    script += `            page.uncheck("${action.selector}");\n`;
                    break;
                case 'wait':
                    script += `            page.waitForSelector("${action.selector}");\n`;
                    break;
            }
        }

        script += `\n            // Add assertions here\n`;
        script += `            // assertThat(page.title()).isEqualTo("Expected Title");\n`;
        script += `        }\n`;
        script += `    }\n`;
        script += `}\n`;

        return script;
    }

    // C# Generator
    function generateCSharpScript(actions) {
        console.log('Generating C# script for actions:', actions);

        let script = `using Microsoft.Playwright;\nusing System.Threading.Tasks;\n\n`;
        script += `namespace PlaywrightTests\n{\n`;
        script += `    class Program\n    {\n`;
        script += `        static async Task Main(string[] args)\n        {\n`;
        script += `            using var playwright = await Playwright.CreateAsync();\n`;
        script += `            await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions\n`;
        script += `            {\n`;
        script += `                Headless = false\n`;
        script += `            });\n`;
        script += `            var context = await browser.NewContextAsync();\n`;
        script += `            var page = await context.NewPageAsync();\n\n`;

        // Process all actions
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];

            switch (action.type) {
                case 'navigate':
                    script += `            await page.GotoAsync("${action.value}");\n`;
                    break;
                case 'click':
                    script += `            await page.ClickAsync("${action.selector}");\n`;
                    break;
                case 'type':
                    script += `            await page.FillAsync("${action.selector}", "${action.value}");\n`;
                    break;
                case 'select':
                    script += `            await page.SelectOptionAsync("${action.selector}", "${action.value}");\n`;
                    break;
                case 'check':
                    script += `            await page.CheckAsync("${action.selector}");\n`;
                    break;
                case 'uncheck':
                    script += `            await page.UncheckAsync("${action.selector}");\n`;
                    break;
                case 'wait':
                    script += `            await page.WaitForSelectorAsync("${action.selector}");\n`;
                    break;
            }
        }

        script += `\n            // Add assertions here\n`;
        script += `            // await Expect(page).ToHaveTitleAsync("Expected Title");\n`;
        script += `\n            await browser.CloseAsync();\n`;
        script += `        }\n`;
        script += `    }\n`;
        script += `}\n`;

        return script;
    }
});
