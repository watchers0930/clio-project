// 지출 메모를 내용별 줄로 나누기 (순수 함수)
// 메모는 한 줄 입력이라 ' / ', ' · ', 줄바꿈으로 내용을 구분해 적는다. 상세 모달에서 한 줄에 하나씩 보여준다.

export function memoLines(memo: string | null | undefined): string[] {
  if (!memo) return [];
  return memo
    .split(/\r?\n|\s+\/\s+|\s+·\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
