-- 사용자별 사이드바 메뉴 커스터마이즈 설정
ALTER TABLE users ADD COLUMN IF NOT EXISTS sidebar_menus JSONB DEFAULT '[]';
