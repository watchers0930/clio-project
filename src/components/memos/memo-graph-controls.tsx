'use client';

interface MemoGraphControlsProps {
  threshold: number;
  onChange: (value: number) => void;
}

export default function MemoGraphControls({ threshold, onChange }: MemoGraphControlsProps) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] text-foreground-secondary"
      style={{
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #E2E8F0',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <span className="whitespace-nowrap">연결 임계값</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={threshold}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-20 cursor-pointer accent-[#6366F1]"
        style={{ height: 3 }}
      />
      <span className="w-7 text-right tabular-nums">{Math.round(threshold * 100)}%</span>
    </div>
  );
}
