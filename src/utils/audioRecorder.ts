import RecordRTC from "recordrtc"

interface AudioRecorderOptions {
  silenceThreshold?: number
  silenceTimeout?: number
  minConsecutiveSilentFrames?: number
  onSilenceStart?: () => void
  onSilenceEnd?: () => void
  onCountdown?: (remaining: number) => void
  onRecordingStop?: (blob: Blob) => void
  onAudioLevel?: (level: number) => void
  debug?: boolean
}

// Standalone audio recorder with silence detection
class AudioRecorderWithSilenceDetection {
  // Configuration
  private silenceThreshold: number
  private silenceTimeout: number
  private silenceEntryThreshold: number
  private silenceExitThreshold: number
  private minConsecutiveSilentFrames: number
  private debug: boolean

  // State
  private isRecording: boolean
  private isPaused: boolean
  private isSilent: boolean
  private recorder: RecordRTC | null
  private stream: MediaStream | null
  private audioContext: AudioContext | null
  private analyser: AnalyserNode | null
  private silenceTimer: NodeJS.Timeout | null
  private countdownInterval: NodeJS.Timeout | null
  private silenceStartTime: number | null
  private lastTranscriptTime: number | null
  private dataArray: Uint8Array | null
  private requestAnimationId: number | null
  private consecutiveSilentFrames: number
  private requiredSilentFrames: number
  private consecutiveSoundFrames: number
  private requiredSoundFrames: number
  private currentConsecutiveSilentFrames: number
  private currentCountdown: number | null

  // Callbacks
  private onSilenceStart: () => void
  private onSilenceEnd: () => void
  private onCountdown: (remaining: number) => void
  private onRecordingStop: (blob: Blob) => void
  private onAudioLevel: (level: number) => void

  constructor(options: AudioRecorderOptions = {}) {
    // Configuration
    this.silenceThreshold = options.silenceThreshold || 0.05
    this.silenceTimeout = options.silenceTimeout || 5000
    this.silenceEntryThreshold = this.silenceThreshold
    this.silenceExitThreshold = this.silenceThreshold * 1.5
    this.minConsecutiveSilentFrames = options.minConsecutiveSilentFrames || 5
    this.debug = options.debug || false

    // State
    this.isRecording = false
    this.isPaused = false
    this.isSilent = false
    this.recorder = null
    this.stream = null
    this.audioContext = null
    this.analyser = null
    this.silenceTimer = null
    this.countdownInterval = null
    this.silenceStartTime = null
    this.lastTranscriptTime = null
    this.dataArray = null
    this.requestAnimationId = null
    this.consecutiveSilentFrames = 0
    this.requiredSilentFrames = 30 // About 0.5 seconds of silence before triggering
    this.consecutiveSoundFrames = 0
    this.requiredSoundFrames = 10 // About 0.15 seconds of sound before canceling silence
    this.currentConsecutiveSilentFrames = 0
    this.currentCountdown = null

    // Callbacks
    this.onSilenceStart = options.onSilenceStart || (() => {})
    this.onSilenceEnd = options.onSilenceEnd || (() => {})
    this.onCountdown = options.onCountdown || (() => {})
    this.onRecordingStop = options.onRecordingStop || (() => {})
    this.onAudioLevel = options.onAudioLevel || (() => {})
  }

  async startRecording(): Promise<boolean> {
    if (this.isRecording) return false

    try {
      this.log("Starting recording with silence detection")

      // Clean up any previous recording
      this.cleanup()

      // Get microphone stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Create recorder
      this.recorder = new RecordRTC(this.stream, {
        type: "audio",
        mimeType: "audio/wav",
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 16000,
        bufferSize: 16384,
      })

      // Start recording
      this.recorder.startRecording()
      this.isRecording = true
      this.isPaused = false

      // Set up silence detection
      this.setupVoiceActivityDetection()

      return true
    } catch (error) {
      // console.error("Error starting recording:", error)
      this.cleanup()
      return false
    }
  }

  setupVoiceActivityDetection(): void {
    try {
      if (!this.stream) return

      // Create audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()

      // Create microphone input source
      const microphone = this.audioContext.createMediaStreamSource(this.stream)
      microphone.connect(this.analyser)

      this.analyser.fftSize = 1024 // Increased for better frequency resolution
      const bufferLength = this.analyser.frequencyBinCount
      this.dataArray = new Uint8Array(bufferLength)

      this.lastTranscriptTime = Date.now()
      this.consecutiveSilentFrames = 0
      this.consecutiveSoundFrames = 0

      // Start monitoring
      this.requestAnimationId = requestAnimationFrame(this.checkVoiceActivity)
    } catch (e) {
      // console.error("Error setting up voice activity detection:", e)
    }
  }

  private checkVoiceActivity = (): void => {
    if (!this.isRecording || !this.analyser || !this.dataArray) return

    this.analyser.getByteFrequencyData(this.dataArray)

    // Calculate average volume level
    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i]
    }
    const average = sum / this.dataArray.length / 255

    // Report audio level
    this.onAudioLevel(average)

    // Log volume level
    if (Math.random() < 0.01 || this.debug) {
      // console.log("Current volume level:", average.toFixed(4), "(Threshold:", this.silenceThreshold, ")")
    }

    if (average < this.silenceEntryThreshold) {
      // Increment consecutive silent frames counter
      this.currentConsecutiveSilentFrames++

      // Only enter silence mode after enough consecutive silent frames
      if (!this.isSilent && this.currentConsecutiveSilentFrames >= this.minConsecutiveSilentFrames) {
        this.isSilent = true
        this.silenceStartTime = Date.now()
        this.onSilenceStart()
        if (this.debug) {
          // console.log(`Silence started after ${this.minConsecutiveSilentFrames} consecutive silent frames`)
        }
      }

      // Check if we need to stop recording due to silence
      if (this.isSilent) {
        const elapsedSilence = Date.now() - (this.silenceStartTime || 0)
        const remainingTime = Math.ceil((this.silenceTimeout - elapsedSilence) / 1000)

        // Update countdown callback
        if (this.onCountdown && remainingTime !== this.currentCountdown) {
          this.currentCountdown = remainingTime
          this.onCountdown(remainingTime)
        }

        // If silence has exceeded the timeout, stop recording
        if (elapsedSilence >= this.silenceTimeout) {
          if (this.debug) {
            // console.log(`${this.silenceTimeout / 1000} seconds of silence detected - stopping recording`)
          }
          this.stopRecording()
          return // Exit the animation frame loop
        }
      }
    } else if (average > this.silenceExitThreshold) {
      // Reset consecutive frames counter
      this.currentConsecutiveSilentFrames = 0

      // Exit silence mode
      if (this.isSilent) {
        this.isSilent = false
        this.currentCountdown = null
        this.onSilenceEnd()
        if (this.debug) {
          // console.log("Silence ended - level above exit threshold")
        }
      }
    } else {
      // Level is between entry and exit thresholds - no change in state but reset consecutive counter
      this.currentConsecutiveSilentFrames = 0
    }

    // Continue monitoring
    if (this.isRecording) {
      this.requestAnimationId = requestAnimationFrame(this.checkVoiceActivity)
    }
  }

  stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.isRecording || !this.recorder) {
        resolve(null)
        return
      }

      this.isRecording = false

      // Clean up silence detection
      this.cleanupSilenceDetection()

      this.recorder.stopRecording(() => {
        const blob = this.recorder?.getBlob() || null

        // Stop tracks
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop())
          this.stream = null
        }

        // Notify recording stopped
        if (blob) {
          this.onRecordingStop(blob)
        }

        resolve(blob)
      })
    })
  }

  pauseRecording(): void {
    if (!this.isRecording || !this.recorder) return

    this.recorder.pauseRecording()
    this.isPaused = true

    // Pause silence detection
    this.cleanupSilenceDetection()
  }

  resumeRecording(): void {
    if (!this.recorder || !this.isPaused) return

    this.recorder.resumeRecording()
    this.isPaused = false

    // Resume silence detection
    if (this.stream) {
      this.setupVoiceActivityDetection()
    }
  }

  cleanupSilenceDetection(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }

    if (this.requestAnimationId) {
      cancelAnimationFrame(this.requestAnimationId)
      this.requestAnimationId = null
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close()
      } catch (e) {
        // console.error("Error closing audio context:", e)
      }
    }

    this.audioContext = null
    this.analyser = null
    this.isSilent = false
  }

  cleanup(): void {
    this.cleanupSilenceDetection()

    if (this.recorder) {
      try {
        if (this.isRecording) {
          this.recorder.stopRecording()
        }
        this.recorder.destroy()
        this.recorder = null
      } catch (e) {
        // console.error("Error cleaning up recorder:", e)
      }
    }

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop())
        this.stream = null
      } catch (e) {
        // console.error("Error cleaning up media stream:", e)
      }
    }

    this.isRecording = false
    this.isPaused = false
  }

  stop(): void {
    // Don't rely on mediaRecorder property which doesn't exist
    // Instead use the existing stopRecording method
    if (this.isRecording) {
      // console.log('Stopping recorder from stop() method');
      this.stopRecording().catch(error => {
        // console.error("Error in stop() method:", error);
      });
    } else {
      // console.log('Recorder already stopped or not initialized');
      // Still clean up resources
      this.cleanup();
    }
  }

  // Helper method for conditional logging
  private log(message: string): void {
    if (this.debug) {
      // console.log(`[AudioRecorder] ${message}`)
    }
  }

  // Method to adjust silence threshold dynamically
  setSilenceThreshold(threshold: number): void {
    this.silenceThreshold = threshold
    this.silenceEntryThreshold = threshold
    this.silenceExitThreshold = threshold * 1.5
    // console.log(`Silence threshold adjusted to: ${threshold}`)
  }

  public setSilenceTimeoutInSeconds(seconds: number): void {
    this.silenceTimeout = seconds * 1000
  }
}

export default AudioRecorderWithSilenceDetection
