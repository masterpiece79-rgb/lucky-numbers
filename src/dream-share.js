/**
 * 꿈 번호 공유 (Phase 1: URL 인코딩 방식, 서버 없이)
 *
 * URL 파라미터 스펙:
 *   ?dream=<base64url>
 *   payload = { n: [1,2,3,4,5,6], k: "돼지", e: "🐷", f: "초대박행운전도사", t: 1729234567 }
 *
 * - n: 번호 6개
 * - k: 키워드
 * - e: 이모지
 * - f: 보낸사람(from)
 * - t: 공유 시점 타임스탬프
 *
 * 3회 제한: localStorage에 {groupId: count} 저장
 */

const SHARE_COUNT_KEY = 'dream_share_counts_v1'
const MAX_SHARES_PER_DREAM = 3
const BASE_URL = 'https://lucky-numbers-miniapp.vercel.app'
const TOSS_URL = 'intoss://lucky-numbers'

function encodePayload(obj) {
  const json = JSON.stringify(obj)
  // Base64 URL-safe
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodePayload(encoded) {
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = decodeURIComponent(escape(atob(b64)))
    return JSON.parse(json)
  } catch (e) {
    console.error('[DreamShare] decode failed:', e)
    return null
  }
}

/**
 * 공유 링크 생성
 * @returns { url: string, tossUrl: string } 웹/앱 링크 쌍
 */
export function buildShareUrl({ numbers, keyword, emoji, from }) {
  const payload = {
    n: numbers,
    k: keyword,
    e: emoji,
    f: from,
    t: Date.now(),
  }
  const encoded = encodePayload(payload)
  return {
    url: `${BASE_URL}/?dream=${encoded}`,
    tossUrl: `${TOSS_URL}/?dream=${encoded}`,
    payload,
  }
}

/**
 * URL에서 받은 꿈 감지
 */
export function detectReceivedDream() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get('dream')
  if (!encoded) return null
  const payload = decodePayload(encoded)
  if (!payload || !Array.isArray(payload.n) || payload.n.length !== 6) return null
  return {
    numbers: payload.n,
    keyword: payload.k || '행운',
    emoji: payload.e || '🎁',
    from: payload.f || '이름모를행운가',
    timestamp: payload.t,
  }
}

/**
 * URL에서 dream 파라미터 제거 (중복 처리 방지)
 */
export function clearDreamParam() {
  if (typeof window === 'undefined' || !window.history?.replaceState) return
  const url = new URL(window.location.href)
  url.searchParams.delete('dream')
  window.history.replaceState({}, '', url.toString())
}

/**
 * 공유 카운터 관리 (localStorage)
 */
function getShareCounts() {
  try {
    const raw = localStorage.getItem(SHARE_COUNT_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveShareCounts(counts) {
  try {
    localStorage.setItem(SHARE_COUNT_KEY, JSON.stringify(counts))
  } catch {}
}

/**
 * 꿈번호 고유 키 생성 (동일 번호+키워드는 같은 카운터)
 */
function getDreamKey(numbers, keyword) {
  const sorted = [...numbers].sort((a, b) => a - b).join(',')
  return `${keyword}:${sorted}`
}

/**
 * 해당 꿈번호를 몇 번 공유했는지
 */
export function getShareCount(numbers, keyword) {
  const counts = getShareCounts()
  return counts[getDreamKey(numbers, keyword)] || 0
}

/**
 * 남은 공유 가능 횟수
 */
export function getRemainingShares(numbers, keyword) {
  return Math.max(0, MAX_SHARES_PER_DREAM - getShareCount(numbers, keyword))
}

/**
 * 공유 횟수 증가
 * @returns { ok: boolean, remaining: number }
 */
export function incrementShareCount(numbers, keyword) {
  const counts = getShareCounts()
  const key = getDreamKey(numbers, keyword)
  const current = counts[key] || 0
  if (current >= MAX_SHARES_PER_DREAM) {
    return { ok: false, remaining: 0 }
  }
  counts[key] = current + 1
  saveShareCounts(counts)
  return { ok: true, remaining: MAX_SHARES_PER_DREAM - counts[key] }
}

export { MAX_SHARES_PER_DREAM }
