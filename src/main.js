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
import { generateLuckyNumbers, generateFiveGames } from './generator.js'
import { showTossInterstitialAd, showTossRewardedAd } from './toss-sdk.js'
import { getAllSaved, saveNumbers, deleteItem, updateItem } from './storage.js'
import { checkAllPending, getPrizeLabel, getRankEmoji } from './matcher.js'
import { generateFromKeyword, getSuggestedKeywords } from './keyword-numbers.js'

// --- State ---
let lottoData = null
let isInToss = typeof window !== 'undefined' && !!window.__APPS_IN_TOSS__
let selectedConditions = []
let currentNumbers = [] // 현재 생성된 전체 6개 번호
let currentTargetDrawNo = null // 다음 회차 번호
let currentSaved = false // 현재 결과가 보관됨 여부
let currentKeywordResult = null // 키워드로 생성된 번호
let currentKeywordSaved = false
let generateCount = 0

// --- DOM ---
const screens = {
  onboarding: document.getElementById('screen-onboarding'),
  stats: document.getElementById('screen-stats'),
  conditions: document.getElementById('screen-conditions'),
  result: document.getElementById('screen-result'),
  vault: document.getElementById('screen-vault'),
  keyword: document.getElementById('screen-keyword'),
}

const loadingOverlay = document.getElementById('loading-overlay')
const adOverlay = document.getElementById('ad-overlay')
const adCloseBtn = document.getElementById('ad-close-btn')
const toastEl = document.getElementById('toast')

// --- Screen Management ---
function switchScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'))
  screens[name].classList.add('active')
  window.scrollTo(0, 0)
}

// --- Toast ---
function showToast(msg, duration = 2500) {
  toastEl.textContent = msg
  toastEl.classList.remove('hidden')
  clearTimeout(showToast._t)
  showToast._t = setTimeout(() => {
    toastEl.classList.add('hidden')
  }, duration)
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

  document.getElementById('latest-round-label').textContent = `제${latest.draw_no}회`
  const drawDate = new Date(latest.date)
  document.getElementById('latest-date-label').textContent =
    `${drawDate.getFullYear()}.${String(drawDate.getMonth()+1).padStart(2,'0')}.${String(drawDate.getDate()).padStart(2,'0')}`
  document.getElementById('latest-draw-balls').innerHTML =
    latest.numbers.map(n => createBallHTML(n, '')).join('')
  document.getElementById('latest-bonus-ball').innerHTML = createBallHTML(latest.bonus_no, '')

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

// --- Ad ---
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
  }
  return showFallbackInterstitialAd()
}

async function showRewardedAd() {
  if (isInToss) {
    const rewarded = await showTossRewardedAd()
    if (rewarded) return true
  }
  await showFallbackInterstitialAd()
  return true
}

// --- Result Rendering ---
async function showResult() {
  generateCount++
  if (generateCount > 1) {
    await showInterstitialAd()
  }

  const first3 = generateLuckyNumbers(selectedConditions, lottoData)
  const extra3 = generateLuckyNumbers(selectedConditions, lottoData)
  const allUsed = new Set(first3)
  for (let i = 0; i < extra3.length; i++) {
    while (allUsed.has(extra3[i])) {
      extra3[i] = Math.floor(Math.random() * 45) + 1
    }
    allUsed.add(extra3[i])
  }
  extra3.sort((a, b) => a - b)
  currentNumbers = [...first3, ...extra3]
  currentTargetDrawNo = getLatestRound(lottoData).draw_no + 1
  currentSaved = false
  console.log('[Result]', selectedConditions, '→', first3, '+', extra3)

  const tagsContainer = document.getElementById('result-conditions')
  tagsContainer.innerHTML = selectedConditions
    .map(c => `<span class="condition-tag">${conditionLabels[c]}</span>`)
    .join('')

  const cards = document.querySelectorAll('#result-cards .result-card')
  cards.forEach(card => card.classList.remove('flipped'))

  document.getElementById('unlock-full').classList.remove('hidden')
  document.getElementById('extra-numbers').classList.add('hidden')
  document.getElementById('extra-balls').innerHTML = ''

  // 보관함 버튼 리셋
  const saveBtn = document.getElementById('btn-save-vault')
  saveBtn.classList.remove('saved')
  document.querySelector('#btn-save-vault .btn-save-label').textContent = '이 번호 보관함에 저장'
  document.getElementById('btn-save-sublabel').textContent = `제${currentTargetDrawNo}회 결과 자동 확인`

  // 5게임 섹션 리셋
  document.getElementById('five-game-card').classList.remove('hidden')
  document.getElementById('five-game-result').classList.add('hidden')
  document.getElementById('five-game-list').innerHTML = ''

  switchScreen('result')

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

// --- 6개 한번에 보기 ---
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

// --- 보관함 저장 (결과 화면) ---
function saveCurrentToVault() {
  if (currentSaved) return
  const saved = saveNumbers({
    numbers: currentNumbers.length >= 6 ? currentNumbers.slice(0, 6) : currentNumbers.slice(0, 3),
    conditions: selectedConditions,
    targetDrawNo: currentTargetDrawNo,
    label: `제${currentTargetDrawNo}회 행운번호`,
  })
  if (saved) {
    currentSaved = true
    const btn = document.getElementById('btn-save-vault')
    btn.classList.add('saved')
    document.querySelector('#btn-save-vault .btn-save-label').textContent = '✓ 보관됨'
    showToast('🔖 보관함에 저장되었어요')
    updateVaultBadge()
    haptic('light')
  }
}

// --- 5게임 보기 ---
async function showFiveGames() {
  const rewarded = await showRewardedAd()
  if (!rewarded) return

  const games = generateFiveGames(selectedConditions, lottoData)
  const list = document.getElementById('five-game-list')
  const letters = ['A', 'B', 'C', 'D', 'E']

  list.innerHTML = games.map((nums, i) => `
    <div class="five-game-row">
      <span class="five-game-letter">${letters[i]}</span>
      <div class="five-game-balls">
        ${nums.map(n => createBallHTML(n, 's')).join('')}
      </div>
    </div>
  `).join('')

  document.getElementById('five-game-card').classList.add('hidden')
  document.getElementById('five-game-result').classList.remove('hidden')
  haptic('heavy')

  // 5게임 모두 보관함에 저장할지 물어보는 대신 간단히 토스트
  games.forEach((nums, i) => {
    saveNumbers({
      numbers: nums,
      conditions: ['5game'],
      targetDrawNo: currentTargetDrawNo,
      label: `제${currentTargetDrawNo}회 실전 ${letters[i]}게임`,
    })
  })
  showToast('🎫 5게임이 보관함에 자동 저장되었어요')
  updateVaultBadge()
}

// --- 키워드 번호 화면 ---
let currentKeyword = ''

function setupKeywordScreen() {
  const input = document.getElementById('keyword-input')
  const generateBtn = document.getElementById('btn-keyword-generate')
  const suggestions = document.getElementById('keyword-suggestions')

  // 추천 키워드 렌더링
  suggestions.innerHTML = getSuggestedKeywords()
    .map(k => `<button class="keyword-chip" data-keyword="${k.key}"><span>${k.emoji}</span> ${k.key}</button>`)
    .join('')

  suggestions.querySelectorAll('.keyword-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const k = chip.dataset.keyword
      input.value = k
      currentKeyword = k
      generateBtn.disabled = false
      suggestions.querySelectorAll('.keyword-chip').forEach(c => c.classList.remove('selected'))
      chip.classList.add('selected')
      haptic('light')
    })
  })

  input.addEventListener('input', () => {
    currentKeyword = input.value.trim()
    generateBtn.disabled = !currentKeyword
    suggestions.querySelectorAll('.keyword-chip').forEach(c => c.classList.remove('selected'))
  })
}

async function generateKeywordNumbers() {
  if (!currentKeyword) return

  const rewarded = await showRewardedAd()
  if (!rewarded) return

  const result = generateFromKeyword(currentKeyword)
  currentKeywordResult = result
  currentKeywordSaved = false

  document.getElementById('keyword-result-emoji').textContent = result.emoji
  document.getElementById('keyword-result-title').textContent = result.matched
    ? `"${result.matched}"의 행운 번호`
    : `"${result.keyword}"의 행운 번호`
  document.getElementById('keyword-result-desc').textContent = result.desc
  document.getElementById('keyword-result-balls').innerHTML =
    result.numbers.map(n => createBallHTML(n)).join('')

  const saveBtn = document.getElementById('btn-keyword-save')
  saveBtn.classList.remove('saved')
  saveBtn.querySelector('.btn-save-label').textContent = '보관함에 저장'

  document.getElementById('keyword-result').classList.remove('hidden')
  haptic('heavy')
  document.getElementById('keyword-result').scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function saveKeywordToVault() {
  if (!currentKeywordResult || currentKeywordSaved) return
  const drawNo = getLatestRound(lottoData).draw_no + 1
  const saved = saveNumbers({
    numbers: currentKeywordResult.numbers,
    conditions: ['keyword'],
    targetDrawNo: drawNo,
    label: `${currentKeywordResult.emoji} "${currentKeywordResult.matched || currentKeywordResult.keyword}"`,
  })
  if (saved) {
    currentKeywordSaved = true
    const btn = document.getElementById('btn-keyword-save')
    btn.classList.add('saved')
    btn.querySelector('.btn-save-label').textContent = '✓ 보관됨'
    showToast('🔖 보관함에 저장되었어요')
    updateVaultBadge()
    haptic('light')
  }
}

// --- 보관함 화면 ---
function renderVault() {
  const items = getAllSaved()
  const listEl = document.getElementById('vault-list')
  const emptyEl = document.getElementById('vault-empty')

  if (items.length === 0) {
    emptyEl.classList.remove('hidden')
    listEl.innerHTML = ''
    return
  }

  emptyEl.classList.add('hidden')

  const winCount = items.filter(i => i.result && i.result.rank > 0).length
  document.getElementById('vault-desc').textContent =
    winCount > 0
      ? `🎉 당첨 ${winCount}건 · 총 ${items.length}건 보관 중`
      : `총 ${items.length}건 · 추첨 후 자동 당첨 확인`

  listEl.innerHTML = items.map(item => {
    const isWin = item.result && item.result.rank > 0
    const isPending = !item.checked
    const winningSet = item.drawNumbers ? new Set(item.drawNumbers) : null

    const ballsHTML = item.numbers.map(n => {
      const matched = winningSet && winningSet.has(n)
      const bonus = item.drawBonus && n === item.drawBonus
      const cls = getBallClass(n)
      const extra = matched ? ' matched' : (bonus ? ' bonus' : '')
      return `<span class="lotto-ball s ${cls}${extra}"${matched ? ' style="outline:2px solid #FFD700"' : ''}>${n}</span>`
    }).join('')

    const date = new Date(item.savedAt)
    const dateStr = `${date.getMonth()+1}/${date.getDate()}`

    let resultHTML = ''
    if (isPending) {
      resultHTML = `<div class="vault-item-result pending">⏳ 제${item.targetDrawNo}회 추첨 대기 중</div>`
    } else if (isWin) {
      resultHTML = `<div class="vault-item-result">${getRankEmoji(item.result.rank)} ${getPrizeLabel(item.result.rank)} · ${item.result.matches}개 일치${item.result.bonus ? '+보너스' : ''}</div>`
    } else {
      resultHTML = `<div class="vault-item-result lose">제${item.targetDrawNo}회 · ${item.result.matches}개 일치 (낙첨)</div>`
    }

    return `
      <div class="vault-item${isWin ? ' win' : ''}">
        <div class="vault-item-top">
          <span class="vault-item-label">${item.label}</span>
          <span class="vault-item-date">${dateStr}</span>
        </div>
        <div class="vault-item-balls">${ballsHTML}</div>
        ${resultHTML}
        <div class="vault-item-top">
          <span class="vault-item-date">ID: ${item.id}</span>
          <button class="vault-item-delete" data-id="${item.id}">삭제</button>
        </div>
      </div>
    `
  }).join('')

  // 삭제 버튼
  listEl.querySelectorAll('.vault-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id)
      if (confirm('이 번호를 삭제할까요?')) {
        deleteItem(id)
        renderVault()
        updateVaultBadge()
        haptic('light')
      }
    })
  })
}

function updateVaultBadge() {
  const items = getAllSaved()
  const winCount = items.filter(i => i.result && i.result.rank > 0).length
  const badge = document.getElementById('vault-badge')
  if (winCount > 0) {
    badge.textContent = `${winCount}`
    badge.classList.remove('hidden')
  } else if (items.length > 0) {
    badge.textContent = `${items.length}`
    badge.classList.remove('hidden')
  } else {
    badge.classList.add('hidden')
  }
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --- Init ---
async function init() {
  try {
    lottoData = await fetchLottoData()
    renderStats()
    setupConditions()
    setupKeywordScreen()

    // 보관함 자동 당첨 확인
    const { newWinnings, totalChecked } = checkAllPending(lottoData)
    console.log('[Vault] 체크됨:', totalChecked, '당첨:', newWinnings.length)
    if (newWinnings.length > 0) {
      setTimeout(() => {
        showToast(`🎉 보관함에 당첨 ${newWinnings.length}건이 확인되었어요!`, 4000)
      }, 1200)
    }
    updateVaultBadge()

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

// 보관함
document.getElementById('btn-vault').addEventListener('click', () => {
  renderVault()
  switchScreen('vault')
  haptic('light')
})
document.getElementById('btn-vault-back').addEventListener('click', () => {
  switchScreen('stats')
  haptic('light')
})

// 결과 보관 버튼
document.getElementById('btn-save-vault').addEventListener('click', () => {
  saveCurrentToVault()
})

// 5게임
document.getElementById('btn-five-game').addEventListener('click', () => {
  showFiveGames()
})

// 키워드 화면 이동
document.getElementById('btn-go-keyword').addEventListener('click', () => {
  document.getElementById('keyword-input').value = ''
  currentKeyword = ''
  document.getElementById('btn-keyword-generate').disabled = true
  document.getElementById('keyword-result').classList.add('hidden')
  document.querySelectorAll('.keyword-chip').forEach(c => c.classList.remove('selected'))
  switchScreen('keyword')
  haptic('light')
})
document.getElementById('btn-keyword-back').addEventListener('click', () => {
  switchScreen('conditions')
  haptic('light')
})
document.getElementById('btn-keyword-generate').addEventListener('click', () => {
  generateKeywordNumbers()
})
document.getElementById('btn-keyword-save').addEventListener('click', () => {
  saveKeywordToVault()
})
document.getElementById('btn-keyword-retry').addEventListener('click', () => {
  document.getElementById('keyword-result').classList.add('hidden')
  document.getElementById('keyword-input').value = ''
  currentKeyword = ''
  document.getElementById('btn-keyword-generate').disabled = true
  document.querySelectorAll('.keyword-chip').forEach(c => c.classList.remove('selected'))
  haptic('light')
})

// Start
init()
