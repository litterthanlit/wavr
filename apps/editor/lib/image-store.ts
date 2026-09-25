/**
 * Content-addressed storage for uploaded images, kept out of localStorage.
 *
 * Saved projects hold `wavr-image:<sha256>` references instead of base64
 * data URLs, so a few images no longer exhaust the ~5 MB localStorage quota.
 * Blobs live in IndexedDB; identical images are stored once.
 */

export const IMAGE_REF_PREFIX = "wavr-image:";

export function isImageRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(IMAGE_REF_PREFIX);
}

export function isDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:");
}

export interface ImageBackend {
  put(key: string, value: Blob): Promise<void>;
  get(key: string): Promise<Blob | undefined>;
  keys(): Promise<string[]>;
  delete(key: string): Promise<void>;
}

export class MemoryImageBackend implements ImageBackend {
  readonly entries = new Map<string, Blob>();
  async put(key: string, value: Blob) {
    this.entries.set(key, value);
  }
  async get(key: string) {
    return this.entries.get(key);
  }
  async keys() {
    return [...this.entries.keys()];
  }
  async delete(key: string) {
    this.entries.delete(key);
  }
}

const DB_NAME = "wavr-images";
const STORE = "images";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

class IndexedDbImageBackend implements ImageBackend {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        this.db = null;
        reject(req.error ?? new Error("Could not open IndexedDB"));
      };
      req.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
    });
    return this.db;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  async put(key: string, value: Blob) {
    await request((await this.store("readwrite")).put(value, key));
  }
  async get(key: string) {
    return (await request((await this.store("readonly")).get(key))) as Blob | undefined;
  }
  async keys() {
    return (await request((await this.store("readonly")).getAllKeys())).map(String);
  }
  async delete(key: string) {
    await request((await this.store("readwrite")).delete(key));
  }
}

let backend: ImageBackend | null | undefined;

/** The shared image backend, or null where IndexedDB is unavailable. */
export function getImageBackend(): ImageBackend | null {
  if (backend === undefined) {
    backend = typeof indexedDB === "undefined" ? null : new IndexedDbImageBackend();
  }
  return backend;
}

export function setImageBackendForTests(next: ImageBackend | null | undefined): void {
  backend = next;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) throw new Error("Not a data URL");
  const header = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const mimeType = header.split(";")[0] || "application/octet-stream";
  if (header.endsWith(";base64")) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  }
  return new Blob([decodeURIComponent(payload)], { type: mimeType });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Store an image and return its reference. Storing the same image twice is a no-op. */
export async function storeImage(store: ImageBackend, dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const key = await sha256Hex(blob);
  if (!(await store.get(key))) await store.put(key, blob);
  return IMAGE_REF_PREFIX + key;
}

/** Data URL for a reference, or null if the image is gone. */
export async function loadImage(store: ImageBackend, ref: string): Promise<string | null> {
  const blob = await store.get(ref.slice(IMAGE_REF_PREFIX.length));
  return blob ? blobToDataUrl(blob) : null;
}

/** Delete stored images that none of `refs` point to. */
export async function pruneImages(store: ImageBackend, refs: Set<string>): Promise<void> {
  const keep = new Set([...refs].map((ref) => ref.slice(IMAGE_REF_PREFIX.length)));
  for (const key of await store.keys()) {
    if (!keep.has(key)) await store.delete(key);
  }
}
