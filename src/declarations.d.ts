// Type declarations for external libraries without TypeScript definitions

// For CSS/SCSS modules
declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// Extend Window interface to add AudioContext
interface Window {
  webkitAudioContext: typeof AudioContext;
}

// Add missing navigator method for MS browsers
interface Navigator {
  msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean;
}