import React, { useState, useEffect, useRef } from "react";
import LanguageSelector from "./LanguageSelector";
import AudioRecorderWithSilenceDetection from "../utils/audioRecorder";
import { transcribeAudio, getTranscriptionResults } from "../services/transcriptionService";
import { translateText } from "../services/translationService";
import { sendTextToChat } from "../services/apiService";
import { getChatApiCode } from "../utils/languageUtils";

interface VoiceToVoiceInterfaceProps {
  onTranslationComplete: (translatedText: string) => void;
  onAssistantResponse: (response: string, responseId: string, languageCode: string) => void;
  currentLanguage?: string; // Add this
  onLanguageChange?: (language: string) => void; // Add this
  resetTrigger?: number; // Add this prop
}

const VoiceToVoiceInterface: React.FC<VoiceToVoiceInterfaceProps> = ({
  onTranslationComplete,
  onAssistantResponse,
  currentLanguage = "en",
  onLanguageChange,
  resetTrigger
}) => {
  // console.log("Rendering VoiceToVoiceInterface component");
  
  // State variables
  const [selectedLanguage, setSelectedLanguage] = useState<string>(currentLanguage);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSilent, setIsSilent] = useState<boolean>(false);
  const [silenceTimeRemaining, setSilenceTimeRemaining] = useState<number | null>(null);
  const [buttonDisabled, setButtonDisabled] = useState<boolean>(false);
  const [processingState, setProcessingState] = useState<string>("idle"); // idle, recording, processing, playing
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false); // Add this state variable
  const [isPreparingAudio, setIsPreparingAudio] = useState<boolean>(false); // Add this state variable

  // Refs
  const recorderInstanceRef = useRef<AudioRecorderWithSilenceDetection | null>(null);
  const currentSelectedLanguage = useRef(selectedLanguage); // Define a ref to store the current language value

  // Initialize the audio recorder
  useEffect(() => {
    if (!recorderInstanceRef.current) {
      // console.log("Initializing audio recorder");
      recorderInstanceRef.current = new AudioRecorderWithSilenceDetection({
        silenceThreshold: 0.08,
        silenceTimeout: 4000,
        minConsecutiveSilentFrames: 5,
        debug: true,
        onSilenceStart: () => {
          // console.log("Silence started");
          setIsSilent(true);
        },
        onSilenceEnd: () => {
          // console.log("Silence ended");
          setIsSilent(false);
          setSilenceTimeRemaining(null);
        },
        onCountdown: (remaining) => {
          // console.log(`Silence countdown: ${remaining}s`);
          setSilenceTimeRemaining(remaining);
        },
        onRecordingStop: handleRecordingEnd,
        onAudioLevel: (level) => {
          // We could use this for visualizations if needed
        }
      });
    }

    return () => {
      // console.log("Cleaning up audio recorder");
      if (recorderInstanceRef.current) {
        recorderInstanceRef.current.cleanup();
        recorderInstanceRef.current = null;
      }
    };
  }, []);

  // Add this effect to sync selectedLanguage with currentLanguage changes
  useEffect(() => {
    if (currentLanguage && currentLanguage !== selectedLanguage) {
      // console.log(`Syncing selectedLanguage with prop change: ${currentLanguage}`);
      setSelectedLanguage(currentLanguage);
      currentSelectedLanguage.current = currentLanguage; // Update the ref value
    }
  }, [currentLanguage]);

  // Add this effect to handle resets
  useEffect(() => {
    if (resetTrigger) {
      // console.log("VoiceToVoiceInterface: Resetting state due to language change");
      
      // Reset all state variables
      setIsRecording(false);
      setIsProcessing(false);
      setIsSilent(false);
      setSilenceTimeRemaining(null);
      setButtonDisabled(false);
      setProcessingState("idle");
      
      // Stop any ongoing recording
      if (recorderInstanceRef.current) {
        recorderInstanceRef.current.stop();
      }
    }
  }, [resetTrigger]);

  // Add this effect to communicate with the TextToSpeech component
  useEffect(() => {
    // Create an event listener to detect when audio starts playing
    const handleAudioStart = () => {
      // console.log('Assistant audio started playing');
      setIsPlayingAudio(true);
      setIsPreparingAudio(false); // Audio has started, so we're no longer preparing
    };
    
    // Create an event listener to detect when audio stops playing
    const handleAudioEnd = () => {
      // console.log('Assistant audio finished playing');
      setIsPlayingAudio(false);
    };
    
    // Add event listeners to the window
    window.addEventListener('assistantAudioStart', handleAudioStart);
    window.addEventListener('assistantAudioEnd', handleAudioEnd);
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('assistantAudioStart', handleAudioStart);
      window.removeEventListener('assistantAudioEnd', handleAudioEnd);
    };
  }, []);

  // Language change handler
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    // console.log(`VoiceToVoiceInterface: Language changed to: ${newLanguage}`);
    
    // Update both state and ref
    setSelectedLanguage(newLanguage);
    currentSelectedLanguage.current = newLanguage;
    
    // Notify the parent component
    if (onLanguageChange) {
      onLanguageChange(newLanguage);
    }
  };

  const toggleRecording = async () => {
    // console.log(`Toggle recording. Current state: ${isRecording}`);
    if (buttonDisabled) {
      // console.log("Button is disabled, ignoring click");
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      handleStartRecording();
    }
  };

  const handleStartRecording = () => {
    if (recorderInstanceRef.current) {
      // console.log('Starting recording');
      setIsRecording(true);
      setProcessingState("recording");
      recorderInstanceRef.current.startRecording();
    } else {
      // console.error('Recorder instance not initialized');
    }
  };

  const stopRecording = async () => {
    // console.log("Manually stopping recording");
    if (!isRecording) return;
    
    setButtonDisabled(true);
    
    if (recorderInstanceRef.current) {
      // console.log("Stopping recorder instance");
      await recorderInstanceRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  const handleRecordingEnd = async (blob: Blob) => {
    // console.log("Recording ended, processing audio");
    setIsRecording(false);
    setIsSilent(false);
    setSilenceTimeRemaining(null);
    setProcessingState("processing");
    setIsProcessing(true);
    setIsPreparingAudio(true); // Indicate that we're preparing the audio response
    
    try {
      // Step 1: Transcription
      // console.log("Step 1: Starting transcription");
      const taskId = await transcribeAudio(blob);
      // console.log(`Transcription task started, ID: ${taskId}`);
      
      if (!taskId) {
        // console.error("Failed to start transcription - no task ID received");
        throw new Error("Failed to start transcription");
      }
      
      // Step 2: Get transcription results
      // console.log("Step 2: Fetching transcription results");
      let response;
      let completed = false;
      let transcriptText = "";
      
      while (!completed) {
        // console.log("Polling for transcription results...");
        response = await getTranscriptionResults(taskId);
        
        if (response.status === "completed") {
          // console.log("Transcription completed successfully");
          completed = true;
          
          if (response.result?.segments && Array.isArray(response.result.segments)) {
            transcriptText = response.result.segments
              .map((segment) => segment.text || "")
              .join(" ")
              .trim();
            // console.log(`Transcription text: "${transcriptText}"`);
          }
        } else if (response.status === "error") {
          // console.error("Transcription error:", response.error || "Unknown error");
          throw new Error("Error in transcription process");
        } else {
          // console.log(`Transcription status: ${response.status}, waiting...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      
      if (!transcriptText) {
        // console.warn("No speech detected in the recording");
        setProcessingState("idle");
        setIsProcessing(false);
        setButtonDisabled(false);
        return;
      }
      
      // CRITICAL: Log selected language before translation
      // console.log(`CRITICAL: Selected language right before translation: ${currentSelectedLanguage.current}`);
      
      // Step 3: Translate the text
      // console.log(`Step 3: Translating text to ${currentSelectedLanguage.current}`);
      let translatedText;
      try {
        // Force it to use the ref value instead of state
        // console.log(`DEBUG: About to translate with language code: ${currentSelectedLanguage.current}`);
        translatedText = await translateText(transcriptText, currentSelectedLanguage.current, "");
        // console.log(`Translation result: "${translatedText}"`);
        
        // If translation returns empty or fails, use the original text
        if (!translatedText || translatedText === "") {
          // console.warn("Translation returned empty string, using original text");
          translatedText = transcriptText;
        }
      } catch (translationError) {
        // console.error("Translation failed, using original text:", translationError);
        translatedText = transcriptText;
      }
      
      if (onTranslationComplete) {
        // console.log("Calling onTranslationComplete callback");
        onTranslationComplete(translatedText);
      }
      
      // Step 4: Send to chat API
      // console.log("Step 4: Sending to chat API");
      const chatApiLanguageCode = getChatApiCode(currentSelectedLanguage.current);
      // console.log(`Using chat API language code: ${chatApiLanguageCode}`);
      
      const chatResponse = await sendTextToChat(translatedText, chatApiLanguageCode);
      // console.log(`Chat API response received, ID: ${chatResponse.id}`);
      
      // Step 5: Trigger the text-to-speech component through the parent callback
      // console.log("Step 5: Triggering text-to-speech via parent callback");
      if (onAssistantResponse) {
        onAssistantResponse(chatResponse.text, chatResponse.id, currentSelectedLanguage.current);
      }
      
      // Set state to playing - the TextToSpeech component will handle actual playback
      setProcessingState("playing");
      
      // Wait for a short time and then reset the state
      // In a real app, you'd wait for confirmation from the TextToSpeech component
      setTimeout(() => {
        setIsProcessing(false);
        setButtonDisabled(false);
      }, 1500);
      
    } catch (error) {
      // console.error("Error processing audio:", error);
      setProcessingState("idle");
      setIsProcessing(false);
      setButtonDisabled(false);
    }
  };

  const handleClose = () => {
    // console.log("Closing interface and refreshing page");
    
    // First, stop recording if active
    if (recorderInstanceRef.current && isRecording) {
      try {
        recorderInstanceRef.current.stopRecording();
        setIsRecording(false);
      } catch (error) {
        // console.error("Error stopping recording:", error);
      }
    }

    // Reset states
    setProcessingState("idle");
    setIsProcessing(false);
    setButtonDisabled(false);
    
    // Add a short delay before refreshing to ensure cleanup completes
    setTimeout(() => {
      // This will refresh the whole page
      window.location.reload();
    }, 100);
  };

  // Function to determine which icon to show
  const renderButtonIcon = () => {
    if (isRecording) {
      // Show stop icon when recording
      return (
        <svg className="w-12 h-12" fill="white" viewBox="0 0 24 24" style={{color: "white"}}>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      );
    } else if (isProcessing) {
      // Show spinner when processing
      return (
        <svg className="w-12 h-12 animate-spin" fill="none" viewBox="0 0 24 24" style={{color: "white"}}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="3"></circle>
          <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      );
    } else if (processingState === "playing") {
      // Show playing icon
      return (
        <svg className="w-12 h-12" fill="white" viewBox="0 0 24 24" style={{color: "white"}}>
          <path d="M8 5.14v14l11-7-11-7z" />
        </svg>
      );
    } else {
      // Improved microphone icon by default
      return (
        <svg className="w-12 h-12" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24" style={{color: "white"}}>
          <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="19" x2="12" y2="22" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="22" x2="16" y2="22" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
  };

  // Get status text based on current state
  const getStatusText = () => {
    if (isRecording && isSilent) {
      return silenceTimeRemaining !== null 
        ? `Silence detected... (stopping in ${silenceTimeRemaining}s)`
        : "Silence detected...";
    } else if (isRecording) {
      return "Listening...";
    } else if (isProcessing) {
      return "Processing...";
    } else if (processingState === "playing") {
      return "Speaking...";
    } else {
      return "Tap to speak";
    }
  };

  // Determine button color based on state
  const getButtonColor = () => {
    if (isRecording) return "<bg-blue-300></bg-gray-300> scale-110";
    if (isProcessing || isPreparingAudio) return "bg-blue-500 animate-pulse";
    if (processingState === "playing" || isPlayingAudio) return "bg-blue-500";
    return "bg-blue-500 hover:bg-blue-600";
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-gray-900 to-black text-white">
      {/* App logo at top left */}
      <div className="absolute top-3 left-3 z-10">
        <img src="/icons/fav.png" alt="Voice Logo" className="w-10 h-10" />
      </div>
      
      {/* Mobile-friendly language selector bar */}
      <div className="p-3 backdrop-blur-md">
        <LanguageSelector
          value={selectedLanguage}
          onChange={handleLanguageChange}
        />
      </div>
      
      {/* Main microphone button area */}
      <div className="flex-grow flex flex-col items-center justify-center">
        <div className="relative">
          {/* Voice waves animation when recording OR when audio is playing */}
          {(isRecording && !isSilent) || isPlayingAudio ? (
            <>
              {/* Use different colors for recording vs playback */}
              <div className={`voice-wave absolute inset-0 w-full h-full rounded-full ${isPlayingAudio ? 'voice-wave-blue' : 'voice-wave-green'}`}></div>
              <div className={`voice-wave absolute inset-0 w-full h-full rounded-full ${isPlayingAudio ? 'voice-wave-blue' : 'voice-wave-green'}`}></div>
              <div className={`voice-wave absolute inset-0 w-full h-full rounded-full ${isPlayingAudio ? 'voice-wave-blue' : 'voice-wave-green'}`}></div>
            </>
          ) : null}
          
          {/* Loader animation when preparing audio */}
          {isPreparingAudio && !isPlayingAudio && (
            <div className="loader absolute inset-0 w-full h-full rounded-full"></div>
          )}
          
          {/* Main button */}
          <button
            onClick={toggleRecording}
            className={`mic-button relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all ${getButtonColor()}`}
            disabled={buttonDisabled}
            style={{
              border: '2px solid transparent',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              backgroundColor: getButtonColor().split(' ')[0].replace('bg-', '') === 'red-600' ? '#dc2626' : 
                               getButtonColor().split(' ')[0].replace('bg-', '') === 'yellow-500' ? '#eab308' : 
                               getButtonColor().split(' ')[0].replace('bg-', '') === 'green-600' ? '#3b82f6' : 
                               '#3b82f6',  // Default blue color
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              WebkitTouchCallout: 'none'
            }}
          >
            <div className="flex items-center justify-center" style={{color: "white"}}>
              {renderButtonIcon()}
            </div>
          </button>
        </div>
        
        {/* Status text */}
        {/* <div className="mt-4 text-center text-sm font-medium">
          {isPreparingAudio ? "Preparing response..." : getStatusText()}
        </div> */}
      </div>
      
      {/* Bottom close button */}
      <div className="p-6 flex justify-center">
        <button
          onClick={handleClose}
          className="close-button w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          style={{
            border: '2px solid transparent',
            backgroundColor: '#1f2937',  // Explicitly setting gray-800 color
            outline: 'none',
            WebkitTapHighlightColor: 'transparent',
            WebkitTouchCallout: 'none'
          }}
        >
          <svg 
            className="w-6 h-6" 
            fill="none" 
            stroke="white" 
            strokeWidth="2" 
            viewBox="0 0 24 24"
            style={{color: "white"}}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VoiceToVoiceInterface;