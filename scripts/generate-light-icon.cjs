/**
 * 라이트 로고 PNG 생성 스크립트
 * assets-generator.html의 renderLogoLight와 동일한 로직
 */
const { createCanvas } = require('@napi-rs/canvas')
const fs = require('fs')
const path = require('path')

const canvas = createCanvas(600, 600)
const ctx = canvas.getContext('2d')

// 크림톤 그라데이션 배경
const bg = ctx.createRadialGradient(300, 300, 100, 300, 300, 420)
bg.addColorStop(0, '#FFFFFF')
bg.addColorStop(0.7, '#FFFBEB')
bg.addColorStop(1, '#FEF3C7')
ctx.fillStyle = bg
ctx.fillRect(0, 0, 600, 600)

// 골드 후광
const halo = ctx.createRadialGradient(300, 300, 30, 300, 300, 260)
halo.addColorStop(0, 'rgba(255, 215, 0, 0.35)')
halo.addColorStop(0.5, 'rgba(255, 215, 0, 0.12)')
halo.addColorStop(1, 'rgba(255, 215, 0, 0)')
ctx.fillStyle = halo
ctx.fillRect(0, 0, 600, 600)

// 클로버 (중앙에 크게)
function drawClover(ctx, x, y, size) {
  ctx.save()
  ctx.translate(x, y)
  const s = size / 140

  // 글로우
  ctx.shadowColor = 'rgba(76, 217, 100, 0.6)'
  ctx.shadowBlur = 30 * s

  const cloverColor = '#4CD964'
  const darkColor = '#2FA844'
  const leafSize = 32 * s

  function drawHeart(cx, cy, angle) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(-leafSize * 0.8, -leafSize * 0.6, -leafSize * 1.1, -leafSize * 1.6, 0, -leafSize * 2.0)
    ctx.bezierCurveTo(leafSize * 1.1, -leafSize * 1.6, leafSize * 0.8, -leafSize * 0.6, 0, 0)
    ctx.closePath()
    ctx.fillStyle = cloverColor
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, -2 * s)
    ctx.lineTo(0, -leafSize * 1.6)
    ctx.strokeStyle = darkColor
    ctx.lineWidth = 2 * s
    ctx.stroke()
    ctx.restore()
  }

  // 4개 잎
  drawHeart(0, -8 * s, 0)
  drawHeart(0, 8 * s, Math.PI)
  drawHeart(-8 * s, 0, -Math.PI / 2)
  drawHeart(8 * s, 0, Math.PI / 2)

  // 줄기
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.moveTo(2 * s, 10 * s)
  ctx.quadraticCurveTo(8 * s, 40 * s, 4 * s, 55 * s)
  ctx.strokeStyle = darkColor
  ctx.lineWidth = 4 * s
  ctx.lineCap = 'round'
  ctx.stroke()

  ctx.restore()
}

drawClover(ctx, 300, 300, 220)

// PNG 저장
const outputPath = path.join(__dirname, '..', 'public', 'icon.png')
const buffer = canvas.toBuffer('image/png')
fs.writeFileSync(outputPath, buffer)
console.log(`✅ 라이트 아이콘 생성 완료: ${outputPath}`)
console.log(`   크기: ${(buffer.length / 1024).toFixed(1)} KB`)
