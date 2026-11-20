"use client";

export function guestTokenKey(code: string) {
  return `guess-digit-guest:${code}`;
}

export function ensureGuestToken(code: string): string {
  const key = guestTokenKey(code);
  let t = "";
  try {
    t = localStorage.getItem(key) || "";
  } catch {
    /* ignore */
  }
  if (!t || t.length < 8) {
    t = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2);
    try {
      localStorage.setItem(key, t);
    } catch {
      /* ignore */
    }
  }
  return t;
}

export async function api<T>(
  path: string,
  opts?: { method?: string; token?: string | null; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(path, {
    method: opts?.method || "GET",
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `http_${res.status}`);
    throw err;
  }
  return data as T;
}

export function compressImage(file: File, maxSide = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}
