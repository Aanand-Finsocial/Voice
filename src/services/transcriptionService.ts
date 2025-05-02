interface TranscriptionResponse {
  id?: string;
  task_id?: string;
  [key: string]: any;
}

interface TranscriptionResult {
  status: string;
  result?: {
    segments?: Array<{
      text?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Send audio for transcription
 * @param {Blob} audioBlob - Audio blob to transcribe
 * @returns {Promise<string>} Task ID for polling results
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');
    formData.append('language', '');
    
    const response = await fetch('https://whisper.codewizzz.com/api/transcribe', {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
          
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data: TranscriptionResponse = await response.json();
    
    if (data && data.id) {
      return data.id;
    } else if (data && data.task_id) {
      return data.task_id;
    } else {
      // Try to look for any field that could be an ID
      const possibleIdFields = Object.entries(data).find(([key, value]) => 
        (key.toLowerCase().includes('id') || key === 'taskId') && typeof value === 'string'
      );
      
      if (possibleIdFields) {
        return possibleIdFields[1];
      } else {
        throw new Error('Could not get task ID from API');
      }
    }
  } catch (error) {
    // console.error('Error sending audio for transcription:', error);
    throw error;
  }
};

/**
 * Get transcription results
 * @param {string} taskId - Task ID from transcription API
 * @returns {Promise<Object>} Transcription results
 */
export const getTranscriptionResults = async (taskId: string): Promise<TranscriptionResult> => {
  try {
    const response = await fetch(`https://whisper.codewizzz.com/api/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
        
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    // console.error('Error getting transcription results:', error);
    throw error;
  }
};