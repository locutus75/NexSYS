/**
 * features/PlaceholderPage.tsx
 * Generic placeholder for screens not yet implemented.
 */

interface Props {
  title: string;
  description: string;
  mvp?: string;
}

export function PlaceholderPage({ title, description, mvp }: Props) {
  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="flex items-center gap-4" style={{ opacity: 0.6 }}>
          <span style={{ fontSize: "2.5rem" }}>🚧</span>
          <div>
            <div className="font-semibold text-secondary">Coming soon</div>
            {mvp && <div className="text-xs text-muted mt-1">Planned for {mvp}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
