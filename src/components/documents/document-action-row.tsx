interface DocumentActionRowItem {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'review' | 'success' | 'share' | 'warning' | 'muted';
  trailing?: React.ReactNode;
}

const ACTION_VARIANTS: Record<NonNullable<DocumentActionRowItem['variant']>, string> = {
  primary: 'bg-foreground text-white hover:bg-primary',
  secondary: 'border border-border-tint text-primary hover:bg-primary-tint',
  review: 'border border-purple-200 text-purple-600 hover:bg-purple-50',
  success: 'border border-success/30 text-success hover:bg-success/5',
  share: 'border border-purple-200 text-purple-500 hover:bg-purple-50',
  warning: 'border border-warning text-warning hover:bg-amber-50',
  muted: 'border border-border text-foreground-secondary hover:bg-surface-secondary',
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
    <div className={direction === 'row' ? 'mt-4 flex flex-wrap gap-2.5 pb-5' : 'flex flex-col gap-2.5'}>
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
