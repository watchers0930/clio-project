'use client';

/** 그래프 뷰 하단 범례 — 노드 색상 및 엣지 굵기 의미 설명 */
export default function MemoGraphLegend() {
  const colorItems = [
    { label: '기본', bg: '#E8EAED', border: '#C8CDD5' },
    { label: '파랑', bg: '#DBEAFE', border: '#93C5FD' },
    { label: '초록', bg: '#DCFCE7', border: '#86EFAC' },
    { label: '노랑', bg: '#FEF9C3', border: '#FDE047' },
    { label: '빨강', bg: '#FEE2E2', border: '#FCA5A5' },
    { label: '보라', bg: '#F3E8FF', border: '#D8B4FE' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 bg-[#F7F8FA] border-t border-[#E2E5EA] text-[11px] text-[#7C8494]">
      <span className="font-medium text-[#4A5568]">범례</span>

      {/* 노드 색상 */}
      <div className="flex items-center gap-2">
        {colorItems.map(({ label, bg, border }) => (
          <span key={label} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-full border"
              style={{ backgroundColor: bg, borderColor: border }}
            />
            {label}
          </span>
        ))}
      </div>

      {/* 구분선 */}
      <span className="text-[#E2E5EA]">|</span>

      {/* 엣지 굵기 */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-[#2E6FF2]" style={{ opacity: 1 }} />
          높은 유사도
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t border-[#2E6FF2]" style={{ opacity: 0.4 }} />
          낮은 유사도
        </span>
      </div>

      {/* 구분선 */}
      <span className="text-[#E2E5EA]">|</span>

      {/* 고립 노드 안내 */}
      <span>임베딩 없는 메모는 고립 노드로 표시됩니다</span>
    </div>
  );
}
