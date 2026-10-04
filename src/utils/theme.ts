export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "fuelguard-theme";

/** Runs in <head> before first paint so a saved dark theme doesn't flash light on load. */
export const themeInitScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})==="dark")document.documentElement.dataset.theme="dark"}catch(e){}})()`;
