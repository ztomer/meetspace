export function MeetspaceLogo({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <img
      src="/logo.svg"
      alt="Meetspace"
      className={className}
      data-compact={compact ? "true" : undefined}
    />
  );
}
