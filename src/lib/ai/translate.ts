import OpenAI from 'openai';

/** 지원 대상 언어 */
export const TRANSLATE_LANGS: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文(简体)',
  es: 'Español',
  vi: 'Tiếng Việt',
};

const CHUNK_SIZE = 2500; // 청크당 최대 문자 수
export const MAX_TRANSLATE_LENGTH = 20000; // 본문 번역 총 상한(비용 보호)

/**
 * 긴 텍스트를 문단 경계 기준으로 CHUNK_SIZE 이하 청크로 분할.
 * 한 문단이 CHUNK_SIZE보다 길면 그대로 하나의 청크로 둔다.
 */
function splitIntoChunks(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > CHUNK_SIZE) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * 텍스트를 targetLang(언어 코드)로 번역. 긴 본문은 청크 분할 후 병렬 번역해 재결합.
 * 서식(줄바꿈)을 최대한 보존한다.
 * @throws targetLang 미지원 시 Error
 */
export async function translateText(text: string, targetLang: string): Promise<string> {
  const targetName = TRANSLATE_LANGS[targetLang];
  if (!targetName) throw new Error('지원하지 않는 언어입니다.');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('번역 기능이 설정되지 않았습니다.');

  const trimmed = text.trim().slice(0, MAX_TRANSLATE_LENGTH);
  if (!trimmed) return '';

  const openai = new OpenAI({ apiKey });
  const chunks = splitIntoChunks(trimmed);

  const system =
    `You are a professional translator. Translate the user's text into ${targetName}. ` +
    `Preserve line breaks and paragraph structure. ` +
    `Output ONLY the translation with no quotes, no commentary, no code fences. ` +
    `If the text is already in ${targetName}, return it unchanged.`;

  const translatedChunks = await Promise.all(
    chunks.map(async (chunk) => {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: chunk },
        ],
      });
      return completion.choices[0]?.message?.content?.trim() ?? '';
    }),
  );

  return translatedChunks.join('\n\n');
}
