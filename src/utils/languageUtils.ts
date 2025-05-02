/**
 * Complete language mapping with all formats needed across the application
 */
interface LanguageInfo {
  name: string;
  uiCode: string;      // UI selection code (e.g., "hi")
  chatApiCode: string; // Chat API code (e.g., "hin_Deva")
  ttsCode: string;     // TTS API code (e.g., "hi")
  flag: string;
}

// Master mapping of all language formats - WITHOUT "-IN" suffixes
export const languageMapping: Record<string, LanguageInfo> = {
  // Key is the UI code without "-IN" suffix
  "en": { name: "English", uiCode: "en", chatApiCode: "eng_Latn", ttsCode: "en", flag: "🇺🇸" },
  "hi": { name: "Hindi", uiCode: "hi", chatApiCode: "hin_Deva", ttsCode: "hi", flag: "🇮🇳" },
  "bn": { name: "Bengali", uiCode: "bn", chatApiCode: "ben_Beng", ttsCode: "bn", flag: "🇮🇳" },
  "gu": { name: "Gujarati", uiCode: "gu", chatApiCode: "guj_Gujr", ttsCode: "gu", flag: "🇮🇳" },
  "kn": { name: "Kannada", uiCode: "kn", chatApiCode: "kan_Knda", ttsCode: "kn", flag: "🇮🇳" },
  "ml": { name: "Malayalam", uiCode: "ml", chatApiCode: "mal_Mlym", ttsCode: "ml", flag: "🇮🇳" },
  "mr": { name: "Marathi", uiCode: "mr", chatApiCode: "mar_Deva", ttsCode: "mr", flag: "🇮🇳" },
  "pa": { name: "Punjabi", uiCode: "pa", chatApiCode: "pan_Guru", ttsCode: "pa", flag: "🇮🇳" },
  "ta": { name: "Tamil", uiCode: "ta", chatApiCode: "tam_Taml", ttsCode: "ta", flag: "🇮🇳" },
  "te": { name: "Telugu", uiCode: "te", chatApiCode: "tel_Telu", ttsCode: "te", flag: "🇮🇳" },
  "ur": { name: "Urdu", uiCode: "ur", chatApiCode: "urd_Arab", ttsCode: "ur", flag: "🇵🇰" },
};

/**
 * Function to strip region from language codes (e.g., "en-IN" → "en")
 */
export const stripRegion = (code: string): string => {
  if (!code) return "en"; // Default fallback
  return code.split('-')[0];
};

/**
 * Lookup by UI code (with automatic region stripping)
 */
export const getLanguageInfo = (code: string): LanguageInfo => {
  if (!code) return languageMapping["en"]; // Default fallback
  
  // Strip region code if present
  const simplifiedCode = stripRegion(code);
  
  // Direct lookup with simplified code
  if (languageMapping[simplifiedCode]) {
    return languageMapping[simplifiedCode];
  }
  
  // Try to match by ttsCode or chatApiCode
  for (const info of Object.values(languageMapping)) {
    if (info.ttsCode === simplifiedCode || info.chatApiCode === simplifiedCode) {
      return info;
    }
  }
  
  // Default to English
  return languageMapping["en"];
};

/**
 * Convert UI code to Chat API code
 */
export const getChatApiCode = (code: string): string => {
  return getLanguageInfo(code).chatApiCode;
};

/**
 * Add this mapping specifically for converting chat API codes to TTS codes
 */
const chatApiToTtsMapping: Record<string, string> = {
  "eng_Latn": "en",
  "hin_Deva": "hi",
  "ben_Beng": "bn",
  "guj_Gujr": "gu",
  "kan_Knda": "kn",
  "mal_Mlym": "ml",
  "mar_Deva": "mr",
  "pan_Guru": "pa",
  "tam_Taml": "ta",
  "tel_Telu": "te",
  "urd_Arab": "ur"
};

/**
 * Update your getTtsCode function to handle chat API codes
 */
export const getTtsCode = (code: string): string => {
  // First check if this is a chat API code format (contains underscore)
  if (code.includes('_')) {
    const ttsCode = chatApiToTtsMapping[code];
    if (ttsCode) {
      return ttsCode;
    }
  }
  
  // Handle UI codes with region
  if (code.includes('-')) {
    const baseCode = code.split('-')[0];
    return baseCode;
  }
  
  // If it's already a simple code or we couldn't convert it
  return code || 'en';
};

/**
 * Get language name from any code format
 */
export const getLanguageName = (code: string): string => {
  return getLanguageInfo(code).name;
};

/**
 * Convert any code format to UI code
 */
export const getUiCode = (code: string): string => {
  return getLanguageInfo(code).uiCode;
};

/**
 * Normalize language code (strip region and ensure valid code)
 */
export const normalizeLanguageCode = (code: string): string => {
  return getLanguageInfo(code).uiCode;
};