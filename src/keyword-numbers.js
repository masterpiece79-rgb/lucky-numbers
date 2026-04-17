/**
 * 꿈/키워드 번호 매칭
 *
 * 한국 로또 문화의 꿈풀이 전통을 기반으로, 주요 키워드별로
 * 의미 있는 번호 풀을 정의. 키워드 미매칭 시 글자 해시 기반 fallback.
 */

// 키워드별 기본 번호 풀 (전통 꿈풀이 + 재미 요소 결합)
const KEYWORD_MAP = {
  // 동물 꿈 (재물운 상징)
  '돼지': { emoji: '🐷', pool: [3, 7, 11, 17, 23, 27, 33, 37, 39, 43], desc: '최고의 재물운 상징' },
  '조상': { emoji: '👴', pool: [1, 4, 8, 13, 21, 28, 35, 42, 44, 45], desc: '조상님이 알려주는 번호' },
  '용':   { emoji: '🐉', pool: [5, 9, 14, 19, 24, 29, 34, 39, 44, 45], desc: '최고 권위와 행운' },
  '뱀':   { emoji: '🐍', pool: [4, 11, 18, 22, 27, 33, 38, 41, 44, 45], desc: '지혜와 부의 상징' },
  '물고기': { emoji: '🐟', pool: [2, 6, 12, 18, 24, 30, 36, 42, 43, 45], desc: '풍요와 번영' },
  '호랑이': { emoji: '🐅', pool: [7, 15, 21, 29, 31, 38, 42, 44, 45, 17], desc: '용맹과 큰 재물' },
  '말':   { emoji: '🐎', pool: [3, 8, 15, 22, 28, 33, 37, 41, 45, 19], desc: '빠른 재운의 상징' },
  '소':   { emoji: '🐂', pool: [9, 12, 18, 23, 29, 34, 38, 42, 45, 11], desc: '꾸준한 재물운' },

  // 자연 요소
  '불':   { emoji: '🔥', pool: [5, 11, 17, 23, 29, 31, 37, 41, 43, 45], desc: '큰 재물의 기운' },
  '물':   { emoji: '💧', pool: [2, 6, 12, 18, 24, 30, 36, 42, 45, 8], desc: '재물이 흐르는 기운' },
  '산':   { emoji: '⛰️', pool: [4, 9, 14, 19, 24, 29, 34, 39, 44, 7], desc: '안정된 재운' },
  '바다': { emoji: '🌊', pool: [3, 8, 13, 18, 23, 28, 33, 38, 43, 21], desc: '큰 재물의 흐름' },

  // 사람/신체
  '아기': { emoji: '👶', pool: [1, 4, 7, 13, 18, 22, 27, 33, 40, 45], desc: '새로운 시작의 축복' },
  '부모': { emoji: '👨‍👩‍👧', pool: [8, 11, 14, 19, 24, 28, 33, 37, 42, 45], desc: '가족의 행운' },

  // 사물
  '돈':   { emoji: '💰', pool: [5, 10, 15, 20, 25, 30, 35, 40, 45, 7], desc: '직접적인 재물운' },
  '금':   { emoji: '🥇', pool: [3, 9, 15, 21, 27, 33, 39, 44, 45, 11], desc: '부의 상징' },
  '꽃':   { emoji: '🌸', pool: [2, 5, 9, 14, 20, 26, 31, 37, 42, 45], desc: '인연과 기쁨' },
  '별':   { emoji: '⭐', pool: [6, 12, 18, 24, 30, 36, 42, 45, 7, 21], desc: '운명의 신호' },
  '무지개': { emoji: '🌈', pool: [1, 8, 16, 24, 32, 40, 45, 12, 27, 36], desc: '꿈의 실현' },

  // 숫자(생일/기념일)
  '생일': { emoji: '🎂', pool: [1, 3, 6, 9, 12, 18, 21, 24, 27, 30], desc: '개인의 특별한 날' },
  '결혼': { emoji: '💒', pool: [5, 11, 17, 23, 29, 33, 38, 42, 45, 2], desc: '새로운 인연과 축복' },
}

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * 키워드에서 매칭되는 번호 풀 찾기
 */
function findKeywordPool(keyword) {
  const trimmed = keyword.trim()
  if (!trimmed) return null

  // 완전 일치
  if (KEYWORD_MAP[trimmed]) {
    return { ...KEYWORD_MAP[trimmed], matched: trimmed }
  }

  // 부분 일치 (키워드가 입력에 포함되거나 입력이 키워드에 포함)
  for (const [key, val] of Object.entries(KEYWORD_MAP)) {
    if (trimmed.includes(key) || key.includes(trimmed)) {
      return { ...val, matched: key }
    }
  }

  return null
}

/**
 * 키워드로 번호 6개 생성
 * @param {string} keyword - 사용자 입력
 * @returns {{numbers: number[], matched: string|null, emoji: string, desc: string}}
 */
export function generateFromKeyword(keyword) {
  const trimmed = keyword.trim() || '행운'
  const matched = findKeywordPool(trimmed)

  let pool
  let emoji = '🌟'
  let desc = ''
  let matchedKey = null

  if (matched) {
    pool = [...matched.pool]
    emoji = matched.emoji
    desc = matched.desc
    matchedKey = matched.matched
  } else {
    // Fallback: 키워드 해시 기반 seed로 10개 pool 생성
    const hash = hashString(trimmed)
    pool = []
    const used = new Set()
    let seed = hash
    while (pool.length < 10) {
      seed = (seed * 9301 + 49297) % 233280
      const n = (seed % 45) + 1
      if (!used.has(n)) {
        used.add(n)
        pool.push(n)
      }
    }
    desc = `"${trimmed}"의 고유한 기운으로 만든 번호`
  }

  // pool에서 6개 랜덤 선택
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const numbers = shuffled.slice(0, 6).sort((a, b) => a - b)

  return { numbers, matched: matchedKey, emoji, desc, keyword: trimmed }
}

/**
 * 추천 키워드 목록 (UI용)
 */
export function getSuggestedKeywords() {
  return [
    { key: '돼지', emoji: '🐷' },
    { key: '조상', emoji: '👴' },
    { key: '용', emoji: '🐉' },
    { key: '물고기', emoji: '🐟' },
    { key: '돈', emoji: '💰' },
    { key: '금', emoji: '🥇' },
    { key: '별', emoji: '⭐' },
    { key: '무지개', emoji: '🌈' },
  ]
}
