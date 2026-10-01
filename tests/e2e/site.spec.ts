import { expect, test, type Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions for the whole test. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // WebGL in software mode logs driver warnings as errors; they aren't ours.
    if (m.type() === 'error' && !/GL Driver|WebGL|GPU stall/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

const noHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe('homepage', () => {
  test('renders every section without errors', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Arman Damirchilou.');
    for (const id of ['work', 'journey', 'profile']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.locator('.v2-card')).toHaveCount(7);
    await expect(page.locator('.v2-milestone')).toHaveCount(7);
    await expect(page.locator('.v2-profile-row')).toHaveCount(6);
    await expect(page.locator('.v2-footer-mail')).toHaveAttribute('href', 'mailto:armandamirchilou@gmail.com');
    // The contact section: a message form and every channel, on the homepage.
    const contact = page.locator('#contact');
    // Located by tag: until it's scrolled to, the heading is still faded out.
    await expect(contact.locator('h2', { hasText: 'Say hello.' })).toBeAttached();
    await expect(contact.locator('form.v2-form')).toBeAttached();
    for (const name of ['Telegram', 'LinkedIn', 'GitHub', 'X']) {
      await expect(contact.locator('.v2-channel-name', { hasText: new RegExp(`^${name}$`) })).toBeAttached();
    }
    await expect(page.locator('[id="contact"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('has no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(600);
    expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('stats count up to their real values', async ({ page }) => {
    await page.goto('/');
    const stats = page.locator('.v2-stat-num');
    await stats.first().scrollIntoViewIfNeeded();
    await expect(stats).toHaveText(['16', '5', '3', '7'], { timeout: 8000 });
  });

  test('the copy uses no em-dashes or emoji', async ({ page }) => {
    await page.goto('/');
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/—/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

test.describe('homepage navigation', () => {
  test.skip(({ isMobile }) => isMobile, 'section links are hidden on phones');

  test('nav links scroll to their section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Profile' }).click();
    await expect
      .poll(async () => page.locator('#profile').evaluate((el) => Math.abs(el.getBoundingClientRect().top)), { timeout: 6000 })
      .toBeLessThan(80);
    await expect(page).toHaveURL(/#profile$/);
  });

  test('the Contact link scrolls to the contact section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Contact' }).click();
    await expect
      .poll(async () => page.locator('#contact').evaluate((el) => Math.abs(el.getBoundingClientRect().top)), { timeout: 8000 })
      .toBeLessThan(80);
  });

  test('a /#section link from another page lands on that section', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Work' }).click();
    await expect
      .poll(async () => page.locator('#work').evaluate((el) => Math.abs(el.getBoundingClientRect().top)), { timeout: 8000 })
      .toBeLessThan(120);
  });
});

test.describe('phone layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'the tab bar and swipe deck are phone-only');

  test('the tab bar sits at the bottom and takes you to a section', async ({ page }) => {
    await page.goto('/');
    const bar = page.locator('.v2-tabbar');
    await expect(bar).toBeVisible();
    const box = (await bar.boundingBox())!;
    const height = page.viewportSize()!.height;
    expect(box.y + box.height).toBeGreaterThan(height - 40);
    await expect(page.getByRole('link', { name: 'Talk to my twin' }).last()).toBeVisible();

    await bar.getByRole('link', { name: 'Journey' }).click();
    await expect
      .poll(async () => page.locator('#journey').evaluate((el) => Math.abs(el.getBoundingClientRect().top)), { timeout: 8000 })
      .toBeLessThan(120);
    await expect(bar.getByRole('link', { name: 'Journey' })).toHaveAttribute('aria-current', 'true');
  });

  test('projects are a swipeable deck with page dots', async ({ page }) => {
    await page.goto('/');
    const deck = page.locator('.v2-cards');
    await deck.scrollIntoViewIfNeeded();
    expect(await deck.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    const dots = page.locator('.v2-cards-dots i');
    await expect(dots).toHaveCount(7);
    await expect(dots.nth(0)).toHaveClass(/is-on/);
    await deck.evaluate((el) => el.scrollTo({ left: (el.firstElementChild as HTMLElement).offsetWidth * 2 + 24 }));
    await expect(dots.nth(2)).toHaveClass(/is-on/);
  });
});

test.describe('light and dark', () => {
  test('every visit opens in light mode, the switch goes dark, and a reload is light again', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' }); // the system setting doesn't decide
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe('rgb(245, 245, 247)');

    await page.getByRole('button', { name: 'Switch to dark mode' }).filter({ visible: true }).first().click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await bg()).toBe('rgb(12, 13, 15)');

    // The choice holds while moving around the site...
    await page.locator('.v2-footer-links').getByRole('link', { name: 'Contact' }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(html).toHaveAttribute('data-theme', 'dark');
    // ...but a new visit opens in light again.
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows all content statically', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('.v2-hero-line').first()).toBeVisible();
    const card = page.locator('.v2-card').nth(3);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    await expect(page.locator('.v2-stat-num').first()).toHaveText('16');
    expect(errors).toEqual([]);
  });
});

test.describe('other pages', () => {
  test('contact page offers every channel', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/contact');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Say hello.');
    for (const name of ['Telegram', 'LinkedIn', 'GitHub', 'X']) {
      await expect(page.locator('.v2-channel-name', { hasText: new RegExp(`^${name}$`) })).toBeVisible();
    }
    // Required fields block an empty submit instead of opening a blank email.
    const valid = await page.locator('form.v2-form').evaluate((f: HTMLFormElement) => f.checkValidity());
    expect(valid).toBe(false);
    expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('the old site is gone', async ({ page }) => {
    await page.goto('/classic');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nothing here.');
    await expect(page.getByRole('link', { name: /classic site/i })).toHaveCount(0);
  });

  test('unknown routes show a 404 page instead of a blank screen', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nothing here.');
    await page.getByRole('link', { name: 'Go home' }).click();
    await expect(page.locator('h1')).toHaveText('Arman Damirchilou.');
  });
});
