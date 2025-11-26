

import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, MessageSquare, Smile, Settings, PictureInPicture, PenTool, Aperture, Captions } from 'lucide-react';

interface ControlsProps {
  isMuted: boolean;
  isVideoStopped: boolean;
  isScreenSharing: boolean;
  isBlurEnabled: boolean;
  isCaptionsEnabled: boolean;
  showChat: boolean;
  showWhiteboard: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleBlur: () => void;
  onToggleCaptions: () => void;
  onTogglePiP: () => void;
  onToggleChat: () => void;
  onToggleWhiteboard: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
  onReaction: (emoji: string) => void;
}

const Controls: React.FC<ControlsProps> = ({
  isMuted,
  isVideoStopped,
  isScreenSharing,
  isBlurEnabled,
  isCaptionsEnabled,
  showChat,
  showWhiteboard,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleBlur,
  onToggleCaptions,
  onTogglePiP,
  onToggleChat,
  onToggleWhiteboard,
  onOpenSettings,
  onLeave,
  onReaction
}) => {
  const [showReactions, setShowReactions] = useState(false);

  const buttonBase = "p-3.5 rounded-2xl transition-all duration-200 transform active:scale-95 flex items-center justify-center relative";
  const buttonNormal = "bg-zinc-900/90 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-700/50 hover:border-zinc-600";
  const buttonActive = "bg-white text-black shadow-lg shadow-white/10 border border-white";
  const buttonDanger = "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20";
  
  const handleReaction = (emoji: string) => {
    onReaction(emoji);
    setShowReactions(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-50">
      
      {/* Reaction Popover */}
      {showReactions && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl border border-zinc-700 rounded-2xl p-2 flex gap-2 shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-200">
              <button onClick={() => handleReaction('❤️')} className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-colors">❤️</button>
              <button onClick={() => handleReaction('👍')} className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-colors">👍</button>
              <button onClick={() => handleReaction('😂')} className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-colors">😂</button>
              <button onClick={() => handleReaction('🎉')} className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-colors">🎉</button>
          </div>
      )}

      <div className="flex items-center gap-2 bg-black/90 backdrop-blur-2xl p-2 rounded-3xl border border-zinc-800 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        
        <button
          onClick={onToggleMute}
          className={`${buttonBase} ${isMuted ? buttonDanger : buttonNormal}`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={onToggleVideo}
          className={`${buttonBase} ${isVideoStopped ? buttonDanger : buttonNormal}`}
          title={isVideoStopped ? "Start Video" : "Stop Video"}
        >
          {isVideoStopped ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <button
            onClick={onToggleScreenShare}
            className={`${buttonBase} ${isScreenSharing ? 'bg-green-500/10 text-green-400 border-green-500/20' : buttonNormal}`}
            title="Share Screen"
        >
            <MonitorUp className="w-5 h-5" />
        </button>

        <button
            onClick={onToggleBlur}
            className={`${buttonBase} ${isBlurEnabled ? buttonActive : buttonNormal}`}
            title="Blur Background"
        >
            <Aperture className="w-5 h-5" />
        </button>

        <button
            onClick={onToggleCaptions}
            className={`${buttonBase} ${isCaptionsEnabled ? buttonActive : buttonNormal}`}
            title="Live Captions"
        >
            <Captions className="w-5 h-5" />
        </button>
        
        <button
            onClick={onOpenSettings}
            className={`${buttonBase} ${buttonNormal}`}
            title="Settings"
        >
            <Settings className="w-5 h-5" />
        </button>

        <button
            onClick={onTogglePiP}
            className={`${buttonBase} ${buttonNormal}`}
            title="Picture in Picture"
        >
            <PictureInPicture className="w-5 h-5" />
        </button>

        <div className="w-px h-8 bg-zinc-800 mx-2"></div>

        <button
            onClick={onToggleWhiteboard}
            className={`${buttonBase} ${showWhiteboard ? buttonActive : buttonNormal}`}
            title="Whiteboard"
        >
            <PenTool className="w-5 h-5" />
        </button>

        <button
            onClick={() => setShowReactions(!showReactions)}
            className={`${buttonBase} ${showReactions ? buttonActive : buttonNormal}`}
            title="Reactions"
        >
            <Smile className="w-5 h-5" />
        </button>

        <button
            onClick={onToggleChat}
            className={`${buttonBase} ${showChat ? buttonActive : buttonNormal}`}
            title="Chat"
        >
            <MessageSquare className="w-5 h-5" />
        </button>

        <div className="w-px h-8 bg-zinc-800 mx-2"></div>

        <button
          onClick={onLeave}
          className={`${buttonBase} bg-red-600 hover:bg-red-500 text-white border-none w-14`}
          title="Leave Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Controls;