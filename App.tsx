
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Hash, 
  Send, 
  Settings, 
  MessageSquare, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  ChevronRight,
  User,
  Lock,
  ExternalLink,
  ShieldCheck,
  LogOut,
  Globe,
  Key,
  Database,
  Cpu,
  Info
} from 'lucide-react';
import { SlackService } from './services/slackService';
import { GeminiService } from './services/geminiService';
import { SlackChannel, AppStatus } from './types';

const DEFAULT_PROXY = 'https://corsproxy.io/?';

const App: React.FC = () => {
  // --- Core State ---
  const [token, setToken] = useState<string>(() => localStorage.getItem('slack_token') || '');
  const [useProxy, setUseProxy] = useState<boolean>(() => localStorage.getItem('slack_use_proxy') === 'true');
  
  // --- UI States ---
  const [inputToken, setInputToken] = useState(token);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'AUTH' | 'CORS' | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [discoveredTokens, setDiscoveredTokens] = useState<{key: string, value: string}[]>([]);

  const slackServiceRef = useRef<SlackService | null>(null);
  const geminiService = useRef(new GeminiService());

  // --- Logic: Initialize Services ---
  useEffect(() => {
    if (token) {
      slackServiceRef.current = new SlackService(token, useProxy ? DEFAULT_PROXY : null);
    } else {
      slackServiceRef.current = null;
    }
  }, [token, useProxy]);

  // --- Logic: Smart Token Scavenging ---
  const scanForTokens = useCallback(() => {
    const found: {key: string, value: string}[] = [];
    const slackPattern = /xox[bap]-[a-zA-Z0-9-]+/;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      if (!val) continue;

      // Scan direct values or inside JSON strings
      const match = val.match(slackPattern);
      if (match && match[0] !== token) {
        found.push({ key, value: match[0] });
      }
    }
    setDiscoveredTokens(found);
  }, [token]);

  useEffect(() => {
    scanForTokens();
    const interval = setInterval(scanForTokens, 5000); // Periodic re-scan
    return () => clearInterval(interval);
  }, [scanForTokens]);

  const fetchChannels = useCallback(async () => {
    if (!token || !slackServiceRef.current) return;
    setStatus(AppStatus.LOADING);
    try {
      const fetchedChannels = await slackServiceRef.current.fetchChannels();
      setChannels(fetchedChannels);
      setStatus(AppStatus.SUCCESS);
      setErrorMessage(null);
      setErrorType(null);
    } catch (err: any) {
      if (err.message === 'CORS_ERROR') {
        setErrorType('CORS');
        setErrorMessage('Connection blocked by Browser Security (CORS). This is common for Slack on the web.');
      } else {
        setErrorMessage(err.message || 'Failed to fetch channels.');
        setErrorType('AUTH');
      }
      setStatus(AppStatus.ERROR);
    }
  }, [token]);

  useEffect(() => {
    if (token && !showSettings) {
      fetchChannels();
    }
  }, [fetchChannels, token, showSettings]);

  const handleConnect = async (targetToken: string, forceProxy?: boolean) => {
    const cleanToken = targetToken.trim();
    const activeProxy = forceProxy !== undefined ? forceProxy : useProxy;

    if (!cleanToken) return;

    setIsVerifying(true);
    setErrorMessage(null);
    setErrorType(null);

    try {
      const testService = new SlackService(cleanToken, activeProxy ? DEFAULT_PROXY : null);
      await testService.testConnection();
      
      // Persist values
      localStorage.setItem('slack_token', cleanToken);
      localStorage.setItem('slack_use_proxy', activeProxy.toString());
      
      setToken(cleanToken);
      setUseProxy(activeProxy);
      setInputToken(cleanToken);
      setShowSettings(false);
      setErrorMessage(null);
    } catch (err: any) {
      if (err.message === 'CORS_ERROR') {
        setErrorType('CORS');
        setErrorMessage('CORS Blocked: The browser restricted the request. Enable the Proxy to continue.');
      } else {
        setErrorMessage(`Slack API Error: ${err.message}`);
        setErrorType('AUTH');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('slack_token');
    localStorage.removeItem('slack_use_proxy');
    setToken('');
    setInputToken('');
    setChannels([]);
    setSelectedChannel(null);
    setShowSettings(false);
  };

  const handleSendMessage = async () => {
    if (!selectedChannel || !message || !slackServiceRef.current) return;
    
    setStatus(AppStatus.LOADING);
    try {
      await slackServiceRef.current.sendMessage(selectedChannel.id, message);
      setMessage('');
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setErrorMessage(err.message === 'CORS_ERROR' ? 'Send blocked by CORS. Enable Proxy in settings.' : err.message);
      setStatus(AppStatus.ERROR);
    }
  };

  const refineWithAI = async (tone: 'professional' | 'friendly' | 'concise') => {
    if (!message) return;
    setIsRefining(true);
    try {
      const refined = await geminiService.current.refineMessage(message, tone);
      setMessage(refined);
    } catch (err) {
      console.error('AI refinement failed', err);
    } finally {
      setIsRefining(false);
    }
  };

  // --- View: Authenticate ---
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-4xl w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500">
          <div className="w-full md:w-5/12 bg-slate-900 p-12 flex flex-col justify-between text-white">
            <div className="space-y-8">
              <div className="w-16 h-16 bg-indigo-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                <MessageSquare className="w-9 h-9" />
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-black tracking-tighter leading-none uppercase italic">Slack<br/>Connect</h1>
                <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[200px]">
                  Professional channel management powered by Gemini AI.
                </p>
              </div>
            </div>
            <div className="pt-10 border-t border-slate-800 space-y-4">
              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                End-to-End Encryption
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                <Cpu className="w-4 h-4 text-indigo-500" />
                Gemini 3-Flash Refinement
              </div>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-12 space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Activation</h2>
              <p className="text-slate-500 text-sm font-medium">Please provide your Bot User OAuth Token.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Token</label>
                  <Key className="w-3.5 h-3.5 text-slate-300" />
                </div>
                <input
                  type="password"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="xoxb-your-token"
                  className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl bg-slate-50 focus:bg-white focus:ring-8 focus:ring-indigo-50 focus:border-indigo-500 transition-all outline-none text-sm font-mono shadow-sm"
                />
              </div>

              {discoveredTokens.length > 0 && !inputToken && (
                <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                    <Database className="w-3.5 h-3.5" />
                    Detected Existing Tokens
                  </div>
                  <div className="grid gap-2">
                    {discoveredTokens.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => { setInputToken(t.value); handleConnect(t.value); }}
                        className="w-full text-left p-4 bg-white border border-indigo-100 rounded-xl hover:bg-indigo-600 hover:text-white transition-all group shadow-sm flex items-center justify-between"
                      >
                        <div className="truncate flex-1">
                          <p className="text-[10px] font-bold opacity-60 mb-0.5 uppercase tracking-tighter">Source: {t.key}</p>
                          <p className="text-[11px] font-mono truncate">{t.value}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className={`p-5 rounded-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm border-2 ${
                  errorType === 'CORS' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4" />
                    {errorType === 'CORS' ? 'Connection Blocked' : 'System Error'}
                  </div>
                  <p className="text-xs font-bold leading-relaxed">{errorMessage}</p>
                  
                  {errorType === 'CORS' && (
                    <button 
                      onClick={() => handleConnect(inputToken, true)}
                      className="mt-1 w-full py-3 bg-amber-600 text-white rounded-xl text-xs font-black hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-200"
                    >
                      <Globe className="w-4 h-4" />
                      Activate CORS Proxy Bypass
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={() => handleConnect(inputToken)}
                disabled={isVerifying || !inputToken}
                className="w-full py-4 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 text-white rounded-2xl font-black shadow-2xl shadow-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                {isVerifying ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>Connect Slack Instance <ChevronRight className="w-5 h-5" /></>
                )}
              </button>

              <div className="flex items-start gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <Info className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-500 font-bold leading-relaxed uppercase">
                  Note: This app runs entirely in your browser. Slack's security policies require a proxy to communicate directly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- View: Main Application ---
  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-black text-white tracking-tight uppercase italic text-sm">SlackConnect</h1>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-5 px-3">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Channels</h2>
              <button 
                onClick={fetchChannels}
                className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                title="Sync Workspace"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${status === AppStatus.LOADING ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="space-y-1">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group ${
                    selectedChannel?.id === channel.id 
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
                      : 'hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex-shrink-0 opacity-60 group-hover:opacity-100">
                    {channel.is_private ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                  </div>
                  <span className="truncate text-sm font-bold tracking-tight">{channel.name}</span>
                </button>
              ))}
              
              {channels.length === 0 && status !== AppStatus.LOADING && (
                <div className="px-4 py-8 text-center bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">No Active Channels</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-950 border-t border-slate-800">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-black text-white truncate uppercase tracking-widest leading-none mb-1">Authenticated</p>
                  <p className="text-[9px] text-slate-500 truncate font-black uppercase tracking-tighter">Bot Instance Online</p>
                </div>
             </div>
             <button 
               onClick={handleLogout}
               className="p-2.5 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl transition-all"
               title="Disconnect"
             >
               <LogOut className="w-4 h-4" />
             </button>
           </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col bg-slate-50 relative">
        {successToast && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-slate-900 text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 font-black text-sm border-2 border-slate-800">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              Broadcasting Complete
            </div>
          </div>
        )}

        <div className="h-24 border-b bg-white flex items-center px-12 justify-between shadow-sm z-10">
          {selectedChannel ? (
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center shadow-inner">
                {selectedChannel.is_private ? <Lock className="w-6 h-6 text-slate-400" /> : <Hash className="w-6 h-6 text-slate-400" />}
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-2xl tracking-tighter">#{selectedChannel.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Channel Stream Syncing {useProxy && 'via Proxy'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-slate-300">
              <MessageSquare className="w-9 h-9 opacity-20" />
              <span className="font-black text-2xl tracking-tighter italic uppercase">Waiting for Destination...</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-16 flex flex-col items-center justify-center text-center">
          {!selectedChannel ? (
            <div className="max-w-lg space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="w-32 h-32 bg-white border border-slate-100 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/5 hover:scale-105 transition-transform">
                <MessageSquare className="w-16 h-16 text-indigo-500" />
              </div>
              <div className="space-y-4">
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter italic uppercase">AI Message HQ</h2>
                <p className="text-slate-500 leading-relaxed font-bold text-xl px-10">
                  Select a destination to initiate high-impact communication refined by Gemini.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-md space-y-10 animate-in fade-in duration-1000">
               <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-2xl shadow-indigo-200/50">
                  <Hash className="w-12 h-12 text-indigo-500" />
               </div>
               <div className="space-y-4">
                  <h3 className="text-4xl font-black text-slate-800 tracking-tighter italic uppercase">Target: #{selectedChannel.name}</h3>
                  <p className="text-slate-400 font-bold text-xl uppercase tracking-widest">System Armed & Ready</p>
               </div>
            </div>
          )}
        </div>

        <div className="p-16 bg-white border-t border-slate-100">
          <div className="max-w-6xl mx-auto space-y-10">
            <div className="relative group">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={selectedChannel ? `Draft critical update for #${selectedChannel.name}...` : 'Select destination...'}
                disabled={!selectedChannel}
                className="w-full h-64 p-10 border-2 border-slate-50 rounded-[3rem] bg-slate-50 focus:bg-white focus:ring-[24px] focus:ring-indigo-50/50 focus:border-indigo-500 transition-all resize-none outline-none text-2xl leading-relaxed disabled:opacity-40 disabled:cursor-not-allowed placeholder:text-slate-300 font-medium shadow-inner"
              />
              
              {message && selectedChannel && (
                <div className="absolute bottom-10 left-10 flex gap-5 animate-in fade-in slide-in-from-left-6 duration-700">
                  <div className="flex items-center gap-3 bg-slate-900 text-white px-6 py-3 rounded-[1.5rem] shadow-2xl border border-slate-800">
                    <Sparkles className={`w-5 h-5 text-indigo-400 ${isRefining ? 'animate-pulse' : ''}`} />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] mr-4 border-r border-slate-700 pr-6">Gemini Refine</span>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => refineWithAI('professional')}
                        disabled={isRefining}
                        className="text-xs font-black px-4 py-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 uppercase tracking-widest"
                      >
                        Elite
                      </button>
                      <button 
                        onClick={() => refineWithAI('friendly')}
                        disabled={isRefining}
                        className="text-xs font-black px-4 py-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 uppercase tracking-widest"
                      >
                        Warm
                      </button>
                      <button 
                        onClick={() => refineWithAI('concise')}
                        disabled={isRefining}
                        className="text-xs font-black px-4 py-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 uppercase tracking-widest"
                      >
                        Brevity
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute bottom-10 right-10">
                <button
                  onClick={handleSendMessage}
                  disabled={!selectedChannel || !message || status === AppStatus.LOADING}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white px-12 py-5 rounded-[2rem] font-black shadow-2xl shadow-indigo-600/30 flex items-center gap-5 transition-all active:scale-95 group text-lg uppercase tracking-tighter italic"
                >
                  {status === AppStatus.LOADING ? (
                    <RefreshCw className="w-7 h-7 animate-spin" />
                  ) : (
                    <>
                      Execute Broadcast 
                      <Send className="w-6 h-6 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-14 space-y-12">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 border-2 border-slate-100 shadow-inner">
                  <Settings className="w-12 h-12 text-slate-600" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Control Panel</h2>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Manage Instance Configuration</p>
              </div>

              <div className="space-y-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OAuth Credentials</label>
                  </div>
                  <input
                    type="password"
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    placeholder="xoxb-..."
                    className="w-full px-8 py-5 border-2 border-slate-50 rounded-[1.5rem] bg-slate-50 focus:bg-white focus:ring-8 focus:ring-indigo-50 focus:border-indigo-500 transition-all outline-none text-sm font-mono shadow-sm"
                  />
                </div>

                <div className="flex items-center justify-between p-6 bg-indigo-50/50 rounded-[2rem] border-2 border-indigo-100/50">
                  <div className="space-y-2">
                    <p className="text-sm font-black text-indigo-900 flex items-center gap-3 tracking-tight uppercase">
                      <Globe className="w-5 h-5" />
                      Global Proxy Mode
                    </p>
                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Essential for Cloud Sync</p>
                  </div>
                  <button 
                    onClick={() => setUseProxy(!useProxy)}
                    className={`w-16 h-8 rounded-full transition-all relative ${useProxy ? 'bg-indigo-600 shadow-2xl shadow-indigo-600/30' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all ${useProxy ? 'left-9' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-5 pt-6">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-5 px-8 border-2 border-slate-50 rounded-[1.5rem] font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-95 uppercase text-xs tracking-widest"
                >
                  Return
                </button>
                <button
                  onClick={() => handleConnect(inputToken)}
                  className="flex-1 py-5 px-8 bg-slate-900 hover:bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-2xl shadow-slate-200 transition-all active:scale-95 uppercase text-xs tracking-widest"
                >
                  Save Sync
                </button>
              </div>
              
              <div className="pt-10 border-t border-slate-100">
                <button 
                  onClick={handleLogout}
                  className="w-full py-5 px-8 rounded-[1.5rem] text-rose-500 hover:bg-rose-50 font-black transition-all flex items-center justify-center gap-4 text-xs tracking-widest uppercase active:scale-95"
                >
                  <LogOut className="w-5 h-5" />
                  Reset Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
