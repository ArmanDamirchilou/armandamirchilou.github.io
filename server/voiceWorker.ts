import { randomUUID } from 'crypto';

/**
 * Hands speech jobs to a voice worker that runs somewhere with the horsepower
 * for voice cloning (Arman's Mac) and can't accept incoming connections. The
 * worker long-polls nextJobs() over HTTPS and posts the finished WAV back via
 * deliver(), so nothing on its side has to be reachable from the internet.
 *
 * When no worker is connected, requestClip() returns null straight away and
 * the caller falls back to the local voice, so the twin never goes silent.
 */

/** A clip, null (worker gone or too slow: use the fallback), or 'cancelled'. */
export type ClipResult = Buffer | null | 'cancelled';

type Job = { id: string; text: string; group?: string; resolve: (r: ClipResult) => void; timer: NodeJS.Timeout };

const queue: Job[] = [];
const inflight = new Map<string, Job>();
let waiter: ((job: Job | null) => void) | null = null;
let lastSeen = 0;

// A worker between polls is still connected; after this long without one it
// has gone away (Mac asleep, network drop) and jobs should not wait for it.
const ALIVE_MS = 35_000;

export function workerAlive(): boolean {
  return waiter !== null || Date.now() - lastSeen < ALIVE_MS;
}

function finish(job: Job, wav: ClipResult) {
  clearTimeout(job.timer);
  inflight.delete(job.id);
  const i = queue.indexOf(job);
  if (i >= 0) queue.splice(i, 1);
  job.resolve(wav);
}

/**
 * Asks the worker for a clip; resolves null if it's gone or too slow. `group`
 * (the visitor's session) lets cancelGroup() drop a reply nobody will hear.
 */
export function requestClip(text: string, timeoutMs = 20_000, group?: string): Promise<ClipResult> {
  if (!workerAlive()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const job: Job = {
      id: randomUUID(),
      text,
      group,
      resolve,
      timer: setTimeout(() => finish(job, null), timeoutMs),
    };
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(job);
    } else {
      queue.push(job);
    }
  });
}

/**
 * The visitor interrupted (Stop, or asked something new): drop their queued
 * sentences so the worker's time goes to the reply they're waiting for. Jobs
 * already handed out resolve now too; their late clips are refused on arrival.
 */
export function cancelGroup(group: string) {
  for (const job of [...queue, ...inflight.values()]) if (job.group === group) finish(job, 'cancelled');
}

// Jobs handed out per poll. Each poll costs the worker a full round trip, which
// from a home connection can be a second or more, so take everything waiting.
const BATCH = 4;

type Handout = { id: string; text: string };
const handout = (job: Job): Handout => {
  inflight.set(job.id, job);
  return { id: job.id, text: job.text };
};

/** Called by the worker's long-poll: queued jobs, or [] after waitMs. */
export function nextJobs(waitMs = 20_000): Promise<Handout[]> {
  lastSeen = Date.now();
  if (queue.length) return Promise.resolve(queue.splice(0, BATCH).map(handout));
  // Only one worker is expected; a newer poll replaces a stale one.
  waiter?.(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (waiter === take) waiter = null;
      lastSeen = Date.now();
      resolve([]);
    }, waitMs);
    const take = (job: Job | null) => {
      clearTimeout(timer);
      lastSeen = Date.now();
      // A reply's sentences are queued together; let the rest of the batch
      // land before answering so they go out in this same response.
      if (!job) return resolve([]);
      setTimeout(() => resolve([handout(job), ...queue.splice(0, BATCH - 1).map(handout)]), 30);
    };
    waiter = take;
  });
}

/** The poll's connection closed before a job arrived: stop waiting on it. */
export function releaseWaiter() {
  const w = waiter;
  waiter = null;
  w?.(null);
  // Give it a few seconds to reconnect, not the full window: a Mac that just
  // went to sleep shouldn't make visitors wait for clips that won't come.
  lastSeen = Date.now() - ALIVE_MS + 5_000;
}

/** A job was handed to a poll whose connection had already closed. */
export function requeue(id: string) {
  const job = inflight.get(id);
  if (!job) return;
  inflight.delete(id);
  queue.unshift(job);
}

/** The worker's finished clip. False if the job already timed out. */
export function deliver(id: string, wav: Buffer | null): boolean {
  lastSeen = Date.now();
  const job = inflight.get(id);
  if (!job) return false;
  finish(job, wav && wav.length > 44 ? wav : null);
  return true;
}
