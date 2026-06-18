/**
 * Shared test helpers for Rehearse.io E2E tests
 */
import { chromium } from "playwright";

export const BASE = "http://localhost:3000";
export const API = "http://localhost:9000";

export async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function dismissCookieConsent(page) {
  try {
    const acceptBtn = page.locator("button", { hasText: "Accept All" });
    if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptBtn.click();
      await wait(300);
    }
  } catch { /* banner may not appear */ }
}

export async function go(page, path) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
  await wait(500);
  await dismissCookieConsent(page);
}

export async function register(page, { name, email, password, role }) {
  await go(page, "/signup");
  const toggleBtn = page.locator("button", { hasText: "Create an account" });
  if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await toggleBtn.click({ force: true });
    await wait(500);
  }
  const roleBtn = page.locator("button", { hasText: role === "recruiter" ? "Recruiter" : "Candidate" }).first();
  await roleBtn.click();
  await wait(200);
  await page.fill('input[name="firstName"]', name.split(" ")[0]);
  await page.fill('input[name="lastName"]', name.split(" ")[1] || "Test");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  await page.locator('input[type="checkbox"]').first().check({ force: true });
  await wait(200);
  await page.locator('button[type="submit"]').click();
  await wait(2000);
  await dismissCookieConsent(page);
}

export async function login(page, { email, password }) {
  await go(page, "/signup");
  await wait(500);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.locator('button[type="submit"]').click();
  await wait(2000);
  await dismissCookieConsent(page);
}

export function createTestRunner() {
  const state = { passed: 0, failed: 0, errors: [], warnings: [] };

  async function test(name, fn) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await fn(page, browser);
      console.log(`  ✅ ${name}`);
      state.passed++;
    } catch (err) {
      console.log(`  ❌ ${name}`);
      console.log(`     ${err.message.split("\n")[0]}`);
      state.errors.push({ name, error: err.message.split("\n")[0] });
      state.failed++;
    } finally {
      await browser.close();
    }
  }

  function warn(name, msg) {
    console.log(`  ⚠️  ${name}: ${msg}`);
    state.warnings.push({ name, message: msg });
  }

  return { test, warn, state };
}
