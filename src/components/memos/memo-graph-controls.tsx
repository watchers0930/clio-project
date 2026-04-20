'use client';

interface MemoGraphControlsProps {
  threshold: number;
  onThresholdChange: (value: number) => void;
}

const MIN = 0.70;
const MAX = 0.95;
const STEP = 0.01;

export default function MemoGraphControls({
  threshold,
  onThresholdChange,
}: MemoGraphControlsProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E2E5EA] bg-white">
      <label
        htmlFor="graph-threshold"
        className="text-[12px] text-[#7C8494] whitespace-nowrap flex-shrink-0"
      >
        연결 강도
      </label>
      <input
        id="graph-threshold"
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={threshold}
        onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 accent-[#2E6FF2] cursor-pointer"
      />
      <span className="text-[12px] font-medium text-[#1B1F2B] w-8 text-right flex-shrink-0">
        {threshold.toFixed(2)}
      </span>
    </div>
  );
}
