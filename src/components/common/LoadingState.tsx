interface LoadingStateProps {
  message: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  return <p className="loading-state" role="status" aria-live="polite">{message}</p>;
}
