import {
  fetchLottoData,
  getLatestRound,
  getTotalRounds,
  getMostFrequent,
  getLeastFrequent,
  getMonthlyHot,
  getMonthlyCold,
  getBallClass
} from './lotto-data.js'
import { generateLuckyNumbers } from './generator.js'
import { showTossInterstitialAd, showTossRewardedAd } from './toss-sdk.js'

// --- State ---
let lottoData = null
let isInToss = typeof window !== 'undefined' && !!window.__APPS_IN_TOSS__
let selectedConditions = []
let currentNumbers = [] // 현재 생성된 전체 6개 번호

// --- DOM ---
const screens = {
  onboarding: document.getElementById('screen-onboarding'),
  stats: document.getElementById('screen-stats'),
  conditions: document.getElementById('screen-conditions'),
  result: document.getElementById('screen-result'),
}

const loadingOverlay = document.getElementById('loading-overlay')
const adOverlay = document.getElementById('ad-overlay')
const adCloseBtn = document.getElementById('ad-close-btn')

// --- Screen Management ---
function switchScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'))
  screens[name].classList.add('active')
  window.scrollTo(0, 0)
}

// --- Ball Rendering ---
function createBallHTML(num, size = '', count = null) {
  const cls = getBallClass(num)
  const sizeClass = size ? ` ${size}` : ''
  const countHTML = count !== null ? `<span class="ball-count">${count}회</span>` : ''
  return `<span class="lotto-ball${sizeClass} ${cls}">${num}${countHTML}</span>`
}

// --- Stats Rendering ---
function renderStats() {
  const month = new Date().getMonth() + 1
  const latest = getLatestRound(lottoData)
  const total = getTotalRounds(lottoData)

  document.getElementById('total-rounds').textContent = latest.draw_no
  document.getElementById('total-count').textContent = total
  document.getElementById('current-month').textContent = month

  // 직전 당첨 결과
  document.getElementById('latest-round-label').textContent = `제${latest.draw_no}회`
  const drawDate = new Date(latest.date)
  document.getElementById('latest-date-label').textContent =
    `${drawDate.getFullYear()}.${String(drawDate.getMonth()+1).padStart(2,'0')}.${String(drawDate.getDate()).padStart(2,'0')}`
  document.getElementById('latest-draw-balls').innerHTML =
    latest.numbers.map(n => createBallHTML(n, '')).join('')
  document.getElementById('latest-bonus-ball').innerHTML = createBallHTML(latest.bonus_no, '')

  // 통계 카드
  const mostFreq = getMostFrequent(lottoData, 5)
  const leastFreq = getLeastFrequent(lottoData, 5)
  const monthHot = getMonthlyHot(lottoData, month, 5)
  const monthCold = getMonthlyCold(lottoData, month, 5)

  document.getElementById('stat-most-frequent').innerHTML =
    mostFreq.map(item => createBallHTML(item.number, 's', item.count)).join('')

  document.getElementById('stat-least-frequent').innerHTML =
    leastFreq.map(item => createBallHTML(item.number, 's', item.count)).join('')

  document.getElementById('stat-month-hot').innerHTML =
    monthHot.map(item => createBallHTML(item.number, 's', item.count)).join('')

  document.getElementById('stat-month-cold').innerHTML =
    monthCold.map(item => createBallHTML(item.number, 's', item.count)).join('')
}

// --- Condition Selection ---
const conditionLabels = {
  'hot': '🔥 뜨거운 번호',
  'cold': '❄️ 차가운 번호',
  'last-draw': '🔄 직전 회차',
  'monthly': '📅 이달의 행운',
  'balanced': '🎯 빈도 균형',
  'hidden': '🌙 숨은 번호',
}

function setupConditions() {
  const cards = document.querySelectorAll('.condition-card')
  const generateBtn = document.getElementById('btn-generate')

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const condition = card.dataset.condition

      if (card.classList.contains('selected')) {
        card.classList.remove('selected')
        selectedConditions = selectedConditions.filter(c => c !== condition)
      } else {
        if (selectedConditions.length >= 2) {
          const first = document.querySelector(`.condition-card[data-condition="${selectedConditions[0]}"]`)
          if (first) first.classList.remove('selected')
          selectedConditions.shift()
        }
        card.classList.add('selected')
        selectedConditions.push(condition)
      }

      generateBtn.disabled = selectedConditions.length === 0
      haptic('light')
    })
  })
}

// --- Ad (전면 광고 - 매번 번호 생성 시) ---
function showFallbackInterstitialAd() {
  return new Promise((resolve) => {
    adOverlay.classList.remove('hidden')
    adCloseBtn.disabled = true

    let countdown = 5
    adCloseBtn.textContent = `${countdown}초 후 닫기`

    const timer = setInterval(() => {
      countdown--
      if (countdown <= 0) {
        clearInterval(timer)
        adCloseBtn.disabled = false
        adCloseBtn.textContent = '닫기 ✕'
      } else {
        adCloseBtn.textContent = `${countdown}초 후 닫기`
      }
    }, 1000)

    adCloseBtn.onclick = () => {
      if (adCloseBtn.disabled) return
      adOverlay.classList.add('hidden')
      resolve()
    }
  })
}

async function showInterstitialAd() {
  if (isInToss) {
    const shown = await showTossInterstitialAd()
    if (shown) return
    // 토스 광고 실패 시 fallback
  }
  return showFallbackInterstitialAd()
}

async function showRewardedAd() {
  if (isInToss) {
    const rewarded = await showTossRewardedAd()
    if (rewarded) return true
    // 토스 광고 실패 시 fallback
  }
  await showFallbackInterstitialAd()
  return true
}

// --- Result Rendering ---
async function showResult() {
  // 먼저 전면 광고 표시
  await showInterstitialAd()

  // 번호 6개 생성 (3개 먼저 + 3개 추가)
  const first3 = generateLuckyNumbers(selectedConditions, lottoData)
  const extra3 = generateLuckyNumbers(selectedConditions, lottoData)
  // 중복 제거 — extra에서 first3과 겹치면 재생성
  const allUsed = new Set(first3)
  for (let i = 0; i < extra3.length; i++) {
    while (allUsed.has(extra3[i])) {
      extra3[i] = Math.floor(Math.random() * 45) + 1
    }
    allUsed.add(extra3[i])
  }
  extra3.sort((a, b) => a - b)
  currentNumbers = [...first3, ...extra3]
  console.log('[Result]', selectedConditions, '→', first3, '+', extra3)

  // 조건 태그 렌더링
  const tagsContainer = document.getElementById('result-conditions')
  tagsContainer.innerHTML = selectedConditions
    .map(c => `<span class="condition-tag">${conditionLabels[c]}</span>`)
    .join('')

  // 카드 리셋
  const cards = document.querySelectorAll('.result-card')
  cards.forEach(card => card.classList.remove('flipped'))

  // 6개 보기 영역 리셋
  document.getElementById('unlock-full').classList.remove('hidden')
  document.getElementById('extra-numbers').classList.add('hidden')
  document.getElementById('extra-balls').innerHTML = ''

  switchScreen('result')

  // 순차 플립 애니메이션
  for (let i = 0; i < 3; i++) {
    await delay(500)
    const card = cards[i]
    const ball = card.querySelector('.result-ball')
    const num = first3[i]
    ball.className = `result-ball ${getBallClass(num)}`
    ball.textContent = num
    card.classList.add('flipped')
    haptic('light')
  }
}

// --- 6개 한번에 보기 (보상형 광고) ---
async function showExtraNumbers() {
  const rewarded = await showRewardedAd()
  if (!rewarded) return

  const extra3 = currentNumbers.slice(3)
  const extraBalls = document.getElementById('extra-balls')
  extraBalls.innerHTML = extra3
    .map(n => `<span class="lotto-ball ${getBallClass(n)}">${n}</span>`)
    .join('')

  document.getElementById('unlock-full').classList.add('hidden')
  document.getElementById('extra-numbers').classList.remove('hidden')
  haptic('heavy')
}

// --- Haptic ---
function haptic(type = 'light') {
  if (navigator.vibrate) {
    switch (type) {
      case 'light': navigator.vibrate(30); break
      case 'heavy': navigator.vibrate([100, 50, 200]); break
    }
  }
}

// --- Utility ---
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --- Init ---
async function init() {
  try {
    lottoData = await fetchLottoData()
    renderStats()
    setupConditions()

    // 로딩 해제
    loadingOverlay.classList.add('hidden')
    console.log('[App] 초기화 완료')
  } catch (err) {
    console.error('[App] 초기화 실패:', err)
    loadingOverlay.querySelector('.loading-text').textContent = '데이터 로드 실패. 새로고침 해주세요.'
  }
}

// --- Event Listeners ---
document.getElementById('btn-start').addEventListener('click', () => {
  switchScreen('stats')
  haptic('light')
})

document.getElementById('btn-go-conditions').addEventListener('click', () => {
  switchScreen('conditions')
  haptic('light')
})

document.getElementById('btn-generate').addEventListener('click', () => {
  showResult()
})

document.getElementById('btn-retry').addEventListener('click', () => {
  switchScreen('conditions')
  haptic('light')
})

document.getElementById('btn-home').addEventListener('click', () => {
  // 조건 선택 초기화
  selectedConditions = []
  document.querySelectorAll('.condition-card').forEach(c => c.classList.remove('selected'))
  document.getElementById('btn-generate').disabled = true
  switchScreen('stats')
  haptic('light')
})

document.getElementById('btn-back-stats').addEventListener('click', () => {
  switchScreen('stats')
  haptic('light')
})

document.getElementById('btn-unlock-full').addEventListener('click', () => {
  showExtraNumbers()
})

// Start
init()
