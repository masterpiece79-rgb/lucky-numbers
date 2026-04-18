/**
 * 재미있는 발신자 별명 자동 생성기
 * '초대박행운전도사', '이번주금손', '지난주똥손이번주금손' 같은 유쾌한 별명 생성
 */

const WORDS = {
  prefix: [
    '초대박', '대박', '슈퍼', '울트라', '찐', '왕', '진짜', '최강', '전설의',
    '레전드', '원조', '우주최강', '역대급', '미친', '찐텐', '풀파워',
  ],
  time: [
    '이번주', '오늘의', '올해의', '이번달', '오늘밤의', '방금막', '지금이순간',
    '요즘', '바로지금',
  ],
  rare: [
    '보기드문', '희귀한', '귀한', '신비한', '꿈속의', '천년만에한번',
    '만날수없는', '찾기어려운', '숨겨진',
  ],
  luck: [
    '행운', '금손', '복덩이', '대박', '행복', '기쁨', '꿈돼지', '로또신',
    '복복', '운빨', '럭키',
  ],
  role: [
    '전도사', '장인', '마스터', '천사', '요정', '신선', '마법사', '도사',
    '명장', '박사', '여신', '왕자', '공주', '대장', '구도자', '수호자',
  ],
  bad: [
    '똥손', '꽝손', '흙손', '불운', '비운', '꽝포',
  ],
  good: [
    '금손', '대박', '행운', '로또신', '복덩이', '럭키', '잭팟',
  ],
  vibe: [
    '고수', '마니아', '덕후', '중독', '전문가', '프로', '달인', '귀재',
  ],
  adj: [
    '황금빛', '반짝이는', '빛나는', '눈부신', '설레는', '두근두근',
    '예감좋은', '심상치않은', '뭔가있는',
  ],
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

const TEMPLATES = [
  // 1. {prefix}{luck}{role} - 초대박행운전도사
  () => `${pick(WORDS.prefix)}${pick(WORDS.luck)}${pick(WORDS.role)}`,
  // 2. {time}{good} - 이번주금손
  () => `${pick(WORDS.time)}${pick(WORDS.good)}`,
  // 3. {rare}{luck}아 - 보기드문행운아
  () => `${pick(WORDS.rare)}${pick(WORDS.luck)}아`,
  // 4. 지난주{bad}이번주{good} - 지난주똥손이번주금손
  () => `지난주${pick(WORDS.bad)}이번주${pick(WORDS.good)}`,
  // 5. {prefix}꿈{vibe} - 최강꿈덕후
  () => `${pick(WORDS.prefix)}꿈${pick(WORDS.vibe)}`,
  // 6. {rare}{role} - 신비한마법사
  () => `${pick(WORDS.rare)}${pick(WORDS.role)}`,
  // 7. {adj}{luck}{role} - 황금빛행운요정
  () => `${pick(WORDS.adj)}${pick(WORDS.luck)}${pick(WORDS.role)}`,
  // 8. {luck}{vibe} - 행운덕후
  () => `${pick(WORDS.luck)}${pick(WORDS.vibe)}`,
  // 9. {prefix}{role} - 전설의마법사
  () => `${pick(WORDS.prefix)}${pick(WORDS.role)}`,
  // 10. {time}{luck}{role} - 이번주행운요정
  () => `${pick(WORDS.time)}${pick(WORDS.luck)}${pick(WORDS.role)}`,
]

/**
 * 랜덤하게 재미있는 별명 생성
 */
export function generateFunName() {
  const template = pick(TEMPLATES)
  let name = template()
  // 너무 긴 이름은 다시 뽑기 (최대 15자)
  if (name.length > 15) {
    return generateFunName()
  }
  return name
}
