-- 054: 저장소 경로 컬럼(storage_path·signature_path) 사용자 세션 쓰기 차단
--
-- 배경(2026-11-14 운영 확인):
--   storage.objects 는 RLS 정책 0개라 저장소 접근은 서버가 service role 로만 한다(src/lib/storage/files-bucket.ts).
--   그런데 files·documents·users 의 RLS 는 소유자 컬럼만 검사해, 사용자 세션이 Supabase REST 로
--   storage_path / signature_path 에 임의 경로(예: 남의 서명·회사 직인)를 넣을 수 있었다(롤백 시험으로 확인).
--   서버가 그 행의 경로로 service role 다운로드·서명URL·삭제를 하면 남의 파일을 읽거나 지울 수 있는 구멍이 된다.
--
-- 조치: 사용자 세션(auth.uid() not null)의 아래 쓰기를 거부한다. 정상 경로는 모두 서버(service role)가 쓴다.
--   files.storage_path      : INSERT 시 값 지정, UPDATE 시 변경
--   documents.storage_path  : INSERT 시 값 지정, UPDATE 시 변경
--   users.signature_path    : INSERT 시 값 지정, UPDATE 시 변경
-- 앱 쪽 다층 방어: 경로 가드(isAllowedStoragePath)·참조 확인 후 삭제(removeUnreferencedBlobs).

create or replace function public.protect_storage_path_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new text;
  v_old text;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_table_name = 'users' then
    v_new := new.signature_path;
    v_old := case when tg_op = 'UPDATE' then old.signature_path end;
  else
    v_new := new.storage_path;
    v_old := case when tg_op = 'UPDATE' then old.storage_path end;
  end if;

  if tg_op = 'INSERT' and v_new is not null then
    raise exception '저장소 경로는 서버만 지정할 수 있습니다.';
  end if;
  if tg_op = 'UPDATE' and v_new is distinct from v_old then
    raise exception '저장소 경로는 서버만 변경할 수 있습니다.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_storage_path_columns() from public, anon, authenticated;

drop trigger if exists trg_protect_storage_path on public.files;
create trigger trg_protect_storage_path
  before insert or update on public.files
  for each row execute function public.protect_storage_path_columns();

drop trigger if exists trg_protect_storage_path on public.documents;
create trigger trg_protect_storage_path
  before insert or update on public.documents
  for each row execute function public.protect_storage_path_columns();

drop trigger if exists trg_protect_signature_path on public.users;
create trigger trg_protect_signature_path
  before insert or update on public.users
  for each row execute function public.protect_storage_path_columns();
