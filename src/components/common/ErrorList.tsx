interface ErrorListProps {
  errors: string[];
}

export function ErrorList({ errors }: ErrorListProps) {
  if (errors.length === 0) return null;

  return (
    <div className="form-error" role="alert">
      {errors.map((error) => (
        <p key={error}>{error}</p>
      ))}
    </div>
  );
}
