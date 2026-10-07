import puppeteer from 'puppeteer-core';
import { KOREAN_FONT_FACE_CSS } from './korean-fonts';

/**
 * 서버리스 Chromium에는 한글 폰트가 없어 한글이 깨진다(숫자·ASCII만 렌더).
 * 생성 HTML <head>에 한글 @font-face(base64 임베드)를 주입해 어디서든 한글이 렌더되게 한다.
 */
function injectKoreanFonts(html: string): string {
  const styleTag = `<style>${KOREAN_FONT_FACE_CSS}</style>`;
  if (html.includes('</head>')) return html.replace('</head>', `${styleTag}</head>`);
  if (html.includes('<body')) return html.replace('<body', `${styleTag}<body`);
  return styleTag + html;
}

/**
 * HTML 문자열을 서버에서 실제 PDF(Buffer)로 변환한다.
 * - Vercel(serverless): @sparticuz/chromium 번들 사용
 * - 로컬: 시스템에 설치된 Google Chrome 사용
 * 여백은 문서 HTML의 CSS(padding/@page)로 제어하므로 page.pdf margin은 0으로 둔다.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  let launchOptions: Parameters<typeof puppeteer.launch>[0];
  if (isServerless) {
    const chromium = (await import('@sparticuz/chromium')).default;
    launchOptions = {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    };
  } else {
    const localChromePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
    ].filter(Boolean) as string[];
    launchOptions = {
      executablePath: localChromePaths[0],
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
  }

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(injectKoreanFonts(html), { waitUntil: 'load' });
    // @font-face(base64) 디코딩 완료까지 대기 — 안 하면 fallback(한글 없음)으로 인쇄될 수 있음
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
