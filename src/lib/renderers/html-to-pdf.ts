import puppeteer from 'puppeteer-core';

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
    await page.setContent(html, { waitUntil: 'load' });
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
