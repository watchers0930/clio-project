import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

/** 파일 상태 매핑 (DB status → 프론트 표시용) */
const STATUS_MAP: Record<string, string> = {
  uploading: '업로드중',
  processing: '처리중',
  indexed: '완료',
  completed: '완료',
  error: '오류',
};

/** 파일 사이즈 포맷 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** MIME → 확장자 매핑 */
function mimeToType(mime: string | null, name: string): string {
  if (!mime) return name.split('.').pop()?.toUpperCase() ?? 'FILE';
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

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 부서명 매핑
    const { data: depts } = await supabase.from('departments').select('id, name');
    const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
    const deptIdByName = new Map((depts ?? []).map((d) => [d.name, d.id]));

    let query = supabase.from('files').select('*', { count: 'exact' });

    if (department && department !== '전체') {
      const deptId = deptIdByName.get(department);
      if (deptId) query = query.eq('department_id', deptId);
    }

    if (status && status !== '전체') {
      const dbStatus = Object.entries(STATUS_MAP).find(([, v]) => v === status)?.[0];
      if (dbStatus) query = query.eq('status', dbStatus);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const from = (page - 1) * limit;
    query = query.order('created_at', { ascending: false }).range(from, from + limit - 1);

    const { data: rows, count, error } = await query;
    if (error) {
      console.error('[files/GET]', error.message);
      return NextResponse.json({ success: false, error: '파일 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    let files = (rows ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      type: mimeToType(f.type, f.name),
      department: deptMap.get(f.department_id ?? '') ?? '미분류',
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
    if (!supabase) {
      return NextResponse.json({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') ?? '';

    // FormData (파일 업로드)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const departmentId = formData.get('department_id') as string | null;

      if (!file) {
        return NextResponse.json({ success: false, error: '파일이 필요합니다.' }, { status: 400 });
      }

      // Storage에 파일 업로드
      const storagePath = `uploads/${departmentId ?? 'general'}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(storagePath, file);
      if (uploadError) {
        console.error('[files/POST] storage upload:', uploadError.message);
        return NextResponse.json({ success: false, error: '파일 업로드에 실패했습니다.' }, { status: 500 });
      }

      // files 테이블에 메타데이터 INSERT
      const { data, error } = await supabase.from('files').insert({
        name: file.name,
        type: file.type,
        size: file.size,
        department_id: departmentId ?? null,
        uploaded_by: authUserId,
        status: 'processing',
        storage_path: storagePath,
      }).select().single();

      if (error) {
        console.error('[files/POST] insert:', error.message);
        return NextResponse.json({ success: false, error: '파일 정보 저장에 실패했습니다.' }, { status: 500 });
      }

      // audit_logs 기록
      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'file.upload',
        target_type: 'file',
        target_id: data.id,
        details: { file_name: file.name, size: file.size },
      }).then(() => {}, () => {});

      // 백그라운드 파일 처리 (텍스트 추출 → 청킹 → 임베딩)
      const baseUrl = request.nextUrl.origin;
      fetch(`${baseUrl}/api/files/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: data.id }),
      }).then(() => {}, () => {});

      return NextResponse.json({ success: true, data }, { status: 201 });
    }

    // JSON body (메타데이터만)
    const body = await request.json().catch(() => null);
    if (!body?.name) {
      return NextResponse.json({ success: false, error: '파일 이름이 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await supabase.from('files').insert({
      name: body.name,
      type: body.type ?? 'application/octet-stream',
      size: body.size ?? 0,
      department_id: body.department_id ?? null,
      uploaded_by: authUserId,
      status: 'indexed',
      storage_path: null,
    }).select().single();

    if (error) {
      console.error('[files/POST] json insert:', error.message);
      return NextResponse.json({ success: false, error: '파일 정보 저장에 실패했습니다.' }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: 'file.upload',
      target_type: 'file',
      target_id: data.id,
      details: { file_name: body.name },
    }).then(() => {}, () => {});

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
