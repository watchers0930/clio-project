/**
 * CLIO 시드 스크립트
 * Supabase Auth에 사용자 생성 + 모든 테이블에 샘플 데이터 삽입
 *
 * 실행: node scripts/seed.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jbvofhxoupujtuazzphk.supabase.co';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impidm9maHhvdXB1anR1YXp6cGhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNzYwMSwiZXhwIjoyMDkwMDkzNjAxfQ.K7syTqX7r0VQ5swmsEnXqHODLuBWFpORbAhr0k6zPWA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── 실제 DB에 있는 ID ──────────────────────────────────────────────────
const DEPT = {
  BIZ: '25747a95-9237-41d1-bec6-2bc3906a3916',   // 경영기획팀
  DEV: '148b1eec-23e7-43b7-adf8-060ddbf98d64',   // 개발팀
  HR: '70bc9c77-97e7-48c7-b2d1-6666c748f804',    // 인사팀
  LEGAL: '166c170d-ec70-4c9a-a200-d190b0c371da',  // 법무팀
  MKT: 'c886ca1b-7a96-46ea-85a3-a5f242f72ea8',   // 마케팅팀
};

const CHANNEL = {
  BIZ: '85d9c084-ba99-43ca-b96e-cbe411db9d52',
  DEV: '0be0522b-47a1-4ac5-af38-0a8cde85bc76',
  HR: '98324364-edfd-4792-b672-0cfa9f772357',
  LEGAL: '9d660d50-85c8-446d-9511-e3ec011b96a3',
  NOTICE: 'a554b70f-13ca-478c-a461-153e150804df',
};

const TEMPLATE = {
  MEETING: 'bc4901b4-149d-4872-a9cf-0674b6689551',
  CONTRACT: '430ab2d2-63c2-4cab-b2f4-f2d1a34fe3c2',
  PROPOSAL: 'b9fee53b-986b-44b3-869b-e659b8471781',
  REPORT: '6859bfbe-d005-4e51-a3d6-3f8c30340cd7',
  OFFICIAL: 'b931874b-efb3-4b9e-9ba5-7019df9a9709',
};

const ADMIN_AUTH_ID = 'cb336617-4ca9-4d28-966f-f3111ba2a36c';

// ── 생성할 사용자 목록 ─────────────────────────────────────────────────
const USERS_TO_CREATE = [
  { email: 'park@clio.kr', name: '박경영', dept: DEPT.BIZ, role: 'manager' },
  { email: 'lee@clio.kr', name: '이법무', dept: DEPT.LEGAL, role: 'manager' },
  { email: 'choi@clio.kr', name: '최법무', dept: DEPT.LEGAL, role: 'user' },
  { email: 'jung@clio.kr', name: '정개발', dept: DEPT.DEV, role: 'manager' },
  { email: 'han@clio.kr', name: '한개발', dept: DEPT.DEV, role: 'user' },
  { email: 'son@clio.kr', name: '손개발', dept: DEPT.DEV, role: 'user' },
  { email: 'kang@clio.kr', name: '강마케', dept: DEPT.MKT, role: 'manager' },
  { email: 'yoon@clio.kr', name: '윤마케', dept: DEPT.MKT, role: 'user' },
  { email: 'seo@clio.kr', name: '서인사', dept: DEPT.HR, role: 'manager' },
];

async function createAuthUsers() {
  console.log('\n── Auth 사용자 생성 ──');
  const userIds = { 'admin@clio.kr': ADMIN_AUTH_ID };

  for (const u of USERS_TO_CREATE) {
    // 이미 존재하는지 확인
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing.users.find((eu) => eu.email === u.email);
    if (found) {
      console.log(`  [skip] ${u.email} (이미 존재: ${found.id})`);
      userIds[u.email] = found.id;
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: 'password',
      email_confirm: true,
      user_metadata: { name: u.name },
    });

    if (error) {
      console.error(`  [fail] ${u.email}: ${error.message}`);
      continue;
    }
    console.log(`  [ok] ${u.email} → ${data.user.id}`);
    userIds[u.email] = data.user.id;
  }

  return userIds;
}

async function seedUsers(userIds) {
  console.log('\n── users 테이블 시딩 ──');

  for (const u of USERS_TO_CREATE) {
    const authId = userIds[u.email];
    if (!authId) continue;

    const { error } = await supabase.from('users').upsert(
      {
        id: authId,
        email: u.email,
        name: u.name,
        department_id: u.dept,
        role: u.role,
        avatar_url: null,
      },
      { onConflict: 'id' },
    );

    if (error) {
      console.error(`  [fail] ${u.email}: ${error.message}`);
    } else {
      console.log(`  [ok] ${u.name} (${u.email})`);
    }
  }
}

async function seedFiles(userIds) {
  console.log('\n── files 테이블 시딩 ──');

  const files = [
    { name: '2026년_사업계획서.pdf', type: 'application/pdf', size: 2560000, dept: DEPT.BIZ, uploader: 'admin@clio.kr', status: 'indexed' },
    { name: '1분기_실적보고서.pdf', type: 'application/pdf', size: 1843200, dept: DEPT.BIZ, uploader: 'park@clio.kr', status: 'indexed' },
    { name: '프로젝트_제안서_v3.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 524288, dept: DEPT.DEV, uploader: 'jung@clio.kr', status: 'indexed' },
    { name: '3월_회의록.md', type: 'text/markdown', size: 32768, dept: DEPT.HR, uploader: 'seo@clio.kr', status: 'processing' },
    { name: '계약서_최종.pdf', type: 'application/pdf', size: 1048576, dept: DEPT.LEGAL, uploader: 'lee@clio.kr', status: 'indexed' },
    { name: '마케팅_전략_보고서.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: 5242880, dept: DEPT.MKT, uploader: 'kang@clio.kr', status: 'error' },
    { name: 'API_설계문서_v2.md', type: 'text/markdown', size: 65536, dept: DEPT.DEV, uploader: 'han@clio.kr', status: 'indexed' },
    { name: '코드리뷰_가이드.md', type: 'text/markdown', size: 40960, dept: DEPT.DEV, uploader: 'son@clio.kr', status: 'indexed' },
    { name: '채용공고_시니어개발자.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 204800, dept: DEPT.HR, uploader: 'seo@clio.kr', status: 'indexed' },
    { name: '법률자문_요약.pdf', type: 'application/pdf', size: 737280, dept: DEPT.LEGAL, uploader: 'choi@clio.kr', status: 'indexed' },
    { name: '2026_예산안.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1536000, dept: DEPT.BIZ, uploader: 'admin@clio.kr', status: 'indexed' },
    { name: '브랜드_가이드라인.pdf', type: 'application/pdf', size: 8388608, dept: DEPT.MKT, uploader: 'yoon@clio.kr', status: 'indexed' },
    { name: '신입사원_교육자료.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: 3145728, dept: DEPT.HR, uploader: 'seo@clio.kr', status: 'indexed' },
    { name: '개인정보처리방침_v4.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 409600, dept: DEPT.LEGAL, uploader: 'lee@clio.kr', status: 'indexed' },
    { name: 'CI_CD_파이프라인_설정.md', type: 'text/markdown', size: 20480, dept: DEPT.DEV, uploader: 'jung@clio.kr', status: 'indexed' },
    { name: '캠페인_성과_리포트.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 819200, dept: DEPT.MKT, uploader: 'kang@clio.kr', status: 'indexed' },
    { name: '분기_인사평가.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 614400, dept: DEPT.HR, uploader: 'seo@clio.kr', status: 'indexed' },
    { name: '서비스_이용약관_개정안.pdf', type: 'application/pdf', size: 921600, dept: DEPT.LEGAL, uploader: 'choi@clio.kr', status: 'indexed' },
    { name: '고객_분석_대시보드.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: 6291456, dept: DEPT.MKT, uploader: 'yoon@clio.kr', status: 'indexed' },
    { name: '시스템_아키텍처_문서.md', type: 'text/markdown', size: 81920, dept: DEPT.DEV, uploader: 'han@clio.kr', status: 'indexed' },
  ];

  const rows = files.map((f) => ({
    name: f.name,
    type: f.type,
    size: f.size,
    department_id: f.dept,
    uploaded_by: userIds[f.uploader] ?? ADMIN_AUTH_ID,
    status: f.status,
    storage_path: null,
  }));

  const { data, error } = await supabase.from('files').insert(rows).select('id, name');
  if (error) {
    console.error(`  [fail] ${error.message}`);
    return {};
  }
  console.log(`  [ok] ${data.length}개 파일 삽입`);
  return Object.fromEntries(data.map((f) => [f.name, f.id]));
}

async function seedDocuments(userIds, fileIds) {
  console.log('\n── documents 테이블 시딩 ──');

  const docs = [
    {
      title: '1분기 업무 보고서',
      content: '## 개요\n이번 분기 업무 보고서입니다.\n\n### 주요 성과\n- 매출 목표 달성률 112%\n- 신규 고객 42건 확보\n\n### 개선 필요 사항\n- 고객 응대 프로세스 개선 필요',
      template_id: TEMPLATE.REPORT,
      source_file_ids: [],
      status: 'completed',
      created_by: userIds['admin@clio.kr'],
    },
    {
      title: '3월 전체 회의록',
      content: '## 회의 정보\n- 일시: 2026-03-20 14:00\n- 참석자: 김관리, 박경영, 정개발, 강마케\n\n### 안건\n1. 2분기 사업 계획\n2. 신규 프로젝트 착수\n3. 채용 계획',
      template_id: TEMPLATE.MEETING,
      source_file_ids: [],
      status: 'completed',
      created_by: userIds['park@clio.kr'],
    },
    {
      title: 'AI 검색 시스템 제안서',
      content: '## 프로젝트 개요\nRAG 기반 문서 검색 시스템 도입 제안\n\n### 기대 효과\n- 문서 검색 시간 80% 단축\n- 정보 접근성 향상',
      template_id: TEMPLATE.PROPOSAL,
      source_file_ids: [],
      status: 'draft',
      created_by: userIds['jung@clio.kr'],
    },
    {
      title: '서비스 이용약관 개정안',
      content: '## 개정 사유\n개인정보보호법 개정에 따른 이용약관 업데이트\n\n### 주요 변경사항\n- 제3조: 개인정보 수집 항목 명시\n- 제7조: 데이터 보존 기간 변경',
      template_id: TEMPLATE.OFFICIAL,
      source_file_ids: [],
      status: 'completed',
      created_by: userIds['lee@clio.kr'],
    },
    {
      title: '2분기 마케팅 캠페인 기획서',
      content: '## 캠페인 개요\n신규 프로모션 기획안입니다.\n\n### 타겟\n- B2B SaaS 기업\n- 직원 수 50~200명 규모\n\n### 예산\n- 총 5,000만원',
      template_id: TEMPLATE.PROPOSAL,
      source_file_ids: [],
      status: 'draft',
      created_by: userIds['kang@clio.kr'],
    },
  ];

  const { data, error } = await supabase.from('documents').insert(docs).select('id, title');
  if (error) {
    console.error(`  [fail] ${error.message}`);
    return;
  }
  console.log(`  [ok] ${data.length}개 문서 삽입`);
}

async function seedChannelMembers(userIds) {
  console.log('\n── channel_members 시딩 ──');

  const members = [
    // admin은 모든 채널에 참여
    { channel_id: CHANNEL.BIZ, user_id: userIds['admin@clio.kr'] },
    { channel_id: CHANNEL.DEV, user_id: userIds['admin@clio.kr'] },
    { channel_id: CHANNEL.HR, user_id: userIds['admin@clio.kr'] },
    { channel_id: CHANNEL.LEGAL, user_id: userIds['admin@clio.kr'] },
    { channel_id: CHANNEL.NOTICE, user_id: userIds['admin@clio.kr'] },
    // 부서별 멤버
    { channel_id: CHANNEL.BIZ, user_id: userIds['park@clio.kr'] },
    { channel_id: CHANNEL.DEV, user_id: userIds['jung@clio.kr'] },
    { channel_id: CHANNEL.DEV, user_id: userIds['han@clio.kr'] },
    { channel_id: CHANNEL.DEV, user_id: userIds['son@clio.kr'] },
    { channel_id: CHANNEL.HR, user_id: userIds['seo@clio.kr'] },
    { channel_id: CHANNEL.LEGAL, user_id: userIds['lee@clio.kr'] },
    { channel_id: CHANNEL.LEGAL, user_id: userIds['choi@clio.kr'] },
    { channel_id: CHANNEL.NOTICE, user_id: userIds['park@clio.kr'] },
    { channel_id: CHANNEL.NOTICE, user_id: userIds['jung@clio.kr'] },
    { channel_id: CHANNEL.NOTICE, user_id: userIds['kang@clio.kr'] },
    { channel_id: CHANNEL.NOTICE, user_id: userIds['seo@clio.kr'] },
    { channel_id: CHANNEL.NOTICE, user_id: userIds['lee@clio.kr'] },
  ].filter((m) => m.user_id);

  const { error } = await supabase.from('channel_members').upsert(members, {
    onConflict: 'channel_id,user_id',
  });
  if (error) {
    console.error(`  [fail] ${error.message}`);
    return;
  }
  console.log(`  [ok] ${members.length}개 멤버십 삽입`);
}

async function seedMessages(userIds) {
  console.log('\n── messages 시딩 ──');

  const msgs = [
    { channel_id: CHANNEL.BIZ, sender_id: userIds['admin@clio.kr'], content: '내일 보고서 마감입니다. 확인 부탁드립니다.' },
    { channel_id: CHANNEL.BIZ, sender_id: userIds['park@clio.kr'], content: '네, 오늘 중으로 제출하겠습니다.' },
    { channel_id: CHANNEL.DEV, sender_id: userIds['jung@clio.kr'], content: '배포 완료했습니다. QA 부탁드립니다.' },
    { channel_id: CHANNEL.DEV, sender_id: userIds['han@clio.kr'], content: '확인했습니다. 테스트 진행하겠습니다.' },
    { channel_id: CHANNEL.NOTICE, sender_id: userIds['admin@clio.kr'], content: '4월 1일 전사 워크숍이 예정되어 있습니다. 일정 확인 부탁드립니다.' },
    { channel_id: CHANNEL.HR, sender_id: userIds['seo@clio.kr'], content: '시니어 개발자 채용 면접 일정이 확정되었습니다.' },
    { channel_id: CHANNEL.LEGAL, sender_id: userIds['lee@clio.kr'], content: '계약서 검토 완료했습니다. 수정사항 첨부합니다.' },
    { channel_id: CHANNEL.DEV, sender_id: userIds['son@clio.kr'], content: 'PR 리뷰 부탁드립니다. #142' },
  ].filter((m) => m.sender_id);

  const { error } = await supabase.from('messages').insert(msgs);
  if (error) {
    console.error(`  [fail] ${error.message}`);
    return;
  }
  console.log(`  [ok] ${msgs.length}개 메시지 삽입`);
}

async function seedAuditLogs(userIds) {
  console.log('\n── audit_logs 시딩 ──');

  const logs = [
    { user_id: userIds['admin@clio.kr'], action: 'file.upload', target_type: 'file', details: { file_name: '2026년_사업계획서.pdf' } },
    { user_id: userIds['park@clio.kr'], action: 'file.upload', target_type: 'file', details: { file_name: '1분기_실적보고서.pdf' } },
    { user_id: userIds['jung@clio.kr'], action: 'document.create', target_type: 'document', details: { title: 'AI 검색 시스템 제안서' } },
    { user_id: userIds['admin@clio.kr'], action: 'search', target_type: 'search', details: { query: '사업계획서' } },
    { user_id: userIds['lee@clio.kr'], action: 'document.create', target_type: 'document', details: { title: '서비스 이용약관 개정안' } },
    { user_id: userIds['kang@clio.kr'], action: 'file.upload', target_type: 'file', details: { file_name: '마케팅_전략_보고서.pptx' } },
    { user_id: userIds['seo@clio.kr'], action: 'file.upload', target_type: 'file', details: { file_name: '채용공고_시니어개발자.docx' } },
    { user_id: userIds['han@clio.kr'], action: 'search', target_type: 'search', details: { query: 'API 설계' } },
    { user_id: userIds['admin@clio.kr'], action: 'template.create', target_type: 'template', details: { name: '보고서' } },
    { user_id: userIds['yoon@clio.kr'], action: 'file.upload', target_type: 'file', details: { file_name: '브랜드_가이드라인.pdf' } },
  ].filter((l) => l.user_id);

  const { error } = await supabase.from('audit_logs').insert(logs);
  if (error) {
    console.error(`  [fail] ${error.message}`);
    return;
  }
  console.log(`  [ok] ${logs.length}개 로그 삽입`);
}

// ── 실행 ────────────────────────────────────────────────────────────────
async function main() {
  console.log('CLIO 시드 스크립트 시작\n');

  // 1. Auth 사용자 생성
  const userIds = await createAuthUsers();
  console.log(`\n총 사용자 ID: ${Object.keys(userIds).length}명`);

  // 2. users 테이블
  await seedUsers(userIds);

  // 3. files
  const fileIds = await seedFiles(userIds);

  // 4. documents
  await seedDocuments(userIds, fileIds);

  // 5. channel_members
  await seedChannelMembers(userIds);

  // 6. messages
  await seedMessages(userIds);

  // 7. audit_logs
  await seedAuditLogs(userIds);

  // 최종 카운트 확인
  console.log('\n── 최종 데이터 확인 ──');
  const tables = ['departments', 'users', 'files', 'documents', 'channels', 'channel_members', 'messages', 'audit_logs'];
  for (const t of tables) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t}: ${count}건`);
  }

  console.log('\n시드 완료!');
}

main().catch(console.error);
