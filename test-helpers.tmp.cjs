async function gotoWithRetry(page, url) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => document.querySelectorAll('input').length > 0, { timeout: 8000 });
      return;
    } catch {
      console.log(`[gotoWithRetry] attempt ${attempt} failed to hydrate, retrying...`);
      await page.waitForTimeout(1500);
    }
  }
  throw new Error(`gotoWithRetry: page never hydrated after ${maxAttempts} attempts`);
}

async function loginAs(page, email, password) {
  await gotoWithRetry(page, 'http://localhost:3033/auth/login');
  const emailInput = page.getByPlaceholder('nama@puskesmas.go.id');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /Masuk ke Sistem/ }).click();
  await page.waitForURL(/\/dashboard|\/app/, { timeout: 20000 });
}

module.exports = { gotoWithRetry, loginAs };
