import React, { useState, useEffect, useRef } from "react";
import { getTtsCode } from '../utils/languageUtils';

type StatusType = "info" | "success" | "error" | "";

interface TextToSpeechProps {
  responseId: string;
  languageCode?: string;
  onComplete?: () => void;
}

/**
 * Removes asterisk characters but keeps the content between them
 * @param text The text to process
 * @returns The text with asterisk characters removed
 */
const removeAsterisks = (text: string): string => {
  // Replace all asterisk characters with nothing, keeping the content
  return text.replace(/\*/g, '');
};

/**
 * Removes hashtag characters but keeps the content around them
 * @param text The text to process
 * @returns The text with hashtag characters removed
 */
const removeHashtags = (text: string): string => {
  // Replace all hashtag characters with nothing, keeping the content
  return text.replace(/#/g, '');
};

/**
 * Removes both asterisks and hashtags from text
 * @param text The text to process
 * @returns The text with asterisks and hashtags removed
 */
const cleanFormattingSymbols = (text: string): string => {
  // First remove asterisks
  let cleaned = text.replace(/\*/g, '');
  // Then remove hashtags
  cleaned = cleaned.replace(/#/g, '');
  return cleaned;
};

const TextToSpeech: React.FC<TextToSpeechProps> = ({ 
  responseId, 
  languageCode = "en",
  onComplete 
}) => {
  const API_URL = "https://texttospeech.codewizzz.com";
  const RESPONSE_API_URL = "https://hindai.codewizzz.com/chat";

  const [text, setText] = useState<string>("");
  const [language, setLanguage] = useState<string>(languageCode);
  const [status, setStatus] = useState<{ message: string; type: StatusType }>({
    message: "",
    type: "",
  });
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const handleAudioEnded = () => {
    // console.log('Audio playback ended');
    if (onComplete) {
      // console.log('Calling onComplete callback');
      onComplete();
    }
  };
  
  const handleAudioError = (event: ErrorEvent) => {
    // console.error('Audio playback error:', event);
    updateStatus('Error playing audio', 'error');
  };
  
  useEffect(() => {
    // console.log(`TextToSpeech received responseId: ${responseId}, language: ${languageCode}`);
  
    // Function to handle audio playback
    const playAudio = async () => {
      if (audioRef.current && audioUrl) {
        try {
          // console.log('Auto-playing audio response');
          
          // Set up event handlers before attempting playback
          audioRef.current.onplay = () => {
            // console.log('Audio playback started');
            // Dispatch a custom event that VoiceToVoiceInterface can listen for
            window.dispatchEvent(new CustomEvent('assistantAudioStart'));
          };
          
          audioRef.current.onended = () => {
            // console.log('Audio playback ended');
            // Dispatch a custom event that VoiceToVoiceInterface can listen for
            window.dispatchEvent(new CustomEvent('assistantAudioEnd'));
            if (onComplete) {
              onComplete();
            }
          };
          
          audioRef.current.onerror = (e) => {
            // console.error('Audio playback error:', e);
            if (onComplete) {
              onComplete();
            }
          };
          
          // Load the source
          audioRef.current.src = audioUrl;
          audioRef.current.load();
          
          // Play after a short delay to ensure loading has started
          setTimeout(() => {
            const playPromise = audioRef.current?.play();
            if (playPromise) {
              playPromise.catch(e => {
                // console.error('Failed to auto-play audio:', e);
                // Many browsers require user interaction before audio can play
                // console.log('User interaction may be required for audio playback');
              });
            }
          }, 300);
        } catch (error) {
          // console.error('Error setting up audio playback:', error);
        }
      }
    };
    
    // When audioUrl changes (meaning we have a new audio file), try to play it
    if (audioUrl) {
      playAudio();
    }
    
  }, [audioUrl, onComplete]);
      
  useEffect(() => {
    // console.log(`TextToSpeech received responseId: ${responseId}, language: ${languageCode}`);
  
    // Stop any previous audio playing when new responseId comes
    if (audioRef.current) {
      // console.log('Stopping previous audio playback');
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioUrl(null); // Clear old audio source
  
    if (languageCode) {
      const ttsCode = getTtsCode(languageCode);
      // console.log(`Setting language to: ${ttsCode} (from ${languageCode})`);
      setLanguage(ttsCode);
    }
  
    if (responseId) {
      fetchResponseText();
    }
  }, [responseId, languageCode]);
  
  const fetchResponseText = async () => {
    if (!responseId) return;

    setIsLoading(true);
    updateStatus("Fetching response text...", "info");

    try {
      const response = await fetch(`/response-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ response_id: responseId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch response: ${response.status}`);
      }

      const data = await response.json();

      let responseText = '';
      if (data.response) {
        responseText = data.response;
      } else if (data.message) {
        responseText = data.message;
      } else if (data.result) {
        responseText = data.result;
      } else if (typeof data === 'string') {
        responseText = data;
      } else {
        responseText = JSON.stringify(data);
      }

      if (responseText) {
        setText(responseText);
        updateStatus("Response text loaded. Converting to speech...", "success");
        await convertTextToSpeech(responseText);
      } else {
        updateStatus("No text found in the response", "error");
        setIsLoading(false);
      }
    } catch (error: any) {
      updateStatus(`Error: ${error.message}`, "error");
      // console.error("Error fetching response text:", error);
      setIsLoading(false);
    }
  };

  const convertTextToSpeech = async (textToSpeak: string = text) => {
    if (!textToSpeak.trim()) {
      updateStatus("No text available to convert", "error");
      return;
    }

    updateStatus("Converting text to speech...", "info");
    setIsLoading(true);

    try {
      // Remove formatting symbols before processing for speech
      const cleanedText = cleanFormattingSymbols(textToSpeak);
      // console.log(`Original text: "${textToSpeak}"`);
      // console.log(`Cleaned text for speech: "${cleanedText}"`);
      
      // Determine the correct language for TTS based on the text
      const detectedLanguage = await detectTextLanguage(cleanedText);
      const currentLanguage = detectedLanguage || language;
      
      // console.log(`Converting text to speech in language: ${currentLanguage}`);
      
      const payload = {
        text: cleanedText.trim(), // Use the cleaned text here
        language: currentLanguage,
      };
      
      // console.log(`Sending TTS payload:`, payload);

      const response = await fetch(`/text-to-speech`, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: { download_url?: string; filename?: string } = await response.json();

      if (!data.download_url || !data.filename) {
        throw new Error("Invalid response from server");
      }

      setAudioUrl(`${API_URL}${data.download_url}`);
      setFilename(data.filename);
      updateStatus("Speech generated successfully!", "success");
    } catch (error: any) {
      updateStatus(`Error: ${error.message}`, "error");
      // console.error("Error converting text to speech:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add this helper function to detect text language
  const detectTextLanguage = async (text: string): Promise<string | null> => {
    // Simple heuristic: if the text contains Devanagari characters, it's likely Hindi
    const devanagariPattern = /[\u0900-\u097F]/;
    if (devanagariPattern.test(text)) {
      return "hi";
    }
    
    // For other languages, you might need more sophisticated detection
    // or rely on the language prop passed to the component
    return null;
  };

  const updateStatus = (message: string, type: StatusType) => {
    setStatus({ message, type });
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-gray-100 p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Text to Speech</h1>

        <div className="mb-4 p-4 bg-white rounded-md border border-gray-200">
          <h3 className="text-lg font-medium mb-2 text-gray-700">Response Text:</h3>
          <p className="text-gray-900 whitespace-pre-wrap">{text || "Loading response text..."}</p>
        </div>

        {/* {isLoading && (
          <div className="flex justify-center my-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
          </div>
        )} */}

        {status.message && (
          <div
            className={`mt-6 p-4 rounded-md ${
              status.type === "error" 
                ? "bg-red-100 text-red-700" 
                : status.type === "success" 
                  ? "bg-green-100 text-green-700" 
                  : "bg-blue-100 text-blue-700"
            }`}
          >
            {status.message}
          </div>
        )}

        {audioUrl && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2 text-gray-700">Audio Playback:</h3>
            <audio 
              ref={audioRef} 
              className="hidden" // Hide the audio element initially
              onEnded={handleAudioEnded}
            >
              <source src={audioUrl} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
            {filename && (
              <a
                href={audioUrl}
                download={filename}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download Audio File
              </a>
            )}
            <div className="mt-4">
              <button
                onClick={() => audioRef.current?.play()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Play Response
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextToSpeech;