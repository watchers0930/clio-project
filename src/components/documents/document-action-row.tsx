interface DocumentActionRowItem {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'review' | 'success' | 'share' | 'warning' | 'muted';
  trailing?: React.ReactNode;
}

const ACTION_VARIANTS: Record<NonNullable<DocumentActionRowItem['variant']>, string> = {
  primary: 'bg-[#1d1d1f] text-white hover:bg-[#0071e3]',
  secondary: 'border border-[#D7E7FF] text-[#2E6FF2] hover:bg-[#eef6ff]',
  review: 'border border-[#E6DBFF] text-[#7C3AED] hover:bg-[#FAF5FF]',
  success: 'border border-[#D7EFDE] text-[#258A4E] hover:bg-[#F4FBF6]',
  share: 'border border-[#E6DBFF] text-[#7B61FF] hover:bg-[#f6f3ff]',
  warning: 'border border-[#f59e0b] text-[#f59e0b] hover:bg-amber-50',
  muted: 'border border-[#e5e5e7] text-[#6e6e73] hover:bg-[#f5f5f7]',
};

export function DocumentActionRow({ items }: { items: DocumentActionRowItem[] }) {
  return <DocumentActionRowLayout items={items} direction="row" />;
}

export function DocumentActionStack({ items }: { items: DocumentActionRowItem[] }) {
  return <DocumentActionRowLayout items={items} direction="column" />;
}

function DocumentActionRowLayout({
  items,
  direction,
}: {
  items: DocumentActionRowItem[];
  direction: 'row' | 'column';
}) {
  return (
    <div className={direction === 'row' ? 'mt-4 flex flex-wrap gap-2.5' : 'flex flex-col gap-2.5'}>
      {items.map((item) => {
        const variant = item.variant ?? 'secondary';
        return (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-medium transition-colors ${direction === 'column' ? 'justify-center' : ''} ${ACTION_VARIANTS[variant]}`}
          >
            {item.label}
            {item.trailing}
          </button>
        );
      })}
    </div>
  );
}
