import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://localhost:3000";
const outDir = "/private/tmp/claude-501/-Users-ganeshpandey-Developer-summeet-hrms-fe/486ba346-38a5-4de3-ac6c-d2baba3b1c73/scratchpad/verify";
fs.mkdirSync(outDir, { recursive: true });

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 5000 });
  await page.waitForTimeout(500);

  // 1. Site switcher (super admin, should show All Sites + full list)
  await page.click('header button:has-text("All Sites")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/01-site-switcher-open.png` });
  await page.reload();
  await page.waitForTimeout(500);

  // 2. Notifications dropdown
  await page.click('button:has(svg.lucide-bell)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/02-notifications-open.png` });
  await page.reload();
  await page.waitForTimeout(500);

  // 3. Leave page - Team Leave tab with approve/reject
  await page.goto(`${BASE}/leave`);
  await page.waitForTimeout(400);
  await page.locator('button', { hasText: "Team Leave" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/03-team-leave-before.png` });

  await page.click('button:has-text("Approve")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/04-team-leave-after-approve.png` });

  // 4. Employee profile with Mapped Sites (Priya Singh EMP003)
  await page.goto(`${BASE}/employees/EMP003`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/05-employee-mapped-sites.png` });

  // 5. Recruitment - job view modal
  await page.goto(`${BASE}/recruitment`);
  await page.waitForTimeout(400);
  await page.locator('table button:has-text("View")').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/06-recruitment-view-modal.png` });

  // 6. Training - add program modal opens
  await page.goto(`${BASE}/training`);
  await page.waitForTimeout(400);
  await page.click('button:has-text("Add Training Program")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/07-training-add-modal.png` });
  await page.keyboard.press("Escape");

  // 7. Assets - add asset modal opens
  await page.goto(`${BASE}/assets`);
  await page.waitForTimeout(400);
  await page.click('button:has-text("Add Asset")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/08-assets-add-modal.png` });

  await browser.close();
  console.log("done");
}

run();
