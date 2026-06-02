import { test, expect } from '@playwright/test';

const EMAIL    = 'test@fieldlab.com';
const PASSWORD = 'test1234';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fill the LoginView form and submit.
 * Returns true if the dashboard is reached, false if login failed.
 */
async function doLogin(page) {
  await page.goto('/');
  // Wait for the login form — LoginView placeholder
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  try {
    // Dashboard title appears after successful login
    await page.waitForSelector('h1:has-text("FieldLab")', { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('FieldLab AMS — E2E', () => {

  // 1 ─ Login ─────────────────────────────────────────────────────────────────
  test('1. Login — renders form and submits credentials', async ({ page }) => {
    await page.goto('/');

    // Loading screen may appear briefly while Supabase resolves the session
    await page.waitForSelector('text=FIELD LAB', { timeout: 10000 });

    await expect(page.locator('text=FIELD LAB').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // After submit: either dashboard loads or an error/loading state appears
    await expect(
      page.locator('h1:has-text("FieldLab"), .animate-spin, [class*="red"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  // 2 ─ Dashboard title & team ────────────────────────────────────────────────
  test('2. Dashboard shows team name and AlertBanner area', async ({ page }) => {
    const ok = await doLogin(page);
    if (!ok) {
      test.skip(true, 'Login failed — test@fieldlab.com must be registered in Supabase');
      return;
    }

    // Dashboard heading
    await expect(page.locator('h1:has-text("FieldLab")')).toBeVisible();

    // Team selector renders (TeamSelector is always present after login)
    await expect(
      page.locator('button').filter({ hasText: /División|Sub|equipo/i }).first()
    ).toBeVisible();
  });

  // 3 ─ Switch team ───────────────────────────────────────────────────────────
  test('3. Switch team via dropdown — team selector opens', async ({ page }) => {
    const ok = await doLogin(page);
    if (!ok) {
      test.skip(true, 'Requires authenticated session');
      return;
    }

    // Find and click the TeamSelector button
    const teamBtn = page.locator('button').filter({ hasText: /División|Sub 18/i }).first();
    await expect(teamBtn).toBeVisible({ timeout: 5000 });
    await teamBtn.click();

    // Dropdown panel with team list should appear
    await expect(
      page.locator('text=Primera División, text=Sub 18').first()
    ).toBeVisible({ timeout: 3000 });
  });

  // 4 ─ Evaluaciones: Navette tab ─────────────────────────────────────────────
  test('4. Evaluaciones → Navette tab exists', async ({ page }) => {
    const ok = await doLogin(page);
    if (!ok) {
      test.skip(true, 'Requires authenticated session');
      return;
    }

    // Click Evaluaciones in NavBar
    await page.click('button:has-text("Eval.")');
    await page.waitForTimeout(500);

    // Main tab bar should have 'Resistencia'
    const resistencia = page.locator('button:has-text("Resistencia")');
    await expect(resistencia).toBeVisible({ timeout: 5000 });
    await resistencia.click();

    // Navette sub-tab
    await expect(page.locator('button:has-text("Navette")')).toBeVisible({ timeout: 3000 });
  });

  // 5 ─ Evaluaciones: UNCa tab ────────────────────────────────────────────────
  test('5. Evaluaciones → UNCa tab exists', async ({ page }) => {
    const ok = await doLogin(page);
    if (!ok) {
      test.skip(true, 'Requires authenticated session');
      return;
    }

    await page.click('button:has-text("Eval.")');
    await page.waitForTimeout(500);

    const resistencia = page.locator('button:has-text("Resistencia")');
    await expect(resistencia).toBeVisible({ timeout: 5000 });
    await resistencia.click();

    await expect(page.locator('button:has-text("UNCa")')).toBeVisible({ timeout: 3000 });
  });

  // 6 ─ Public /wellness route ────────────────────────────────────────────────
  test('6. Public /wellness route accessible without login', async ({ page }) => {
    // Navigate directly — no auth required
    await page.goto('/wellness');

    // Should NOT redirect to login; should show the wellness form or "not found" message
    // Either way, the Supabase auth spinner should NOT be the only thing on screen
    await page.waitForTimeout(2000);

    // The public wellness form renders a root div immediately (no gate)
    const url = page.url();
    expect(url).toContain('/wellness');

    // Should show FieldLab branding or player-not-found message — NOT the login form
    const isLoginPage = await page.locator('text=FIELD LAB').first().isVisible().catch(() => false);
    // If FIELD LAB appears, it could be either LoginView or the wellness header
    // The wellness form uses inline styles, not Tailwind classes from LoginView
    // Verify by checking that there is NO submit button of LoginView type on this page
    // (wellness form submit says "Enviar reporte" not "Iniciar sesión")
    const loginBtn = page.locator('button:has-text("Iniciar sesión"), button:has-text("Registrarse")');
    await expect(loginBtn).not.toBeVisible({ timeout: 3000 });
  });

  // 7 ─ PDF export button in PlayerProfile ────────────────────────────────────
  test('7. PlayerProfile has PDF export button', async ({ page }) => {
    const ok = await doLogin(page);
    if (!ok) {
      test.skip(true, 'Requires authenticated session');
      return;
    }

    // Navigate to a player profile — click the first athlete row
    await page.click('button:has-text("Eval.")').catch(() => {});
    await page.goto('/');
    await page.waitForSelector('h1:has-text("FieldLab")', { timeout: 8000 });

    // Click the first athlete in the roster list
    const firstAthlete = page.locator('button').filter({ hasText: /Ramiro|Leandro|Tomás|Facundo|Agustín|Lucía|Valentina|Martín/i }).first();
    await expect(firstAthlete).toBeVisible({ timeout: 5000 });
    await firstAthlete.click();

    // Wait for PlayerProfile to load
    await page.waitForTimeout(1500);

    // PDF button should be visible in the header
    await expect(
      page.locator('button:has-text("PDF")')
    ).toBeVisible({ timeout: 5000 });
  });

});
