import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The queue keeps module-level state, so every test gets a fresh copy.
async function load() {
  vi.resetModules();
  return import('../server/voiceWorker');
}

const WAV = Buffer.alloc(200, 1);

/** Resolves a long-poll that is waiting on a job (it batches for 30ms). */
async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(50);
  return p;
}

describe('voice worker queue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('falls back immediately when no worker has ever connected', async () => {
    const w = await load();
    expect(w.workerAlive()).toBe(false);
    await expect(w.requestClip('hi')).resolves.toBeNull();
  });

  it('hands a job to a waiting poll and returns the delivered clip', async () => {
    const w = await load();
    const poll = w.nextJobs(20_000);
    expect(w.workerAlive()).toBe(true);
    const clip = w.requestClip('Hey there.');
    const [job] = await settle(poll);
    expect(job.text).toBe('Hey there.');
    expect(w.deliver(job.id, WAV)).toBe(true);
    await expect(clip).resolves.toBe(WAV);
  });

  it("sends a whole reply's sentences in one poll", async () => {
    const w = await load();
    const poll = w.nextJobs(20_000);
    const clips = ['One.', 'Two.', 'Three.'].map((t) => w.requestClip(t));
    const jobs = await settle(poll);
    expect(jobs.map((j) => j.text)).toEqual(['One.', 'Two.', 'Three.']);
    jobs.forEach((j) => w.deliver(j.id, WAV));
    await expect(Promise.all(clips)).resolves.toEqual([WAV, WAV, WAV]);
  });

  it('queues jobs until the next poll picks them up', async () => {
    const w = await load();
    const idle = w.nextJobs(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await idle).toEqual([]);
    const clip = w.requestClip('Queued.');
    const [job] = await w.nextJobs(20_000);
    expect(job.text).toBe('Queued.');
    w.deliver(job.id, WAV);
    await expect(clip).resolves.toBe(WAV);
  });

  it('gives up on a slow worker so the caller can use the fallback voice', async () => {
    const w = await load();
    const poll = w.nextJobs(20_000);
    const clip = w.requestClip('Slow.', 5000);
    const [job] = await settle(poll);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(clip).resolves.toBeNull();
    // A clip that arrives after the deadline is refused, not played late.
    expect(w.deliver(job.id, WAV)).toBe(false);
  });

  it('treats an empty or header-only clip as a failure', async () => {
    const w = await load();
    const poll = w.nextJobs(20_000);
    const clip = w.requestClip('Broken.');
    const [job] = await settle(poll);
    w.deliver(job.id, Buffer.alloc(44));
    await expect(clip).resolves.toBeNull();
  });

  it('puts jobs back when their poll connection had already dropped', async () => {
    const w = await load();
    const poll = w.nextJobs(20_000);
    const clip = w.requestClip('Retry me.');
    const [lost] = await settle(poll);
    w.requeue(lost.id);
    const [job] = await w.nextJobs(20_000);
    expect(job.id).toBe(lost.id);
    w.deliver(job.id, WAV);
    await expect(clip).resolves.toBe(WAV);
  });

  it('stops counting a worker as alive soon after its connection drops', async () => {
    const w = await load();
    void w.nextJobs(20_000);
    w.releaseWaiter();
    expect(w.workerAlive()).toBe(true);
    vi.advanceTimersByTime(6000);
    expect(w.workerAlive()).toBe(false);
  });
});

describe('cancelling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("drops only that visitor's queued sentences, without a fallback", async () => {
    const w = await load();
    const idle = w.nextJobs(10);
    await vi.advanceTimersByTimeAsync(10);
    await idle;
    const mine = ['A.', 'B.'].map((t) => w.requestClip(t, 20_000, 'me'));
    const theirs = w.requestClip('C.', 20_000, 'them');
    w.cancelGroup('me');
    await expect(Promise.all(mine)).resolves.toEqual(['cancelled', 'cancelled']);
    const jobs = await w.nextJobs(20_000);
    expect(jobs.map((j) => j.text)).toEqual(['C.']);
    w.deliver(jobs[0].id, WAV);
    await expect(theirs).resolves.toBe(WAV);
  });
});

describe('prefetching a reply', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.TTS_MODE;
  });

  it("queues every sentence the page will ask for, and serves the page's requests from them", async () => {
    vi.resetModules();
    process.env.TTS_MODE = 'clone-remote';
    const worker = await import('../server/voiceWorker');
    const tts = await import('../server/tts');
    const { splitForSpeech } = await import('../server/speech');

    const reply = "Hey! I'm Arman, sixteen, from Tehran. I build AI stuff, and yeah, I built this twin. Want to hear more?";
    const poll = worker.nextJobs(20_000);
    tts.prefetchSpeech(reply, 'visitor-1');
    const jobs = await settle(poll);
    expect(jobs.map((j) => j.text)).toEqual(splitForSpeech(reply));

    // An MP4/AAC clip ("ftyp" at byte 4) is stored with the right extension.
    const aac = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypM4A '), Buffer.alloc(100)]);
    jobs.forEach((j) => worker.deliver(j.id, aac));
    await vi.runAllTimersAsync();

    const first = await tts.synthesizeSpeech(jobs[0].text, 'page-request', 'visitor-1');
    expect(first.audioUrl).toMatch(/\.m4a$/);
    expect(first.useBrowserTTS).toBe(false);
  });
});
