import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CLIO 개인정보처리방침',
  description: 'CLIO 서비스의 개인정보 수집·이용 및 Google 사용자 데이터 처리 방침',
};

const LAST_UPDATED = '2026년 9월 9일';
const CONTACT_EMAIL = 'tool@dgon.co.kr';

export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 96px', color: '#1d1d1f', lineHeight: 1.75, fontSize: 15 }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ color: '#6e6e73', marginBottom: 40 }}>최종 업데이트: {LAST_UPDATED}</p>

      <section style={{ marginBottom: 32 }}>
        <p>
          CLIO(이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 중요하게 생각하며, 관련 법령을 준수합니다. 본
          방침은 서비스가 어떤 정보를 수집하고, 어떻게 이용·보관·파기하는지를 설명합니다. 특히 Google
          계정(Gmail) 연동 시 처리되는 데이터에 대해 명확히 고지합니다.
        </p>
      </section>

      <Section title="1. 수집하는 정보">
        <ul style={ulStyle}>
          <li><strong>계정 정보</strong>: 이름, 이메일 주소, 소속/부서 등 서비스 이용에 필요한 정보</li>
          <li><strong>Google 계정 연동 정보(선택)</strong>: 이용자가 Gmail을 연결한 경우, 받은편지함 이메일의 제목·본문·발신자·수신일자 및 첨부파일의 내용(문서 텍스트)</li>
          <li><strong>업로드/연동 파일</strong>: 이용자가 직접 업로드하거나 로컬 폴더 인덱싱으로 연동한 문서의 텍스트</li>
          <li><strong>이용 기록</strong>: 검색어, 문서 생성 이력 등 서비스 운영·개선을 위한 로그</li>
        </ul>
      </Section>

      <Section title="2. 정보의 이용 목적">
        <ul style={ulStyle}>
          <li>AI 기반 문서·이메일 검색 및 요약 기능 제공</li>
          <li>검색 정확도 향상을 위한 임베딩(벡터) 인덱싱</li>
          <li>서비스 제공·유지, 오류 대응 및 기능 개선</li>
        </ul>
      </Section>

      <Section title="3. Google 사용자 데이터(Gmail) 처리">
        <p style={{ marginBottom: 12 }}>
          이용자가 Gmail 연동을 선택하면, 서비스는 <code style={codeStyle}>gmail.readonly</code> 권한으로 이메일을
          <strong> 읽기 전용</strong>으로 접근합니다. 서비스는 이메일을 수정·발송·삭제하지 않습니다.
        </p>
        <ul style={ulStyle}>
          <li>수집된 이메일 본문·첨부 텍스트는 <strong>이용자 본인의 검색 기능 제공 목적</strong>으로만 사용됩니다.</li>
          <li>이메일 데이터는 광고 목적으로 사용되지 않으며, 제3자에게 판매되지 않습니다.</li>
          <li>이용자는 언제든지 서비스 설정에서 <strong>Gmail 연결을 해제</strong>할 수 있으며, 해제 시 동기화된 이메일 데이터는 삭제됩니다.</li>
        </ul>
        <p style={{ marginTop: 16, padding: '14px 16px', background: '#f5f5f7', borderRadius: 10, fontSize: 14 }}>
          CLIO&rsquo;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={linkStyle}>
            Google API Services User Data Policy
          </a>, including the Limited Use requirements.
        </p>
      </Section>

      <Section title="4. 제3자 처리 위탁">
        <p>
          검색·요약 기능 제공을 위해 문서 및 이메일 텍스트의 일부가 임베딩·요약 생성 목적으로 AI 처리
          서비스(OpenAI 등)로 전송될 수 있습니다. 해당 처리는 서비스 기능 제공 목적에 한하며, 수탁자는
          관련 데이터를 자체 목적으로 이용하지 않습니다.
        </p>
      </Section>

      <Section title="5. 보관 및 파기">
        <ul style={ulStyle}>
          <li>수집된 정보는 이용 목적 달성 또는 이용자의 삭제 요청 시까지 보관합니다.</li>
          <li>Gmail 연결 해제 시 동기화된 이메일·첨부 인덱스는 즉시 삭제됩니다.</li>
          <li>회원 탈퇴 또는 서비스 종료 시 관련 개인정보는 지체 없이 파기합니다.</li>
        </ul>
      </Section>

      <Section title="6. 정보 보안">
        <p>
          서비스는 접근 권한 통제, 전송 구간 암호화(HTTPS) 등 합리적인 보호조치를 적용하여 개인정보의
          분실·도난·유출·변조를 방지하기 위해 노력합니다.
        </p>
      </Section>

      <Section title="7. 이용자의 권리">
        <p>
          이용자는 자신의 개인정보에 대한 열람·정정·삭제를 요청할 수 있으며, Gmail 연동 해제 및 데이터
          삭제를 서비스 설정에서 직접 수행할 수 있습니다.
        </p>
      </Section>

      <Section title="8. 문의처">
        <p>
          개인정보 처리에 관한 문의는 아래로 연락해 주시기 바랍니다.<br />
          이메일: <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>
        </p>
      </Section>

      <p style={{ marginTop: 40, color: '#6e6e73', fontSize: 13 }}>
        본 방침은 {LAST_UPDATED}부터 적용됩니다. 내용이 변경될 경우 본 페이지를 통해 공지합니다.
      </p>
    </main>
  );
}

const ulStyle: React.CSSProperties = { paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 };
const codeStyle: React.CSSProperties = { background: '#f0f0f2', padding: '2px 6px', borderRadius: 6, fontSize: 13 };
const linkStyle: React.CSSProperties = { color: '#2E6FF2', textDecoration: 'underline' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}
