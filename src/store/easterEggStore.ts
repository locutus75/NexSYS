import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EasterEggState {
  isConfigOpen: boolean;
  jitter: number;
  baseLength: number;
  maxDepthBase: number;
  branchProbBase: number;
  spawnDelayBase: number;
  soundEnabled: boolean;
  soundVolume: number;
  soundPitch: number;
  soundCrackle: number;
  
  setConfigOpen: (open: boolean) => void;
  updateParam: (param: keyof EasterEggState, value: number | boolean) => void;
  resetDefaults: () => void;
}

const DEFAULTS = {
  jitter: 0.4,
  baseLength: 40,
  maxDepthBase: 12,
  branchProbBase: 0.02,
  spawnDelayBase: 400,
  soundEnabled: true,
  soundVolume: 0.5,
  soundPitch: 40,
  soundCrackle: 0.8,
};

export const useEasterEggStore = create<EasterEggState>()(
  persist(
    (set) => ({
      isConfigOpen: false,
      ...DEFAULTS,
      
      setConfigOpen: (open) => set({ isConfigOpen: open }),
      
      updateParam: (param, value) => set((state) => ({ ...state, [param]: value })),
      
      resetDefaults: () => set((state) => ({
        ...state,
        ...DEFAULTS
      })),
    }),
    {
      name: 'nexsys-easteregg-storage',
      partialize: (state) => ({
        jitter: state.jitter,
        baseLength: state.baseLength,
        maxDepthBase: state.maxDepthBase,
        branchProbBase: state.branchProbBase,
        spawnDelayBase: state.spawnDelayBase,
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume,
        soundPitch: state.soundPitch,
        soundCrackle: state.soundCrackle,
      }),
    }
  )
);
