import { useState, useEffect } from 'react';
import './App.css';
import VoiceToVoiceInterface from './components/VoiceToVoiceInterface';
import TextToSpeech from './components/TextToSpeech';
import { configureApiEndpoints } from './services/apiService';
import React from 'react';

function App() {
  // console.log("Rendering App component");
  
  const [translationText, setTranslationText] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('');
  const [responseId, setResponseId] = useState<string>('');
  const [responseLanguage, setResponseLanguage] = useState<string>("en");
  const [showTextToSpeech, setShowTextToSpeech] = useState<boolean>(false);
  const [resetTrigger, setResetTrigger] = useState<number>(Date.now());
  
  // Configure API endpoints
  useEffect(() => {
    // console.log("Configuring API endpoints");
    const apiBaseUrl = document.querySelector('meta[name="api-base-url"]')?.getAttribute('content');
    if (apiBaseUrl) {
      // console.log(`Using API base URL: ${apiBaseUrl}`);
      configureApiEndpoints(apiBaseUrl);
    }
  }, []);

  // Handle translation completion
  const handleTranslationComplete = (translatedText: string) => {
    // console.log(`App: Translation completed: "${translatedText}"`);
    setTranslationText(translatedText);
  };

  // Handle assistant response and trigger TTS
  const handleAssistantResponse = async (response: string, respId: string, languageCode: string) => {
    // console.log(`App: Assistant response received: "${response}" (ID: ${respId}, language: ${languageCode})`);
    setAssistantResponse(response);
    setResponseId(respId);
    setResponseLanguage(languageCode);
    setShowTextToSpeech(true);
  };
  
  // Handle language changes - force a full refresh of the flow
  const handleLanguageChange = (language: string) => {
    // console.log(`App: Language changed to: ${language}`);
    
    // Reset state to trigger a complete refresh of the flow
    setShowTextToSpeech(false);
    setResponseLanguage(language);
    setAssistantResponse('');
    setResponseId('');
    setTranslationText('');
    
    // Force the VoiceToVoiceInterface to reset
    setResetTrigger(Date.now()); // A timestamp to force reset
  };
  
  // Handle when TTS is complete
  const handleTTSComplete = () => {
    // console.log("App: TextToSpeech process completed");
    setShowTextToSpeech(false);
    
    // After audio finishes, reset to be ready for the next interaction
    setTimeout(() => {
      // Reset states but keep the language setting
      setAssistantResponse('');
      setResponseId('');
      setTranslationText('');
    }, 500);
  };

  return (
    <>
      <VoiceToVoiceInterface
        onTranslationComplete={handleTranslationComplete}
        onAssistantResponse={handleAssistantResponse}
        currentLanguage={responseLanguage}
        onLanguageChange={handleLanguageChange}
        resetTrigger={resetTrigger} // Add this prop
      />
      
      {/* TextToSpeech component rendered */}
      {showTextToSpeech && responseId && (
        <div>
          <TextToSpeech 
            key={`tts-${responseLanguage}-${responseId}`} // Force re-render on changes
            responseId={responseId} 
            languageCode={responseLanguage} 
            onComplete={handleTTSComplete}
          />
        </div>
      )}
    </>
  );
}

export default App;