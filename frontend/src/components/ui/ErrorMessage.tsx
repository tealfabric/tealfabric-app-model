export function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-error/30 bg-[var(--color-error-subtle)] px-3 py-2 text-small text-error"
    >
      {message}
    </div>
  );
}
