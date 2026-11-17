const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/usr/bin/google-chrome'
  });
  
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000');
  
  // Step 1: Take home screenshot
  await page.screenshot({ path: '/cursor/stores/bc-8f6cf1c4-2493-4b1a-a6df-7ed437cfa311/media/test-home.png', fullPage: true });
  console.log('Home screenshot saved');
  
  // Step 2: Click host button
  await page.click('.btn-lime');
  await page.waitForNavigation({ timeout: 10000 });
  
  // Get the code from URL
  const url = page.url();
  const code = url.match(/\/host\/([A-Z0-9]+)/)?.[1];
  console.log('Event code:', code);
  
  // Take host screenshot
  await page.screenshot({ path: '/cursor/stores/bc-8f6cf1c4-2493-4b1a-a6df-7ed437cfa311/media/test-host.png', fullPage: true });
  console.log('Host screenshot saved');
  
  // Fill in the form
  await page.type('input[placeholder*="Acme"]', 'Снежный Corp');
  await page.type('textarea', 'Сколько ёлок в офисе?');
  const answerInput = await page.$('input[type="number"]');
  await answerInput.click({ clickCount: 3 });
  await page.type('input[type="number"]', '7');
  
  await page.screenshot({ path: '/cursor/stores/bc-8f6cf1c4-2493-4b1a-a6df-7ed437cfa311/media/test-host-filled.png', fullPage: true });
  console.log('Host form filled screenshot saved');
  
  // Click save or lobby
  await page.click('.btn-lime');
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: '/cursor/stores/bc-8f6cf1c4-2493-4b1a-a6df-7ed437cfa311/media/test-host-lobby.png', fullPage: true });
  console.log('Host lobby screenshot saved');
  
  console.log('Final code:', code);
  
  // Keep browser open
  await page.waitForTimeout(60000);
  
})().catch(console.error);
