/**
 * 토스 미니앱(앱인토스) SDK 연동 모듈
 *
 * 앱인토스 WebView SDK를 사용하여 토스 앱과 연동합니다.
 * 공식 문서: https://developers-apps-in-toss.toss.im/
 */

function isInTossApp() {
  return typeof window !== 'undefined' && window.__APPS_IN_TOSS__;
}

export async function initTossSDK() {
  if (!isInTossApp()) {
    console.log('[LuckyNumbers] 토스 앱 외부 환경 - 웹 모드로 실행');
    return { mode: 'web' };
  }

  try {
    const sdk = window.__APPS_IN_TOSS_SDK__ || window.__APPS_IN_TOSS__;
    if (!sdk || !sdk.getAppContext) {
      throw new Error('SDK not available');
    }
    const appContext = await sdk.getAppContext();

    console.log('[LuckyNumbers] 토스 미니앱 모드로 실행');
    return {
      mode: 'toss',
      sdk,
      appContext,
      user: appContext.user,
    };
  } catch (error) {
    console.error('[LuckyNumbers] SDK 초기화 실패, 웹 모드로 전환:', error);
    return { mode: 'web' };
  }
}

export async function shareApp(sdk) {
  const shareData = {
    title: '🍀 행운의 번호 - 로또 번호 추천',
    description: '과거 당첨 통계로 찾는 나만의 행운 번호!',
    url: 'https://lucky-numbers-miniapp.vercel.app',
  };

  if (sdk && sdk.mode === 'toss') {
    try {
      await sdk.sdk.share(shareData);
      return true;
    } catch (error) {
      console.error('[LuckyNumbers] 공유 실패:', error);
      return false;
    }
  }

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (error) {
      return false;
    }
  }

  try {
    await navigator.clipboard.writeText(shareData.url);
    alert('링크가 복사되었습니다!');
    return true;
  } catch {
    return false;
  }
}

// --- 광고 SDK ---
// 실제 토스 광고 그룹 ID (2026-04-17 발급)
const AD_GROUP_ID_INTERSTITIAL = 'ait.v2.live.4a2b351327de4a79' // 번호생성 전면 광고
const AD_GROUP_ID_REWARDED = 'ait.v2.live.3a7e1415be6c402e'     // 6개번호 보상형 광고

/**
 * 토스 풀스크린 광고 표시 (interstitial / rewarded 공용)
 *
 * SDK 시그니처(@apps-in-toss/web-bridge):
 *   loadFullScreenAd({ options:{adGroupId}, onEvent, onError }) → cleanup()
 *     onEvent: { type: 'loaded' }
 *   showFullScreenAd({ options:{adGroupId}, onEvent, onError }) → cleanup()
 *     onEvent: clicked|dismissed|failedToShow|impression|show|requested|userEarnedReward
 *
 * @param {string} adGroupId
 * @param {Function} [onLoaded] - 광고가 화면에 뜨기 직전 호출 (로딩 UI 숨김용)
 * @param {boolean} [trackReward] - 보상형(rewarded) 광고 여부
 * @returns {Promise<boolean>} interstitial: 광고 노출됨 / rewarded: 보상 획득됨
 */
async function showFullScreenAdGeneric(adGroupId, onLoaded, trackReward = false) {
  try {
    const mod = await import('@apps-in-toss/web-framework')
    const { loadFullScreenAd, showFullScreenAd } = mod

    if (!loadFullScreenAd || !showFullScreenAd) {
      console.log('[Ad] SDK 함수 없음 - 웹 모드')
      return false
    }

    if (loadFullScreenAd.isSupported && !loadFullScreenAd.isSupported()) {
      console.log('[Ad] loadFullScreenAd.isSupported() === false - 웹 모드')
      return false
    }

    console.log('[Ad] 광고 로드 시작:', adGroupId, 'rewarded:', trackReward)

    return new Promise((resolve) => {
      let done = false
      let loaded = false
      let rewarded = false
      let cleanupLoad = null
      let cleanupShow = null

      const cleanupAll = () => {
        try { cleanupLoad?.() } catch {}
        try { cleanupShow?.() } catch {}
      }

      const finish = (value) => {
        if (done) return
        done = true
        cleanupAll()
        resolve(value)
      }

      // 1) 광고 로드
      cleanupLoad = loadFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          console.log('[Ad] load event:', event?.type)
          if (event?.type === 'loaded') {
            loaded = true
            if (onLoaded) { try { onLoaded() } catch {} }

            // 2) 광고 표시
            cleanupShow = showFullScreenAd({
              options: { adGroupId },
              onEvent: (showEvent) => {
                console.log('[Ad] show event:', showEvent?.type)
                if (showEvent?.type === 'userEarnedReward') {
                  rewarded = true
                } else if (showEvent?.type === 'dismissed') {
                  finish(trackReward ? rewarded : true)
                } else if (showEvent?.type === 'failedToShow') {
                  finish(false)
                }
              },
              onError: (err) => {
                console.error('[Ad] show error:', err)
                finish(false)
              },
            })
          }
        },
        onError: (err) => {
          console.error('[Ad] load error:', err)
          finish(false)
        },
      })

      // 5초 안에 loaded 이벤트 없으면 → fallback
      setTimeout(() => {
        if (!loaded) {
          console.log('[Ad] loaded 이벤트 5초 무응답 - 웹 모드/광고 없음')
          finish(false)
        }
      }, 5000)
      // 전체 90초 backup
      setTimeout(() => finish(false), 90000)
    })
  } catch (error) {
    console.error('[Ad] SDK 호출 실패:', error)
    return false
  }
}

/**
 * 전면 광고 (번호 생성 시)
 * @param {Function} [onLoaded]
 * @returns {Promise<boolean>}
 */
export async function showTossInterstitialAd(onLoaded) {
  return showFullScreenAdGeneric(AD_GROUP_ID_INTERSTITIAL, onLoaded, false)
}

/**
 * 보상형 광고 (5게임 / 키워드 등)
 * @param {Function} [onLoaded]
 * @returns {Promise<boolean>} 보상 획득 여부
 */
export async function showTossRewardedAd(onLoaded) {
  return showFullScreenAdGeneric(AD_GROUP_ID_REWARDED, onLoaded, true)
}

export function hapticFeedback(type = 'light') {
  if (navigator.vibrate) {
    switch (type) {
      case 'light':
        navigator.vibrate(30);
        break;
      case 'medium':
        navigator.vibrate(50);
        break;
      case 'heavy':
        navigator.vibrate([100, 50, 200]);
        break;
    }
  }
}

export default {
  initTossSDK,
  shareApp,
  hapticFeedback,
  showTossInterstitialAd,
  showTossRewardedAd,
};
