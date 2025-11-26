
import React, { useEffect, useState } from 'react';
import { X, Camera, Mic, Settings, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCameraId?: string;
  currentMicId?: string;
  onDeviceChange: (kind: 'videoinput' | 'audioinput', deviceId: string) => void;
}

interface DeviceOption {
  deviceId: string;
  label: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentCameraId,
  currentMicId,
  onDeviceChange
}) => {
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [mics, setMics] = useState<DeviceOption[]>([]);

  useEffect(() => {
    if (isOpen) {
      getDevices();
    }
  }, [isOpen]);

  const getDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0,4)}` }));
        
      const audioDevices = devices
        .filter(device => device.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0,4)}` }));

      setCameras(videoDevices);
      setMics(audioDevices);
    } catch (e) {
      console.error("Error enumerating devices", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden transform transition-all scale-100 p-0 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-zinc-800 rounded-xl">
               <Settings className="w-5 h-5 text-white" />
             </div>
             <h3 className="text-lg font-bold text-white">Device Settings</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8">
            {/* Camera Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium uppercase tracking-wider">
                    <Camera className="w-4 h-4" />
                    <span>Camera</span>
                </div>
                <div className="space-y-2">
                    {cameras.length === 0 && <p className="text-zinc-500 text-sm">No cameras found</p>}
                    {cameras.map(device => (
                        <button
                            key={device.deviceId}
                            onClick={() => onDeviceChange('videoinput', device.deviceId)}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${
                                currentCameraId === device.deviceId 
                                ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' 
                                : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            }`}
                        >
                            <span className="truncate text-sm font-medium">{device.label}</span>
                            {currentCameraId === device.deviceId && <Check className="w-4 h-4" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Microphone Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium uppercase tracking-wider">
                    <Mic className="w-4 h-4" />
                    <span>Microphone</span>
                </div>
                <div className="space-y-2">
                    {mics.length === 0 && <p className="text-zinc-500 text-sm">No microphones found</p>}
                    {mics.map(device => (
                        <button
                            key={device.deviceId}
                            onClick={() => onDeviceChange('audioinput', device.deviceId)}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${
                                currentMicId === device.deviceId 
                                ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' 
                                : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            }`}
                        >
                            <span className="truncate text-sm font-medium">{device.label}</span>
                            {currentMicId === device.deviceId && <Check className="w-4 h-4" />}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
             <button 
               onClick={onClose}
               className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-colors"
             >
                Done
             </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
