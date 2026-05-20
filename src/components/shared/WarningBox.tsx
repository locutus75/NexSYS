/**
 * components/shared/WarningBox.tsx
 * Reusable inline alert/warning box.
 */

interface Props {
  severity?: "info" | "warn" | "danger" | "success";
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const ICONS = {
  info:    "ℹ️",
  warn:    "⚠️",
  danger:  "🚫",
  success: "✅",
};

export function WarningBox({ severity = "warn", title, children, className = "" }: Props) {
  return (
    <div className={`alert alert--${severity} ${className}`} role="alert">
      <span className="alert__icon">{ICONS[severity]}</span>
      <div className="alert__body">
        {title && <div className="alert__title">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}
