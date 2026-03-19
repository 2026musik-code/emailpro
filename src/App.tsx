/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Copy, RefreshCw, Mail, Inbox, X, Loader2, LogOut, ChevronDown, Menu, Trash2, Languages, Terminal } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const API_BASE = 'https://api.mail.tm';

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

export default function App() {
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [username, setUsername] = useState('');
  const [account, setAccount] = useState<any>(null);
  const [token, setToken] = useState('');
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [tool, setTool] = useState<'mail.tm' | 'generator.email'>('mail.tm');
  const [generatorDomain, setGeneratorDomain] = useState('g-mail.kr');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [domainStatuses, setDomainStatuses] = useState<Record<string, boolean>>({});
  const [checkingDomains, setCheckingDomains] = useState(false);
  const [isDomainDropdownOpen, setIsDomainDropdownOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const VIP_DOMAINS = [
    { category: '👑 ELITE', domains: [{ name: 'googl.win', uptime: '821d' }, { name: 'maildoc.org', uptime: '159d' }, { name: 'capcutpro.click', uptime: '120d' }, { name: 'g-mail.kr', uptime: '113d' }, { name: 'jymz.xyz', uptime: '72d' }] },
    { category: '⚡ FAST OTP', domains: [{ name: 'id-mail.kr' }, { name: 'getcode1.com' }, { name: 'codemail1.com' }, { name: '681mail.com' }, { name: 'katanajp.shop' }, { name: 'my-mail.kr' }, { name: 'mail-id.kr' }, { name: 'kr-mail.kr' }, { name: 'getcode.com' }] },
    { category: '🌏 ASIA & INDO', domains: [{ name: 'akunku.shop' }, { name: 'berkahfb.com' }, { name: 'chatgptku.pro' }, { name: 'autoxugiare.com' }, { name: 'clonechatluong.net' }] },
    { category: '🌐 GLOBAL', domains: [{ name: 'travelistaworld.com' }, { name: 'xcvv.xyz' }, { name: 'gglorytogod.com' }, { name: 'gmail2.gq' }, { name: '11jac.com' }, { name: 'btcmod.com' }, { name: 'gapura.cloud' }, { name: 'nusantara.xyz' }] }
  ];

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [{
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      message,
      type
    }, ...prev].slice(0, 50));
  };

  // Load persisted data
  useEffect(() => {
    const savedAccount = localStorage.getItem('mail_account');
    const savedToken = localStorage.getItem('mail_token');
    
    // Fetch accounts from R2 backend
    fetch('/api/accounts')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setSavedAccounts(data);
          localStorage.setItem('saved_accounts', JSON.stringify(data));
        } else {
          // Fallback to local storage if R2 is empty or not configured
          const savedAccs = localStorage.getItem('saved_accounts');
          if (savedAccs) {
            setSavedAccounts(JSON.parse(savedAccs));
          } else if (savedAccount && savedToken) {
            const acc = JSON.parse(savedAccount);
            const accounts = [{ address: acc.address, token: savedToken, id: acc.id }];
            setSavedAccounts(accounts);
            localStorage.setItem('saved_accounts', JSON.stringify(accounts));
            syncAccountsToR2(accounts);
          }
        }
      })
      .catch(err => {
        console.error('Failed to fetch accounts from R2', err);
        const savedAccs = localStorage.getItem('saved_accounts');
        if (savedAccs) setSavedAccounts(JSON.parse(savedAccs));
      });

    if (savedAccount && savedToken) {
      setAccount(JSON.parse(savedAccount));
      setToken(savedToken);
    }
    fetchDomains();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && account) {
      interval = setInterval(() => {
        fetchMessages(account);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, account]);

  const highlightOTP = (text: string) => {
    return text.replace(/\b\d{6}\b/g, (match) => {
      navigator.clipboard.writeText(match);
      return `<span class="text-4xl font-bold text-green-400 bg-black p-2 rounded-lg border-2 border-green-400 shadow-[0_0_10px_#4ade80]">${match}</span>`;
    });
  };

  const syncAccountsToR2 = async (accounts: any[]) => {
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts })
      });
    } catch (err) {
      console.error('Failed to sync accounts to R2', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDomainDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (tool === 'generator.email' && Object.keys(domainStatuses).length === 0 && !checkingDomains) {
      checkGeneratorDomains();
    }
  }, [tool]);

  const checkGeneratorDomains = async () => {
    setCheckingDomains(true);
    const allDomains = VIP_DOMAINS.flatMap(c => c.domains);
    
    const checkDomain = async (domain: string) => {
      try {
        const res = await fetch('/api/generator/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usr: 'testchk' + Math.floor(Math.random()*1000), dmn: domain })
        });
        const data = await res.json();
        const isOnline = data.uptime !== 'offline';
        setDomainStatuses(prev => ({ ...prev, [domain]: isOnline }));
      } catch {
        setDomainStatuses(prev => ({ ...prev, [domain]: false }));
      }
    };

    // Process in batches of 3 to avoid overwhelming the proxy
    for (let i = 0; i < allDomains.length; i += 3) {
      const batch = allDomains.slice(i, i + 3);
      await Promise.all(batch.map(d => checkDomain(d.name)));
    }
    setCheckingDomains(false);
  };

  const syncEmailsToR2 = async (accountId: string, emails: any[]) => {
    try {
      await fetch(`/api/emails/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
      });
    } catch (err) {
      console.error('Failed to sync emails to R2', err);
    }
  };

  // Fetch domains
  const fetchDomains = async () => {
    try {
      const res = await fetch(`${API_BASE}/domains`);
      const data = await res.json();
      if (data['hydra:member']) {
        setDomains(data['hydra:member']);
        if (data['hydra:member'].length > 0) {
          setSelectedDomain(data['hydra:member'][0].domain);
        }
      }
    } catch (err) {
      console.error('Failed to fetch domains', err);
    }
  };

  // Generate Email
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (tool === 'mail.tm') {
        if (!username || !selectedDomain) return;
        
        const address = `${username}@${selectedDomain}`;
        const password = Math.random().toString(36).slice(-8) + 'A1!'; // Random password
        
        addLog(`Creating mail.tm account: ${address}`, 'info');
        
        // Create account
        const accRes = await fetch(`${API_BASE}/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, password })
        });
        
        if (!accRes.ok) {
          const errData = await accRes.json();
          addLog(`mail.tm error: ${errData.message}`, 'error');
          throw new Error(errData.message || 'Gagal membuat akun');
        }
        
        const accData = await accRes.json();
        addLog(`mail.tm account created: ${accData.id}`, 'success');
        
        // Get token
        const tokenRes = await fetch(`${API_BASE}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, password })
        });
        
        if (!tokenRes.ok) {
          addLog('Failed to get mail.tm token', 'error');
          throw new Error('Gagal mendapatkan token');
        }
        
        const tokenData = await tokenRes.json();
        addLog('mail.tm token received', 'success');
        
        const newAccount = { ...accData, provider: 'mail.tm' };
        setAccount(newAccount);
        setToken(tokenData.token);
        
        localStorage.setItem('mail_account', JSON.stringify(newAccount));
        localStorage.setItem('mail_token', tokenData.token);
        
        const newAcc = { address: accData.address, token: tokenData.token, id: accData.id, provider: 'mail.tm' };
        const updatedAccounts = [newAcc, ...savedAccounts.filter(a => a.id !== accData.id)];
        setSavedAccounts(updatedAccounts);
        localStorage.setItem('saved_accounts', JSON.stringify(updatedAccounts));
        syncAccountsToR2(updatedAccounts);
      } else if (tool === 'generator.email') {
        const usr = username || Math.random().toString(36).substring(2, 10);
        const dmn = generatorDomain || 'g-mail.kr';
        
        addLog(`Validating generator.email: ${usr}@${dmn}`, 'info');
        
        const response = await fetch('/api/generator/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usr, dmn })
        });
        
        if (!response.ok) {
          addLog(`HTTP Error: ${response.status}`, 'error');
          // Don't throw, just proceed
        } else {
          const data = await response.json();
          addLog(`Response: ${JSON.stringify(data)}`, data.status === 'bad' ? 'error' : 'success');
          
          if (data.status === 'bad' && data.uptime !== 'offline') {
            throw new Error(`Generator.email error: ${JSON.stringify(data)}`);
          }
        }
        
        const newAccount = {
          id: `gen-${Date.now()}`,
          address: `${usr}@${dmn}`,
          provider: 'generator.email',
          usr,
          dmn
        };
        
        setAccount(newAccount);
        setToken('generator-token'); // dummy token
        
        localStorage.setItem('mail_account', JSON.stringify(newAccount));
        localStorage.setItem('mail_token', 'generator-token');
        
        const newAcc = { address: newAccount.address, token: 'generator-token', id: newAccount.id, provider: 'generator.email', usr, dmn };
        const updatedAccounts = [newAcc, ...savedAccounts.filter(a => a.id !== newAccount.id)];
        setSavedAccounts(updatedAccounts);
        localStorage.setItem('saved_accounts', JSON.stringify(updatedAccounts));
        syncAccountsToR2(updatedAccounts);
      }
    } catch (err: any) {
      addLog(`Error: ${err.message}`, 'error');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages
  const fetchMessages = async (acc = account) => {
    if (!acc) return;
    
    // Ensure we use the correct usr and dmn for generator.email
    const usr = acc.usr || acc.address?.split('@')[0];
    const dmn = acc.dmn || acc.address?.split('@')[1];
    
    const currentToken = acc.token || token;
    if (!currentToken && acc.provider !== 'generator.email') return;
    
    setRefreshing(true);
    
    const fetchWithRetry = async (url: string, options: any, retries = 3): Promise<Response> => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fetch(url, options);
        } catch (err) {
          if (i === retries - 1) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      throw new Error('Failed to fetch after retries');
    };

    try {
      if (acc.provider === 'generator.email') {
        addLog(`Fetching inbox for generator.email: ${usr}@${dmn}`, 'info');
        const response = await fetchWithRetry(`/api/generator/inbox?usr=${usr}&dmn=${dmn}`, {});
        
        if (!response.ok) {
          throw new Error(`Generator.email inbox fetch failed: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        const text = await response.text();
        
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Received non-JSON response:', text);
          addLog(`Received non-JSON response from server. Check console for details.`, 'error');
          throw new Error('Invalid JSON response from server');
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          addLog(`Failed to parse JSON from generator.email: ${text.substring(0, 50)}...`, 'error');
          throw new Error('Invalid JSON response from server');
        }
        
        addLog(`Generator.email response: ${JSON.stringify(data).substring(0, 200)}`, 'info');
        
        const messagesList: any[] = [];
        
        if (data.status === 'success' && data.emails && data.emails.length > 0) {
          addLog(`Found ${data.emails.length} messages in generator.email inbox`, 'success');
          
          data.emails.forEach((msg: any) => {
            messagesList.push({
              id: msg.id,
              from: { address: msg.from, name: msg.from },
              subject: msg.subject,
              createdAt: new Date().toISOString(),
              html: msg.body_preview,
              text: msg.body_preview,
              intro: msg.body_preview
            });
          });
        } else {
          addLog(`No messages found in generator.email inbox`, 'info');
        }
        
        setMessages(messagesList);
        if (messagesList.length > 0 && acc.id) {
          syncEmailsToR2(acc.id, messagesList);
        }
      } else {
        addLog(`Fetching inbox for mail.tm`, 'info');
        const res = await fetchWithRetry(`${API_BASE}/messages`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          addLog(`Found ${data['hydra:member']?.length || 0} messages in mail.tm`, 'success');
          setMessages(data['hydra:member'] || []);
          if (data['hydra:member'] && data['hydra:member'].length > 0 && acc.id) {
            syncEmailsToR2(acc.id, data['hydra:member']);
          }
        } else {
          throw new Error(`Mail.tm inbox fetch failed: ${res.status} ${res.statusText}`);
        }
      }
    } catch (err: any) {
      addLog(`Fetch messages error: ${err.message}`, 'error');
      console.error('Failed to fetch messages', err);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Polling messages
  useEffect(() => {
    if (token || account?.provider === 'generator.email') {
      fetchMessages();
      const interval = setInterval(fetchMessages, 10000);
      return () => clearInterval(interval);
    }
  }, [token, account]);

  // Read message
  const readMessage = async (id: string) => {
    setMessageLoading(true);
    setSelectedMessage({ id, loading: true });
    setShowTranslation(false);
    try {
      if (account?.provider === 'generator.email') {
        const msg = messages.find(m => m.id === id);
        if (msg) {
          setSelectedMessage({ ...msg, loading: false });
        }
      } else {
        const res = await fetch(`${API_BASE}/messages/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSelectedMessage(data);
        }
      }
    } catch (err) {
      console.error('Failed to read message', err);
      setSelectedMessage(null);
    } finally {
      setMessageLoading(false);
    }
  };

  const switchAccount = (acc: any) => {
    setAccount(acc);
    setToken(acc.token);
    localStorage.setItem('mail_account', JSON.stringify(acc));
    localStorage.setItem('mail_token', acc.token);
    setIsSidebarOpen(false);
    setMessages([]);
    fetchMessages(acc);
  };

  const deleteAccount = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(a => a.id !== id);
    setSavedAccounts(updated);
    localStorage.setItem('saved_accounts', JSON.stringify(updated));
    syncAccountsToR2(updated);
    if (account?.id === id) {
      logout();
    }
  };

  const copyToClipboard = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const logout = () => {
    localStorage.removeItem('mail_account');
    localStorage.removeItem('mail_token');
    setAccount(null);
    setToken('');
    setMessages([]);
  };

  const translateEmail = async () => {
    if (!selectedMessage || isTranslating) return;
    
    // Toggle if already translated
    if (selectedMessage.translatedHtml || selectedMessage.translatedText) {
      setShowTranslation(!showTranslation);
      return;
    }

    setIsTranslating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const isHtml = !!selectedMessage.html;
      const contentToTranslate = isHtml ? selectedMessage.html : selectedMessage.text;
      
      const prompt = `Terjemahkan konten email berikut ke bahasa Indonesia. 
      ${isHtml ? 'Konten ini dalam format HTML. Anda HARUS mempertahankan struktur HTML, tag, dan gaya persis seperti aslinya, dan HANYA terjemahkan teks di dalam tag tersebut.' : 'Konten ini adalah teks biasa.'}
      
      Berikut adalah kontennya:
      ${contentToTranslate}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      const translatedText = response.text;
      
      setSelectedMessage((prev: any) => ({
        ...prev,
        [isHtml ? 'translatedHtml' : 'translatedText']: translatedText
      }));
      setShowTranslation(true);
    } catch (err) {
      console.error('Translation failed', err);
      // Fallback or alert could be added here, but we'll just log it to keep UI clean
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500/30 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-2 -ml-2 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-all active:scale-95"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white hidden xs:block">
              EMAIL PRO
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 sm:p-2.5 rounded-xl transition-all active:scale-95 ${autoRefresh ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`}
            title="Auto-Refresh Inbox (5s)"
          >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className={`p-2 sm:p-2.5 rounded-xl transition-all active:scale-95 ${showLogs ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`}
            title="System Logs"
          >
            <Terminal className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="relative group">
            <select 
              value={tool} 
              onChange={(e) => setTool(e.target.value as any)}
              className="appearance-none bg-[#1a1a1a] border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 pr-8 sm:pr-10 text-xs sm:text-sm font-medium text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 hover:bg-[#222] transition-all cursor-pointer"
            >
              <option value="mail.tm">Mail.tm</option>
              <option value="generator.email">Generator.email</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {account && (
            <button 
              onClick={logout}
              className="text-xs sm:text-sm font-medium text-red-400/80 hover:text-red-400 flex items-center gap-1.5 sm:gap-2 transition-all px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl hover:bg-red-500/10 active:scale-95"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {!account ? (
          // Landing Page
          <div className="flex-1 flex flex-col items-center justify-center sm:justify-start mt-4 sm:mt-12 w-full max-w-md mx-auto">
            <div className="w-full bg-slate-900 border border-slate-800 rounded-[24px] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              {/* Decorative background glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="text-center mb-8 relative z-10">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">Buat Email Baru</h2>
                <p className="text-gray-400 text-sm sm:text-base">Pilih nama dan domain untuk email Anda</p>
              </div>
              <form onSubmit={handleGenerate} className="space-y-5 relative z-10">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Nama Email</label>
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())}
                    placeholder="contoh: john"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-base"
                  />
                </div>
                {tool === 'mail.tm' ? (
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-amber-500 mb-2 uppercase tracking-wider">Domain</label>
                    <div className="relative">
                      <select 
                        value={selectedDomain}
                        onChange={(e) => setSelectedDomain(e.target.value)}
                        className="w-full bg-black border-2 border-purple-600 rounded-xl px-4 py-3.5 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-base"
                      >
                        {VIP_DOMAINS.map((group) => (
                          <optgroup key={group.category} label={group.category} className="bg-black text-purple-400 font-bold">
                            {group.domains.map((d) => (
                              <option key={d.name} value={d.name} className="bg-black text-white">
                                {group.category === '👑 ELITE' ? '● ' : ''}{d.name} {d.uptime ? `(${d.uptime})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-amber-500">
                        <ChevronDown className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Domain (Generator.email)</label>
                    <div className="relative" ref={dropdownRef}>
                      <input 
                        type="text" 
                        required
                        value={generatorDomain}
                        onChange={(e) => setGeneratorDomain(e.target.value.toLowerCase())}
                        onFocus={() => setIsDomainDropdownOpen(true)}
                        placeholder="Pilih atau ketik domain..."
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-base pr-16"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                        {domainStatuses[generatorDomain] === undefined && generatorDomain ? (
                           <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                        ) : domainStatuses[generatorDomain] === true ? (
                           <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Online"></span>
                        ) : domainStatuses[generatorDomain] === false ? (
                           <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" title="Offline"></span>
                        ) : null}
                        <ChevronDown 
                          className={`w-5 h-5 text-gray-500 transition-transform cursor-pointer hover:text-gray-300 ${isDomainDropdownOpen ? 'rotate-180' : ''}`} 
                          onClick={() => setIsDomainDropdownOpen(!isDomainDropdownOpen)} 
                        />
                      </div>

                      {isDomainDropdownOpen && (
                        <div className="absolute z-50 w-full mt-2 bg-[#111] border border-white/10 rounded-xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar">
                          {VIP_DOMAINS.map((category, idx) => (
                            <div key={idx} className="py-2">
                              <div className="px-4 py-1.5 text-[10px] sm:text-xs font-bold text-indigo-400/80 uppercase tracking-wider bg-white/5 sticky top-0 backdrop-blur-md z-10">
                                {category.category}
                              </div>
                              {category.domains.map(domain => (
                                <div 
                                  key={domain.name}
                                  onClick={() => {
                                    setGeneratorDomain(domain.name);
                                    setIsDomainDropdownOpen(false);
                                  }}
                                  className="px-4 py-2.5 hover:bg-white/10 cursor-pointer flex items-center justify-between transition-colors"
                                >
                                  <span className="text-sm text-gray-200">{domain.name}</span>
                                  <div className="flex items-center gap-2">
                                    {category.category === '👑 ELITE' && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <p>{error}</p>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading || !username || (tool === 'mail.tm' && !selectedDomain) || (tool === 'generator.email' && !generatorDomain)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 font-semibold text-base py-4 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buat Email Sekarang'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          // Dashboard
          <div className="flex-1 flex flex-col space-y-4 sm:space-y-6 animate-in fade-in duration-500">
            {/* Email Address Card */}
            <div className="bg-[#111] border border-indigo-500/20 rounded-[24px] p-5 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden shadow-xl shadow-black/50">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <div className="relative z-10">
                <p className="text-xs sm:text-sm font-semibold text-indigo-400/80 mb-1.5 uppercase tracking-wider">Alamat Email Aktif</p>
                <p className="text-xl sm:text-3xl font-bold text-white tracking-tight break-all">{account.address}</p>
              </div>
              <button 
                onClick={copyToClipboard}
                className="relative z-10 flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl px-5 py-3 transition-all group/copy active:scale-95 w-full sm:w-auto"
              >
                {copied ? (
                  <>
                    <span className="text-indigo-400 text-sm font-semibold">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 group-hover/copy:text-indigo-300" />
                    <span className="text-sm font-semibold text-indigo-300 group-hover/copy:text-indigo-200">Salin Alamat</span>
                  </>
                )}
              </button>
            </div>

            {/* Inbox */}
            <div className="bg-[#111] border border-white/10 rounded-[24px] overflow-hidden flex flex-col flex-1 min-h-[500px] shadow-xl shadow-black/50">
              <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between bg-[#161616]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Inbox className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight">Kotak Masuk</h3>
                  <span className="bg-white/10 text-gray-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    {messages.length}
                  </span>
                </div>
                <button 
                  onClick={() => fetchMessages()}
                  className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
                {refreshing ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4 py-12">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                    <p className="text-gray-300 font-medium text-lg">Memuat pesan...</p>
                    <p className="text-sm text-gray-500 mt-1">Mohon tunggu sebentar</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4 py-12">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <Inbox className="w-8 h-8 text-gray-500" />
                    </div>
                    <p className="text-gray-300 font-medium text-lg">Kotak masuk kosong</p>
                    <p className="text-sm text-gray-500 mt-1">Menunggu pesan baru masuk...</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {messages.map((msg) => {
                      const senderInitial = (msg.from?.name || msg.from?.address || '?').charAt(0).toUpperCase();
                      return (
                        <li key={msg.id}>
                          <button 
                            onClick={() => readMessage(msg.id)}
                            className="w-full text-left p-4 sm:p-5 hover:bg-white/5 transition-colors flex items-start gap-3 sm:gap-4 group active:bg-white/10"
                          >
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
                              <span className="text-white font-bold text-base sm:text-lg">{senderInitial}</span>
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center justify-between mb-1 gap-2">
                                <p className="font-semibold text-gray-200 truncate group-hover:text-indigo-300 transition-colors text-sm sm:text-base">
                                  {msg.from?.name || msg.from?.address || 'Unknown'}
                                </p>
                                <span className="text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">
                                  {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors">
                                {msg.subject || '(Tanpa Subjek)'}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative w-[280px] max-w-[85vw] bg-[#0a0a0a] border-r border-white/10 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#111]">
              <h2 className="font-semibold text-white tracking-tight">Akun Tersimpan</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 -mr-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {savedAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <p className="text-sm font-medium text-gray-500">Belum ada akun tersimpan</p>
                </div>
              ) : (
                savedAccounts.map(acc => (
                  <div 
                    key={acc.id} 
                    onClick={() => switchAccount(acc)} 
                    className={`w-full text-left p-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-between group ${account?.id === acc.id ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 shadow-lg shadow-indigo-500/5' : 'bg-[#111] text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-white/5'}`}
                  >
                    <div className="flex flex-col truncate pr-3">
                      <div className="flex items-center">
                        <Mail className={`w-4 h-4 mr-3 shrink-0 ${account?.id === acc.id ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-400'}`} />
                        <p className="text-sm font-semibold truncate">{acc.address}</p>
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 ml-7 mt-1 uppercase tracking-widest">{acc.provider || 'mail.tm'}</span>
                    </div>
                    <button 
                      onClick={(e) => deleteAccount(e, acc.id)} 
                      className="p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95"
                      title="Hapus Akun"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedMessage(null)}></div>
          <div className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between bg-[#111]">
              <div className="pr-4 flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-3">
                  <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight tracking-tight truncate">{selectedMessage.subject || '(Tanpa Subjek)'}</h2>
                  {!messageLoading && !selectedMessage.loading && (
                    <button
                      onClick={translateEmail}
                      disabled={isTranslating}
                      className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border shrink-0 active:scale-95 w-fit ${
                        showTranslation 
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                      title="Terjemahkan ke Bahasa Indonesia"
                    >
                      {isTranslating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Languages className="w-4 h-4" />
                      )}
                      {showTranslation ? 'Teks Asli' : 'Terjemahkan'}
                    </button>
                  )}
                </div>
                {selectedMessage.from && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                    <span className="font-semibold text-gray-200">{selectedMessage.from.name || selectedMessage.from.address}</span>
                    <span className="text-gray-500 text-xs sm:text-sm truncate">&lt;{selectedMessage.from.address}&gt;</span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setSelectedMessage(null)}
                className="p-2.5 -mr-2 -mt-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all shrink-0 active:scale-95 bg-black/20"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-0 overflow-y-auto flex-1 bg-white relative" style={{ WebkitOverflowScrolling: 'touch' }}>
              {messageLoading || selectedMessage.loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <div className="w-full h-full min-h-[500px]">
                  {selectedMessage.html ? (
                    <iframe 
                      srcDoc={showTranslation && selectedMessage.translatedHtml ? selectedMessage.translatedHtml : selectedMessage.html} 
                      className="w-full h-full min-h-[500px] border-0"
                      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                    />
                  ) : (
                    <div className="p-6 sm:p-8 bg-[#0a0a0a] h-full">
                      <div 
                        className="whitespace-pre-wrap font-sans text-gray-300 text-sm sm:text-base leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: highlightOTP(showTranslation && selectedMessage.translatedText ? selectedMessage.translatedText : (selectedMessage.text || 'Tidak ada konten'))
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setShowLogs(false)}></div>
          <div className="relative bg-[#0a0a0a] border border-white/10 rounded-[24px] w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-white/10 bg-[#111]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">System Logs</h2>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button 
                  onClick={() => setLogs([])}
                  className="px-3 py-1.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs sm:text-sm font-semibold active:scale-95"
                >
                  Clear
                </button>
                <button 
                  onClick={() => setShowLogs(false)}
                  className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#050505] font-mono text-xs sm:text-sm space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
              {logs.length === 0 ? (
                <div className="text-gray-500 text-center py-12 flex flex-col items-center justify-center">
                  <Terminal className="w-8 h-8 text-gray-600 mb-3" />
                  <p>No logs available</p>
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 border-b border-white/5 pb-3 last:border-0 hover:bg-white/5 p-2 rounded-lg transition-colors">
                    <span className="text-gray-500 shrink-0 font-medium">[{log.time}]</span>
                    <span className={`break-all leading-relaxed ${
                      log.type === 'error' ? 'text-red-400 font-medium' : 
                      log.type === 'success' ? 'text-emerald-400 font-medium' : 
                      'text-gray-300'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

