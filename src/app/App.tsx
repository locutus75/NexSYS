/**
 * app/App.tsx
 * Root application shell: sidebar + main content area.
 */

import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import { OverviewPage }         from "../features/overview/OverviewPage";
import { SendPage }             from "../features/send/SendPage";
import { ReceivePage }          from "../features/receive/ReceivePage";
import { NodeStatusPage }       from "../features/node/NodeStatusPage";
import { NetworkSelectorPage }  from "../features/network/NetworkSelectorPage";
import { SettingsPage }         from "../features/settings/SettingsPage";
import { ZkSysPage }            from "../features/zksys/ZkSysPage";
import { RolluxPage }           from "../features/rollux/RolluxPage";
import { TransactionsPage }     from "../features/transactions/TransactionsPage";
import { CoinControlPage }      from "../features/utxos/CoinControlPage";
import { SecurityPage }         from "../features/security/SecurityPage";
import { SentryNodePage }       from "../features/sentry/SentryNodePage";
import { WhereIsMySysPage }     from "../features/where/WhereIsMySysPage";
import { BridgePage }           from "../features/bridge/BridgePage";
import { LightningEasterEgg } from "../components/layout/LightningEasterEgg";
import { PlaceholderPage }      from "../features/PlaceholderPage";
import "./App.css";

export function App() {
  const [bgLogoEnabled, setBgLogoEnabled] = useState(() => {
    return localStorage.getItem("nexsys_bg_logo_enabled") !== "false";
  });
  const [bgLogoOpacity, setBgLogoOpacity] = useState(() => {
    return parseFloat(localStorage.getItem("nexsys_bg_logo_opacity") || "0.08");
  });
  const [bgLogoType, setBgLogoType] = useState(() => {
    return localStorage.getItem("nexsys_bg_logo_type") || "icon";
  });

  useEffect(() => {
    const handleSettingsChange = () => {
      setBgLogoEnabled(localStorage.getItem("nexsys_bg_logo_enabled") !== "false");
      setBgLogoOpacity(parseFloat(localStorage.getItem("nexsys_bg_logo_opacity") || "0.08"));
      setBgLogoType(localStorage.getItem("nexsys_bg_logo_type") || "icon");
    };

    window.addEventListener("nexsys_bg_settings_change", handleSettingsChange);
    return () => {
      window.removeEventListener("nexsys_bg_settings_change", handleSettingsChange);
    };
  }, []);

  // Auto-update check on startup
  useEffect(() => {
    const checkUpdateOnStartup = localStorage.getItem("nexsys_auto_update_startup") !== "false";
    if (!checkUpdateOnStartup) return;

    import("@tauri-apps/api/core").then(({ isTauri }) => {
      if (isTauri()) {
        import("@tauri-apps/plugin-updater").then(({ check }) => {
          check().then(async (update) => {
            if (update) {
              console.log("[Auto-Update] Update found:", update.version, "Downloading & installing...");
              await update.downloadAndInstall();
              console.log("[Auto-Update] Install complete. Relaunching...");
              const { relaunch } = await import("@tauri-apps/plugin-process");
              await relaunch();
            } else {
              console.log("[Auto-Update] No updates found.");
            }
          }).catch(err => {
            console.error("[Auto-Update] Check failed:", err);
          });
        });
      }
    }).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <LightningEasterEgg />
        {bgLogoEnabled && (
          <div 
            className={`app-bg-watermark app-bg-watermark--${bgLogoType}`} 
            style={{ 
              opacity: bgLogoOpacity,
              backgroundImage: `url(${bgLogoType === "banner" ? "/logo_banner.png" : "/logo.png"})` 
            }}
            aria-hidden="true"
          />
        )}
        <Sidebar />
        <main className="app-main" id="main-content">
          <Routes>
            <Route path="/"                element={<OverviewPage />} />
            <Route path="/where-is-my-sys" element={<WhereIsMySysPage />} />
            <Route path="/send"            element={<SendPage />} />
            <Route path="/receive"         element={<ReceivePage />} />
            <Route path="/bridge"          element={<BridgePage />} />
            <Route path="/transactions"    element={<TransactionsPage />} />
            <Route path="/utxos"           element={<CoinControlPage />} />
            <Route path="/node"            element={<NodeStatusPage />} />
            <Route path="/sentry"          element={<SentryNodePage />} />
            <Route path="/zksys"           element={<ZkSysPage />} />
            <Route path="/rollux"          element={<RolluxPage />} />
            <Route path="/security"        element={<SecurityPage />} />
            <Route path="/network"         element={<NetworkSelectorPage />} />
            <Route path="/settings"        element={<SettingsPage />} />
            <Route path="/developer-api"   element={
              <PlaceholderPage
                title="Developer API"
                description="Local read/write API for wallet automation and tooling."
                mvp="MVP 7"
              />
            } />
            <Route path="/diagnostics"     element={
              <PlaceholderPage
                title="Diagnostics"
                description="RPC health checks, log viewer, and support bundle export."
                mvp="MVP 4"
              />
            } />
            <Route path="/help"            element={
              <PlaceholderPage
                title="Help & Learn"
                description="Chain explanations, address format guides, and bridge tutorials."
                mvp="Ongoing"
              />
            } />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
