/**
 * Lightweight hints for contact-import UI (no PII).
 */

/** Best-effort iOS/iPadOS detection for tailored copy (Safari has no Contact Picker API). */
export function isLikelyIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ may report as MacIntel with touch
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true
  return false
}
