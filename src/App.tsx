import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  RefreshCw, 
  Copy, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Inbox, 
  ShieldCheck, 
  Zap,
  Clock,
  ExternalLink,
  Plus,
  ArrowLeft,
  Loader2,
  Bell,
  Volume2,
  VolumeX
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { io, Socket } from 'socket.io-client';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  body_preview?: string;
  html?: string;
  text?: string;
}

interface Account {
  address: string;
  token: string;
  id: string;
  provider: 'mail.tm' | 'generator.email' | '1secmail';
  usr?: string;
  dmn?: string;
}

// --- Constants ---
const MAIL_TM_API = 'https://api.mail.tm';
const SECMAIL_API = 'https://www.1secmail.com/api/v1/';

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'success' | 'error' }[]>([]);
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tool, setTool] = useState<'mail.tm' | 'generator.email' | '1secmail'>('mail.tm');
  
  // Custom username/domain for 1secmail or generator.email
  const [username, setUsername] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- API Helpers ---
  const fetchDomains = async () => {
    try {
      addLog(`Fetching domains for ${tool}...`, 'info');
      if (tool === 'mail.tm') {
        const res = await fetch(`${MAIL_TM_API}/domains`);
        const data = await res.json();
        const dmns = data['hydra:member'].map((d: any) => d.domain);
        setDomains(dmns);
        setSelectedDomain(dmns[0] || '');
        addLog(`Loaded ${dmns.length} domains from Mail.tm`, 'success');
      } else if (tool === '1secmail') {
        const res = await fetch(`${SECMAIL_API}?action=getDomainList`);
        const data = await res.json();
        setDomains(data);
        setSelectedDomain(data[0] || '');
        addLog(`Loaded ${data.length} domains from 1secmail`, 'success');
      } else {
        // Mock domains for generator.email proxy
        const dmns = [
          'jymz.xyz', 'tako.skin', 'capcutpro.click', 'clonetrust.com', 
          'sparkletoc.com', 'theweifamily.icu', 'maildoc.org', 'xuseca.cloud',
          'googl.win', 'thip-like.com', 'c-tta.top', 'nowtopzen.com',
          'ebarg.net', 'btcmod.com', 'tmxttvmail.com'
        ];
        setDomains(dmns);
        setSelectedDomain(dmns[0]);
        addLog(`Loaded ${dmns.length} domains for Generator`, 'success');
      }
    } catch (err) {
      addLog('Failed to fetch domains', 'error');
    }
  };

  useEffect(() => {
    fetchDomains();
  }, [tool]);

  const generateAccount = async () => {
    setLoading(true);
    setError(null);
    addLog(`Generating ${tool} account...`, 'info');
    
    try {
      if (tool === 'mail.tm') {
        const domain = selectedDomain || domains[0];
        const usr = username || Math.random().toString(36).substring(7);
        const pwd = Math.random().toString(36).substring(7);
        const address = `${usr}@${domain}`;
        
        const res = await fetch(`${MAIL_TM_API}/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, password: pwd })
        });
        
        if (!res.ok) throw new Error('Failed to create account');
        const data = await res.json();
        
        // Get token
        const tokenRes = await fetch(`${MAIL_TM_API}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, password: pwd })
        });
        const tokenData = await tokenRes.json();
        
        const newAcc: Account = { address, token: tokenData.token, id: data.id, provider: 'mail.tm' };
        setAccount(newAcc);
        addLog(`Account created: ${address}`, 'success');
      } else if (tool === '1secmail') {
        const usr = username || Math.random().toString(36).substring(7);
        const dmn = selectedDomain || domains[0];
        const address = `${usr}@${dmn}`;
        const newAcc: Account = { address, token: '1secmail-token', id: usr, provider: '1secmail', usr, dmn };
        setAccount(newAcc);
        addLog(`1secmail account set: ${address}`, 'success');
      } else {
        // generator.email proxy
        const usr = username || 'user' + Math.floor(Math.random() * 10000);
        const dmn = selectedDomain || 'jymz.xyz';
        const address = `${usr}@${dmn}`;
        
        // Validate via proxy
        const res = await fetch('/api/generator/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usr, dmn })
        });
        
        const text = await res.text();
        
        if (!res.ok) {
          throw new Error(`Server error (${res.status}): ${text || 'Empty response'}`);
        }
        
        let data: any = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          // If not JSON, check if it contains 'good' or 'success'
          if (text.toLowerCase().includes('good') || text.toLowerCase().includes('success')) {
            data = { status: 'good' };
          } else {
            throw new Error(`Invalid response format: ${text.substring(0, 50)}...`);
          }
        }
        
        if (data.status === 'good' || data.status === 'success' || text.includes('good')) {
          const newAcc: Account = { address, token: 'gen-token', id: usr, provider: 'generator.email', usr, dmn };
          setAccount(newAcc);
          addLog(`Generator.email approved: ${address}`, 'success');
        } else {
          throw new Error('Domain not supported or validation failed');
        }
      }
    } catch (err: any) {
      setError(err.message);
      addLog(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = useCallback(async () => {
    if (!account) return;
    setFetchingEmails(true);
    
    try {
      if (account.provider === 'mail.tm') {
        const res = await fetch(`${MAIL_TM_API}/messages`, {
          headers: { 'Authorization': `Bearer ${account.token}` }
        });
        const data = await res.json();
        const msgs = data['hydra:member'].map((m: any) => ({
          id: m.id,
          from: m.from.address,
          subject: m.subject,
          date: new Date(m.createdAt).toLocaleString(),
          body_preview: m.intro
        }));
        setEmails(msgs);
        if (msgs.length > emails.length && soundEnabled) {
          new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(() => {});
        }
      } else if (account.provider === '1secmail') {
        const res = await fetch(`${SECMAIL_API}?action=getMessages&login=${account.usr}&domain=${account.dmn}`);
        const data = await res.json();
        const msgs = data.map((m: any) => ({
          id: m.id.toString(),
          from: m.from,
          subject: m.subject,
          date: m.date,
          body_preview: 'Click to read'
        }));
        setEmails(msgs);
      } else if (account.provider === 'generator.email') {
        const res = await fetch(`/api/generator/inbox?usr=${account.usr}&dmn=${account.dmn}`);
        const data = await res.json();
        if (data.status === 'success') {
          setEmails(data.emails);
          if (data.emails.length > emails.length && soundEnabled) {
            new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(() => {});
          }
        }
      }
    } catch (err) {
      addLog('Failed to fetch emails', 'error');
    } finally {
      setFetchingEmails(false);
    }
  }, [account, emails.length, soundEnabled]);

  const readEmail = async (id: string) => {
    if (!account) return;
    setLoading(true);
    try {
      if (account.provider === 'mail.tm') {
        const res = await fetch(`${MAIL_TM_API}/messages/${id}`, {
          headers: { 'Authorization': `Bearer ${account.token}` }
        });
        const data = await res.json();
        setSelectedEmail({
          id: data.id,
          from: data.from.address,
          subject: data.subject,
          date: new Date(data.createdAt).toLocaleString(),
          html: data.html?.[0] || data.text,
          text: data.text
        });
      } else if (account.provider === '1secmail') {
        const res = await fetch(`${SECMAIL_API}?action=readMessage&login=${account.usr}&domain=${account.dmn}&id=${id}`);
        const data = await res.json();
        setSelectedEmail({
          id: data.id.toString(),
          from: data.from,
          subject: data.subject,
          date: data.date,
          html: data.htmlBody || data.body,
          text: data.body
        });
      } else if (account.provider === 'generator.email') {
        const res = await fetch(`/api/generator/message?usr=${account.usr}&dmn=${account.dmn}&id=${id}`);
        const data = await res.json();
        if (data.status === 'success') {
          setSelectedEmail(data.data);
        }
      }
    } catch (err) {
      addLog('Failed to read email', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account?.provider === 'generator.email') {
      const socket: Socket = io('wss://generator.email', {
        path: '/socket.io',
        transports: ['websocket']
      });

      const channel = `${account.usr}@${account.dmn}`.toLowerCase();
      
      socket.on('connect', () => {
        addLog('Connected to Generator.email real-time stream', 'info');
        socket.emit('watch_for_my_email', channel);
      });

      socket.on('new_email', (data) => {
        addLog('New email received via real-time stream!', 'success');
        fetchEmails();
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [account, fetchEmails]);

  useEffect(() => {
    if (account) {
      const interval = setInterval(fetchEmails, 10000);
      fetchEmails();
      return () => clearInterval(interval);
    }
  }, [account, fetchEmails]);

  const copyEmail = () => {
    if (account) {
      navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addLog('Email copied to clipboard', 'success');
    }
  };

  const reset = () => {
    setAccount(null);
    setEmails([]);
    setSelectedEmail(null);
    setLogs([]);
    addLog('System reset', 'info');
  };

  // --- UI Components ---
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Email Generator</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Disposable Temp Mail</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-zinc-800">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-zinc-400">System Online</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Generator & Logs */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Generator Card */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Zap className="w-32 h-32 text-indigo-500" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Generate Mail
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Provider</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'mail.tm', label: 'Mail.tm' },
                      { id: '1secmail', label: '1secmail' },
                      { id: 'generator.email', label: 'Generator' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTool(p.id as any);
                          addLog(`Switched to ${p.label} provider`, 'info');
                        }}
                        className={cn(
                          "py-2.5 text-[10px] font-bold rounded-xl border transition-all uppercase tracking-tight cursor-pointer",
                          tool === p.id 
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                            : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600 active:scale-95"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Username (Optional)</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. jason_born"
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Domain</label>
                <select 
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                >
                  {domains.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={generateAccount}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 group"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                {account ? 'Generate New' : 'Create Account'}
              </button>
            </div>
          </div>
        </section>

          {/* Logs Card */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 h-[300px] flex flex-col">
            <h2 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4" />
              System Activity
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 italic text-sm">
                  <p>No activity yet...</p>
                </div>
              )}
              {logs.map((log, i) => (
                <div key={i} className="text-[11px] font-mono flex gap-2 leading-relaxed animate-in fade-in slide-in-from-left-2">
                  <span className="text-zinc-600">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                  <span className={cn(
                    log.type === 'success' ? 'text-emerald-400' : 
                    log.type === 'error' ? 'text-rose-400' : 'text-zinc-400'
                  )}>
                    {log.msg}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </section>
        </div>

        {/* Right Column: Inbox & Content */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Active Account Banner */}
          <AnimatePresence mode="wait">
            {account ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-indigo-600 rounded-3xl p-6 shadow-2xl shadow-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
                <div className="flex items-center gap-4 z-10">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <ShieldCheck className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Your Temporary Address</p>
                    <h3 className="text-xl sm:text-2xl font-black text-white break-all">{account.address}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2 z-10">
                  <button 
                    onClick={copyEmail}
                    className="bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl px-4 py-3 font-bold flex items-center gap-2 transition-all active:scale-95"
                  >
                    {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button 
                    onClick={reset}
                    className="bg-indigo-700/50 hover:bg-indigo-700 text-white rounded-xl p-3 transition-all"
                    title="Delete Account"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-3xl p-12 text-center"
              >
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-xl font-bold text-zinc-400 mb-2">No Active Mailbox</h3>
                <p className="text-zinc-600 max-w-xs mx-auto text-sm">Generate a temporary email address to start receiving messages anonymously.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inbox Area */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden min-h-[500px] flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-indigo-400" />
                <h2 className="font-bold">Inbox</h2>
                {emails.length > 0 && (
                  <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {emails.length}
                  </span>
                )}
              </div>
              <button 
                onClick={fetchEmails}
                disabled={!account || fetchingEmails}
                className="text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-2 transition-colors disabled:opacity-30"
              >
                <RefreshCw className={cn("w-4 h-4", fetchingEmails && "animate-spin")} />
                Refresh
              </button>
            </div>

            <div className="flex-1 relative">
              <AnimatePresence mode="wait">
                {selectedEmail ? (
                  <motion.div 
                    key="viewer"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute inset-0 bg-zinc-900 flex flex-col z-20"
                  >
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                      <button 
                        onClick={() => setSelectedEmail(null)}
                        className="flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Inbox
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-500">{selectedEmail.date}</span>
                      </div>
                    </div>
                    <div className="p-6 border-b border-zinc-800">
                      <h3 className="text-xl font-bold mb-2">{selectedEmail.subject}</h3>
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <span className="font-semibold text-indigo-400">From:</span>
                        {selectedEmail.from}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-white text-zinc-900 custom-scrollbar selection:bg-indigo-200">
                      {selectedEmail.html ? (
                        <div dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans text-sm">{selectedEmail.text}</pre>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="divide-y divide-zinc-800/50"
                  >
                    {emails.length === 0 ? (
                      <div className="py-32 flex flex-col items-center justify-center text-zinc-700">
                        {fetchingEmails ? (
                          <Loader2 className="w-12 h-12 animate-spin mb-4 opacity-20" />
                        ) : (
                          <Inbox className="w-12 h-12 mb-4 opacity-10" />
                        )}
                        <p className="text-sm font-medium">{fetchingEmails ? 'Checking for new mail...' : 'Waiting for incoming mail...'}</p>
                        <p className="text-[10px] uppercase tracking-widest mt-2 opacity-50">Updates every 10 seconds</p>
                      </div>
                    ) : (
                      emails.map((email) => (
                        <button
                          key={email.id}
                          onClick={() => readEmail(email.id)}
                          className="w-full px-6 py-5 flex items-start gap-4 hover:bg-indigo-600/5 transition-colors text-left group"
                        >
                          <div className="w-10 h-10 bg-zinc-800 rounded-xl flex-shrink-0 flex items-center justify-center group-hover:bg-indigo-600/20 transition-colors">
                            <Mail className="w-5 h-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-zinc-200 truncate pr-4">{email.from}</span>
                              <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">{email.date}</span>
                            </div>
                            <h4 className="text-sm font-medium text-zinc-400 truncate mb-1">{email.subject}</h4>
                            <p className="text-xs text-zinc-600 truncate">{email.body_preview}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-700 mt-1 group-hover:text-indigo-400 transition-colors" />
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: ShieldCheck, title: 'Privacy First', desc: 'No registration, no personal data required.' },
              { icon: Zap, title: 'Instant Delivery', desc: 'Emails arrive in real-time with zero delay.' },
              { icon: Clock, title: 'Auto-Delete', desc: 'Messages are automatically purged after use.' }
            ].map((feature, i) => (
              <div key={i} className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4 flex items-start gap-3">
                <div className="p-2 bg-zinc-800 rounded-lg">
                  <feature.icon className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold mb-1">{feature.title}</h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-zinc-800/50 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-30 grayscale">
            <Mail className="w-5 h-5" />
            <span className="font-bold tracking-tighter">EMAIL GENERATOR</span>
          </div>
          <div className="flex items-center gap-8 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">API Documentation</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Contact</a>
          </div>
          <p className="text-[10px] text-zinc-600 font-mono">© 2026 TEMP-MAIL-GEN.SYSTEM</p>
        </div>
      </footer>

      {/* Global Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}
