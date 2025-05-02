// Language code mapping dictionary between ISO codes and chat API codes
const languageCodeMapping: Record<string, string> = {
  "en": "eng_Latn",
  "hi": "hin_Deva",
  "bn": "ben_Beng",
  "gu": "guj_Gujr",
  "kn": "kan_Knda",
  "ml": "mal_Mlym",
  "mr": "mar_Deva",
  "pa": "pan_Guru",
  "ta": "tam_Taml",
  "te": "tel_Telu",
  "ur": "urd_Arab"
};

interface ApiEndpoint {
  url: string;
  method: string;
}

interface ApiConfiguration {
  chatInitiate: ApiEndpoint;
  responseStatus: ApiEndpoint;
}

// API configuration
let apiConfig: ApiConfiguration = {
  chatInitiate: {
    url: 'https://hindai.codewizzz.com/chat/initiate',
    method: 'POST'
  },
  responseStatus: {
    url: 'https://hindai.codewizzz.com/chat/response-status',
    method: 'POST'
  }
};

/**
 * Configure API endpoints
 */
export const configureApiEndpoints = (baseUrl: string): void => {
  if (baseUrl) {
    apiConfig.chatInitiate.url = `https://hindai.codewizzz.com/chat/initiate`;
    apiConfig.responseStatus.url = `https://hindai.codewizzz.com/chat/response-status`;
    // console.log(`API endpoints configured with base URL: ${baseUrl}`);
  }
};

/**
 * Convert standard language codes to chat API specific codes
 */
export const getChatApiLanguageCode = (standardCode: string): string => {
  const baseCode = standardCode.split('-')[0];
  return languageCodeMapping[baseCode] || baseCode;
};

/**
 * Helper function to find response text in API responses
 */
export const findResponseText = (data: Record<string, any>): string => {
  for (const key in data) {
    if (['id', 'response_id', 'status', 'chat_id'].includes(key)) continue;
    if (typeof data[key] === 'string' && data[key].length > 5) {
      return data[key];
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      for (const innerKey in data[key]) {
        if (typeof data[key][innerKey] === 'string' && data[key][innerKey].length > 5) {
          return data[key][innerKey];
        }
      }
    }
  }
  return JSON.stringify(data);
};

/**
 * Get response status using response_id
 */
export const getResponseStatus = async (responseId: string): Promise<string> => {
  try {
    // console.log(`Fetching response status for ID: ${responseId}`);
    
    const payload = { response_id: responseId };
    const response = await fetch(apiConfig.responseStatus.url, {
      method: apiConfig.responseStatus.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    // console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data: Record<string, any> = await response.json();
    // console.log(`Raw response data:, data`);
    
    let responseText = '';
    
    if (data.response) {
      responseText = data.response;
    } else if (data.message) {
      responseText = data.message;
    } else if (data.result) {
      responseText = data.result;
    } else if (data.status === 'completed' && data.data) {
      responseText = data.data.response || data.data.message || JSON.stringify(data.data);
    } else if (data.status === 'completed') {
      if (data.response_text) {
        responseText = data.response_text;
      } else {
        responseText = findResponseText(data);
      }
    } else if (data.status === 'processing' || data.status === 'pending') {
      // console.log(`Status is ${data.status}, waiting 2 seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return getResponseStatus(responseId);
    } else {
      responseText = findResponseText(data) || `Received response: ${JSON.stringify(data)}`;
    }
    
    // console.log(`FINAL RESPONSE TEXT (ID: ${responseId}):, responseText`);
    
    return responseText;
  } catch (error) {
    // console.error('Error getting response status:', error);
    return 'Error: Could not get AI response. Please try again.';
  }
};

// Import your utility
import { getLanguageName } from '../utils/languageUtils';

/**
 * Translate text to English using Google Translate API (unofficial)
 * @param text - The text to translate
 * @param sourceLanguage - Source language code (or 'auto' for auto-detection)
 * @returns The translated text in English
 */
const translateToEnglish = async (text: string, sourceLanguage: string = 'auto'): Promise<string> => {
  try {
    // Don't translate if text is empty or already in English
    if (!text.trim() || sourceLanguage === 'en' || sourceLanguage === 'eng_Latn') {
      return text;
    }

    // Encode the text for URL
    const encodedText = encodeURIComponent(text);
    
    // Build the Google Translate API URL
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=en&dt=t&q=${encodedText}`;
    
    // console.log(`[TRANSLATION] Requesting translation from ${sourceLanguage} to English`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Translation API Error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Google Translate returns a nested array structure
    // The translated text is in the first position of each inner array
    if (data && Array.isArray(data) && data[0] && Array.isArray(data[0])) {
      // Extract and join all the translated pieces
      const translatedText = data[0]
        .filter(chunk => chunk && chunk[0])
        .map(chunk => chunk[0])
        .join('');
      
      // console.log(`[TRANSLATION] Original: "${text}"`);
      // console.log(`[TRANSLATION] Translated: "${translatedText}"`);
      
      return translatedText;
    }
    
    // console.warn('[TRANSLATION] Unexpected response format, returning original text');
    return text;
  } catch (error) {
    // console.error('Translation error:', error);
    return text; // fallback: return original if translation fails
  }
};

/**
 * Get ISO language code from chat API language code
 */
const getISOLanguageCode = (chatApiLanguageCode: string): string => {
  // Find the ISO code that maps to this chat API code
  for (const [iso, api] of Object.entries(languageCodeMapping)) {
    if (api === chatApiLanguageCode) {
      return iso;
    }
  }
  // Default to 'auto' if not found
  return 'auto';
};

/**
 * Send text to chat API
 */
export const sendTextToChat = async (text: string, chatApiLanguageCode: string): Promise<{ text: string, id: string }> => {
  try {
    // console.log(`[PROCESS] Chat API using language code: ${chatApiLanguageCode}`);
    
    // Get ISO language code for translation
    const sourceISOCode = getISOLanguageCode(chatApiLanguageCode);
    
    // Translate text to English before sending
    const englishText = await translateToEnglish(text, sourceISOCode);
    
    const payload = {
      username: "user",
      language_code: chatApiLanguageCode,
      language_name: getLanguageName(chatApiLanguageCode),
      enable_search: false,
      message: englishText // Always sending English version
    };
    
    // console.log(`[DEBUG] Sending payload to chat/initiate:`, payload);
    
    const response = await fetch(apiConfig.chatInitiate.url, {
      method: apiConfig.chatInitiate.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    // console.log(`[DEBUG] Chat initiate response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data: Record<string, any> = await response.json();
    // console.log(`[DEBUG] Chat initiate raw response:, data`);
    
    let responseId: string | null = null;
    
    if (data.response_id) {
      responseId = data.response_id;
    } else if (data.id) {
      responseId = data.id;
    } else if (data.task_id) {
      responseId = data.task_id;
    } else {
      for (const key in data) {
        if (typeof data[key] === 'string' && (key.toLowerCase().includes('id') || key.toLowerCase().includes('response'))) {
          responseId = data[key];
          break;
        }
      }
    }
    
    if (responseId) {
      // console.log(`[DEBUG] Getting response text for ID: ${responseId}`);
      const responseText = await getResponseStatus(responseId);
      // console.log(`[RESPONSE] Final response text: "${responseText}"`);
      return { text: responseText, id: responseId };
    } else {
      throw new Error('No response ID found in API response');
    }
  } catch (error) {
    // console.error('Error sending message to chat API:', error);
    return { text: 'Error: Could not send message to AI. Please try again.', id: '' };
  }
};