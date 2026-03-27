/**
 * OpenAI Whisper API를 통한 음성 텍스트 변환
 */

import OpenAI from 'openai';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (Whisper API 제한)

export async function transcribeAudio(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<string> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(`파일 크기가 25MB를 초과합니다. (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');

  const openai = new OpenAI({ apiKey });

  const file = new File([buffer], fileName, { type: 'audio/mp4' });

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'ko',
    response_format: 'text',
  });

  return response as unknown as string;
}
