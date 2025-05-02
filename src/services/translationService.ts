import { stripRegion } from '../utils/languageUtils';

/**
 * Translate text using Google Translate API
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code (e.g., "en-IN" or "en")
 * @returns {Promise<string>} Translated text
 */
export const translateText = async (text: string, targetLanguage: string, p0: string): Promise<string> => {
  // console.log(`translateText function called with targetLanguage=${targetLanguage}, text="${text}"`);
  
  // Add this part to debug the language code
  if (targetLanguage === "en") {
    // console.warn("WARNING: Target language is still set to English (en)");
  } else {
    // console.log(`Using non-English target language: ${targetLanguage}`);
  }

  // This is the critical point - make sure we're getting the right language code
  if (targetLanguage !== 'en') {
    // console.log(`Non-English language detected: ${targetLanguage}`);
  }

  // console.log(`Translating text to ${targetLanguage}: "${text}"`);
  
  try {
    // If source and target languages are the same, return the original text
    // Important: Only skip if the target language is actually English, don't auto-detect
    if (targetLanguage === 'en') {
      // console.log("Target language is English, skipping translation");
      return text;
    }

    // URL encode the text
    const encodedText = encodeURIComponent(text);
    
    // Use Google Translate API
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLanguage}&dt=t&q=${encodedText}`;
    // console.log(`Making translation request to: ${url}`);
      
    const response = await fetch(url, { 
      // Add headers to help with CORS issues
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*'
      }
    });
    
    if (!response.ok) {
      // console.error(`Google Translate API error: ${response.status}`);
      throw new Error(`Translation API error: ${response.status}`);
    }
    
    const data = await response.json();
    // console.log("Translation API response:", data);
    
    // Extract translated text
    if (data && Array.isArray(data[0])) {
      let translatedText = '';
      
      // Google Translate returns an array of arrays where each inner array contains
      // the translated segment at index 0
      for (let i = 0; i < data[0].length; i++) {
        if (data[0][i][0]) {
          translatedText += data[0][i][0];
        }
      }
      
      // console.log(`Translation result: "${translatedText}"`);
      return translatedText;
    } else {
      // console.error("Unexpected translation API response format");
      throw new Error("Unexpected translation API response format");
    }
  } catch (error) {
    // console.error("Error translating text:", error);
    
    // Try alternative translation approach
    try {
      // console.log("Trying alternative translation method...");
      const altUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
      
      const altResponse = await fetch(altUrl);
      if (altResponse.ok) {
        const altData = await altResponse.json();
        if (Array.isArray(altData) && altData.length > 0) {
          // console.log(`Alternative translation result: "${altData[0]}"`);
          return altData[0];
        }
      }
    } catch (altError) {
      // console.error("Alternative translation failed:", altError);
    }
    
    // Return the original text if all translation methods fail
    return text;
  }
};