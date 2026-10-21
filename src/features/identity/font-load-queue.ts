import type { FontDownloadProgress } from "./font-download-progress";
type Subscriber<T> = {
  priority: () => number;
  onProgress?: (progress: FontDownloadProgress) => void;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};
type Entry<T> = {
  key: string;
  controller: AbortController;
  loader: (
    signal: AbortSignal,
    report: (progress: FontDownloadProgress) => void,
  ) => Promise<T>;
  progress: FontDownloadProgress;
  subscribers: Set<Subscriber<T>>;
  state: "queued" | "running" | "ready";
  value?: T;
};
const aborted = () => new DOMException("Font loading cancelled", "AbortError");

/** Shared downloads: cancel only after the last consumer leaves; cache completed fonts. */
export class FontLoadQueue<T> {
  private entries = new Map<string, Entry<T>>();
  private queue: Entry<T>[] = [];
  private running = 0;
  private reservations = new Set<() => number>();
  private scheduled = false;
  constructor(private concurrency = 3) {}

  reserve(priority: () => number) {
    this.reservations.add(priority);
    return () => {
      this.reservations.delete(priority);
      this.refresh();
    };
  }

  refresh() {
    if (this.scheduled) return;
    this.scheduled = true;
    const run = () => {
      this.scheduled = false;
      this.pump();
    };
    // Let all cards register their work before deciding visual priority.
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else queueMicrotask(run);
  }

  keys() {
    return this.entries.keys();
  }
  delete(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    entry.controller.abort();
    for (const subscriber of entry.subscribers) subscriber.reject(aborted());
    entry.subscribers.clear();
  }

  load(
    key: string,
    loader: Entry<T>["loader"],
    signal?: AbortSignal,
    onProgress?: Subscriber<T>["onProgress"],
    priority: () => number = () => 0,
  ): Promise<T> {
    if (signal?.aborted) return Promise.reject(aborted());
    let entry = this.entries.get(key);
    if (entry?.state === "ready") return Promise.resolve(entry.value as T);
    if (!entry) {
      entry = {
        key,
        loader,
        controller: new AbortController(),
        subscribers: new Set(),
        state: "queued",
        progress: { phase: "queued", loaded: 0, total: null },
      };
      this.entries.set(key, entry);
      this.queue.push(entry);
    }
    const current = entry;
    return new Promise<T>((resolve, reject) => {
      const cleanup = () => signal?.removeEventListener("abort", cancel);
      const subscriber: Subscriber<T> = {
        priority,
        onProgress,
        resolve: (value) => {
          cleanup();
          resolve(value);
        },
        reject: (error) => {
          cleanup();
          reject(error);
        },
      };
      const cancel = () => {
        current.subscribers.delete(subscriber);
        subscriber.reject(aborted());
        if (!current.subscribers.size && current.state !== "ready") {
          if (this.entries.get(key) === current) this.entries.delete(key);
          current.controller.abort();
        }
      };
      current.subscribers.add(subscriber);
      signal?.addEventListener("abort", cancel, { once: true });
      onProgress?.(current.progress);
      this.refresh();
    });
  }

  private pump() {
    const priority = (entry: Entry<T>) =>
      Math.min(...[...entry.subscribers].map((item) => item.priority()));
    while (this.running < this.concurrency && this.queue.length) {
      this.queue = this.queue.filter(
        (entry) => !entry.controller.signal.aborted,
      );
      if (!this.queue.length) return;
      this.queue.sort((left, right) => priority(left) - priority(right));
      const entry = this.queue[0];
      const barrier = Math.min(
        Infinity,
        ...[...this.reservations].map((getPriority) => getPriority()),
      );
      if (barrier < priority(entry)) return;
      this.queue.shift();
      entry.state = "running";
      this.running++;
      void Promise.resolve()
        .then(() => {
          entry.controller.signal.throwIfAborted();
          return entry.loader(entry.controller.signal, (progress) => {
            if (entry.controller.signal.aborted) return;
            entry.progress = progress;
            for (const subscriber of entry.subscribers)
              subscriber.onProgress?.(progress);
          });
        })
        .then((value) => {
          entry.controller.signal.throwIfAborted();
          entry.state = "ready";
          entry.value = value;
          for (const subscriber of entry.subscribers) subscriber.resolve(value);
        })
        .catch((error) => {
          if (this.entries.get(entry.key) === entry)
            this.entries.delete(entry.key);
          for (const subscriber of entry.subscribers) subscriber.reject(error);
        })
        .finally(() => {
          entry.subscribers.clear();
          this.running--;
          this.refresh();
        });
    }
  }
}
