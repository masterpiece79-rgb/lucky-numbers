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
import { getAllSaved, saveNumbers, deleteItem, updateItem, countManualGroups, deleteGroup } from './storage.js'
import { checkAllPending, getPrizeLabel, getRankEmoji, getRankLabel, formatPrize, formatWinners } from './matcher.js'
import { generateFromKeyword, getSuggestedKeywords } from './keyword-numbers.js'
import { generateFunName } from './name-generator.js'
import {
  buildShareUrl, detectReceivedDream, clearDreamParam,
  getRemainingShares, incrementShareCount, MAX_SHARES_PER_DREAM
} from './dream-share.js'

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
  picker: document.getElementById('screen-picker'),
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
  'monthly': '📅 이달의 행운',
  'balanced': '🎯 빈도 균형',
  'hidden': '🌙 숨은 번호',
  'last-draw': '🔄 직전 회차', // legacy - 기존 저장된 데이터 호환용
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
  // 항상 토스 SDK를 먼저 시도 → 실패 시 fallback (환경 감지는 SDK가 스스로 처리)
  const shown = await showTossInterstitialAd()
  if (shown) return
  return showFallbackInterstitialAd()
}

async function showRewardedAd() {
  const rewarded = await showTossRewardedAd()
  if (rewarded) return true
  await showFallbackInterstitialAd()
  return true
}

// --- Result Rendering ---
async function showResult() {
  generateCount++
  if (generateCount > 1) {
    await showInterstitialAd()
  }

  // 6개 번호 생성 (중복 없이)
  const first3 = generateLuckyNumbers(selectedConditions, lottoData)
  const extra3 = generateLuckyNumbers(selectedConditions, lottoData)
  const allUsed = new Set(first3)
  for (let i = 0; i < extra3.length; i++) {
    while (allUsed.has(extra3[i])) {
      extra3[i] = Math.floor(Math.random() * 45) + 1
    }
    allUsed.add(extra3[i])
  }
  const sixNumbers = [...first3, ...extra3].sort((a, b) => a - b)
  currentNumbers = sixNumbers
  currentTargetDrawNo = getLatestRound(lottoData).draw_no + 1
  currentSaved = false
  console.log('[Result]', selectedConditions, '→', sixNumbers)

  // 조건 태그 렌더링
  document.getElementById('result-conditions').innerHTML = selectedConditions
    .map(c => `<span class="condition-tag">${conditionLabels[c]}</span>`)
    .join('')

  // 카드 리셋
  const cards = document.querySelectorAll('#result-cards .result-card')
  cards.forEach(card => card.classList.remove('flipped'))

  // 보관함 버튼 리셋
  const saveBtn = document.getElementById('btn-save-vault')
  saveBtn.classList.remove('saved')
  document.querySelector('#btn-save-vault .btn-save-label').textContent = '이 번호 보관함에 저장'
  document.getElementById('btn-save-sublabel').textContent = `제${currentTargetDrawNo}회 추첨(토 20:35) 이후 앱을 다시 열면 결과 확인`

  // 5게임 섹션 리셋
  document.getElementById('five-game-card').classList.remove('hidden')
  document.getElementById('five-game-result').classList.add('hidden')
  document.getElementById('five-game-list').innerHTML = ''

  // 다시뽑기/처음으로 액션 숨김 (저장 후 노출)
  document.getElementById('result-actions').classList.add('hidden')

  switchScreen('result')

  // 카드 플립 애니메이션 — 6개를 1.5초 내 완결
  // 앞 3개: 각 0.35초 간격 | 뒤 3개: 살짝 간격 주고 빠르게 추가
  for (let i = 0; i < 3; i++) {
    await delay(i === 0 ? 350 : 350)
    flipCard(cards[i], sixNumbers[i])
    haptic('light')
  }
  for (let i = 3; i < 6; i++) {
    await delay(180)
    flipCard(cards[i], sixNumbers[i])
    haptic('light')
  }
}

function flipCard(card, num) {
  const ball = card.querySelector('.result-ball')
  ball.className = `result-ball ${getBallClass(num)}`
  ball.textContent = num
  card.classList.add('flipped')
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
    document.querySelector('#btn-save-vault .btn-save-label').textContent = '✓ 보관함에 저장됨'
    document.getElementById('btn-save-sublabel').textContent = '토요일 추첨(20:35) 후 앱을 다시 열면 결과 알려드려요'
    showToast('🔖 보관함에 저장되었어요')
    updateVaultBadge()
    haptic('heavy')

    // 다시뽑기/처음으로 버튼 노출
    document.getElementById('result-actions').classList.remove('hidden')
    // 저장 버튼 쪽으로 스크롤 (CTA 연속성)
    setTimeout(() => {
      document.getElementById('result-actions').scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)
  }
}

// --- 5게임 보기 (A는 이미 받음 → B~E 4게임 추가) ---
async function showFiveGames() {
  const rewarded = await showRewardedAd()
  if (!rewarded) return

  // A게임 = 현재 6개 번호, B~E 4게임 추가 생성
  const allFive = generateFiveGames(selectedConditions, lottoData)
  // 첫 번째(A)를 currentNumbers로 대체
  const games = [currentNumbers, ...allFive.slice(1, 5)]

  const list = document.getElementById('five-game-list')
  const letters = ['A', 'B', 'C', 'D', 'E']

  list.innerHTML = games.map((nums, i) => `
    <div class="five-game-row${i === 0 ? ' game-a' : ''}">
      <span class="five-game-letter">${letters[i]}</span>
      <div class="five-game-balls">
        ${nums.map(n => createBallHTML(n, 's')).join('')}
      </div>
    </div>
  `).join('')

  document.getElementById('five-game-card').classList.add('hidden')
  document.getElementById('five-game-result').classList.remove('hidden')
  haptic('heavy')

  // B~E 4게임을 보관함 자동 저장 (A는 유저가 명시 저장하거나 보관함 버튼 누를 때 저장)
  for (let i = 1; i < 5; i++) {
    saveNumbers({
      numbers: games[i],
      conditions: ['5game'],
      targetDrawNo: currentTargetDrawNo,
      label: `제${currentTargetDrawNo}회 실전 ${letters[i]}게임`,
    })
  }
  showToast('🎫 B~E 4게임이 보관함에 저장되었어요')
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
function renderVaultItem(item) {
  const isWin = item.result && item.result.rank > 0
  const isPending = !item.checked
  const winningSet = item.drawNumbers ? new Set(item.drawNumbers) : null

  const ballsHTML = item.numbers.map(n => {
    const matched = winningSet && winningSet.has(n)
    const cls = getBallClass(n)
    const extra = matched ? ' matched' : ''
    return `<span class="lotto-ball s ${cls}${extra}"${matched ? ' style="outline:2px solid #F59E0B"' : ''}>${n}</span>`
  }).join('')

  const date = new Date(item.savedAt)
  const dateStr = `${date.getMonth()+1}/${date.getDate()}`

  let resultHTML = ''
  if (isPending) {
    resultHTML = `<div class="vault-item-result pending">⏳ 제${item.targetDrawNo}회 추첨 대기 중</div>`
  } else if (isWin) {
    const rankLabel = getRankLabel(item.result.rank)
    const matchText = `${item.result.matches}개 일치${item.result.bonus ? '+보너스' : ''}`
    let prizeText = ''
    if (item.prizeInfo && item.prizeInfo.prize) {
      prizeText = ` · <strong>${formatPrize(item.prizeInfo.prize)}</strong>`
    }
    let winnersText = ''
    if (item.prizeInfo && item.prizeInfo.winners) {
      winnersText = `<div class="vault-item-subresult">전국 ${formatWinners(item.prizeInfo.winners)} · 제${item.targetDrawNo}회</div>`
    }
    resultHTML = `
      <div class="vault-item-result win-row">
        <span>${rankLabel} · ${matchText}${prizeText}</span>
      </div>
      ${winnersText}
    `
  } else {
    resultHTML = `<div class="vault-item-result lose">제${item.targetDrawNo}회 · ${item.result.matches}개 일치 (낙첨)</div>`
  }

  const permanentBadge = item.isPermanent
    ? `<span class="permanent-badge">🔁 매주 자동</span>`
    : ''

  const deleteDataAttr = item.isPermanent
    ? `data-group-id="${item.groupId}"`
    : `data-id="${item.id}"`

  // 당첨 자랑 섹션 (당첨된 경우)
  const isReceived = (item.conditions || []).includes('received')
  const bragHTML = isWin ? `
    <div class="vault-brag-section">
      ${isReceived ? '<div class="brag-thanks">💌 꿈 선물 덕분에 당첨됐어요!</div>' : ''}
      <button class="btn-brag" data-item-id="${item.id}">
        📣 ${isReceived ? '감사 인사 전하기' : '당첨 자랑하기'}
      </button>
    </div>
  ` : ''

  return `
    <div class="vault-item${isWin ? ' win' : ''}">
      <div class="vault-item-top">
        <span class="vault-item-label">${item.label} ${permanentBadge}</span>
        <span class="vault-item-date">${dateStr}</span>
      </div>
      <div class="vault-item-balls">${ballsHTML}</div>
      ${resultHTML}
      ${bragHTML}
      <div class="vault-item-actions">
        <button class="vault-item-delete" ${deleteDataAttr}>${item.isPermanent ? '자동 보관 해제' : '삭제'}</button>
      </div>
    </div>
  `
}

function renderVault() {
  const items = getAllSaved()
  const emptyEl = document.getElementById('vault-empty')

  // 4섹션 분리
  // 1) 받은 꿈 (received)
  const received = items.filter(i => (i.conditions || []).includes('received'))

  // 2) 내가 고른 번호 (manual) - 그룹당 최신 1개만 대표 표시
  const manualGroups = new Map()
  const manual = []
  for (const item of items) {
    if (!item.isManual) continue
    if (!manualGroups.has(item.groupId)) {
      manualGroups.set(item.groupId, true)
      manual.push(item)
    }
  }

  // 3) 추첨 대기 (manual/received 제외한 pending)
  const pending = items.filter(
    i => !i.checked && !i.isManual && !(i.conditions || []).includes('received')
  )

  // 4) 지난 결과 (checked) - received/manual도 포함
  const history = items.filter(i => i.checked)

  const total = items.length
  if (total === 0) {
    emptyEl.classList.remove('hidden')
    document.getElementById('section-received').classList.add('hidden')
    document.getElementById('section-manual').classList.add('hidden')
    document.getElementById('section-pending').classList.add('hidden')
    document.getElementById('section-history').classList.add('hidden')
    document.getElementById('vault-desc').textContent = '번호 저장 후 토요일 추첨 후 앱 열면 결과 확인'
    return
  }
  emptyEl.classList.add('hidden')

  const winCount = items.filter(i => i.result && i.result.rank > 0).length
  document.getElementById('vault-desc').textContent =
    winCount > 0
      ? `🎉 당첨 ${winCount}건 · 총 ${total}건 보관 중`
      : `총 ${total}건 · 토요일 추첨 후 앱 열면 결과 확인`

  // 섹션별 렌더링
  renderSection('section-received', 'vault-list-received', 'received-count', received)
  renderSection('section-manual', 'vault-list-manual', 'manual-count', manual)
  renderSection('section-pending', 'vault-list-pending', 'pending-count', pending)
  renderSection('section-history', 'vault-list-history', 'history-count', history)

  // 당첨 자랑 버튼 바인딩
  document.querySelectorAll('.btn-brag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = Number(e.currentTarget.dataset.itemId)
      const item = getAllSaved().find(i => i.id === itemId)
      if (item) bragWin(item)
    })
  })

  // 삭제 버튼 바인딩
  document.querySelectorAll('.vault-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const groupId = e.target.dataset.groupId
      const id = e.target.dataset.id
      if (groupId) {
        if (confirm('이 번호 그룹을 삭제할까요? (매주 자동 보관이 중단됩니다)')) {
          deleteGroup(Number(groupId))
          renderVault()
          updateVaultBadge()
          haptic('light')
        }
      } else if (id) {
        if (confirm('이 번호를 삭제할까요?')) {
          deleteItem(Number(id))
          renderVault()
          updateVaultBadge()
          haptic('light')
        }
      }
    })
  })
}

function renderSection(sectionId, listId, countId, items) {
  const section = document.getElementById(sectionId)
  const list = document.getElementById(listId)
  const count = document.getElementById(countId)
  if (items.length === 0) {
    section.classList.add('hidden')
    return
  }
  section.classList.remove('hidden')
  count.textContent = `${items.length}`
  list.innerHTML = items.map(renderVaultItem).join('')
}

// --- 번호 직접 고르기 (Picker) ---
let pickerSelected = []

function renderPickerGrid() {
  const grid = document.getElementById('picker-grid')
  grid.innerHTML = ''
  for (let n = 1; n <= 45; n++) {
    const btn = document.createElement('button')
    btn.className = `picker-num ${getBallClass(n)}`
    btn.dataset.num = n
    btn.textContent = n
    if (pickerSelected.includes(n)) btn.classList.add('selected')
    btn.addEventListener('click', () => togglePickerNum(n))
    grid.appendChild(btn)
  }
}

function togglePickerNum(n) {
  const idx = pickerSelected.indexOf(n)
  if (idx >= 0) {
    pickerSelected.splice(idx, 1)
  } else {
    if (pickerSelected.length >= 6) {
      showToast('6개까지만 선택할 수 있어요')
      return
    }
    pickerSelected.push(n)
  }
  document.getElementById('picker-count').textContent = pickerSelected.length
  document.getElementById('btn-picker-save').disabled = pickerSelected.length !== 6
  renderPickerGrid()
  haptic('light')
}

function clearPicker() {
  pickerSelected = []
  document.getElementById('picker-count').textContent = '0'
  document.getElementById('btn-picker-save').disabled = true
  renderPickerGrid()
  haptic('light')
}

function openPicker() {
  const groups = countManualGroups()
  if (groups >= 5) {
    showToast('최대 5개까지 보관할 수 있어요. 기존 번호를 먼저 삭제해주세요', 3500)
    return
  }
  pickerSelected = []
  document.getElementById('picker-count').textContent = '0'
  document.getElementById('btn-picker-save').disabled = true
  document.getElementById('picker-permanent').checked = true
  renderPickerGrid()
  switchScreen('picker')
}

function savePickerNumbers() {
  if (pickerSelected.length !== 6) return
  const isPermanent = document.getElementById('picker-permanent').checked
  const drawNo = getLatestRound(lottoData).draw_no + 1
  const sorted = [...pickerSelected].sort((a, b) => a - b)
  const label = isPermanent ? '내가 고른 번호 (매주)' : '내가 고른 번호'

  saveNumbers({
    numbers: sorted,
    conditions: ['manual'],
    targetDrawNo: drawNo,
    label,
    isManual: true,
    isPermanent,
  })

  showToast('🎯 내 번호가 보관함에 저장되었어요')
  haptic('heavy')
  updateVaultBadge()
  renderVault()
  switchScreen('vault')
}

function updateVaultBadge() {
  const items = getAllSaved()
  const winCount = items.filter(i => i.result && i.result.rank > 0).length
  const badge = document.getElementById('vault-badge')
  const desc = document.getElementById('vault-entry-card-desc')

  if (winCount > 0) {
    badge.textContent = `${winCount}`
    badge.classList.remove('hidden')
    if (desc) desc.textContent = `🎉 당첨 ${winCount}건 · 총 ${items.length}건 보관 중`
  } else if (items.length > 0) {
    badge.textContent = `${items.length}`
    badge.classList.remove('hidden')
    if (desc) desc.textContent = `총 ${items.length}건 · 토요일 추첨 후 앱 열면 결과 확인`
  } else {
    badge.classList.add('hidden')
    if (desc) desc.textContent = '번호 저장 후 토요일 추첨 후 앱에 다시 오면 결과 확인'
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
    setupOnboarding()
    setupDreamPicker()
    setupLottoBuyButtons()

    // 보관함 자동 당첨 확인
    const { newWinnings, totalChecked } = checkAllPending(lottoData)
    console.log('[Vault] 체크됨:', totalChecked, '당첨:', newWinnings.length)
    if (newWinnings.length > 0) {
      setTimeout(() => {
        showToast(`🎉 보관함에 당첨 ${newWinnings.length}건이 있어요! 확인해보세요`, 4000)
      }, 1200)
    }
    updateVaultBadge()

    loadingOverlay.classList.add('hidden')

    // 받은 꿈 감지 (URL 파라미터)
    const received = detectReceivedDream()
    if (received) {
      showReceivedDreamModal(received)
      clearDreamParam()
    } else {
      // 온보딩 스킵 여부 체크
      const onboarded = localStorage.getItem('onboarding_completed') === 'true'
      if (onboarded) {
        switchScreen('stats')
      }
    }

    console.log('[App] 초기화 완료')
  } catch (err) {
    console.error('[App] 초기화 실패:', err)
    loadingOverlay.querySelector('.loading-text').textContent = '데이터 로드 실패. 새로고침 해주세요.'
  }
}

// --- Onboarding Slides ---
let obCurrent = 0
function setupOnboarding() {
  const slides = document.querySelectorAll('.ob-slide')
  const dots = document.querySelectorAll('.ob-dot')
  const nextBtn = document.getElementById('btn-ob-next')
  const skipBtn = document.getElementById('btn-ob-skip')

  function gotoSlide(idx) {
    obCurrent = idx
    slides.forEach((s, i) => s.classList.toggle('active', i === idx))
    dots.forEach((d, i) => d.classList.toggle('active', i === idx))
    nextBtn.textContent = idx === slides.length - 1 ? '🍀 시작하기' : '다음'
    haptic('light')
  }

  nextBtn.addEventListener('click', () => {
    if (obCurrent < slides.length - 1) {
      gotoSlide(obCurrent + 1)
    } else {
      finishOnboarding()
    }
  })

  skipBtn.addEventListener('click', () => {
    finishOnboarding()
  })

  // 스와이프 지원 (간단)
  let touchStartX = null
  document.getElementById('screen-onboarding').addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX
  })
  document.getElementById('screen-onboarding').addEventListener('touchend', e => {
    if (touchStartX === null) return
    const dx = e.changedTouches[0].clientX - touchStartX
    if (Math.abs(dx) > 60) {
      if (dx < 0 && obCurrent < slides.length - 1) gotoSlide(obCurrent + 1)
      if (dx > 0 && obCurrent > 0) gotoSlide(obCurrent - 1)
    }
    touchStartX = null
  })
}

function finishOnboarding() {
  localStorage.setItem('onboarding_completed', 'true')
  switchScreen('stats')
  haptic('heavy')
}

// --- Dream Share (팔기) ---
let currentDreamShare = null // { numbers, keyword, emoji }

function openDreamShareModal() {
  if (!currentKeywordResult) return
  currentDreamShare = {
    numbers: currentKeywordResult.numbers,
    keyword: currentKeywordResult.matched || currentKeywordResult.keyword,
    emoji: currentKeywordResult.emoji,
  }

  const remaining = getRemainingShares(currentDreamShare.numbers, currentDreamShare.keyword)
  if (remaining === 0) {
    showToast('이 꿈은 이미 3회 모두 공유했어요', 3000)
    return
  }

  // 미리보기 렌더링
  document.getElementById('dream-sell-key').textContent =
    `${currentDreamShare.emoji} ${currentDreamShare.keyword}꿈`
  document.getElementById('dream-sell-balls').innerHTML =
    currentDreamShare.numbers.map(n => createBallHTML(n, 's')).join('')

  // 이름 자동 생성
  document.getElementById('dream-sell-name').value = generateFunName()

  // 남은 공유 표시
  document.getElementById('dream-sell-shares').innerHTML =
    `남은 공유: <strong>${remaining}</strong> / ${MAX_SHARES_PER_DREAM} 회`

  document.getElementById('dream-sell-overlay').classList.remove('hidden')
}

function closeDreamShareModal() {
  document.getElementById('dream-sell-overlay').classList.add('hidden')
  currentDreamShare = null
}

function rerollName() {
  document.getElementById('dream-sell-name').value = generateFunName()
  haptic('light')
}

async function confirmDreamShare() {
  if (!currentDreamShare) return
  const nameInput = document.getElementById('dream-sell-name')
  const from = (nameInput.value || '').trim() || generateFunName()

  const { url, tossUrl, payload } = buildShareUrl({
    ...currentDreamShare,
    from,
  })

  // 공유 실행
  const shareText = `💌 "${from}"님의 ${currentDreamShare.emoji} ${currentDreamShare.keyword}꿈 행운번호 받아가세요!\n\n이번 주 대박나세요 🍀`
  const shareData = {
    title: '🍀 꿈번호 선물',
    text: shareText,
    url,
  }

  let shared = false
  try {
    if (isInToss && window.__APPS_IN_TOSS__?.share) {
      await window.__APPS_IN_TOSS__.share(shareData)
      shared = true
    } else if (navigator.share) {
      await navigator.share(shareData)
      shared = true
    } else {
      // Fallback: 클립보드
      await navigator.clipboard.writeText(`${shareText}\n${url}`)
      showToast('링크가 복사되었어요. 친구에게 붙여넣기 해주세요!', 3000)
      shared = true
    }
  } catch (e) {
    // 유저가 공유 취소한 경우 - 카운트 안 올림
    console.log('[DreamShare] 취소 또는 실패', e)
    return
  }

  if (shared) {
    const { remaining } = incrementShareCount(currentDreamShare.numbers, currentDreamShare.keyword)
    showToast(`💌 꿈을 보냈어요! 남은 공유 ${remaining}회`, 2500)
    haptic('heavy')
    closeDreamShareModal()
  }
}

// --- Dream Received (받기) ---
let currentReceivedDream = null

function showReceivedDreamModal(dream) {
  currentReceivedDream = dream
  document.getElementById('received-from').textContent = dream.from
  document.getElementById('received-keyword').textContent =
    `${dream.emoji} ${dream.keyword}꿈의 행운번호`
  document.getElementById('received-balls').innerHTML =
    dream.numbers.map(n => createBallHTML(n, 's')).join('')
  document.getElementById('dream-received-overlay').classList.remove('hidden')
  haptic('heavy')
}

function closeReceivedDreamModal(saveToVault = false) {
  if (saveToVault && currentReceivedDream) {
    const drawNo = getLatestRound(lottoData).draw_no + 1
    saveNumbers({
      numbers: currentReceivedDream.numbers,
      conditions: ['received'],
      targetDrawNo: drawNo,
      label: `🎁 ${currentReceivedDream.from}님의 ${currentReceivedDream.emoji} ${currentReceivedDream.keyword}꿈`,
    })
    showToast('🎁 받은 꿈이 보관함에 저장되었어요', 2500)
    updateVaultBadge()
  }
  document.getElementById('dream-received-overlay').classList.add('hidden')
  currentReceivedDream = null

  // 저장했으면 보관함으로, 아니면 통계 화면으로
  if (saveToVault) {
    renderVault()
    switchScreen('vault')
  } else {
    switchScreen('stats')
  }
}

// --- 로또 구매 연결 ---
function openExternalUrl(url) {
  try {
    // 토스 SDK의 openUrl이 있으면 사용
    if (isInToss && window.__APPS_IN_TOSS__?.openUrl) {
      window.__APPS_IN_TOSS__.openUrl(url)
    } else {
      window.open(url, '_blank')
    }
  } catch (e) {
    // Fallback: location 이동
    window.location.href = url
  }
  haptic('light')
}

function findLottoStore() {
  // 네이버 지도 로또판매점 검색 (웹 URL이 가장 호환성 좋음)
  openExternalUrl('https://map.naver.com/p/search/로또판매점')
}

function openOnlineLotto() {
  // 동행복권 공식 사이트 (대한민국 유일의 합법 온라인 로또)
  openExternalUrl('https://dhlottery.co.kr')
}

function setupLottoBuyButtons() {
  // class 기반으로 모든 인스턴스에 바인딩
  document.querySelectorAll('.btn-find-store').forEach(btn => {
    btn.addEventListener('click', findLottoStore)
  })
  document.querySelectorAll('.btn-online-lotto').forEach(btn => {
    btn.addEventListener('click', openOnlineLotto)
  })
}

// --- 당첨 자랑하기 ---
function bragWin(item) {
  const rankLabel = getRankLabel(item.result.rank)
  const prizeText = item.prizeInfo?.prize ? formatPrize(item.prizeInfo.prize) : ''
  const isReceived = (item.conditions || []).includes('received')

  let shareText
  if (isReceived) {
    // 받은 꿈으로 당첨 → 감사 메시지
    const fromMatch = item.label.match(/(.+?)님의/)
    const fromName = fromMatch ? fromMatch[1].replace(/^🎁\s*/, '') : '친구'
    shareText = `🎉 ${fromName}님이 준 꿈번호로 ${rankLabel} 당첨됐어요!${prizeText ? ` (${prizeText})` : ''} 행운을 나눠주셔서 감사해요 🍀\n\n나도 꿈번호 받아보기 👉`
  } else {
    shareText = `🎉 "행운의 번호" 앱으로 ${rankLabel} 당첨됐어요!${prizeText ? ` (${prizeText})` : ''} 이번주 여러분도 대박나세요 🍀\n\n나도 뽑아보기 👉`
  }

  const url = 'https://lucky-numbers-miniapp.vercel.app'
  const shareData = {
    title: `🍀 ${rankLabel} 당첨!`,
    text: shareText,
    url,
  }

  try {
    if (isInToss && window.__APPS_IN_TOSS__?.share) {
      window.__APPS_IN_TOSS__.share(shareData)
    } else if (navigator.share) {
      navigator.share(shareData).catch(() => {})
    } else {
      navigator.clipboard?.writeText(`${shareText}\n${url}`)
      showToast('자랑 문구가 복사되었어요!', 2500)
    }
    haptic('heavy')
  } catch (e) {
    console.error('[Brag] 실패:', e)
  }
}

function setupDreamPicker() {
  document.getElementById('btn-sell-dream').addEventListener('click', openDreamShareModal)
  document.getElementById('btn-dream-sell-cancel').addEventListener('click', closeDreamShareModal)
  document.getElementById('btn-dream-sell-confirm').addEventListener('click', confirmDreamShare)
  document.getElementById('dream-sell-dice').addEventListener('click', rerollName)
  document.getElementById('btn-received-save').addEventListener('click', () => closeReceivedDreamModal(true))
  document.getElementById('btn-received-dismiss').addEventListener('click', () => closeReceivedDreamModal(false))
}

// --- Event Listeners ---
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

// 번호 직접 고르기
document.getElementById('btn-add-manual').addEventListener('click', () => {
  openPicker()
  haptic('light')
})
document.getElementById('btn-picker-back').addEventListener('click', () => {
  switchScreen('vault')
  haptic('light')
})
document.getElementById('btn-picker-save').addEventListener('click', () => {
  savePickerNumbers()
})
document.getElementById('btn-picker-clear').addEventListener('click', () => {
  clearPicker()
})

// Start
init()
