import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/* ── Supabase 미설정 시 폴백용 mock 데이터 ── */
const MOCK_FILES = [
  { id: '1', name: '2026년 1분기 실적보고서.pdf', type: 'PDF', department: '경영기획팀', size: '2.4 MB', uploadDate: '2026-03-25', status: '완료' as const },
  { id: '2', name: '프로젝트 제안서_v3.docx', type: 'DOCX', department: '개발팀', size: '1.8 MB', uploadDate: '2026-03-25', status: '완료' as const },
  { id: '3', name: '3월 회의록.md', type: 'MD', department: '인사팀', size: '256 KB', uploadDate: '2026-03-24', status: '처리중' as const },
  { id: '4', name: '계약서_최종.pdf', type: 'PDF', department: '법무팀', size: '3.1 MB', uploadDate: '2026-03-24', status: '완료' as const },
  { id: '5', name: '마케팅 전략 보고서.pptx', type: 'PPTX', department: '마케팅팀', size: '5.6 MB', uploadDate: '2026-03-23', status: '오류' as const },
  { id: '6', name: '급여 명세서_3월.xlsx', type: 'XLSX', department: '인사팀', size: '890 KB', uploadDate: '2026-03-23', status: '완료' as const },
  { id: '7', name: '제품 스펙 문서.pdf', type: 'PDF', department: '개발팀', size: '4.2 MB', uploadDate: '2026-03-22', status: '완료' as const },
  { id: '8', name: '고객 분석 리포트.pptx', type: 'PPTX', department: '마케팅팀', size: '7.3 MB', uploadDate: '2026-03-22', status: '완료' as const },
  { id: '9', name: 'NDA 계약서_A사.pdf', type: 'PDF', department: '법무팀', size: '1.2 MB', uploadDate: '2026-03-21', status: '완료' as const },
  { id: '10', name: '시스템 아키텍처 설계서.md', type: 'MD', department: '개발팀', size: '340 KB', uploadDate: '2026-03-21', status: '처리중' as const },
  { id: '11', name: '회사 규정집_2026.pdf', type: 'PDF', department: '인사팀', size: '8.1 MB', uploadDate: '2026-03-20', status: '완료' as const },
  { id: '12', name: '브랜드 가이드라인.pptx', type: 'PPTX', department: '마케팅팀', size: '12.4 MB', uploadDate: '2026-03-19', status: '완료' as const },
];

/** 파일 상태 매핑 (DB status → 프론트 표시용) */
const STATUS_MAP: Record<string, string> = {
  uploading: '업로드중',
  processing: '처리중',
  indexed: '완료',
  error: '오류',
};

/** 파일 사이즈 포맷 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** MIME → 확장자 매핑 */
function mimeToType(mime: string, name: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'audio/m4a': 'M4A',
    'text/markdown': 'MD',
  };
  return map[mime] ?? name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const department = searchParams.get('department');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.toLowerCase();

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      // departments 맵 한번에 가져오기
      const { data: depts } = await supabase.from('departments').select('id, name');
      const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
      const deptIdByName = new Map((depts ?? []).map((d) => [d.name, d.id]));

      let query = supabase
        .from('files')
        .select('*', { count: 'exact' });

      // 부서 필터 (이름으로 받아서 ID로 변환)
      if (department && department !== '전체') {
        const deptId = deptIdByName.get(department);
        if (deptId) query = query.eq('department_id', deptId);
      }

      // 상태 필터 (프론트 표시명 → DB status)
      if (status && status !== '전체') {
        const dbStatus = Object.entries(STATUS_MAP).find(([, v]) => v === status)?.[0];
        if (dbStatus) query = query.eq('status', dbStatus);
      }

      // 파일명 검색
      if (search) {
        query = query.ilike('original_name', `%${search}%`);
      }

      // 정렬 + 페이지네이션
      const from = (page - 1) * limit;
      query = query.order('created_at', { ascending: false }).range(from, from + limit - 1);

      const { data: rows, count, error } = await query;
      if (error) throw error;

      // type 필터는 DB에 별도 컬럼이 없으므로 클라이언트측 필터
      let files = (rows ?? []).map((f) => ({
        id: f.id,
        name: f.original_name,
        type: mimeToType(f.mime_type, f.original_name),
        department: deptMap.get(f.department_id) ?? '미분류',
        size: formatSize(f.size),
        uploadDate: f.created_at.split('T')[0],
        status: STATUS_MAP[f.status] ?? f.status,
      }));

      if (type && type !== '전체') {
        files = files.filter((f) => f.type === type);
      }

      return NextResponse.json({
        success: true,
        files,
        total: type && type !== '전체' ? files.length : (count ?? 0),
        page,
        limit,
      });
    }

    /* ── 폴백: mock 데이터 ── */
    let filtered = [...MOCK_FILES];

    if (department && department !== '전체') {
      filtered = filtered.filter((f) => f.department === department);
    }
    if (type && type !== '전체') {
      filtered = filtered.filter((f) => f.type === type);
    }
    if (status && status !== '전체') {
      filtered = filtered.filter((f) => f.status === status);
    }
    if (search) {
      filtered = filtered.filter((f) => f.name.toLowerCase().includes(search));
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return NextResponse.json({
      success: true,
      files: paginated,
      total,
      page,
      limit,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '파일 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      /* ── Supabase: Storage 업로드 + files 테이블 INSERT ── */
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const departmentId = formData.get('department_id') as string | null;

      // JSON body 폴백 (formData가 아닌 경우)
      if (!file) {
        const body = await request.json().catch(() => null);
        if (!body?.name) {
          return NextResponse.json(
            { success: false, error: '파일이 필요합니다.' },
            { status: 400 },
          );
        }

        // JSON으로 메타데이터만 INSERT (파일 없이)
        const { data, error } = await supabase.from('files').insert({
          name: body.name,
          type: body.mime_type ?? 'application/octet-stream',
          size: body.size ?? 0,
          department_id: body.department_id ?? 'dept-1',
          uploaded_by: body.user_id ?? 'user-1',
          status: 'indexed',
          storage_path: `/files/${body.name}`,
        } as Record<string, unknown>).select().single();

        if (error) throw error;

        // audit_logs 기록
        try {
          await supabase.from('audit_logs').insert({
            user_id: body.user_id ?? 'user-1',
            action: 'file.upload',
            target_type: 'file',
            target_id: data.id,
            details: { file_name: body.name },
          } as Record<string, unknown>);
        } catch { /* audit 실패는 무시 */ }

        return NextResponse.json({ success: true, data }, { status: 201 });
      }

      // Storage에 파일 업로드
      const storagePath = `uploads/${departmentId ?? 'general'}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      // files 테이블에 메타데이터 INSERT
      const { data, error } = await supabase.from('files').insert({
        name: file.name,
        type: file.type,
        size: file.size,
        department_id: departmentId ?? 'dept-1',
        uploaded_by: 'user-1', // TODO: getUser()
        status: 'processing',
        storage_path: storagePath,
      } as Record<string, unknown>).select().single();

      if (error) throw error;

      // audit_logs 기록
      try {
        await supabase.from('audit_logs').insert({
          user_id: 'user-1',
          action: 'file.upload',
          target_type: 'file',
          target_id: data.id,
          details: { file_name: file.name, size: file.size },
        } as Record<string, unknown>);
      } catch { /* audit 실패는 무시 */ }

      return NextResponse.json({ success: true, data }, { status: 201 });
    }

    /* ── 폴백: mock ── */
    const body = await request.json();
    const { name, type: fileType, department, size } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: '파일 이름이 필요합니다.' },
        { status: 400 },
      );
    }

    const newFile = {
      id: `file-${Date.now()}`,
      name,
      type: fileType ?? 'FILE',
      department: department ?? '경영기획팀',
      size: size ?? '0 KB',
      uploadDate: new Date().toISOString().split('T')[0],
      status: '완료' as const,
    };

    return NextResponse.json(
      { success: true, file: newFile },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
