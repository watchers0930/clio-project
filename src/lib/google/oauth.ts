import { google } from 'googleapis';

// gmail.modify: 읽기 + 라벨 수정(휴지통 이동 포함). 영구 삭제(messages.delete)는 불가하므로
// 사용자 실수 시에도 Gmail 휴지통에서 복구 가능하다. readonly의 상위 권한이라 검색·본문 조회도 그대로 동작.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'openid',
  'email',
];

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI ?? 'https://clioai.vercel.app/api/auth/google/callback').trim();

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID 또는 GOOGLE_CLIENT_SECRET이 설정되지 않았습니다.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl() {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
  });
}
