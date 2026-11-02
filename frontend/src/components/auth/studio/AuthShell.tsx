type AuthShellProps = {
  children: React.ReactNode;
  wide?: boolean;
};

/** Width constraint for auth form content. */
export function AuthShell({ children, wide = false }: AuthShellProps) {
  return (
    <div className={`mx-auto w-full ${wide ? "max-w-4xl" : "max-w-lg"}`}>{children}</div>
  );
}
