interface StatusBadgeProps {
  children: string;
}

export function StatusBadge({ children }: StatusBadgeProps) {
  return <span>{children}</span>;
}
