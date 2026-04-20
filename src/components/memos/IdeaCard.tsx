'use client';

interface IdeaCardProps {
  index: number;
  title: string;
  description: string;
  effect: string;
}

export default function IdeaCard({ index, title, description, effect }: IdeaCardProps) {
  return (
    <div className="bg-[#F7F8FA] rounded-lg border border-[#E2E5EA] p-4">
      <div className="flex items-start gap-2 mb-2">
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full text-[11px] font-bold text-white flex items-center justify-center"
          style={{ backgroundColor: '#2E6FF2', marginTop: 1 }}
        >
          {index}
        </span>
        <p className="text-[13px] font-semibold text-[#1B1F2B] leading-snug">{title}</p>
      </div>

      <p className="text-[12px] text-[#3A3F4B] leading-[1.7] mb-2 pl-7">{description}</p>

      <p className="text-[11px] text-[#A0A7B5] leading-[1.6] pl-7">
        예상 효과: {effect}
      </p>
    </div>
  );
}
