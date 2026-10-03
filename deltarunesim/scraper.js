const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

(async () => {
  console.log('Starting Puppeteer asset interceptor...');

  const browser = await puppeteer.launch({
    headless: 'shell',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const page = await browser.newPage();

  page.on('response', async (response) => {
    const urlStr = response.url();
    if (!urlStr.includes('deltarunesim.com')) return;

    try {
      const parsedUrl = new URL(urlStr);
      let relativePath = parsedUrl.pathname;

      if (relativePath === '/' || relativePath === '') {
        relativePath = '/index.html';
      }

      const localPath = path.join(__dirname, relativePath);
      const dir = path.dirname(localPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const buffer = await response.buffer();
      fs.writeFileSync(localPath, buffer);
      console.log(`[SAVED] ${relativePath}`);
    } catch (err) {
      if (!err.message.includes('No data found')) {
        console.error(`[ERROR] Failed to save ${urlStr}: ${err.message}`);
      }
    }
  });

  console.log('Navigating to https://deltarunesim.com/...');
  await page.goto('https://deltarunesim.com/', { waitUntil: 'networkidle2', timeout: 60000 });

  console.log('Simulating game interactions to trigger audio & sprite loading...');
  
  await page.evaluate(async () => {
    document.body.click();
    const interactiveElements = document.querySelectorAll('button, canvas, a, div');
    interactiveElements.forEach((el) => {
      try { el.click(); } catch (e) {}
    });
  });

  console.log('Waiting 20 seconds for dynamic audio assets to stream...');
  await new Promise((resolve) => setTimeout(resolve, 20000));

  await browser.close();
  console.log('Scrape complete!');
})();
