import { useState } from "react";
import { WarningBox } from "../shared/WarningBox";

interface Props {
  update: any | null;
  onClose: () => void;
  onInstall: () => Promise<void>;
}

export function UpdatePromptModal({ update, onClose, onInstall }: Props) {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipVersion, setSkipVersion] = useState(false);

  if (!update) return null;

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      await onInstall();
    } catch (err: any) {
      setError(err.message || String(err));
      setInstalling(false);
    }
  };

  const handleClose = () => {
    if (skipVersion) {
      localStorage.setItem("nexsys_skipped_update_version", update.version);
    }
    onClose();
  };

  return (
    <div 
      className="dialog-overlay" 
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !installing) {
          handleClose();
        }
      }} 
      style={{ zIndex: 10000 }}
    >
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header" style={{ justifyContent: "space-between", width: "100%", marginBottom: "16px" }}>
          <h3 className="dialog__title" style={{ margin: 0 }}>Update Available</h3>
          {!installing && (
            <button className="btn btn-ghost btn-sm" onClick={handleClose} style={{ padding: "0 8px", fontSize: "20px" }}>×</button>
          )}
        </div>
        
        <div>
          <p className="mb-4">
            A new version of NexSYS (<strong>v{update.version}</strong>) is available. Would you like to install it now?
          </p>
          
          {update.body && (
            <div className="mb-4 p-3 bg-base-200 rounded text-sm text-secondary" style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {update.body}
            </div>
          )}

          {error && <WarningBox severity="danger" className="mb-4">{error}</WarningBox>}

          {!installing && (
            <div className="mb-4 flex items-center gap-2">
              <input 
                type="checkbox" 
                id="skip-update"
                checked={skipVersion}
                onChange={(e) => setSkipVersion(e.target.checked)}
                className="checkbox checkbox-primary"
              />
              <label htmlFor="skip-update" className="text-sm text-secondary cursor-pointer">
                Don't ask again for this version
              </label>
            </div>
          )}

          <div className="dialog__actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleClose}
              disabled={installing}
            >
              No, later
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? "Installing & Relaunching..." : "Yes, Install now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
