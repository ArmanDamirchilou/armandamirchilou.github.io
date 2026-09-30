import { expect, test, type Page, type Route } from '@playwright/test';

// The twin talks to a mocked backend so these tests are deterministic: the
// reply, the voice clips and their timing are all controlled here.
const API = 'https://twin.test';
const REPLY =
  "Hey! I'm Arman, sixteen, from Tehran. I build AI stuff, and yeah, I built this twin you're talking to. Want to hear about my projects?";

/** A short sine-wave WAV, so the <audio> element really plays something. */
function wav(seconds = 1.6, rate = 16000): Buffer {
  const n = Math.floor(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 220) * 8000), 44 + i * 2);
  return buf;
}
const CLIP = wav();

type Mock = { chats: { headers: Record<string, string>; body: any }[]; speaks: string[] };

async function mockBackend(page: Page, opts: { healthy?: boolean } = {}): Promise<Mock> {
  const mock: Mock = { chats: [], speaks: [] };
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  };
  await page.route('**/backend.json*', (r) => r.fulfill({ json: { url: API } }));
  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (path === '/api/health') {
      if (opts.healthy === false) return route.fulfill({ status: 503, headers: cors, body: 'down' });
      return route.fulfill({ headers: cors, json: { status: 'online', llm: 'mock', tts: 'kokoro', voiceClone: 'live' } });
    }
    if (path === '/api/chat') {
      mock.chats.push({ headers: req.headers(), body: req.postDataJSON() });
      await new Promise((r) => setTimeout(r, 150));
      return route.fulfill({ headers: cors, json: { text: REPLY, audioUrl: null, useBrowserTTS: false } });
    }
    if (path === '/api/speak') {
      mock.speaks.push(req.postDataJSON().text);
      await new Promise((r) => setTimeout(r, 200));
      return route.fulfill({ headers: cors, json: { audioUrl: `/audio/clip-${mock.speaks.length}.wav`, useBrowserTTS: false } });
    }
    if (path.startsWith('/audio/')) {
      // Like Daytona's proxy: a browser request without the bypass header
      // gets an HTML warning page instead of the file.
      if (!req.headers()['x-daytona-skip-preview-warning']) {
        return route.fulfill({ headers: { ...cors, 'content-type': 'text/html' }, body: '<!doctype html><p>Preview warning</p>' });
      }
      return route.fulfill({ headers: { ...cors, 'content-type': 'audio/wav' }, body: CLIP });
    }
    return route.fulfill({ status: 404, headers: cors });
  });
  return mock;
}

async function openTwin(page: Page) {
  await page.goto('/twin');
  await page.getByRole('button', { name: /let's talk/i }).click();
  const input = page.getByPlaceholder(/ask me anything/i);
  await input.click();
  await page.getByRole('button', { name: /got it/i }).click();
  return input;
}

const status = (page: Page) => page.locator('.twin-status');

test.describe('digital twin', () => {
  test('answers, speaks sentence by sentence, and Stop silences it for good', async ({ page }) => {
    const mock = await mockBackend(page);
    const input = await openTwin(page);
    await expect(page.locator('.voice-pill')).toHaveText('Voice live');

    await input.fill('Who are you?');
    await input.press('Enter');
    await expect(page.locator('.message.assistant')).toHaveText(REPLY);
    await expect(status(page)).toContainText('Speaking');

    // First clip is a single short sentence so the voice starts quickly.
    expect(mock.speaks[0]).toBe("Hey! I'm Arman, sixteen, from Tehran.");

    await page.getByRole('button', { name: /stop talking/i }).click();
    await expect(status(page)).toContainText('Listening');
    await expect(page.getByRole('button', { name: /stop talking/i })).toBeHidden();
    const after = mock.speaks.length;
    await page.waitForTimeout(3000);
    await expect(status(page)).toContainText('Listening');
    expect(mock.speaks.length).toBe(after);
  });

  test('plays every sentence of a reply, in order, when left alone', async ({ page }) => {
    const mock = await mockBackend(page);
    const input = await openTwin(page);
    await input.fill('Who are you?');
    await input.press('Enter');
    await expect(status(page)).toContainText('Speaking');
    await expect(status(page)).toContainText('Listening', { timeout: 20000 });
    expect(mock.speaks.join(' ')).toBe(REPLY);
  });

  test('Esc interrupts the reply', async ({ page }) => {
    await mockBackend(page);
    const input = await openTwin(page);
    await input.fill('Tell me about you');
    await input.press('Enter');
    await expect(status(page)).toContainText('Speaking');
    await page.keyboard.press('Escape');
    await expect(status(page)).toContainText('Listening');
  });

  test('a new question cuts off the previous answer', async ({ page }) => {
    const mock = await mockBackend(page);
    const input = await openTwin(page);
    await input.fill('First question');
    await input.press('Enter');
    await expect(status(page)).toContainText('Speaking');
    await input.fill('Second question');
    await input.press('Enter');
    await expect(page.locator('.message.assistant')).toHaveCount(2);
    // The second reply restarts from its own first sentence.
    await expect.poll(() => mock.speaks.filter((s) => s.startsWith('Hey!')).length).toBe(2);
  });

  test('each visitor gets their own conversation id', async ({ page, browser }) => {
    const mock = await mockBackend(page);
    const input = await openTwin(page);
    for (const q of ['one', 'two']) {
      await input.fill(q);
      await input.press('Enter');
      await expect(page.locator('.message.assistant')).toHaveCount(mock.chats.length);
    }
    const ids = mock.chats.map((c) => c.headers['x-session-id']);
    expect(ids[0]).toMatch(/^[\w-]{8,64}$/);
    expect(ids[1]).toBe(ids[0]);

    const other = await browser.newPage();
    const mock2 = await mockBackend(other);
    const input2 = await openTwin(other);
    await input2.fill('hi');
    await input2.press('Enter');
    await expect(other.locator('.message.assistant')).toHaveCount(1);
    expect(mock2.chats[0].headers['x-session-id']).not.toBe(ids[0]);
    await other.close();
  });

  test('says so plainly when the backend is down', async ({ page }) => {
    await mockBackend(page, { healthy: false });
    await page.goto('/twin');
    await expect(page.locator('.twin-offline-note')).toBeVisible();
    await expect(page.locator('.voice-pill')).toHaveText('Voice offline');
  });
});
