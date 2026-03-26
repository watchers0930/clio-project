import type {
  User,
  Department,
  FileRecord,
  Template,
  Document,
  AuditLog,
  Channel,
  Message,
} from './supabase/types';

// =============================================================================
// Departments
// =============================================================================

export const departments: Department[] = [
  { id: 'dept-1', name: '경영지원팀', description: '경영 전략 및 지원 업무를 담당합니다.', created_at: '2025-01-01T00:00:00Z' },
  { id: 'dept-2', name: '총무팀', description: '사무 환경, 시설 관리, 복리후생 등을 담당합니다.', created_at: '2025-01-01T00:00:00Z' },
  { id: 'dept-3', name: '개발팀', description: '소프트웨어 개발 및 기술 연구를 담당합니다.', created_at: '2025-01-01T00:00:00Z' },
  { id: 'dept-4', name: '마케팅팀', description: '브랜드 마케팅, 광고, SNS 운영을 담당합니다.', created_at: '2025-01-01T00:00:00Z' },
  { id: 'dept-5', name: '인사팀', description: '채용, 평가, 교육 등 인사 관리를 담당합니다.', created_at: '2025-01-01T00:00:00Z' },
];

// =============================================================================
// Users (10)
// =============================================================================

export const users: User[] = [
  { id: 'user-1', email: 'admin@clio.kr', name: '김관리', department: 'dept-1', role: 'admin', avatar_url: null, created_at: '2025-01-05T09:00:00Z' },
  { id: 'user-2', email: 'park@clio.kr', name: '박경영', department: 'dept-1', role: 'manager', avatar_url: null, created_at: '2025-01-06T09:00:00Z' },
  { id: 'user-3', email: 'lee@clio.kr', name: '이총무', department: 'dept-2', role: 'manager', avatar_url: null, created_at: '2025-01-07T09:00:00Z' },
  { id: 'user-4', email: 'choi@clio.kr', name: '최총무', department: 'dept-2', role: 'user', avatar_url: null, created_at: '2025-01-08T09:00:00Z' },
  { id: 'user-5', email: 'jung@clio.kr', name: '정개발', department: 'dept-3', role: 'manager', avatar_url: null, created_at: '2025-01-09T09:00:00Z' },
  { id: 'user-6', email: 'han@clio.kr', name: '한개발', department: 'dept-3', role: 'user', avatar_url: null, created_at: '2025-01-10T09:00:00Z' },
  { id: 'user-7', email: 'son@clio.kr', name: '손개발', department: 'dept-3', role: 'user', avatar_url: null, created_at: '2025-01-11T09:00:00Z' },
  { id: 'user-8', email: 'kang@clio.kr', name: '강마케', department: 'dept-4', role: 'manager', avatar_url: null, created_at: '2025-01-12T09:00:00Z' },
  { id: 'user-9', email: 'yoon@clio.kr', name: '윤마케', department: 'dept-4', role: 'user', avatar_url: null, created_at: '2025-01-13T09:00:00Z' },
  { id: 'user-10', email: 'seo@clio.kr', name: '서인사', department: 'dept-5', role: 'manager', avatar_url: null, created_at: '2025-01-14T09:00:00Z' },
];

// =============================================================================
// Files (20)
// =============================================================================

export const files: FileRecord[] = [
  { id: 'file-1', user_id: 'user-1', department_id: 'dept-1', name: '2025_사업계획서', original_name: '2025_사업계획서.pdf', mime_type: 'application/pdf', size: 2_450_000, storage_path: '/files/dept-1/2025_사업계획서.pdf', status: 'indexed', metadata: { pages: 42 }, created_at: '2025-02-01T10:00:00Z', updated_at: '2025-02-01T10:30:00Z' },
  { id: 'file-2', user_id: 'user-2', department_id: 'dept-1', name: '월간_경영보고_3월', original_name: '월간_경영보고_3월.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 850_000, storage_path: '/files/dept-1/월간_경영보고_3월.docx', status: 'indexed', metadata: { pages: 15 }, created_at: '2025-03-05T14:00:00Z', updated_at: '2025-03-05T14:20:00Z' },
  { id: 'file-3', user_id: 'user-2', department_id: 'dept-1', name: '예산집행현황_Q1', original_name: '예산집행현황_Q1.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1_200_000, storage_path: '/files/dept-1/예산집행현황_Q1.xlsx', status: 'indexed', metadata: { sheets: 5 }, created_at: '2025-03-20T11:00:00Z', updated_at: '2025-03-20T11:15:00Z' },
  { id: 'file-4', user_id: 'user-3', department_id: 'dept-2', name: '사무실_임대계약서', original_name: '사무실_임대계약서.pdf', mime_type: 'application/pdf', size: 3_100_000, storage_path: '/files/dept-2/사무실_임대계약서.pdf', status: 'indexed', metadata: { pages: 28 }, created_at: '2025-01-15T09:00:00Z', updated_at: '2025-01-15T09:30:00Z' },
  { id: 'file-5', user_id: 'user-3', department_id: 'dept-2', name: '비품_구매내역_2025', original_name: '비품_구매내역_2025.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 450_000, storage_path: '/files/dept-2/비품_구매내역_2025.xlsx', status: 'indexed', metadata: { sheets: 3 }, created_at: '2025-02-10T13:00:00Z', updated_at: '2025-02-10T13:10:00Z' },
  { id: 'file-6', user_id: 'user-4', department_id: 'dept-2', name: '차량관리_대장', original_name: '차량관리_대장.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 320_000, storage_path: '/files/dept-2/차량관리_대장.docx', status: 'indexed', metadata: { pages: 8 }, created_at: '2025-02-20T15:00:00Z', updated_at: '2025-02-20T15:05:00Z' },
  { id: 'file-7', user_id: 'user-5', department_id: 'dept-3', name: 'API_설계문서_v2', original_name: 'API_설계문서_v2.pdf', mime_type: 'application/pdf', size: 1_800_000, storage_path: '/files/dept-3/API_설계문서_v2.pdf', status: 'indexed', metadata: { pages: 35 }, created_at: '2025-01-20T10:00:00Z', updated_at: '2025-01-20T10:45:00Z' },
  { id: 'file-8', user_id: 'user-6', department_id: 'dept-3', name: '코드리뷰_가이드라인', original_name: '코드리뷰_가이드라인.pdf', mime_type: 'application/pdf', size: 920_000, storage_path: '/files/dept-3/코드리뷰_가이드라인.pdf', status: 'indexed', metadata: { pages: 18 }, created_at: '2025-02-05T11:00:00Z', updated_at: '2025-02-05T11:20:00Z' },
  { id: 'file-9', user_id: 'user-7', department_id: 'dept-3', name: 'DB_스키마_ERD', original_name: 'DB_스키마_ERD.pdf', mime_type: 'application/pdf', size: 2_100_000, storage_path: '/files/dept-3/DB_스키마_ERD.pdf', status: 'indexed', metadata: { pages: 12 }, created_at: '2025-02-15T14:00:00Z', updated_at: '2025-02-15T14:10:00Z' },
  { id: 'file-10', user_id: 'user-5', department_id: 'dept-3', name: '스프린트_회의록_0310', original_name: '스프린트_회의록_0310.m4a', mime_type: 'audio/m4a', size: 15_600_000, storage_path: '/files/dept-3/스프린트_회의록_0310.m4a', status: 'indexed', metadata: { duration_sec: 1800 }, created_at: '2025-03-10T16:00:00Z', updated_at: '2025-03-10T16:45:00Z' },
  { id: 'file-11', user_id: 'user-6', department_id: 'dept-3', name: '배포_체크리스트', original_name: '배포_체크리스트.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 210_000, storage_path: '/files/dept-3/배포_체크리스트.docx', status: 'indexed', metadata: { pages: 4 }, created_at: '2025-03-12T09:00:00Z', updated_at: '2025-03-12T09:05:00Z' },
  { id: 'file-12', user_id: 'user-8', department_id: 'dept-4', name: 'SNS_컨텐츠_가이드', original_name: 'SNS_컨텐츠_가이드.pdf', mime_type: 'application/pdf', size: 4_200_000, storage_path: '/files/dept-4/SNS_컨텐츠_가이드.pdf', status: 'indexed', metadata: { pages: 52 }, created_at: '2025-01-25T10:00:00Z', updated_at: '2025-01-25T10:30:00Z' },
  { id: 'file-13', user_id: 'user-8', department_id: 'dept-4', name: '2025_마케팅_전략', original_name: '2025_마케팅_전략.pdf', mime_type: 'application/pdf', size: 3_500_000, storage_path: '/files/dept-4/2025_마케팅_전략.pdf', status: 'indexed', metadata: { pages: 38 }, created_at: '2025-02-01T13:00:00Z', updated_at: '2025-02-01T13:25:00Z' },
  { id: 'file-14', user_id: 'user-9', department_id: 'dept-4', name: '광고비_집행현황', original_name: '광고비_집행현황.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 680_000, storage_path: '/files/dept-4/광고비_집행현황.xlsx', status: 'indexed', metadata: { sheets: 4 }, created_at: '2025-03-01T11:00:00Z', updated_at: '2025-03-01T11:10:00Z' },
  { id: 'file-15', user_id: 'user-9', department_id: 'dept-4', name: '고객_설문조사_결과', original_name: '고객_설문조사_결과.pdf', mime_type: 'application/pdf', size: 1_500_000, storage_path: '/files/dept-4/고객_설문조사_결과.pdf', status: 'indexed', metadata: { pages: 22 }, created_at: '2025-03-15T15:00:00Z', updated_at: '2025-03-15T15:15:00Z' },
  { id: 'file-16', user_id: 'user-10', department_id: 'dept-5', name: '취업규칙_2025', original_name: '취업규칙_2025.pdf', mime_type: 'application/pdf', size: 1_800_000, storage_path: '/files/dept-5/취업규칙_2025.pdf', status: 'indexed', metadata: { pages: 30 }, created_at: '2025-01-10T09:00:00Z', updated_at: '2025-01-10T09:20:00Z' },
  { id: 'file-17', user_id: 'user-10', department_id: 'dept-5', name: '신입사원_온보딩_매뉴얼', original_name: '신입사원_온보딩_매뉴얼.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1_100_000, storage_path: '/files/dept-5/신입사원_온보딩_매뉴얼.docx', status: 'indexed', metadata: { pages: 20 }, created_at: '2025-02-01T10:00:00Z', updated_at: '2025-02-01T10:15:00Z' },
  { id: 'file-18', user_id: 'user-10', department_id: 'dept-5', name: '연봉_테이블_2025', original_name: '연봉_테이블_2025.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 350_000, storage_path: '/files/dept-5/연봉_테이블_2025.xlsx', status: 'indexed', metadata: { sheets: 2 }, created_at: '2025-02-15T14:00:00Z', updated_at: '2025-02-15T14:05:00Z' },
  { id: 'file-19', user_id: 'user-1', department_id: 'dept-1', name: '이사회_회의록_0301', original_name: '이사회_회의록_0301.m4a', mime_type: 'audio/m4a', size: 22_400_000, storage_path: '/files/dept-1/이사회_회의록_0301.m4a', status: 'indexed', metadata: { duration_sec: 3600 }, created_at: '2025-03-01T17:00:00Z', updated_at: '2025-03-01T17:50:00Z' },
  { id: 'file-20', user_id: 'user-7', department_id: 'dept-3', name: '보안_점검_결과', original_name: '보안_점검_결과.pdf', mime_type: 'application/pdf', size: 2_700_000, storage_path: '/files/dept-3/보안_점검_결과.pdf', status: 'processing', metadata: { pages: 25 }, created_at: '2025-03-25T10:00:00Z', updated_at: '2025-03-25T10:00:00Z' },
];

// =============================================================================
// Templates (5)
// =============================================================================

export const templates: Template[] = [
  {
    id: 'tmpl-1',
    name: '주간업무보고서',
    description: '매주 팀별 업무 현황을 보고하는 양식입니다.',
    department_id: 'dept-1',
    type: 'company',
    content: { placeholders: ['부서명', '보고기간', '주요성과', '차주계획', '이슈사항'], structure: { sections: ['개요', '금주 성과', '차주 계획', '이슈 및 건의'] } },
    is_active: true,
    created_at: '2025-01-10T09:00:00Z',
    updated_at: '2025-01-10T09:00:00Z',
  },
  {
    id: 'tmpl-2',
    name: '회의록',
    description: '회의 내용을 기록하는 표준 양식입니다.',
    department_id: 'dept-1',
    type: 'company',
    content: { placeholders: ['회의명', '일시', '참석자', '안건', '결정사항', '후속조치'], structure: { sections: ['회의 정보', '안건 목록', '논의 내용', '결정사항', 'Action Items'] } },
    is_active: true,
    created_at: '2025-01-10T09:00:00Z',
    updated_at: '2025-01-10T09:00:00Z',
  },
  {
    id: 'tmpl-3',
    name: '기술설계문서',
    description: '개발팀 기술 설계 표준 양식입니다.',
    department_id: 'dept-3',
    type: 'department',
    content: { placeholders: ['프로젝트명', '작성자', '기술스택', '아키텍처', 'API명세'], structure: { sections: ['개요', '기술 스택', '아키텍처', 'API 설계', '데이터 모델', '보안 고려사항'] } },
    is_active: true,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-02-20T14:00:00Z',
  },
  {
    id: 'tmpl-4',
    name: '마케팅_캠페인_기획서',
    description: '마케팅 캠페인 기획을 위한 양식입니다.',
    department_id: 'dept-4',
    type: 'department',
    content: { placeholders: ['캠페인명', '목표', '타겟', '예산', '일정', 'KPI'], structure: { sections: ['캠페인 개요', '목표 및 KPI', '타겟 분석', '전략', '예산 계획', '일정'] } },
    is_active: true,
    created_at: '2025-01-20T11:00:00Z',
    updated_at: '2025-01-20T11:00:00Z',
  },
  {
    id: 'tmpl-5',
    name: '채용공고_양식',
    description: '인사팀 채용공고 표준 양식입니다.',
    department_id: 'dept-5',
    type: 'department',
    content: { placeholders: ['포지션', '부서', '경력조건', '업무내용', '우대사항', '복리후생'], structure: { sections: ['포지션 소개', '담당 업무', '자격 요건', '우대 사항', '근무 조건', '지원 방법'] } },
    is_active: true,
    created_at: '2025-02-01T09:00:00Z',
    updated_at: '2025-02-01T09:00:00Z',
  },
];

// =============================================================================
// Documents (5)
// =============================================================================

export const documents: Document[] = [
  {
    id: 'doc-1',
    user_id: 'user-2',
    template_id: 'tmpl-1',
    title: '경영지원팀 주간업무보고 (3월 3주차)',
    content: '## 개요\n경영지원팀 3월 3주차 업무보고입니다.\n\n## 금주 성과\n- 2025년 사업계획 이사회 보고 완료\n- Q1 예산 집행 현황 분석 완료\n\n## 차주 계획\n- 4월 예산안 편성\n- 분기 경영실적 보고서 작성\n\n## 이슈\n- 해당 없음',
    source_file_ids: ['file-1', 'file-3'],
    status: 'completed',
    watermark: 'CLIO-CONFIDENTIAL',
    created_at: '2025-03-21T10:00:00Z',
  },
  {
    id: 'doc-2',
    user_id: 'user-5',
    template_id: 'tmpl-3',
    title: 'CLIO RAG 엔진 기술설계문서',
    content: '## 개요\nCLIO 플랫폼의 RAG(Retrieval Augmented Generation) 엔진 기술 설계 문서입니다.\n\n## 기술 스택\n- Next.js 14 App Router\n- Supabase (pgvector)\n- OpenAI Embeddings\n\n## 아키텍처\n문서 업로드 → 청크 분할 → 임베딩 생성 → 벡터 저장 → 쿼리 시 유사도 검색\n\n## API 설계\n- POST /api/search: 자연어 검색\n- POST /api/files: 파일 업로드 및 인덱싱',
    source_file_ids: ['file-7', 'file-9'],
    status: 'completed',
    watermark: 'CLIO-INTERNAL',
    created_at: '2025-03-18T14:00:00Z',
  },
  {
    id: 'doc-3',
    user_id: 'user-8',
    template_id: 'tmpl-4',
    title: '2025 봄 프로모션 캠페인 기획서',
    content: '## 캠페인 개요\n2025년 봄 시즌 프로모션 캠페인입니다.\n\n## 목표 및 KPI\n- 신규 가입자 2,000명\n- 매출 전월 대비 30% 증가\n\n## 타겟 분석\n- 25-35세 직장인\n- 디지털 서비스에 관심 있는 사용자',
    source_file_ids: ['file-13', 'file-15'],
    status: 'completed',
    watermark: null,
    created_at: '2025-03-15T11:00:00Z',
  },
  {
    id: 'doc-4',
    user_id: 'user-10',
    template_id: 'tmpl-5',
    title: '시니어 백엔드 개발자 채용공고',
    content: '## 포지션 소개\n성장하는 CLIO 팀과 함께할 시니어 백엔드 개발자를 모집합니다.\n\n## 담당 업무\n- RAG 파이프라인 설계 및 구현\n- API 서버 개발 및 최적화\n\n## 자격 요건\n- 백엔드 개발 5년 이상\n- TypeScript/Node.js 경험 필수',
    source_file_ids: ['file-16'],
    status: 'draft',
    watermark: null,
    created_at: '2025-03-22T09:00:00Z',
  },
  {
    id: 'doc-5',
    user_id: 'user-3',
    template_id: 'tmpl-2',
    title: '3월 총무팀 정기회의록',
    content: '## 회의 정보\n- 일시: 2025-03-20 14:00\n- 참석자: 이총무, 최총무\n\n## 안건\n1. 사무실 리모델링 진행상황\n2. 비품 구매 승인\n\n## 결정사항\n- 4월 첫째 주 리모델링 착공\n- 비품 구매 예산 500만원 승인',
    source_file_ids: ['file-4', 'file-5'],
    status: 'completed',
    watermark: 'CLIO-INTERNAL',
    created_at: '2025-03-20T16:00:00Z',
  },
];

// =============================================================================
// Audit Logs (recent)
// =============================================================================

export const auditLogs: AuditLog[] = [
  { id: 'log-1', user_id: 'user-1', action: 'file.upload', resource_type: 'file', resource_id: 'file-20', details: { file_name: '보안_점검_결과.pdf' }, ip_address: '192.168.1.10', created_at: '2025-03-25T10:00:00Z' },
  { id: 'log-2', user_id: 'user-5', action: 'document.create', resource_type: 'document', resource_id: 'doc-2', details: { title: 'CLIO RAG 엔진 기술설계문서' }, ip_address: '192.168.1.25', created_at: '2025-03-18T14:00:00Z' },
  { id: 'log-3', user_id: 'user-10', action: 'document.create', resource_type: 'document', resource_id: 'doc-4', details: { title: '시니어 백엔드 개발자 채용공고' }, ip_address: '192.168.1.40', created_at: '2025-03-22T09:00:00Z' },
  { id: 'log-4', user_id: 'user-8', action: 'search', resource_type: 'search', resource_id: '', details: { query: '마케팅 예산' }, ip_address: '192.168.1.35', created_at: '2025-03-24T11:00:00Z' },
  { id: 'log-5', user_id: 'user-2', action: 'document.create', resource_type: 'document', resource_id: 'doc-1', details: { title: '경영지원팀 주간업무보고 (3월 3주차)' }, ip_address: '192.168.1.12', created_at: '2025-03-21T10:00:00Z' },
  { id: 'log-6', user_id: 'user-3', action: 'file.upload', resource_type: 'file', resource_id: 'file-6', details: { file_name: '차량관리_대장.docx' }, ip_address: '192.168.1.18', created_at: '2025-02-20T15:00:00Z' },
  { id: 'log-7', user_id: 'user-6', action: 'file.download', resource_type: 'file', resource_id: 'file-8', details: { file_name: '코드리뷰_가이드라인.pdf' }, ip_address: '192.168.1.26', created_at: '2025-03-23T09:30:00Z' },
  { id: 'log-8', user_id: 'user-9', action: 'search', resource_type: 'search', resource_id: '', details: { query: '고객 설문' }, ip_address: '192.168.1.36', created_at: '2025-03-24T14:00:00Z' },
  { id: 'log-9', user_id: 'user-7', action: 'document.view', resource_type: 'document', resource_id: 'doc-2', details: {}, ip_address: '192.168.1.27', created_at: '2025-03-25T11:00:00Z' },
  { id: 'log-10', user_id: 'user-1', action: 'user.login', resource_type: 'user', resource_id: 'user-1', details: {}, ip_address: '192.168.1.10', created_at: '2025-03-25T08:00:00Z' },
];

// =============================================================================
// Channels & Messages
// =============================================================================

export const channels: Channel[] = [
  { id: 'ch-1', name: '경영지원팀', type: 'department', department_id: 'dept-1', created_at: '2025-01-01T00:00:00Z' },
  { id: 'ch-2', name: '개발팀', type: 'department', department_id: 'dept-3', created_at: '2025-01-01T00:00:00Z' },
  { id: 'ch-3', name: '전사공지', type: 'group', department_id: null, created_at: '2025-01-01T00:00:00Z' },
];

export const messages: Message[] = [
  { id: 'msg-1', channel_id: 'ch-3', user_id: 'user-1', content: '3월 경영실적 보고서가 공유되었습니다. 확인 부탁드립니다.', is_read: true, created_at: '2025-03-20T09:00:00Z' },
  { id: 'msg-2', channel_id: 'ch-2', user_id: 'user-5', content: '스프린트 회의 녹음 파일 업로드 완료했습니다.', is_read: true, created_at: '2025-03-10T17:00:00Z' },
  { id: 'msg-3', channel_id: 'ch-2', user_id: 'user-6', content: '코드리뷰 가이드라인 문서 업데이트했습니다. 리뷰 부탁드려요.', is_read: false, created_at: '2025-03-23T10:00:00Z' },
  { id: 'msg-4', channel_id: 'ch-1', user_id: 'user-2', content: '이번 주 업무보고서 제출 완료했습니다.', is_read: true, created_at: '2025-03-21T10:30:00Z' },
  { id: 'msg-5', channel_id: 'ch-3', user_id: 'user-10', content: '시니어 백엔드 채용공고 초안 검토 부탁드립니다.', is_read: false, created_at: '2025-03-22T09:30:00Z' },
  { id: 'msg-6', channel_id: 'ch-2', user_id: 'user-7', content: '보안 점검 결과 문서 올렸습니다. 처리 중입니다.', is_read: false, created_at: '2025-03-25T10:15:00Z' },
];

// =============================================================================
// Mock search chunks for RAG simulation
// =============================================================================

export const mockSearchChunks = [
  { file_id: 'file-1', chunk_index: 3, content: '2025년 매출 목표는 전년 대비 25% 성장한 500억원으로 설정하였으며, 이를 위해 신규 서비스 런칭과 기존 고객 유지율 향상에 집중한다.' },
  { file_id: 'file-1', chunk_index: 7, content: '디지털 전환 가속화를 위해 RAG 기반 문서 관리 시스템 CLIO를 도입하고, 전사적 업무 효율성을 30% 개선하는 것을 목표로 한다.' },
  { file_id: 'file-7', chunk_index: 2, content: 'API 설계 원칙: RESTful 아키텍처를 기반으로 하되, 검색 등 복잡한 쿼리가 필요한 엔드포인트는 POST 메서드를 사용한다.' },
  { file_id: 'file-7', chunk_index: 5, content: '벡터 검색은 pgvector의 cosine similarity를 사용하며, 상위 10개 결과를 반환한다. 임베딩 차원은 1536(text-embedding-3-small)이다.' },
  { file_id: 'file-8', chunk_index: 1, content: '코드리뷰 시 확인사항: 1) 타입 안전성, 2) 에러 핸들링, 3) 보안 취약점, 4) 성능 이슈, 5) 코드 가독성' },
  { file_id: 'file-13', chunk_index: 4, content: '2025년 마케팅 핵심 전략은 콘텐츠 마케팅 강화와 B2B 시장 확대이며, 전체 마케팅 예산의 40%를 디지털 채널에 배분한다.' },
  { file_id: 'file-16', chunk_index: 8, content: '연차 휴가는 입사일 기준으로 산정하며, 1년 미만 근무자는 매월 1일의 유급휴가가 발생한다. 3년 이상 근속 시 추가 휴가 2일이 부여된다.' },
  { file_id: 'file-17', chunk_index: 0, content: '신입사원 온보딩 프로그램: 1주차 회사 소개 및 조직 이해, 2주차 직무 교육, 3주차 멘토링 시작, 4주차 OJT 및 첫 프로젝트 배정' },
  { file_id: 'file-9', chunk_index: 3, content: 'users 테이블과 departments 테이블은 1:N 관계이며, files 테이블은 users와 departments 양쪽에 FK로 연결된다.' },
  { file_id: 'file-15', chunk_index: 6, content: '고객 만족도 조사 결과 NPS 점수 72점으로 전분기 대비 8점 상승하였으며, 주요 개선 요인은 UI/UX 개편이다.' },
];
