import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { NetworkBadge } from "./NetworkBadge";
import "./Sidebar.css";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  to: string;
  dividerBefore?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "nav-overview",     label: "Overview",          icon: "◉",  to: "/" },
  { id: "nav-whereismysys", label: "Where Is My SYS?",  icon: "🗺", to: "/where-is-my-sys" },
  { id: "nav-send",         label: "Send",               icon: "↑",  to: "/send", dividerBefore: true },
  { id: "nav-receive",      label: "Receive",            icon: "↓",  to: "/receive" },
  { id: "nav-bridge",       label: "Bridge",             icon: "⇄",  to: "/bridge" },
  { id: "nav-transactions", label: "Transactions",       icon: "≡",  to: "/transactions", dividerBefore: true },
  { id: "nav-utxos",        label: "Coin Control",       icon: "⊞",  to: "/utxos" },
  { id: "nav-node",         label: "Node Status",        icon: "⬡",  to: "/node", dividerBefore: true },
  { id: "nav-sentry",       label: "Sentry Node",        icon: "🛡", to: "/sentry" },
  { id: "nav-rollux",       label: "Rollux",             icon: <img src="/rollux.svg" alt="Rollux" style={{width: "16px", height: "16px"}} />, to: "/rollux" },
  { id: "nav-zksys",        label: "zkSYS",              icon: "⚡", to: "/zksys" },
  { id: "nav-security",     label: "Security & Backup",  icon: "🔐", to: "/security", dividerBefore: true },
  { id: "nav-network",      label: "Network",            icon: "🌐", to: "/network" },
  { id: "nav-settings",     label: "Settings",           icon: "⚙",  to: "/settings" },
];

export function Sidebar() {
  const [appVersion, setAppVersion] = useState("v0.1.0-mvp1");

  useEffect(() => {
    import("@tauri-apps/api/core")
      .then(({ isTauri }) => {
        if (isTauri()) {
          import("@tauri-apps/api/app")
            .then(({ getVersion }) => {
              getVersion().then((ver) => setAppVersion(`v${ver}`));
            })
            .catch((err) => console.error("Error loading app version:", err));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <nav className="sidebar" aria-label="Main navigation">
      {/* Logo / Brand */}
      <div className="sidebar__brand sidebar__brand--banner">
        <img 
          src="/logo_banner.png" 
          alt="NexSYS Command Center" 
          className="sidebar__brand-banner-img" 
          style={{ cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" }}
          onMouseDown={(e) => {
            if (e.shiftKey) {
              window.dispatchEvent(new CustomEvent('nexsys:easteregg:config'));
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            window.dispatchEvent(new CustomEvent('nexsys:easteregg:start', { 
              detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            }));
          }}
          onMouseUp={() => window.dispatchEvent(new CustomEvent('nexsys:easteregg:stop'))}
          onMouseLeave={() => window.dispatchEvent(new CustomEvent('nexsys:easteregg:stop'))}
          onTouchStart={(e) => {
            if (e.shiftKey) {
              window.dispatchEvent(new CustomEvent('nexsys:easteregg:config'));
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            window.dispatchEvent(new CustomEvent('nexsys:easteregg:start', { 
              detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            }));
          }}
          onTouchEnd={() => window.dispatchEvent(new CustomEvent('nexsys:easteregg:stop'))}
        />
      </div>

      {/* Network badge & Version */}
      <div className="sidebar__network" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <NetworkBadge />
        <span className="text-muted text-xs" style={{ opacity: 0.6 }}>{appVersion}</span>
      </div>

      {/* Nav links */}
      <div className="sidebar__nav" role="list">
        {NAV_ITEMS.map((item) => (
          <div key={item.id}>
            {item.dividerBefore && <div className="sidebar__divider" />}
            <NavLink
              id={item.id}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `sidebar__item${isActive ? " sidebar__item--active" : ""}`
              }
              role="listitem"
            >
              <span className="sidebar__item-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="sidebar__item-label">{item.label}</span>
            </NavLink>
          </div>
        ))}
      </div>

    </nav>
  );
}
