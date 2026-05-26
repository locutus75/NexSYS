import { useEasterEggStore } from "../../store/easterEggStore";
import "./LightningConfigModal.css";

export function LightningConfigModal() {
  const {
    isConfigOpen,
    setConfigOpen,
    jitter,
    baseLength,
    maxDepthBase,
    branchProbBase,
    spawnDelayBase,
    soundEnabled,
    soundVolume,
    updateParam,
    resetDefaults
  } = useEasterEggStore();

  if (!isConfigOpen) return null;

  return (
    <div 
      className="lightning-config-overlay" 
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          setConfigOpen(false);
        }
      }}
    >
      <div className="lightning-config-modal" onClick={e => e.stopPropagation()}>
        
        <div className="lightning-config-header">
          <h2 className="lightning-config-title">
            <span>⚡️</span> Lightning Configuration
          </h2>
          <button 
            className="lightning-config-close"
            onClick={() => setConfigOpen(false)}
          >
            ✕
          </button>
        </div>

        <div>
          {/* Audio Settings */}
          <div className="lightning-config-section">
            <div className="lightning-config-row">
              <label className="lightning-config-label">Enable Sound</label>
              <input 
                type="checkbox" 
                checked={soundEnabled} 
                onChange={(e) => updateParam('soundEnabled', e.target.checked)}
                className="lightning-config-checkbox"
              />
            </div>
            
            {soundEnabled && (
              <div className="lightning-config-slider-container">
                <div className="lightning-config-slider-header">
                  <span>Volume</span>
                  <span>{Math.round(soundVolume * 100)}%</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.05"
                  value={soundVolume}
                  onChange={(e) => updateParam('soundVolume', parseFloat(e.target.value))}
                  className="lightning-config-slider"
                />
              </div>
            )}
          </div>

          {/* Visual Settings */}
          <div className="lightning-config-slider-container">
            <div className="lightning-config-slider-header">
              <span>Jitter (Smoothness)</span>
              <span>{jitter.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0" max="2" step="0.1"
              value={jitter}
              onChange={(e) => updateParam('jitter', parseFloat(e.target.value))}
              className="lightning-config-slider"
            />
          </div>

          <div className="lightning-config-slider-container">
            <div className="lightning-config-slider-header">
              <span>Base Length (Distance)</span>
              <span>{baseLength}</span>
            </div>
            <input 
              type="range" min="10" max="100" step="5"
              value={baseLength}
              onChange={(e) => updateParam('baseLength', parseInt(e.target.value))}
              className="lightning-config-slider"
            />
          </div>

          <div className="lightning-config-slider-container">
            <div className="lightning-config-slider-header">
              <span>Max Branches (Depth Limit)</span>
              <span>{maxDepthBase}</span>
            </div>
            <input 
              type="range" min="5" max="40" step="1"
              value={maxDepthBase}
              onChange={(e) => updateParam('maxDepthBase', parseInt(e.target.value))}
              className="lightning-config-slider"
            />
          </div>

          <div className="lightning-config-slider-container">
            <div className="lightning-config-slider-header">
              <span>Branch Probability</span>
              <span>{(branchProbBase * 100).toFixed(0)}%</span>
            </div>
            <input 
              type="range" min="0.01" max="0.15" step="0.01"
              value={branchProbBase}
              onChange={(e) => updateParam('branchProbBase', parseFloat(e.target.value))}
              className="lightning-config-slider"
            />
          </div>

          <div className="lightning-config-slider-container">
            <div className="lightning-config-slider-header">
              <span>Spawn Delay (ms)</span>
              <span>{spawnDelayBase}</span>
            </div>
            <input 
              type="range" min="100" max="1000" step="50"
              value={spawnDelayBase}
              onChange={(e) => updateParam('spawnDelayBase', parseInt(e.target.value))}
              className="lightning-config-slider"
            />
          </div>
        </div>

        <div className="lightning-config-footer">
          <button 
            className="lightning-config-reset"
            onClick={resetDefaults}
          >
            Reset to defaults
          </button>
        </div>

      </div>
    </div>
  );
}
