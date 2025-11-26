
import { useState, useEffect, useRef } from 'react';
import { signaling } from '../services/socket';
import { Caption } from '../types';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export const useLiveCaptions = (roomId: string, userId: string) => {
  const [captions, setCaptions] = useState<Map<string, string>>(new Map());
  const [isCaptionsEnabled, setIsCaptionsEnabled] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Listener for incoming captions from others
    const handleCaption = (data: Caption) => {
        setCaptions(prev => {
            const newMap = new Map(prev);
            newMap.set(data.senderId, data.text);
            return newMap;
        });

        // Clear caption after 4 seconds
        setTimeout(() => {
            setCaptions(prev => {
                const newMap = new Map(prev);
                if (newMap.get(data.senderId) === data.text) {
                    newMap.delete(data.senderId);
                }
                return newMap;
            });
        }, 4000);
    };

    signaling.on('caption', handleCaption);
    return () => {
        signaling.off('caption', handleCaption);
    };
  }, []);

  useEffect(() => {
    if (isCaptionsEnabled) {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new window.webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        // Final result
                        const text = event.results[i][0].transcript;
                        broadcastCaption(text, true);
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                if (interimTranscript) {
                    broadcastCaption(interimTranscript, false);
                }
            };

            recognition.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
            };

            recognition.start();
            recognitionRef.current = recognition;
        } else {
            console.warn("Web Speech API not supported in this browser");
            setIsCaptionsEnabled(false);
        }
    } else {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    }

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };
  }, [isCaptionsEnabled, roomId, userId]);

  const broadcastCaption = (text: string, isFinal: boolean) => {
      // Show local caption immediately
      setCaptions(prev => {
          const newMap = new Map(prev);
          newMap.set(userId, text);
          return newMap;
      });

      // Clear local after delay if final
      if (isFinal) {
          setTimeout(() => {
              setCaptions(prev => {
                  const newMap = new Map(prev);
                  if (newMap.get(userId) === text) {
                      newMap.delete(userId);
                  }
                  return newMap;
              });
          }, 4000);
      }

      signaling.emit('caption', {
          roomId,
          caption: {
              senderId: userId,
              text,
              isFinal,
              timestamp: Date.now()
          }
      });
  };

  return {
      captions,
      isCaptionsEnabled,
      toggleCaptions: () => setIsCaptionsEnabled(prev => !prev)
  };
};
