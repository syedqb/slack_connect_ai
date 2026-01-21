
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
  Search
} from 'lucide-react';
import { SlackService } from './services/slackService';
import { GeminiService } from './services/geminiService';
import { SlackChannel, AppStatus } from './types';

const DEFAULT_PROXY = 'https://corsproxy.io/?';

const App: React.FC = () => {
  // Core State
  const [token, setToken] = useState<string>(() => localStorage.getItem('slack_token') || '');
  const [useProxy, setUseProxy] = useState<boolean>(() => localStorage.getItem('slack_use_proxy') === 'true');
  
  // Input State (Strictly Controlled)
  const [inputToken, setInputToken] = useState(token);

  // App Data State
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'AUTH' | 'CORS' | 'NETWORK' | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [discoveredTokens, setDiscoveredTokens] = useState<{key: string, value: string}[]>([]);

  const slackServiceRef = useRef<SlackService | null>(null);
  const geminiService = useRef(new GeminiService());

  // Initialization & Service Sync
  useEffect(() => {
    if (token) {
      slackServiceRef.current = new SlackService(token, useProxy ? DEFAULT_PROXY : null);
    } else {
      slackServiceRef.current = null;
    }
    // Keep input in sync with current active token
    setInputToken(token);
  }, [token, useProxy]);

  // Scan local storage for potential tokens from other sessions/apps
  const scanLocalStorage = useCallback(() => {
    const found: {key: string, value: string}[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      if (val && (val.startsWith('xoxb-') || val.startsWith('xoxp-')) && val !== token) {
        found.push({ key, value: val });
      }
    }
    setDiscoveredTokens(found);
  }, [token]);

  useEffect(() => {
    scanLocalStorage();
  }, [scanLocalStorage]);

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
        setErrorMessage('Request blocked by browser security (CORS). Enable the proxy below to bypass.');
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

    if (!cleanToken) {
      setErrorMessage('Token field is empty.');
      return;
    }

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
      setShowSettings(false);
      setErrorMessage(null);
    } catch (err: any) {
      if (err.message === 'CORS_ERROR') {
        setErrorType('CORS');
        setErrorMessage('Browser blocked the request. Try clicking "Fix with Proxy" below.');
      } else {
        setErrorType('AUTH');
        setErrorMessage(`Slack Error: ${err.message}`);
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
    setErrorMessage(null);
    setErrorType(null);
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
      setErrorMessage(null);
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

  // Auth View
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500">
          <div className="w-full md:w-5/12 bg-slate-900 p-10 flex flex-col justify-between text-white">
            <div className="space-y-6">
              <div className="w-16 h-16 bg-indigo-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30">
                <MessageSquare className="w-9 h-9" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight leading-none mb-4 uppercase italic">Slack<br/>Connect</h1>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  Craft refined messages with Gemini and send them directly to your team.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-black uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Verified Connection
            </div>
          </div>

          <div className="w-full md:w-7/12 p-10 space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Setup Workspace</h2>
              <p className="text-slate-500 text-sm font-medium">Enter your Bot User OAuth Token to begin.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bot Token</label>
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
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                    <Database className="w-3.5 h-3.5" />
                    Found in local storage
                  </div>
                  {discoveredTokens.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setInputToken(t.value)}
                      className="w-full text-left p-3 bg-white border border-indigo-200 rounded-xl hover:bg-indigo-600 hover:text-white transition-all group shadow-sm"
                    >
                      <p className="text-[10px] font-bold opacity-60 mb-1">Key: {t.key}</p>
                      <p className="text-[11px] font-mono truncate">{t.value}</p>
                    </button>
                  ))}
                </div>
              )}

              {errorMessage && (
                <div className={`p-4 rounded-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 shadow-sm border-2 ${
                  errorType === 'CORS' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4" />
                    {errorType === 'CORS' ? 'Browser CORS Block' : 'Connection Error'}
                  </div>
                  <p className="text-xs font-bold leading-relaxed">{errorMessage}</p>
                  
                  {errorType === 'CORS' && (
                    <button 
                      onClick={() => handleConnect(inputToken, true)}
                      className="mt-2 w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-100"
                    >
                      <Globe className="w-4 h-4" />
                      Fix with Proxy
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={() => handleConnect(inputToken)}
                disabled={isVerifying}
                className="w-full py-4 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 text-white rounded-2xl font-black shadow-2xl shadow-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                {isVerifying ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>Connect Workspace <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
              
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <Search className="w-4 h-4 text-slate-400 mt-0.5" />
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase">
                  Tip: Direct Slack calls are often blocked by browsers. If "Fix with Proxy" is suggested, please enable it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main App View
  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-black text-white tracking-tight">SlackConnect</h1>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Channels</h2>
              <button 
                onClick={fetchChannels}
                className="p-1.5 hover:text-white hover:bg-slate-800 rounded-md transition-all"
                title="Sync Channels"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${status === AppStatus.LOADING ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="space-y-1">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                    selectedChannel?.id === channel.id 
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
                      : 'hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex-shrink-0 opacity-60 group-hover:opacity-100">
                    {channel.is_private ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                  </div>
                  <span className="truncate text-sm font-bold">{channel.name}</span>
                </button>
              ))}
              
              {channels.length === 0 && status !== AppStatus.LOADING && (
                <div className="px-3 py-6 text-center bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                  <p className="text-[11px] text-slate-500 font-bold uppercase">No channels synced</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 bg-slate-950 border-t border-slate-800">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 shadow-inner">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-black text-white truncate uppercase tracking-wider">Connected</p>
                  <p className="text-[10px] text-slate-500 truncate italic font-medium">Workspace Active</p>
                </div>
             </div>
             <button 
               onClick={handleLogout}
               className="p-2.5 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl transition-all"
               title="Logout"
             >
               <LogOut className="w-4 h-4" />
             </button>
           </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col bg-slate-50 relative">
        {successToast && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-black text-sm border border-slate-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Message Delivered Successfully
            </div>
          </div>
        )}

        {errorMessage && (
          <div className={`border-b p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 z-20 ${
            errorType === 'CORS' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}>
            <div className="flex items-center gap-3 text-sm font-bold max-w-2xl">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
              {errorType === 'CORS' && (
                <button 
                  onClick={() => handleConnect(token, true)}
                  className="bg-amber-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-colors shadow-sm"
                >
                  Enable Proxy
                </button>
              )}
            </div>
            <button 
              onClick={() => { setErrorMessage(null); setErrorType(null); }}
              className="hover:bg-black/5 rounded-full p-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4 opacity-40 hover:opacity-100" />
            </button>
          </div>
        )}

        <div className="h-24 border-b bg-white flex items-center px-12 justify-between shadow-sm z-10">
          {selectedChannel ? (
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center shadow-inner">
                {selectedChannel.is_private ? <Lock className="w-6 h-6 text-slate-400" /> : <Hash className="w-6 h-6 text-slate-400" />}
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight">#{selectedChannel.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest">Active {useProxy && '• Proxied'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-slate-300">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <span className="font-black text-xl tracking-tight">Select Channel Destination</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center justify-center text-center">
          {!selectedChannel ? (
            <div className="max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="w-28 h-28 bg-white border border-slate-100 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/5 group">
                <MessageSquare className="w-14 h-14 text-indigo-500 group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">Unified AI Drafting</h2>
                <p className="text-slate-500 leading-relaxed font-bold text-lg">
                  Choose a workspace channel and start crafting powerful messages with Gemini AI.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-md space-y-8 animate-in fade-in duration-1000">
               <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-2xl shadow-indigo-100">
                  <Hash className="w-10 h-10 text-indigo-500" />
               </div>
               <h3 className="text-3xl font-black text-slate-800 tracking-tight italic">Drafting for #{selectedChannel.name}</h3>
               <p className="text-slate-400 font-bold text-lg">Your team is waiting for your update.</p>
            </div>
          )}
        </div>

        <div className="p-12 bg-white border-t border-slate-100">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="relative group">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={selectedChannel ? `Draft your thoughts for #${selectedChannel.name}...` : 'Select a destination first...'}
                disabled={!selectedChannel}
                className="w-full h-56 p-8 border-2 border-slate-50 rounded-[2rem] bg-slate-50 focus:bg-white focus:ring-[16px] focus:ring-indigo-50/50 focus:border-indigo-500 transition-all resize-none outline-none text-xl leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-slate-300 font-medium"
              />
              
              {message && selectedChannel && (
                <div className="absolute bottom-8 left-8 flex gap-4 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-slate-800">
                    <Sparkles className={`w-4 h-4 text-indigo-400 ${isRefining ? 'animate-pulse' : ''}`} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] mr-3 border-r border-slate-700 pr-4">AI Refine</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => refineWithAI('professional')}
                        disabled={isRefining}
                        className="text-xs font-black px-3 py-1.5 hover:bg-white/10 rounded-xl transition-all active:scale-95"
                      >
                        Pro
                      </button>
                      <button 
                        onClick={() => refineWithAI('friendly')}
                        disabled={isRefining}
                        className="text-xs font-black px-3 py-1.5 hover:bg-white/10 rounded-xl transition-all active:scale-95"
                      >
                        Warm
                      </button>
                      <button 
                        onClick={() => refineWithAI('concise')}
                        disabled={isRefining}
                        className="text-xs font-black px-3 py-1.5 hover:bg-white/10 rounded-xl transition-all active:scale-95"
                      >
                        Brief
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute bottom-8 right-8">
                <button
                  onClick={handleSendMessage}
                  disabled={!selectedChannel || !message || status === AppStatus.LOADING}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white px-10 py-4 rounded-2xl font-black shadow-2xl shadow-indigo-600/20 flex items-center gap-4 transition-all active:scale-95 group"
                >
                  {status === AppStatus.LOADING ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      Post Message 
                      <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-lg z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-12 space-y-10">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-[1.8rem] flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-inner">
                  <Settings className="w-10 h-10 text-slate-600" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Settings</h2>
                <p className="text-slate-500 text-sm font-bold">Update credentials or connection modes.</p>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Bot OAuth Token</label>
                  <input
                    type="password"
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    placeholder="xoxb-..."
                    className="w-full px-6 py-4 border-2 border-slate-50 rounded-2xl bg-slate-50 focus:bg-white focus:ring-8 focus:ring-indigo-50 focus:border-indigo-500 transition-all outline-none text-sm font-mono shadow-sm"
                  />
                </div>

                <div className="flex items-center justify-between p-5 bg-indigo-50/30 rounded-3xl border border-indigo-100/50">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-indigo-900 flex items-center gap-2 tracking-tight">
                      <Globe className="w-4 h-4" />
                      CORS Proxy Mode
                    </p>
                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider italic">Required for browser-side API calls</p>
                  </div>
                  <button 
                    onClick={() => setUseProxy(!useProxy)}
                    className={`w-14 h-7 rounded-full transition-all relative ${useProxy ? 'bg-indigo-600 shadow-xl shadow-indigo-600/20' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${useProxy ? 'left-8' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-4 px-6 border-2 border-slate-50 rounded-2xl font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-95"
                >
                  Close
                </button>
                <button
                  onClick={() => handleConnect(inputToken)}
                  className="flex-1 py-4 px-6 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-slate-200 transition-all active:scale-95"
                >
                  Update
                </button>
              </div>
              
              <div className="pt-8 border-t border-slate-100">
                <button 
                  onClick={handleLogout}
                  className="w-full py-4 px-6 rounded-2xl text-rose-500 hover:bg-rose-50 font-black transition-all flex items-center justify-center gap-3 text-sm tracking-tight active:scale-95"
                >
                  <LogOut className="w-5 h-5" />
                  Reset Session
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
