/**
 * 행운 보관함 - localStorage 기반
 * 저장 구조:
 * {
 *   id: timestamp,
 *   groupId: timestamp,              // 영구보관 묶음 ID (clone과 공유)
 *   numbers: [1,7,13,22,33,44],
 *   conditions: ['hot'] | ['keyword'] | ['5game'] | ['manual'],
 *   targetDrawNo: 1220,
 *   savedAt: '2026-04-18T10:30:00',
 *   checked: false,
 *   result: { rank, matches, bonus } | null,
 *   prizeInfo: { prize, winners } | null,
 *   label: string,
 *   isManual: boolean,               // 유저가 직접 고른 번호
 *   isPermanent: boolean,            // 매주 자동 재등록
 * }
 */

const STORAGE_KEY = 'lucky_numbers_vault_v1'
const MAX_ITEMS = 100 // 최대 보관 개수 (확장)
const MAX_MANUAL_GROUPS = 5 // 수동 저장 최대 그룹(세트) 수

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

export function saveNumbers({
  numbers, conditions, targetDrawNo, label,
  isManual = false, isPermanent = false, groupId = null,
}) {
  const all = getAllSaved()
  const now = Date.now()
  const item = {
    id: now,
    groupId: groupId || now,
    numbers: [...numbers].sort((a, b) => a - b),
    conditions: conditions || [],
    targetDrawNo,
    savedAt: new Date().toISOString(),
    checked: false,
    result: null,
    label: label || '행운번호',
    isManual,
    isPermanent,
  }
  all.unshift(item)

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

/**
 * 수동 저장된 번호의 고유 그룹 수 (한도 체크용)
 */
export function countManualGroups() {
  const all = getAllSaved()
  const groups = new Set()
  for (const item of all) {
    if (item.isManual && item.groupId) groups.add(item.groupId)
  }
  return groups.size
}

/**
 * 영구보관(매주 자동 재등록) 대상의 최신 엔트리 조회
 */
export function getLatestInGroup(groupId) {
  const all = getAllSaved()
  return all.find(item => item.groupId === groupId) || null
}

/**
 * 특정 그룹을 통째로 삭제 (모든 clone 포함)
 */
export function deleteGroup(groupId) {
  const all = getAllSaved().filter(item => item.groupId !== groupId)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

/**
 * 영구보관 그룹의 자동 재등록: 해당 그룹의 최신 엔트리가
 * 이미 추첨됐고(targetDrawNo <= latest draw) 다음 회차를 타겟으로 하는
 * 미체크 엔트리가 없으면 → 다음 회차용 clone 생성
 */
export function ensurePermanentNextDraw(latestDrawNo) {
  const all = getAllSaved()
  const permanentGroups = new Map()

  // 그룹별 최신 엔트리 수집 (영구보관만)
  for (const item of all) {
    if (!item.isPermanent || !item.groupId) continue
    const existing = permanentGroups.get(item.groupId)
    if (!existing || item.savedAt > existing.savedAt) {
      permanentGroups.set(item.groupId, item)
    }
  }

  let cloned = 0
  for (const [groupId, latest] of permanentGroups) {
    // 이미 미래 회차 대기 중인 clone 있으면 skip
    const hasPending = all.some(
      it => it.groupId === groupId && !it.checked && it.targetDrawNo > latestDrawNo
    )
    if (hasPending) continue

    // 다음 회차 clone 생성
    const nextTarget = latestDrawNo + 1
    saveNumbers({
      numbers: latest.numbers,
      conditions: latest.conditions,
      targetDrawNo: nextTarget,
      label: latest.label,
      isManual: latest.isManual,
      isPermanent: true,
      groupId, // 같은 그룹 유지
    })
    cloned++
  }
  return cloned
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
