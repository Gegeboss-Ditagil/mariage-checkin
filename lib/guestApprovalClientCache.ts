'use client';

type ApprovalPayload = { requests?: Array<{ photo_signed_url?: string | null }> };

let cachedPayload: ApprovalPayload | null = null;
let warmPromise: Promise<ApprovalPayload | null> | null = null;

function preloadPhotos(payload: ApprovalPayload | null) {
  if (!payload || typeof window === 'undefined') return;
  for (const request of (payload.requests || []).slice(0, 6)) {
    if (!request.photo_signed_url) continue;
    const image = new Image();
    image.decoding = 'async';
    image.src = request.photo_signed_url;
  }
}

async function requestApprovals(): Promise<ApprovalPayload | null> {
  const response = await fetch('/api/guest-approvals', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = (await response.json()) as ApprovalPayload;
  cachedPayload = payload;
  preloadPhotos(payload);
  return payload;
}

/** Lance la lecture pendant le splash et partage la meme Promise avec la page. */
export function warmGuestApprovals() {
  if (cachedPayload) return Promise.resolve(cachedPayload);
  if (!warmPromise) warmPromise = requestApprovals().finally(() => { warmPromise = null; });
  return warmPromise;
}

export function readGuestApprovalsCache() {
  return cachedPayload;
}

/** Actualisation explicite apres une decision ou pendant le sondage. */
export async function refreshGuestApprovals() {
  return requestApprovals();
}

export function clearGuestApprovalsCache() {
  cachedPayload = null;
  warmPromise = null;
}
