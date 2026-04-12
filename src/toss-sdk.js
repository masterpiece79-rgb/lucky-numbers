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
};
