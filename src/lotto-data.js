const API_URL = 'https://smok95.github.io/lotto/results/all.json'

let cachedData = null

export async function fetchLottoData(forceRefresh = false) {
  if (cachedData && !forceRefresh) return cachedData

  // forceRefresh 시 CDN/브라우저 캐시 우회 (추첨 직후 API 반영 지연 대응)
  const url = forceRefresh ? `${API_URL}?t=${Date.now()}` : API_URL
  const opts = forceRefresh ? { cache: 'no-store' } : {}
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error('데이터를 불러올 수 없습니다')
  cachedData = await res.json()
  console.log(`[LottoData] ${cachedData.length}개 회차 로드 완료${forceRefresh ? ' (강제 새로고침)' : ''}`)
  return cachedData
}

export function getLatestRound(data) {
  return data[data.length - 1]
}

export function getTotalRounds(data) {
  return data.length
}

// 전체 번호별 출현 횟수 (1~45)
export function getFrequencyMap(data) {
  const freq = {}
  for (let i = 1; i <= 45; i++) freq[i] = 0
  for (const round of data) {
    for (const n of round.numbers) {
      freq[n]++
    }
  }
  return freq
}

// 정렬된 빈도 배열 [{number, count}, ...]
function sortedFrequency(freqMap) {
  return Object.entries(freqMap)
    .map(([number, count]) => ({ number: Number(number), count }))
    .sort((a, b) => b.count - a.count)
}

// 가장 많이 뽑힌 번호 TOP N
export function getMostFrequent(data, n = 5) {
  const freq = getFrequencyMap(data)
  return sortedFrequency(freq).slice(0, n)
}

// 가장 적게 뽑힌 번호 TOP N
export function getLeastFrequent(data, n = 5) {
  const freq = getFrequencyMap(data)
  return sortedFrequency(freq).slice(-n).reverse()
}

// 특정 월에 자주 뽑힌 번호
export function getMonthlyHot(data, month, n = 5) {
  const monthData = data.filter(d => new Date(d.date).getMonth() + 1 === month)
  if (monthData.length === 0) return []
  const freq = getFrequencyMap(monthData)
  return sortedFrequency(freq).slice(0, n)
}

// 특정 월에 안 뽑힌 번호
export function getMonthlyCold(data, month, n = 5) {
  const monthData = data.filter(d => new Date(d.date).getMonth() + 1 === month)
  if (monthData.length === 0) return []
  const freq = getFrequencyMap(monthData)
  return sortedFrequency(freq).slice(-n).reverse()
}

// 최근 N회차 데이터
export function getRecentRounds(data, n) {
  return data.slice(-n)
}

// 올해 당첨 데이터
export function getThisYearData(data) {
  const year = new Date().getFullYear()
  return data.filter(d => new Date(d.date).getFullYear() === year)
}

// 최근 N회차에서 freq 이상 출현한 번호 목록
export function getHotNumbers(data, recentN = 5, minFreq = 2) {
  const recent = getRecentRounds(data, recentN)
  const freq = {}
  for (let i = 1; i <= 45; i++) freq[i] = 0
  for (const round of recent) {
    for (const n of round.numbers) freq[n]++
  }
  return Object.entries(freq)
    .filter(([, count]) => count >= minFreq)
    .map(([number]) => Number(number))
}

// 올해 한 번도 안 나온 번호 목록
export function getColdNumbers(data) {
  const thisYear = getThisYearData(data)
  const appeared = new Set()
  for (const round of thisYear) {
    for (const n of round.numbers) appeared.add(n)
  }
  const cold = []
  for (let i = 1; i <= 45; i++) {
    if (!appeared.has(i)) cold.push(i)
  }
  return cold
}

// 최근 N회차 동안 한 번도 안 나온 번호
export function getHiddenNumbers(data, recentN = 20) {
  const recent = getRecentRounds(data, recentN)
  const appeared = new Set()
  for (const round of recent) {
    for (const n of round.numbers) appeared.add(n)
  }
  const hidden = []
  for (let i = 1; i <= 45; i++) {
    if (!appeared.has(i)) hidden.push(i)
  }
  return hidden
}

// 해당 월 출현 빈도 상위 N개 번호 목록
export function getMonthlyHotNumbers(data, month, n = 15) {
  return getMonthlyHot(data, month, n).map(item => item.number)
}

// 번호의 공 색상 클래스
export function getBallClass(num) {
  if (num <= 10) return 'ball-1'
  if (num <= 20) return 'ball-2'
  if (num <= 30) return 'ball-3'
  if (num <= 40) return 'ball-4'
  return 'ball-5'
}
