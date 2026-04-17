/**
 * 번호 보관함 - localStorage 기반
 * 저장 구조:
 * {
 *   id: timestamp,
 *   numbers: [1,7,13,22,33,44],   // 6개 번호 (3개만 있는 경우 1등 판정 불가)
 *   conditions: ['hot', 'monthly'], // 또는 ['keyword'] 또는 ['5game']
 *   targetDrawNo: 1220,             // 이 번호로 맞출 예상 회차
 *   savedAt: '2026-04-18T10:30:00',
 *   checked: false,                 // 매칭 완료 여부
 *   result: { rank, matches, bonus } | null,
 *   label: '행운번호' | '꿈 키워드: 돼지' 등
 * }
 */

const STORAGE_KEY = 'lucky_numbers_vault_v1'
const MAX_ITEMS = 50 // 최대 보관 개수

export function getAllSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch (e) {
    console.error('[Storage] 불러오기 실패:', e)
    return []
  }
}

export function saveNumbers({ numbers, conditions, targetDrawNo, label }) {
  const all = getAllSaved()
  const item = {
    id: Date.now(),
    numbers: [...numbers].sort((a, b) => a - b),
    conditions: conditions || [],
    targetDrawNo,
    savedAt: new Date().toISOString(),
    checked: false,
    result: null,
    label: label || '행운번호',
  }
  all.unshift(item) // 최신이 위로

  // 최대 개수 초과 시 가장 오래된 것 제거
  if (all.length > MAX_ITEMS) {
    all.splice(MAX_ITEMS)
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    return item
  } catch (e) {
    console.error('[Storage] 저장 실패:', e)
    return null
  }
}

export function deleteItem(id) {
  const all = getAllSaved().filter(item => item.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

export function updateItem(id, updates) {
  const all = getAllSaved()
  const idx = all.findIndex(item => item.id === id)
  if (idx === -1) return false
  all[idx] = { ...all[idx], ...updates }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

export function countUnreadWinnings() {
  const all = getAllSaved()
  return all.filter(item => item.result && item.result.rank > 0 && !item.resultSeen).length
}
