/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw, Mail, Inbox, X, Loader2, LogOut, ChevronDown } from 'lucide-react';

const API_BASE = 'https://api.mail.tm';

export default function App() {
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [username, setUsername] = useState('');
  const [account, setAccount] = useState<any>(null);
  const [token, setToken] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load persisted data
  useEffect(() => {
    const savedAccount = localStorage.getItem('mail_account');
    const savedToken = localStorage.getItem('mail_token');
    if (savedAccount && savedToken) {
      setAccount(JSON.parse(savedAccount));
      setToken(savedToken);
    }
    fetchDomains();
  }, []);

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
    if (!username || !selectedDomain) return;
    
    setLoading(true);
    setError('');
    
    const address = `${username}@${selectedDomain}`;
    const password = Math.random().toString(36).slice(-8) + 'A1!'; // Random password
    
    try {
      // Create account
      const accRes = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });
      
      if (!accRes.ok) {
        const errData = await accRes.json();
        throw new Error(errData.message || 'Gagal membuat akun');
      }
      
      const accData = await accRes.json();
      
      // Get token
      const tokenRes = await fetch(`${API_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });
      
      if (!tokenRes.ok) throw new Error('Gagal mendapatkan token');
      
      const tokenData = await tokenRes.json();
      
      setAccount(accData);
      setToken(tokenData.token);
      
      localStorage.setItem('mail_account', JSON.stringify(accData));
      localStorage.setItem('mail_token', tokenData.token);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages
  const fetchMessages = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data['hydra:member'] || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Polling messages
  useEffect(() => {
    if (token) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Read message
  const readMessage = async (id: string) => {
    setMessageLoading(true);
    setSelectedMessage({ id, loading: true });
    try {
      const res = await fetch(`${API_BASE}/messages/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedMessage(data);
      }
    } catch (err) {
      console.error('Failed to read message', err);
      setSelectedMessage(null);
    } finally {
      setMessageLoading(false);
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

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col">
        
        {/* Header */}
        <header className="flex items-center justify-between py-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
              EMAIL PRO
            </h1>
          </div>
          {account && (
            <button 
              onClick={logout}
              className="text-sm font-medium text-purple-200 hover:text-white flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {!account ? (
            // Landing Page
            <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
              <div className="text-center mb-10">
                <h2 className="text-4xl font-bold mb-4 tracking-tight">Temporary Email,<br/>Premium Experience.</h2>
                <p className="text-purple-200/80 text-lg">Buat alamat email sementara yang aman dan instan.</p>
              </div>

              <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
                <form onSubmit={handleGenerate} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">Custom Name</label>
                    <input 
                      type="text" 
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())}
                      placeholder="contoh: john"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">Pilih Domain</label>
                    <div className="relative">
                      <select 
                        value={selectedDomain}
                        onChange={(e) => setSelectedDomain(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      >
                        {domains.length === 0 ? (
                          <option value="">Memuat domain...</option>
                        ) : (
                          domains.map(d => (
                            <option key={d.id} value={d.domain} className="bg-gray-900 text-white">@{d.domain}</option>
                          ))
                        )}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={loading || !username || !selectedDomain}
                    className="w-full bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate Email'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            // Dashboard
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Email Address Card */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <p className="text-sm font-medium text-purple-200 mb-3">Alamat Email Anda</p>
                <div 
                  onClick={copyToClipboard}
                  className="flex items-center justify-between bg-black/20 border border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-black/30 transition-colors group/copy"
                >
                  <span className="text-xl sm:text-2xl font-medium truncate pr-4">{account.address}</span>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/50 group-hover/copy:text-white group-hover/copy:bg-white/10'}`}>
                    <Copy className="w-5 h-5" />
                  </div>
                </div>
                {copied && <p className="text-emerald-400 text-sm mt-3 absolute bottom-4 right-8 animate-in fade-in">Disalin ke clipboard!</p>}
              </div>

              {/* Inbox */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[400px]">
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <Inbox className="w-5 h-5 text-purple-300" />
                    <h3 className="text-lg font-semibold">Kotak Masuk</h3>
                    <span className="bg-purple-500/20 text-purple-300 text-xs font-bold px-2.5 py-1 rounded-full">
                      {messages.length}
                    </span>
                  </div>
                  <button 
                    onClick={fetchMessages}
                    className="p-2 rounded-lg hover:bg-white/10 text-purple-200 hover:text-white transition-colors"
                    title="Refresh Manual"
                  >
                    <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <Loader2 className="w-8 h-8 text-purple-400/50 animate-spin" />
                      </div>
                      <p className="text-purple-200 font-medium">Menunggu email masuk...</p>
                      <p className="text-sm text-purple-200/60 mt-2">Otomatis refresh setiap 10 detik</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/5">
                      {messages.map((msg) => (
                        <li key={msg.id}>
                          <button 
                            onClick={() => readMessage(msg.id)}
                            className="w-full text-left p-4 sm:p-6 hover:bg-white/[0.03] transition-colors flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold text-white truncate pr-4">{msg.from.address}</p>
                                <span className="text-xs text-purple-200/60 whitespace-nowrap">
                                  {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <p className="text-sm text-purple-200 truncate">{msg.subject || '(Tanpa Subjek)'}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Message Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMessage(null)}></div>
          <div className="relative w-full max-w-2xl bg-gray-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-white/10 flex items-start justify-between bg-white/[0.02]">
              <div className="pr-4">
                <h2 className="text-xl font-bold text-white mb-2">{selectedMessage.subject || '(Tanpa Subjek)'}</h2>
                {selectedMessage.from && (
                  <div className="flex items-center gap-2 text-sm text-purple-200">
                    <span className="font-medium text-white">{selectedMessage.from.name || selectedMessage.from.address}</span>
                    <span className="opacity-60">&lt;{selectedMessage.from.address}&gt;</span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setSelectedMessage(null)}
                className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-black/20">
              {messageLoading || selectedMessage.loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  {selectedMessage.html ? (
                    <iframe 
                      srcDoc={selectedMessage.html} 
                      className="w-full min-h-[300px] bg-white rounded-xl"
                      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-purple-100/80 text-sm leading-relaxed">
                      {selectedMessage.text || 'Tidak ada konten'}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

