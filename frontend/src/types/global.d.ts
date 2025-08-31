declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

// Fix for setTimeout return type
declare var setTimeout: (
  callback: (...args: any[]) => void,
  ms?: number,
  ...args: any[]
) => number;

declare var setInterval: (
  callback: (...args: any[]) => void,
  ms?: number,
  ...args: any[]
) => number;

declare var clearTimeout: (id: number) => void;
declare var clearInterval: (id: number) => void;

// Fix for vitest globals
declare var describe: any;
declare var it: any;
declare var expect: any;
declare var beforeEach: any;
declare var vi: any;

export {};
