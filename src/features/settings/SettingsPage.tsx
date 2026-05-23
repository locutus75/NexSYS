/**
 * features/settings/SettingsPage.tsx
 * RPC connection configuration for local + remote Syscoin Core nodes.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Wallet } from "ethers";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import type { RpcConfig } from "../../types/network";
import { validatePassword } from "../../services/cryptoService";

export function SettingsPage() {
  const { rpcConfig, updateRpcConfig, activeNetwork, evmAddress, setEvmAddress, isCredentialsSaved, saveCredentials, clearCredentials } = useNetworkStore();
  const [form, setForm] = useState<RpcConfig>({ ...rpcConfig });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [inTauri, setInTauri] = useState<boolean | null>(null);
  
  // EVM Credentials Tab & Form State
  const [credMethod, setCredMethod] = useState<"mnemonic" | "private_key" | "watch_only">("watch_only");
  const [evmForm, setEvmForm] = useState(evmAddress);
  const [evmPrivKeyForm, setEvmPrivKeyForm] = useState("");
  const [evmMnemonicForm, setEvmMnemonicForm] = useState("");
  const [evmPasswordForm, setEvmPasswordForm] = useState("");
  const [showPrivKey, setShowPrivKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [evmSaved, setEvmSaved] = useState(false);
  const [evmError, setEvmError] = useState<string | null>(null);
  const [isNewlyGenerated, setIsNewlyGenerated] = useState(false);

  const handleGenerateSeed = () => {
    try {
      const wallet = Wallet.createRandom();
      if (wallet.mnemonic && wallet.mnemonic.phrase) {
        setEvmMnemonicForm(wallet.mnemonic.phrase);
        setIsNewlyGenerated(true);
        setEvmSaved(false);
        setEvmError(null);
      } else {
        throw new Error("Mnemonic phrase generation failed.");
      }
    } catch (err: any) {
      setEvmError(`Failed to generate seed phrase: ${err.message || String(err)}`);
    }
  };

  const [bgLogoEnabled, setBgLogoEnabled] = useState(() => {
    return localStorage.getItem("nexsys_bg_logo_enabled") !== "false";
  });
  const [bgLogoOpacity, setBgLogoOpacity] = useState(() => {
    return parseFloat(localStorage.getItem("nexsys_bg_logo_opacity") || "0.08");
  });
  const [bgLogoType, setBgLogoType] = useState(() => {
    return localStorage.getItem("nexsys_bg_logo_type") || "icon";
  });

  const [appVersion, setAppVersion] = useState<string>("0.1.0");
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "no-update" | "available" | "downloading" | "installing" | "done" | "error">("idle");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateManifest, setUpdateManifest] = useState<any>(null);

  useEffect(() => {
    import("@tauri-apps/api/core").then(({ isTauri }) => {
      setInTauri(isTauri());
    }).catch(() => setInTauri(false));
  }, []);

  useEffect(() => {
    if (inTauri) {
      import("@tauri-apps/api/app").then(({ getVersion }) => {
        getVersion().then(setAppVersion);
      }).catch((err) => console.error("Error loading app version:", err));
    }
  }, [inTauri]);

  useEffect(() => {
    setEvmForm(evmAddress);
  }, [evmAddress]);

  async function handleCheckForUpdates() {
    setUpdateStatus("checking");
    setUpdateError(null);
    setUpdateManifest(null);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update) {
        setUpdateStatus("available");
        setUpdateManifest(update);
      } else {
        setUpdateStatus("no-update");
      }
    } catch (err: any) {
      console.error("[Updater] Check failed:", err);
      setUpdateStatus("error");
      setUpdateError(err?.message || String(err));
    }
  }

  async function handleInstallUpdate() {
    if (!updateManifest) return;
    setUpdateStatus("downloading");
    setUpdateError(null);

    try {
      await updateManifest.downloadAndInstall((event: any) => {
        if (event && event.event === "Started") {
          setUpdateStatus("downloading");
        } else if (event && event.event === "Finished") {
          setUpdateStatus("installing");
        }
      });

      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err: any) {
      console.error("[Updater] Install failed:", err);
      setUpdateStatus("error");
      setUpdateError(err?.message || String(err));
    }
  }

  function handleChange(key: keyof RpcConfig, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setTestResult(null);
    setTestError(null);
  }

  function handleSave() {
    updateRpcConfig(form);
    setSaved(true);
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    const { SyscoinRpcClient } = await import("../../services/syscoinRpcClient");
    const testClient = new SyscoinRpcClient(form);
    const result = await testClient.pingWithError();
    console.log("[NexSYS] Test connection result:", result);
    if (result.ok) {
      setTestResult("ok");
    } else {
      setTestResult("fail");
      setTestError(result.error);
    }
    setTesting(false);
  }

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure your Syscoin Core RPC connection. Supports local and remote nodes.</p>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="stat-label mb-6">RPC Connection — {activeNetwork}</div>

        {inTauri === false && (
          <WarningBox severity="warn" title="Browser mode detected" className="mb-4">
            You are viewing this page in a regular browser, not the Tauri app window.
            RPC calls will use a local proxy — remote nodes at custom IPs will not work.
            Launch the app with <code>pnpm tauri dev</code> to connect to any node.
          </WarningBox>
        )}

        <WarningBox severity="info" className="mb-6">
          Your RPC password is stored locally on this device only. It is never logged or transmitted to any external service.
        </WarningBox>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div>
            <label className="form-label" htmlFor="rpc-host">Host</label>
            <input
              id="rpc-host"
              className="input mt-2"
              value={form.host}
              placeholder="127.0.0.1 or remote hostname"
              onChange={(e) => handleChange("host", e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="rpc-port">Port</label>
            <input
              id="rpc-port"
              className="input mt-2"
              type="number"
              value={form.port}
              onChange={(e) => handleChange("port", parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="rpc-user">RPC Username</label>
            <input
              id="rpc-user"
              className="input mt-2"
              value={form.username}
              autoComplete="off"
              onChange={(e) => handleChange("username", e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="rpc-pass">RPC Password</label>
            <input
              id="rpc-pass"
              className="input mt-2"
              type="password"
              value={form.password}
              autoComplete="new-password"
              onChange={(e) => handleChange("password", e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="rpc-wallet">Wallet Name (optional)</label>
            <input
              id="rpc-wallet"
              className="input mt-2"
              placeholder="Leave blank for default wallet"
              value={form.walletName ?? ""}
              onChange={(e) => handleChange("walletName", e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <input
              id="rpc-ssl"
              type="checkbox"
              checked={form.useSsl}
              onChange={(e) => handleChange("useSsl", e.target.checked)}
            />
            <label htmlFor="rpc-ssl" className="text-sm text-secondary">Use SSL (HTTPS)</label>
          </div>
        </div>

        {testResult === "ok" && <WarningBox severity="success" className="mt-4">Connection successful!</WarningBox>}
        {testResult === "fail" && (
          <WarningBox severity="danger" title="Connection failed" className="mt-4">
            {testError ?? "Could not reach the node. Check host, port, and credentials."}
          </WarningBox>
        )}
        {saved && !testResult && <WarningBox severity="success" className="mt-4">Settings saved.</WarningBox>}

        <div className="flex gap-3 mt-6">
          <button id="settings-test-btn" className="btn btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? <><div className="spinner" /> Testing…</> : "Test Connection"}
          </button>
          <button id="settings-save-btn" className="btn btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>

      {/* EVM address/credentials card */}
      <div className="card mt-6" style={{ maxWidth: 560 }}>
        <div className="stat-label mb-4">NEVM / Rollux Credentials ({activeNetwork})</div>
        
        <WarningBox severity="info" className="mb-5">
          Your credentials are encrypted using AES-GCM 256-bit and stored locally.
          The master password is required to approve bridge claims and is never saved.
        </WarningBox>

        {isCredentialsSaved && (
          <WarningBox severity="success" className="mb-5" title="Credentials Secured">
            ✓ Natively encrypted wallet configured (Address: <code>{evmAddress}</code>). 
            You can sign SPV Bridge claims directly in-app.
          </WarningBox>
        )}

        {/* Tab Selection */}
        <div className="flex gap-2 mb-5" style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "12px" }}>
          <button
            type="button"
            className={`btn btn-sm ${credMethod === "mnemonic" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setCredMethod("mnemonic"); setEvmError(null); setEvmSaved(false); setIsNewlyGenerated(false); }}
          >
            🔑 Seed Phrase
          </button>
          <button
            type="button"
            className={`btn btn-sm ${credMethod === "private_key" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setCredMethod("private_key"); setEvmError(null); setEvmSaved(false); setIsNewlyGenerated(false); }}
          >
            🔒 Private Key
          </button>
          <button
            type="button"
            className={`btn btn-sm ${credMethod === "watch_only" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setCredMethod("watch_only"); setEvmError(null); setEvmSaved(false); setIsNewlyGenerated(false); }}
          >
            👁 Watch-Only
          </button>
        </div>

        {/* Tab Content */}
        {credMethod === "mnemonic" && (
          <div className="form-group mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="form-label" htmlFor="evm-mnemonic">Mnemonic Seed Phrase (12 or 24 words)</label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: "2px 8px", fontSize: "0.75rem", border: "1px solid var(--color-border)" }}
                onClick={handleGenerateSeed}
              >
                ✨ Generate New Seed
              </button>
            </div>
            <textarea
              id="evm-mnemonic"
              className="input input-mono mt-1 w-full"
              style={{ minHeight: "80px", resize: "vertical", padding: "10px", lineHeight: "1.4" }}
              placeholder="word1 word2 word3..."
              value={evmMnemonicForm}
              autoComplete="off"
              spellCheck={false}
              onChange={e => {
                setEvmMnemonicForm(e.target.value);
                setEvmSaved(false);
                setEvmError(null);
                setIsNewlyGenerated(false);
              }}
            />
            {evmMnemonicForm && !((words => words.length === 12 || words.length === 24)(evmMnemonicForm.trim().split(/\s+/))) && (
              <span className="form-hint text-warning">Must be exactly 12 or 24 words (separated by spaces).</span>
            )}
            {evmMnemonicForm && ((words => words.length === 12 || words.length === 24)(evmMnemonicForm.trim().split(/\s+/))) && (
              <span className="form-hint text-success">Valid mnemonic format ✓</span>
            )}
            {isNewlyGenerated && (
              <WarningBox severity="warn" title="Backup Your Seed Phrase!" className="mt-3">
                <span className="text-xs">
                  This 12-word phrase was generated cryptographically on your device. 
                  Write it down and store it in a safe, offline location. 
                  <strong> If you lose it, your funds are gone forever.</strong>
                </span>
              </WarningBox>
            )}
          </div>
        )}

        {credMethod === "private_key" && (
          <div className="form-group mb-4">
            <label className="form-label" htmlFor="evm-private-key">Private Key</label>
            <div className="flex gap-2 mt-2" style={{ position: "relative" }}>
              <input
                id="evm-private-key"
                type={showPrivKey ? "text" : "password"}
                className="input input-mono flex-1"
                placeholder="Enter 64-character hex private key"
                value={evmPrivKeyForm}
                autoComplete="off"
                spellCheck={false}
                onChange={e => {
                  setEvmPrivKeyForm(e.target.value);
                  setEvmSaved(false);
                  setEvmError(null);
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ minWidth: "60px" }}
                onClick={() => setShowPrivKey(!showPrivKey)}
              >
                {showPrivKey ? "Hide" : "Show"}
              </button>
            </div>
            {evmPrivKeyForm && !((key) => { const clean = key.trim().startsWith("0x") ? key.trim().slice(2) : key.trim(); return clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean); })(evmPrivKeyForm) && (
              <span className="form-hint text-warning">Must be a valid 64-character hex string.</span>
            )}
            {evmPrivKeyForm && ((key) => { const clean = key.trim().startsWith("0x") ? key.trim().slice(2) : key.trim(); return clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean); })(evmPrivKeyForm) && (
              <span className="form-hint text-success">Valid private key format ✓</span>
            )}
          </div>
        )}

        {credMethod === "watch_only" && (
          <div className="form-group mb-4">
            <label className="form-label" htmlFor="evm-address">Watch-Only 0x Address</label>
            <input
              id="evm-address"
              className="input input-mono mt-2"
              placeholder="0x…"
              value={evmForm}
              autoComplete="off"
              spellCheck={false}
              onChange={e => {
                setEvmForm(e.target.value);
                setEvmSaved(false);
                setEvmError(null);
              }}
            />
            {evmForm && !evmForm.startsWith("0x") && (
              <span className="form-hint text-warning">Address must start with 0x</span>
            )}
            {evmForm && evmForm.startsWith("0x") && evmForm.length !== 42 && (
              <span className="form-hint text-warning">Expected 42 characters, got {evmForm.length}</span>
            )}
            {evmForm && evmForm.startsWith("0x") && evmForm.length === 42 && (
              <span className="form-hint text-success">Valid EVM address ✓</span>
            )}
          </div>
        )}

        {/* Master Password Section (Only for Mnemonic/Private Key) */}
        {credMethod !== "watch_only" && (
          <div className="form-group mb-5" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
            <label className="form-label" htmlFor="evm-password">Master Password (For AES-GCM Encryption)</label>
            <div className="flex gap-2 mt-2" style={{ position: "relative" }}>
              <input
                id="evm-password"
                type={showPassword ? "text" : "password"}
                className="input input-mono flex-1"
                placeholder="Choose a strong password"
                value={evmPasswordForm}
                autoComplete="off"
                onChange={e => {
                  setEvmPasswordForm(e.target.value);
                  setEvmSaved(false);
                  setEvmError(null);
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ minWidth: "60px" }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {/* Strength checklist */}
            {(() => {
              const rules = validatePassword(evmPasswordForm);
              return (
                <div className="password-rules-checklist mt-3 p-3 text-xs" style={{ backgroundColor: "rgba(0,0,0,0.15)", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ color: rules.length ? "var(--color-success)" : "#ff4a4a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{rules.length ? "●" : "○"}</span> Minimaal 12 karakters ({evmPasswordForm.length})
                  </div>
                  <div style={{ color: rules.hasUpper ? "var(--color-success)" : "#ff4a4a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{rules.hasUpper ? "●" : "○"}</span> Minimaal 1 hoofdletter (A-Z)
                  </div>
                  <div style={{ color: rules.hasLower ? "var(--color-success)" : "#ff4a4a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{rules.hasLower ? "●" : "○"}</span> Minimaal 1 kleine letter (a-z)
                  </div>
                  <div style={{ color: rules.hasDigit ? "var(--color-success)" : "#ff4a4a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{rules.hasDigit ? "●" : "○"}</span> Minimaal 1 cijfer (0-9)
                  </div>
                  <div style={{ color: rules.hasSpecial ? "var(--color-success)" : "#ff4a4a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{rules.hasSpecial ? "●" : "○"}</span> Minimaal 1 vreemd/speciaal karakter
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {evmError && <WarningBox severity="danger" className="mt-2">{evmError}</WarningBox>}
        {evmSaved && <WarningBox severity="success" className="mt-2">EVM credentials saved successfully.</WarningBox>}

        <div className="flex gap-3 mt-4">
          <button
            id="settings-evm-save-btn"
            className="btn btn-primary"
            disabled={
              (credMethod === "mnemonic" && (!((words => words.length === 12 || words.length === 24)(evmMnemonicForm.trim().split(/\s+/))) || !validatePassword(evmPasswordForm).isValid)) ||
              (credMethod === "private_key" && (!((key) => { const clean = key.trim().startsWith("0x") ? key.trim().slice(2) : key.trim(); return clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean); })(evmPrivKeyForm) || !validatePassword(evmPasswordForm).isValid)) ||
              (credMethod === "watch_only" && (evmForm.length !== 42 || !evmForm.startsWith("0x")))
            }
            onClick={async () => {
              try {
                if (credMethod === "mnemonic") {
                  await saveCredentials("mnemonic", evmMnemonicForm, evmPasswordForm);
                } else if (credMethod === "private_key") {
                  await saveCredentials("private_key", evmPrivKeyForm, evmPasswordForm);
                } else {
                  setEvmAddress(evmForm.trim());
                }
                setEvmSaved(true);
                setEvmError(null);
                setEvmPasswordForm("");
                setEvmMnemonicForm("");
                setEvmPrivKeyForm("");
                setIsNewlyGenerated(false);
              } catch (err: any) {
                setEvmError(`Error saving credentials: ${err.message || String(err)}`);
              }
            }}
          >
            Save Credentials
          </button>
          
          {(evmAddress || isCredentialsSaved) && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                clearCredentials();
                setEvmForm("");
                setEvmMnemonicForm("");
                setEvmPrivKeyForm("");
                setEvmPasswordForm("");
                setIsNewlyGenerated(false);
                setEvmSaved(true);
                setEvmError(null);
              }}
              id="settings-evm-clear-btn"
            >
              Clear Credentials
            </button>
          )}
        </div>
      </div>

      {/* UI Customization */}
      <div className="card mt-6" style={{ maxWidth: 560 }}>
        <div className="stat-label mb-4">UI Customization</div>
        <p className="text-sm text-secondary mb-5">
          Customize the visual experience of your NexSYS Command Center.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <input
              id="bg-logo-toggle"
              type="checkbox"
              checked={bgLogoEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                setBgLogoEnabled(checked);
                localStorage.setItem("nexsys_bg_logo_enabled", checked ? "true" : "false");
                window.dispatchEvent(new Event("nexsys_bg_settings_change"));
              }}
            />
            <label htmlFor="bg-logo-toggle" className="text-sm text-secondary cursor-pointer">
              Enable watermark background logo
            </label>
          </div>

          {bgLogoEnabled && (
            <>
              <div>
                <label className="form-label mb-2 block">Watermark Style</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    className={`btn flex-1 py-3 justify-center ${bgLogoType === "icon" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => {
                      setBgLogoType("icon");
                      localStorage.setItem("nexsys_bg_logo_type", "icon");
                      window.dispatchEvent(new Event("nexsys_bg_settings_change"));
                    }}
                  >
                    ⚡ Icon Only
                  </button>
                  <button
                    type="button"
                    className={`btn flex-1 py-3 justify-center ${bgLogoType === "banner" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => {
                      setBgLogoType("banner");
                      localStorage.setItem("nexsys_bg_logo_type", "banner");
                      window.dispatchEvent(new Event("nexsys_bg_settings_change"));
                    }}
                  >
                    📛 Full Banner
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="form-label" htmlFor="bg-logo-intensity">
                    Watermark Opacity ({Math.round(bgLogoOpacity * 100)}%)
                  </label>
                </div>
                <input
                  id="bg-logo-intensity"
                  type="range"
                  min="0.01"
                  max="0.30"
                  step="0.01"
                  className="w-full cursor-pointer"
                  style={{ width: "100%" }}
                  value={bgLogoOpacity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setBgLogoOpacity(val);
                    localStorage.setItem("nexsys_bg_logo_opacity", val.toString());
                    window.dispatchEvent(new Event("nexsys_bg_settings_change"));
                  }}
                />
                <span className="form-hint text-xs text-muted mt-2 block">
                  Control the visibility of the brand icon. Recommended intensity is between 3% and 12%.
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* App Updates & Versioning */}
      <div className="card mt-6" style={{ maxWidth: 560 }}>
        <div className="stat-label mb-4">App Updates & Versioning</div>
        <p className="text-sm text-secondary mb-5">
          Manage application releases, check current version, and download secure updates.
        </p>

        {inTauri === false ? (
          <WarningBox severity="info" className="mb-2">
            Updates are managed by the operating system or the desktop wrapper. Launch the NexSYS desktop app to check for updates.
          </WarningBox>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-sm font-semibold text-white">Current Version</span>
              <span className="badge" style={{ backgroundColor: "var(--color-bg-tertiary)", color: "var(--color-accent)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.85rem", fontWeight: "bold" }}>
                v{appVersion}
              </span>
            </div>

            {updateStatus === "checking" && (
              <WarningBox severity="info" className="mt-2 animate-pulse">
                🔍 Checking the update servers for new releases...
              </WarningBox>
            )}

            {updateStatus === "no-update" && (
              <WarningBox severity="success" className="mt-2">
                ✓ Your application is up to date! You are running the latest version.
              </WarningBox>
            )}

            {updateStatus === "error" && (
              <WarningBox severity="danger" title="Update Check Failed" className="mt-2">
                {updateError || "An error occurred while checking for updates. Please try again later or check your internet connection."}
              </WarningBox>
            )}

            {updateStatus === "available" && updateManifest && (
              <div className="card" style={{ backgroundColor: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", padding: "var(--space-4)", borderRadius: "6px" }}>
                <div className="text-sm font-bold text-success mb-2">📢 New Update Available: v{updateManifest.version}</div>
                {updateManifest.date && <div className="text-xs text-muted mb-3">Released on: {new Date(updateManifest.date).toLocaleDateString()}</div>}
                {updateManifest.body && (
                  <div className="text-xs text-secondary mb-4" style={{ maxHeight: "150px", overflowY: "auto", padding: "var(--space-3)", backgroundColor: "rgba(0, 0, 0, 0.2)", borderRadius: "4px", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono, monospace)" }}>
                    {updateManifest.body}
                  </div>
                )}
                <button className="btn btn-primary w-full" onClick={handleInstallUpdate}>
                  Download & Install Update
                </button>
              </div>
            )}

            {updateStatus === "downloading" && (
              <WarningBox severity="info" className="mt-2">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className="spinner" />
                  <span>Downloading package updates... Please do not close NexSYS.</span>
                </div>
              </WarningBox>
            )}

            {updateStatus === "installing" && (
              <WarningBox severity="success" className="mt-2">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className="spinner" />
                  <span>Installing update. Relaunching NexSYS...</span>
                </div>
              </WarningBox>
            )}

            {updateStatus !== "checking" && updateStatus !== "downloading" && updateStatus !== "installing" && updateStatus !== "available" && (
              <button
                id="check-updates-btn"
                className="btn btn-secondary w-full"
                onClick={handleCheckForUpdates}
              >
                Check for Updates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Utilities & Support */}
      <div className="card mt-6" style={{ maxWidth: 560 }}>
        <div className="stat-label mb-4">Utilities & Support</div>
        <p className="text-sm text-secondary mb-5">
          Access developer tools, diagnostics reports, and user support guides.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Link
            to="/developer-api"
            className="btn btn-secondary"
            style={{ width: "100%", padding: "var(--space-4)", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ fontSize: "1.2rem", width: "24px", textAlign: "center", fontWeight: "bold" }}>{"{}"}</span>
              <div>
                <div className="text-sm font-semibold text-white">Developer API</div>
                <div className="text-xs text-muted" style={{ marginTop: "2px" }}>Local automation and read/write RPC access</div>
              </div>
            </div>
            <span style={{ color: "var(--color-accent)", fontWeight: "bold", fontSize: "1.2rem" }}>&rarr;</span>
          </Link>

          <Link
            to="/diagnostics"
            className="btn btn-secondary"
            style={{ width: "100%", padding: "var(--space-4)", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ fontSize: "1.2rem", width: "24px", textAlign: "center", fontWeight: "bold" }}>⊕</span>
              <div>
                <div className="text-sm font-semibold text-white">Diagnostics</div>
                <div className="text-xs text-muted" style={{ marginTop: "2px" }}>RPC health checks, logs, and support bundle export</div>
              </div>
            </div>
            <span style={{ color: "var(--color-accent)", fontWeight: "bold", fontSize: "1.2rem" }}>&rarr;</span>
          </Link>

          <Link
            to="/help"
            className="btn btn-secondary"
            style={{ width: "100%", padding: "var(--space-4)", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ fontSize: "1.2rem", width: "24px", textAlign: "center", fontWeight: "bold" }}>?</span>
              <div>
                <div className="text-sm font-semibold text-white">Help & Learn</div>
                <div className="text-xs text-muted" style={{ marginTop: "2px" }}>Syscoin Core user guide and bridge tutorials</div>
              </div>
            </div>
            <span style={{ color: "var(--color-accent)", fontWeight: "bold", fontSize: "1.2rem" }}>&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
