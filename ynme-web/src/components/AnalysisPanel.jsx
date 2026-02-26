import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, FileText, Zap, Brain, MessageSquare, Send, StopCircle, Mic } from 'lucide-react';

const AnalysisPanel = ({ deviceStatus, socket, userId }) => {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('');
  
  // Chat state
  const [isChatMode, setIsChatMode] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [message, setMessage] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('ai_analysis_complete', (data) => { 
      setAnalysis(data.analysis); 
      setLoading(false); 
      setStage(''); 
    });
    
    socket.on('ai_processing_start', () => {
      if (!isChatMode) setStage('processing');
    });

    socket.on('chat_transcript_update', (data) => {
      setTranscriptSegments(data.history || []);
    });

    socket.on('ai_chat_response', (data) => {
      setChatHistory(prev => [...prev, { role: 'ai', text: data.answer }]);
      setStage('');
    });

    return () => { 
      socket.off('ai_analysis_complete'); 
      socket.off('ai_processing_start');
      socket.off('chat_transcript_update');
      socket.off('ai_chat_response');
    };
  }, [socket, isChatMode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, transcriptSegments]);

  const runSingle = (mode) => {
    if (!socket) return;
    setIsChatMode(false);
    setLoading(true); 
    setAnalysis(''); 
    setStage('recording');
    socket.emit('request_stt', { userId, duration: 7000, mode });
  };

  const toggleChatMode = () => {
    if (isChatMode) {
      // Stop continuous capture
      if (socket) socket.emit('execute_command', { command: 'STOP_CAPTURE', value: null });
      setIsChatMode(false);
      setStage('');
    } else {
      // Start continuous capture
      setIsChatMode(true);
      setChatHistory([]);
      setTranscriptSegments([]);
      if (socket) socket.emit('request_stt', { userId, duration: 0, mode: 'chat' });
    }
  };

  const sendAskAi = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;
    setChatHistory(prev => [...prev, { role: 'user', text: message }]);
    setStage('thinking');
    socket.emit('ask_ai', { userId, question: message });
    setMessage('');
  };

  if (!deviceStatus) return null;

  return (
    <div className="rounded-xl bg-[#111] border border-white/[0.06] overflow-hidden flex flex-col" style={{ height: '400px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-white/20" />
          <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">AI Assistant</span>
        </div>
        
        {isChatMode && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[9px] font-medium text-emerald-400/80 bg-emerald-400/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Listening to video
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-b border-white/[0.04] bg-[#151515]">
        <div className="flex flex-wrap gap-1.5">
          {[
            { mode: 'summary', label: 'Summarize', icon: <Zap size={11} /> },
            { mode: 'notes', label: 'Study Notes', icon: <FileText size={11} /> },
            { mode: 'explain', label: 'Deep Insight', icon: <Brain size={11} /> },
          ].map(a => (
            <button key={a.mode} onClick={() => runSingle(a.mode)} disabled={loading || isChatMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                isChatMode || loading
                  ? 'bg-transparent border-transparent text-white/20'
                  : 'bg-white/[0.03] border-white/[0.05] text-white/50 hover:text-white/80 hover:bg-white/[0.06]'
              }`}
            >{a.icon} {a.label}</button>
          ))}
          
          <div className="w-px h-6 bg-white/[0.06] mx-1 self-center" />
          
          <button onClick={toggleChatMode} disabled={loading && !isChatMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              isChatMode 
                ? 'bg-red-500/15 text-red-500 border border-red-500/20 hover:bg-red-500/25'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25'
            } disabled:opacity-30`}
          >
            {isChatMode ? <StopCircle size={12} /> : <Mic size={12} />}
            {isChatMode ? 'Stop Chat' : 'Ask AI'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col relative">
        {!isChatMode ? (
          // Standard Analysis View
          loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                {stage === 'recording' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-[12px] font-medium text-white/40">
                  {stage === 'recording' ? 'Capturing audio...' : 'AI thinking...'}
                </p>
                <p className="text-[10px] text-white/15 mt-0.5">
                  {stage === 'recording' ? 'Listening to media tab' : 'Processing with Llama 3.3'}
                </p>
              </div>
            </div>
          ) : analysis ? (
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <MessageSquare size={11} className="text-white/20" />
                <span className="text-[10px] font-semibold text-white/20 uppercase tracking-wider">Response</span>
              </div>
              <div className="text-[12px] text-white/60 leading-relaxed whitespace-pre-wrap">{analysis}</div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 hover:opacity-100 transition-all">
              <Brain size={32} className="text-white/10 mb-3" />
              <p className="text-[12px] font-medium text-white/40 mb-1">AI Video Analysis</p>
              <p className="text-[10px] text-white/20 max-w-[200px]">Click a button above to generate notes, or start an interactive Chat session.</p>
            </div>
          )
        ) : (
          // Chat Mode View
          <div className="flex flex-col flex-1">
            <div className="flex-1 space-y-4 pb-4">
              {transcriptSegments.length === 0 && chatHistory.length === 0 && (
                <div className="text-center mt-6">
                  <p className="text-[11px] text-white/30">Listening to video playback...</p>
                  <p className="text-[9px] text-white/15 mt-1">Chat gets smarter as you watch.</p>
                </div>
              )}
              
              {/* Show transcribed chunks as small context blocks */}
              {transcriptSegments.length > 0 && chatHistory.length === 0 && (
                <div className="opacity-50 space-y-2">
                  <p className="text-[9px] font-semibold text-white/20 uppercase tracking-widest pl-2 border-l border-white/10">Video Transcript</p>
                  <p className="text-[11px] text-white/30 leading-relaxed italic border-l border-white/10 pl-2">
                    "...{transcriptSegments[transcriptSegments.length - 1]?.text}..."
                  </p>
                </div>
              )}

              {/* Chat messages */}
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] ${
                    m.role === 'user' ? 'bg-white/10 text-white/90 rounded-br-none' : 'bg-white/[0.04] text-white/70 rounded-bl-none border border-white/[0.05]'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              
              {stage === 'thinking' && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.04] border border-white/[0.05] rounded-2xl rounded-bl-none px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-white/20 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1 h-1 bg-white/20 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1 h-1 bg-white/20 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={sendAskAi} className="mt-auto relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask about the video..."
                className="w-full bg-[#151515] border border-white/[0.08] rounded-xl pl-4 pr-10 py-3 text-[12px] font-medium text-white/80 placeholder-white/20 outline-none focus:border-white/20 transition-all shadow-xl"
              />
              <button type="submit" disabled={!message.trim() || stage === 'thinking'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/80 disabled:opacity-30 transition-all rounded-lg hover:bg-white/[0.05]"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;
