const { chromium } = require('playwright');
const path = require('path');

const dir = 'D:\\Project_Web\\kopipu-smart-backend\\storage\\app\\private';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 900 } });

  for (const name of ['preview-activation', 'preview-visit']) {
    await page.goto('file://' + path.join(dir, name + '.html'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(dir, name + '.png'), fullPage: true });
    console.log('screenshotted', name);
  }

  await browser.close();
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
