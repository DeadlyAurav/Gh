/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Sparkles, 
  Video, 
  Settings, 
  History, 
  Download, 
  Share2, 
  Trash2,
  Loader2,
  AlertCircle,
  Key,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { VEO_MODEL, VideoGenerationState } from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');
  const [genState, setGenState] = useState<VideoGenerationState>({ status: 'idle', progress: 0 });
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [history, setHistory] = useState<{id: string, url: string, prompt: string, timestamp: number}[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const generateVideo = async () => {
    if (!prompt.trim()) return;
    
    setGenState({ status: 'generating', progress: 10 });
    
    try {
      // Create a fresh instance to ensure it uses the latest key
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let operation = await ai.models.generateVideos({
        model: VEO_MODEL,
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio
        }
      });

      setGenState({ status: 'polling', progress: 30, operationId: operation.name });

      // Polling
      let isDone = false;
      let attempts = 0;
      const maxAttempts = 60; // 10 minutes max (10s intervals)

      while (!isDone && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;
        
        try {
          operation = await ai.operations.getVideosOperation({ operation: operation });
          
          if (operation.done) {
            isDone = true;
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            
            if (downloadLink) {
              // Fetch the video using the API key
              const videoResponse = await fetch(downloadLink, {
                method: 'GET',
                headers: {
                  'x-goog-api-key': process.env.GEMINI_API_KEY || '',
                },
              });
              
              const blob = await videoResponse.blob();
              const videoUrl = URL.createObjectURL(blob);
              
              setGenState({ status: 'completed', progress: 100, videoUrl });
              
              // Add to history
              setHistory(prev => [{
                id: Math.random().toString(36).substr(2, 9),
                url: videoUrl,
                prompt: prompt,
                timestamp: Date.now()
              }, ...prev]);
            } else {
              throw new Error("No video URL returned from operation");
            }
          } else {
            // Update progress based on attempts
            setGenState(prev => ({ 
              ...prev, 
              progress: Math.min(95, 30 + (attempts * 1)) 
            }));
          }
        } catch (pollError: any) {
          console.error("Polling error:", pollError);
          if (pollError.message?.includes("Requested entity was not found")) {
            setHasKey(false);
            throw new Error("API Key session expired. Please re-select your key.");
          }
        }
      }

      if (!isDone) {
        throw new Error("Generation timed out. Please check your history later.");
      }

    } catch (error: any) {
      console.error("Generation error:", error);
      setGenState({ 
        status: 'error', 
        progress: 0, 
        error: error.message || "An unexpected error occurred during generation." 
      });
    }
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen flex items-center justify-center cinematic-gradient p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass-panel p-8 text-center space-y-6"
        >
          <div className="w-20 h-20 bg-clada-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-10 h-10 text-clada-accent" />
          </div>
          <h1 className="text-4xl font-serif font-bold tracking-tight">Clada</h1>
          <p className="text-white/60 text-lg">
            To begin creating cinematic masterpieces, please connect your Google Cloud project with billing enabled.
          </p>
          <div className="space-y-4">
            <button 
              onClick={handleSelectKey}
              className="w-full py-4 bg-clada-accent hover:bg-clada-accent/80 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group"
            >
              Select API Key
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Learn about Gemini API billing
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-clada-dark overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="w-80 border-r border-white/10 bg-black/40 backdrop-blur-md flex flex-col z-20"
          >
            <div className="p-6 border-bottom border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-clada-accent rounded-lg flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-serif font-bold tracking-tight">Clada</h1>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <History className="w-5 h-5 text-white/40" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">Recent Generations</h2>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white/60">{history.length}</span>
              </div>
              
              {history.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2">
                    <History className="w-6 h-6 text-white/20" />
                  </div>
                  <p className="text-sm text-white/30">No history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group relative glass-panel p-3 hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <div className="aspect-video rounded-lg overflow-hidden mb-2 bg-black/40">
                        <video src={item.url} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-white/60 line-clamp-2 italic">"{item.prompt}"</p>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button className="p-1.5 bg-black/60 rounded-md hover:bg-red-500/80 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10">
              <button 
                onClick={handleSelectKey}
                className="w-full py-3 flex items-center justify-center gap-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                <Settings className="w-4 h-4" />
                API Settings
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative cinematic-gradient">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-6 left-6 z-30 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10"
          >
            <History className="w-5 h-5" />
          </button>
        )}

        {/* Video Display Area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-5xl w-full aspect-video relative group">
            <AnimatePresence mode="wait">
              {genState.status === 'idle' && (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full glass-panel flex flex-col items-center justify-center space-y-6 border-dashed border-2 border-white/10"
                >
                  <div className="w-24 h-24 bg-clada-accent/10 rounded-full flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-clada-accent animate-pulse" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-serif">Ready to Create</h3>
                    <p className="text-white/40 max-w-xs">Enter a prompt below to generate your first cinematic sequence.</p>
                  </div>
                </motion.div>
              )}

              {(genState.status === 'generating' || genState.status === 'polling') && (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full glass-panel flex flex-col items-center justify-center space-y-8"
                >
                  <div className="relative">
                    <Loader2 className="w-20 h-20 text-clada-accent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-mono">{Math.round(genState.progress)}%</span>
                    </div>
                  </div>
                  <div className="text-center space-y-4">
                    <h3 className="text-2xl font-serif">Crafting your vision...</h3>
                    <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-clada-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${genState.progress}%` }}
                      />
                    </div>
                    <p className="text-sm text-white/40 italic">
                      {genState.progress < 30 ? "Initializing neural engine..." : 
                       genState.progress < 60 ? "Synthesizing visual frames..." : 
                       "Applying cinematic finishing..."}
                    </p>
                  </div>
                </motion.div>
              )}

              {genState.status === 'completed' && genState.videoUrl && (
                <motion.div 
                  key="completed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full h-full rounded-2xl overflow-hidden video-glow bg-black group"
                >
                  <video 
                    src={genState.videoUrl} 
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                    loop
                  />
                  <div className="absolute bottom-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-3 bg-black/60 backdrop-blur-md rounded-xl hover:bg-white/10 transition-all border border-white/10">
                      <Download className="w-5 h-5" />
                    </button>
                    <button className="p-3 bg-black/60 backdrop-blur-md rounded-xl hover:bg-white/10 transition-all border border-white/10">
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button className="p-3 bg-black/60 backdrop-blur-md rounded-xl hover:bg-white/10 transition-all border border-white/10">
                      <Maximize2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {genState.status === 'error' && (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full glass-panel flex flex-col items-center justify-center space-y-6 border-red-500/20"
                >
                  <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
                  <div className="text-center space-y-2 max-w-md px-6">
                    <h3 className="text-2xl font-serif text-red-500">Generation Failed</h3>
                    <p className="text-white/60">{genState.error}</p>
                  </div>
                  <button 
                    onClick={() => setGenState({ status: 'idle', progress: 0 })}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-8 max-w-5xl w-full mx-auto">
          <div className="glass-panel p-6 shadow-2xl">
            <div className="flex flex-col gap-6">
              <div className="relative">
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your cinematic vision... (e.g., 'A neon hologram of a cat driving a futuristic car through a rainy cyberpunk city')"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-5 pr-16 text-lg focus:outline-none focus:ring-2 focus:ring-clada-accent/50 transition-all min-h-[120px] resize-none"
                />
                <button 
                  onClick={generateVideo}
                  disabled={!prompt.trim() || genState.status === 'generating' || genState.status === 'polling'}
                  className={cn(
                    "absolute bottom-4 right-4 p-4 rounded-xl transition-all flex items-center justify-center",
                    prompt.trim() && genState.status === 'idle' 
                      ? "bg-clada-accent text-white shadow-lg shadow-clada-accent/20 hover:scale-105 active:scale-95" 
                      : "bg-white/5 text-white/20 cursor-not-allowed"
                  )}
                >
                  {genState.status === 'generating' || genState.status === 'polling' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Play className="w-6 h-6 fill-current" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Aspect Ratio</label>
                    <div className="flex gap-2">
                      {(['16:9', '9:16'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setAspectRatio(ratio)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm transition-all border",
                            aspectRatio === ratio 
                              ? "bg-white/10 border-white/20 text-white" 
                              : "bg-transparent border-white/5 text-white/40 hover:bg-white/5"
                          )}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Resolution</label>
                    <div className="flex gap-2">
                      {(['720p', '1080p'] as const).map((res) => (
                        <button
                          key={res}
                          onClick={() => setResolution(res)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm transition-all border",
                            resolution === res 
                              ? "bg-white/10 border-white/20 text-white" 
                              : "bg-transparent border-white/5 text-white/40 hover:bg-white/5"
                          )}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-white/40 text-xs italic">
                  <Sparkles className="w-4 h-4 text-clada-accent" />
                  Powered by Gemini Veo 3.1
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
