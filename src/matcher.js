/**
 * 로또 당첨 매칭 로직
 *
 * 등수 규칙 (로또 6/45 공식):
 * - 1등: 6개 번호 모두 일치
 * - 2등: 5개 번호 일치 + 보너스 번호 일치
 * - 3등: 5개 번호 일치
 * - 4등: 4개 번호 일치
 * - 5등: 3개 번호 일치
 * - 그 외: 낙첨
 *
 * 주의: 사용자가 3개만 생성한 경우 최대 5등까지만 확인 가능
 */

import { getAllSaved, updateItem } from './storage.js'

/**
 * 단일 번호 세트 매칭
 * @param {number[]} userNumbers - 사용자 번호 (3~6개)
 * @param {number[]} winningNumbers - 당첨 번호 6개
 * @param {number} bonusNumber - 보너스 번호
 * @returns {{rank: number, matches: number, bonus: boolean, matchedNumbers: number[]}}
 */
export function matchOneSet(userNumbers, winningNumbers, bonusNumber) {
  const winSet = new Set(winningNumbers)
  const matchedNumbers = userNumbers.filter(n => winSet.has(n))
  const matches = matchedNumbers.length
  const bonus = userNumbers.includes(bonusNumber)

  let rank = 0
  if (userNumbers.length >= 6) {
    if (matches === 6) rank = 1
    else if (matches === 5 && bonus) rank = 2
    else if (matches === 5) rank = 3
    else if (matches === 4) rank = 4
    else if (matches === 3) rank = 5
  } else {
    // 3~5개만 가진 경우 - 제한적 판정
    if (matches === userNumbers.length && matches >= 3) {
      // 가진 개수 전부 일치
      if (matches === 5) rank = bonus ? 2 : 3
      else if (matches === 4) rank = 4
      else if (matches === 3) rank = 5
    } else if (matches === 3) rank = 5
    else if (matches === 4) rank = 4
    else if (matches === 5) rank = bonus ? 2 : 3
  }

  return { rank, matches, bonus, matchedNumbers }
}

/**
 * 보관함의 모든 미확인 번호를 최신 회차 기준으로 매칭
 * @param {Array} allData - 전체 로또 데이터
 * @returns {{newWinnings: Array, totalChecked: number}}
 */
export function checkAllPending(allData) {
  const saved = getAllSaved()
  const drawMap = new Map()
  for (const round of allData) {
    drawMap.set(round.draw_no, round)
  }

  const newWinnings = []
  let totalChecked = 0

  for (const item of saved) {
    if (item.checked) continue

    const draw = drawMap.get(item.targetDrawNo)
    if (!draw) continue // 아직 추첨 안 됨

    const result = matchOneSet(item.numbers, draw.numbers, draw.bonus_no)
    updateItem(item.id, {
      checked: true,
      result,
      drawDate: draw.date,
      drawNumbers: draw.numbers,
      drawBonus: draw.bonus_no,
    })

    totalChecked++
    if (result.rank > 0) {
      newWinnings.push({ ...item, result, drawNumbers: draw.numbers, drawBonus: draw.bonus_no })
    }
  }

  return { newWinnings, totalChecked }
}

/**
 * 등수별 상금 (2024년 기준 평균치, 참고용)
 */
export function getPrizeLabel(rank) {
  switch (rank) {
    case 1: return '🏆 1등 (약 20억원)'
    case 2: return '🥈 2등 (약 6천만원)'
    case 3: return '🥉 3등 (약 150만원)'
    case 4: return '🎉 4등 (5만원)'
    case 5: return '✨ 5등 (5천원)'
    default: return '아쉽게 낙첨'
  }
}

export function getRankEmoji(rank) {
  switch (rank) {
    case 1: return '🏆'
    case 2: return '🥈'
    case 3: return '🥉'
    case 4: return '🎉'
    case 5: return '✨'
    default: return '😢'
  }
}
