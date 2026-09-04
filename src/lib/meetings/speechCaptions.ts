/**
 * 브라우저 음성인식(Web Speech API) 기반 자막 소스.
 * 로컬 마이크의 발화를 인식해 최종 문장마다 onFinal 콜백을 호출한다.
 * (Daily 트랜스크립션 대신 무료로 동작 — 크롬/엣지 등 지원 브라우저 한정)
 */

const LANG_MAP: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
  es: 'es-ES',
  vi: 'vi-VN',
};

export interface SpeechCaptioner {
  stop: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' &&
    !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
       (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

export function startSpeechCaptions(lang: string, onFinal: (text: string) => void): SpeechCaptioner | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.lang = LANG_MAP[lang] || 'ko-KR';
  rec.continuous = true;
  rec.interimResults = false;

  let stopped = false;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const t = (r[0]?.transcript ?? '').trim();
        if (t) onFinal(t);
      }
    }
  };
  // 무음 등으로 자동 종료되면 재시작(계속 듣기)
  rec.onend = () => { if (!stopped) { try { rec.start(); } catch { /* 이미 시작됨 */ } } };
  rec.onerror = () => { /* no-speech 등은 onend에서 재시작 처리 */ };

  try { rec.start(); } catch { /* 이미 시작됨 */ }

  return {
    stop: () => {
      stopped = true;
      try { rec.stop(); } catch { /* 무시 */ }
    },
  };
}
