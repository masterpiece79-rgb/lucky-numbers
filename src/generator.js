import {
  getHotNumbers,
  getColdNumbers,
  getLatestRound,
  getMonthlyHotNumbers,
  getMostFrequent,
  getLeastFrequent,
  getHiddenNumbers,
  getFrequencyMap
} from './lotto-data.js'

// 가중치 기반 랜덤 선택 (중복 없이 n개)
function weightedRandomPick(pool, n) {
  if (pool.length <= n) return [...pool.map(p => p.number)]

  const result = []
  const remaining = [...pool]

  for (let i = 0; i < n; i++) {
    const totalWeight = remaining.reduce((sum, p) => sum + p.weight, 0)
    let rand = Math.random() * totalWeight
    let picked = remaining[0]

    for (const item of remaining) {
      rand -= item.weight
      if (rand <= 0) {
        picked = item
        break
      }
    }

    result.push(picked.number)
    const idx = remaining.indexOf(picked)
    remaining.splice(idx, 1)
  }

  return result
}

// 단순 랜덤 선택 (배열에서 n개)
function randomPick(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

// 조건별 후보 풀 생성
function buildCandidatePool(condition, data) {
  const month = new Date().getMonth() + 1

  switch (condition) {
    case 'hot': {
      const hotNums = getHotNumbers(data, 5, 2)
      return hotNums.map(n => ({ number: n, weight: 3 }))
    }
    case 'cold': {
      const coldNums = getColdNumbers(data)
      return coldNums.map(n => ({ number: n, weight: 2 }))
    }
    case 'last-draw': {
      const latest = getLatestRound(data)
      return latest.numbers.map(n => ({ number: n, weight: 4 }))
    }
    case 'monthly': {
      const monthlyNums = getMonthlyHotNumbers(data, month, 15)
      return monthlyNums.map((n, i) => ({ number: n, weight: 15 - i }))
    }
    case 'balanced': {
      const top = getMostFrequent(data, 10).map(item => ({ number: item.number, weight: 2 }))
      const bottom = getLeastFrequent(data, 10).map(item => ({ number: item.number, weight: 2 }))
      return [...top, ...bottom]
    }
    case 'hidden': {
      const hiddenNums = getHiddenNumbers(data, 20)
      return hiddenNums.map(n => ({ number: n, weight: 2 }))
    }
    default:
      return []
  }
}

// 메인 번호 생성 함수 (3개)
export function generateLuckyNumbers(conditions, data) {
  if (conditions.length === 0) return []

  // 각 조건의 후보 풀 합치기
  const poolMap = new Map()

  for (const condition of conditions) {
    const candidates = buildCandidatePool(condition, data)
    for (const c of candidates) {
      if (poolMap.has(c.number)) {
        poolMap.get(c.number).weight += c.weight
      } else {
        poolMap.set(c.number, { number: c.number, weight: c.weight })
      }
    }
  }

  let pool = Array.from(poolMap.values())

  // 풀이 3개 미만이면 전체 빈도맵에서 보충
  if (pool.length < 3) {
    const freq = getFrequencyMap(data)
    for (let i = 1; i <= 45; i++) {
      if (!poolMap.has(i)) {
        pool.push({ number: i, weight: 1 })
      }
    }
  }

  // 직전 회차 연결 조건이면 최소 1개는 직전 번호에서 선택
  if (conditions.includes('last-draw')) {
    const latest = getLatestRound(data)
    const forced = randomPick(latest.numbers, 1)[0]
    const remaining = pool.filter(p => p.number !== forced)
    const others = weightedRandomPick(remaining, 2)
    return [forced, ...others].sort((a, b) => a - b)
  }

  return weightedRandomPick(pool, 3).sort((a, b) => a - b)
}

// 실전 5게임 생성 (A~E 각 6개 번호)
export function generateFiveGames(conditions, data) {
  const games = []
  for (let i = 0; i < 5; i++) {
    const set1 = generateLuckyNumbers(conditions, data)
    const set2 = generateLuckyNumbers(conditions, data)
    const merged = [...set1]
    for (const n of set2) {
      if (!merged.includes(n) && merged.length < 6) {
        merged.push(n)
      }
    }
    while (merged.length < 6) {
      const rand = Math.floor(Math.random() * 45) + 1
      if (!merged.includes(rand)) merged.push(rand)
    }
    games.push(merged.sort((a, b) => a - b))
  }
  return games
}
