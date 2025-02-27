# Playwright Recorder

A Chrome extension that records browser actions and generates Playwright scripts, similar to Selenium IDE but for Playwright automation.

![Playwright Recorder Screenshot](screenshots/screenshot.png)

## Features

- 🔴 Record browser interactions (clicks, typing, selections)
- 📝 Generate Playwright test scripts automatically
- 💾 Export scripts for use in your automation projects
- 🚀 Simple and intuitive UI

## Installation

### From Source

1. Clone this repository:
   ```
   git clone https://github.com/ashishjsharda/playwright-recorder.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in the top-right corner)

4. Click "Load unpacked" and select the `playwright-recorder` directory

5. The extension should appear in your browser toolbar

## Usage

1. Click the Playwright Recorder icon in your browser toolbar
2. Click "Start Recording" to begin recording your actions
3. Interact with your website as normal - clicking, typing, etc.
4. Click "Stop Recording" when finished
5. Review the recorded actions in the popup
6. Click "Export Script" to download the generated Playwright script

## Generated Script

The extension generates a Node.js script that uses Playwright to automate the recorded actions. Example:

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://example.com');
  await page.click('#username');
  await page.fill('#username', 'testuser');
  await page.click('#password');
  await page.fill('#password', 'password123');
  await page.click('button:has-text("Login")');

  // Add assertions here
  // await expect(page).toHaveTitle('Dashboard');

  await browser.close();
})();
```

## Contributing

Contributions are welcome! If you'd like to contribute to this project:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Ashish Sharda

## Acknowledgments

- [Playwright](https://playwright.dev/) for the amazing browser automation framework
- Chrome Extensions API documentation
