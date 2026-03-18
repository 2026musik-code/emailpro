/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw, Mail, Inbox, X, Loader2, LogOut, ChevronDown, Menu, Trash2 } from 'lucide-react';

const API_BASE = 'https://api.mail.tm';

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
      
      const newAcc = { address: accData.address, token: tokenData.token, id: accData.id };
      const updatedAccounts = [newAcc, ...savedAccounts.filter(a => a.id !== accData.id)];
      setSavedAccounts(updatedAccounts);
      localStorage.setItem('saved_accounts', JSON.stringify(updatedAccounts));
      syncAccountsToR2(updatedAccounts);
      
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
        if (data['hydra:member'] && data['hydra:member'].length > 0 && account?.id) {
          syncEmailsToR2(account.id, data['hydra:member']);
        }
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

  const switchAccount = (acc: any) => {
    setAccount({ address: acc.address, id: acc.id });
    setToken(acc.token);
    localStorage.setItem('mail_account', JSON.stringify({ address: acc.address, id: acc.id }));
    localStorage.setItem('mail_token', acc.token);
    setIsSidebarOpen(false);
    setMessages([]);
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0a0a0a] sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold tracking-wide text-gray-100">
              EMAIL PRO
            </h1>
          </div>
        </div>
        {account && (
          <button 
            onClick={logout}
            className="text-sm font-medium text-gray-400 hover:text-white flex items-center gap-2 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {!account ? (
          // Landing Page
          <div className="flex-1 flex flex-col items-center justify-start mt-12 sm:mt-20 w-full max-w-md mx-auto">
            <div className="w-full bg-[#111111] border border-white/5 rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-white mb-2">Buat Email Baru</h2>
                <p className="text-gray-400 text-sm">Pilih nama dan domain untuk email Anda</p>
              </div>
              <form onSubmit={handleGenerate} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nama Email</label>
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())}
                    placeholder="contoh: john"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Domain</label>
                  <div className="relative">
                    <select 
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                    >
                      {domains.length === 0 ? (
                        <option value="">Memuat domain...</option>
                      ) : (
                        domains.map(d => (
                          <option key={d.id} value={d.domain} className="bg-gray-900 text-white">@{d.domain}</option>
                        ))
                      )}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
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
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buat Email'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          // Dashboard
          <div className="flex-1 flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Email Address Card */}
            <div className="bg-[#111111] border border-purple-500/20 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <div className="relative z-10">
                <p className="text-sm font-medium text-purple-300/70 mb-1">Alamat Email Aktif</p>
                <p className="text-xl sm:text-2xl font-medium text-white tracking-tight">{account.address}</p>
              </div>
              <button 
                onClick={copyToClipboard}
                className="relative z-10 flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl px-4 py-2.5 transition-colors group/copy"
              >
                {copied ? (
                  <>
                    <span className="text-purple-400 text-sm font-medium">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-purple-400 group-hover/copy:text-purple-300" />
                    <span className="text-sm font-medium text-purple-300 group-hover/copy:text-purple-200">Salin</span>
                  </>
                )}
              </button>
            </div>

            {/* Inbox */}
            <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[500px]">
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#111111]">
                <div className="flex items-center gap-3">
                  <Inbox className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-medium text-white">Kotak Masuk</h3>
                  <span className="bg-purple-500/20 border border-purple-500/20 text-purple-300 text-xs font-medium px-2.5 py-1 rounded-full">
                    {messages.length}
                  </span>
                </div>
                <button 
                  onClick={fetchMessages}
                  className="p-2 rounded-lg hover:bg-purple-500/10 text-purple-400 hover:text-purple-300 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-black/20">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4 py-12">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                      <Inbox className="w-6 h-6 text-purple-400/50" />
                    </div>
                    <p className="text-purple-200 font-medium">Kotak masuk kosong</p>
                    <p className="text-sm text-purple-200/50 mt-1">Menunggu pesan baru...</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {messages.map((msg) => {
                      const senderInitial = (msg.from.name || msg.from.address || '?').charAt(0).toUpperCase();
                      return (
                        <li key={msg.id}>
                          <button 
                            onClick={() => readMessage(msg.id)}
                            className="w-full text-left p-4 sm:p-5 hover:bg-purple-500/5 transition-colors flex items-start gap-4 group"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
                              <span className="text-white font-medium text-lg">{senderInitial}</span>
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-gray-200 truncate pr-4 group-hover:text-purple-300 transition-colors">
                                  {msg.from.name || msg.from.address}
                                </p>
                                <span className="text-xs text-gray-500 whitespace-nowrap group-hover:text-purple-400/70 transition-colors">
                                  {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors">
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative w-72 max-w-[80vw] bg-[#111111] border-r border-white/5 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-medium text-white">Akun Tersimpan</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 -mr-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {savedAccounts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center mt-6">Belum ada akun</p>
              ) : (
                savedAccounts.map(acc => (
                  <div 
                    key={acc.id} 
                    onClick={() => switchAccount(acc)} 
                    className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between group ${account?.id === acc.id ? 'bg-purple-500/10 border border-purple-500/20 text-purple-300' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'}`}
                  >
                    <div className="flex items-center truncate pr-2">
                      <Mail className={`w-4 h-4 mr-3 shrink-0 ${account?.id === acc.id ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-400'}`} />
                      <p className="text-sm font-medium truncate">{acc.address}</p>
                    </div>
                    <button 
                      onClick={(e) => deleteAccount(e, acc.id)} 
                      className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMessage(null)}></div>
          <div className="relative w-full max-w-3xl bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-white/5 flex items-start justify-between bg-[#111111]">
              <div className="pr-4">
                <h2 className="text-xl font-semibold text-white mb-2 leading-tight">{selectedMessage.subject || '(Tanpa Subjek)'}</h2>
                {selectedMessage.from && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-200">{selectedMessage.from.name || selectedMessage.from.address}</span>
                    <span className="text-gray-500">&lt;{selectedMessage.from.address}&gt;</span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setSelectedMessage(null)}
                className="p-2 -mr-2 -mt-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-0 overflow-y-auto flex-1 bg-white">
              {messageLoading || selectedMessage.loading ? (
                <div className="flex items-center justify-center h-40 bg-[#111111]">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : (
                <div className="w-full h-full min-h-[400px]">
                  {selectedMessage.html ? (
                    <iframe 
                      srcDoc={selectedMessage.html} 
                      className="w-full h-full min-h-[400px] border-0"
                      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                    />
                  ) : (
                    <div className="p-6 bg-[#111111] h-full">
                      <pre className="whitespace-pre-wrap font-sans text-gray-300 text-sm leading-relaxed">
                        {selectedMessage.text || 'Tidak ada konten'}
                      </pre>
                    </div>
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

