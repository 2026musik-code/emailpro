import React, { useState, useEffect } from 'react';
import { Shield, Users, Activity, Settings, Save, ArrowLeft, RefreshCw, Database, Mail, Trash2, Eye, X } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'stats' | 'emails'>('stats');
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authForm, setAuthForm] = useState({ currentPassword: '', newUsername: '', newPassword: '' });
  const [authSaving, setAuthSaving] = useState(false);

  const [stats, setStats] = useState({ daily: 0, weekly: 0, monthly: 0, total: 0 });
  const [recent, setRecent] = useState<{email: string, timestamp: string}[]>([]);
  const [savedEmails, setSavedEmails] = useState<any[]>([]);
  const [viewEmail, setViewEmail] = useState<any | null>(null);
  const [config, setConfig] = useState({ dailyLimit: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      if (activeTab === 'stats') {
        const res = await fetch('/api/admin/stats', { headers });
        if (res.status === 401) throw new Error('Unauthorized');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        setStats(data.stats || { daily: 0, weekly: 0, monthly: 0, total: 0 });
        setRecent(data.recentRequests || []);
        setConfig(data.config || { dailyLimit: 0 });
      } else {
        const res = await fetch('/api/admin/emails', { headers });
        if (res.status === 401) throw new Error('Unauthorized');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setSavedEmails(data.emails || []);
      }
    } catch (err: any) {
      if (err.message === 'Unauthorized') {
        setToken(null);
        localStorage.removeItem('adminToken');
      } else {
        setError(err.message || "Failed to load admin data. Is R2 bound?");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [activeTab, token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        localStorage.setItem('adminToken', data.token);
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSaving(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(authForm)
      });
      if (res.status === 401) throw new Error('Unauthorized');
      const data = await res.json();
      if (data.success) {
        alert('Credentials updated successfully!');
        setToken(data.token);
        localStorage.setItem('adminToken', data.token);
        setAuthForm({ currentPassword: '', newUsername: '', newPassword: '' });
      } else {
        throw new Error(data.error || 'Failed to update credentials');
      }
    } catch (err: any) {
      if (err.message === 'Unauthorized') {
        setToken(null);
        localStorage.removeItem('adminToken');
      } else {
        alert(err.message);
      }
    } finally {
      setAuthSaving(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ dailyLimit: config.dailyLimit })
      });
      if (res.status === 401) throw new Error('Unauthorized');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert('Configuration saved successfully!');
    } catch (err: any) {
      alert(`Error saving config: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteEmail = async (key: string) => {
    if (!confirm('Are you sure you want to delete this email?')) return;
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ key })
      });
      if (res.status === 401) throw new Error('Unauthorized');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedEmails(prev => prev.filter(e => e._key !== key));
    } catch (err: any) {
      alert(`Error deleting email: ${err.message}`);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 text-zinc-100 font-sans">
        <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Admin Login</h1>
          <p className="text-zinc-500 text-center text-sm mb-8">Enter your credentials to continue</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm text-center">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Username</label>
              <input 
                type="text" 
                value={loginUser}
                onChange={e => setLoginUser(e.target.value)}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.href = '/'}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-indigo-500" />
                Admin Dashboard
              </h1>
              <p className="text-sm text-zinc-500">Manage system and view saved emails</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-900 rounded-xl p-1 mr-4">
              <button 
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'stats' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Stats
              </button>
              <button 
                onClick={() => setActiveTab('emails')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'emails' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Saved Emails
              </button>
            </div>
            <button 
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button 
              onClick={() => { setToken(null); localStorage.removeItem('adminToken'); }}
              className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-sm font-medium transition-colors ml-2"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl flex items-start gap-3">
            <Database className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold mb-1">Storage Error</h3>
              <p className="text-sm">{error}</p>
              <p className="text-xs mt-2 opacity-80">
                To fix this, make sure you have bound an R2 bucket named <code>VPSAI_R2</code> in your Cloudflare dashboard or <code>wrangler.toml</code>.
              </p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        {activeTab === 'stats' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Today's Requests", value: stats.daily, icon: Activity, color: "text-emerald-400" },
                { label: "This Week", value: stats.weekly, icon: Users, color: "text-blue-400" },
                { label: "This Month", value: stats.monthly, icon: Users, color: "text-indigo-400" },
                { label: "Total All Time", value: stats.total, icon: Database, color: "text-purple-400" },
              ].map((stat, i) => (
                <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-zinc-400">{stat.label}</span>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className="text-3xl font-black">{loading ? '-' : stat.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Settings Panel */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                    <Settings className="w-5 h-5 text-zinc-400" />
                    System Config
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">
                        Daily Request Limit
                      </label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={config.dailyLimit}
                          onChange={(e) => setConfig({...config, dailyLimit: parseInt(e.target.value) || 0})}
                          className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <p className="text-xs text-zinc-600 mt-2">Set to 0 for unlimited requests.</p>
                    </div>

                    <button 
                      onClick={saveConfig}
                      disabled={saving}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Configuration
                    </button>
                  </div>
                </div>

                {/* Credentials Panel */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 mt-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                    <Shield className="w-5 h-5 text-zinc-400" />
                    Admin Credentials
                  </h2>
                  <form onSubmit={changePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Current Password</label>
                      <input 
                        type="password" 
                        value={authForm.currentPassword}
                        onChange={(e) => setAuthForm({...authForm, currentPassword: e.target.value})}
                        className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">New Username</label>
                      <input 
                        type="text" 
                        value={authForm.newUsername}
                        onChange={(e) => setAuthForm({...authForm, newUsername: e.target.value})}
                        placeholder="Leave blank to keep current"
                        className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">New Password</label>
                      <input 
                        type="password" 
                        value={authForm.newPassword}
                        onChange={(e) => setAuthForm({...authForm, newPassword: e.target.value})}
                        className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={authSaving}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {authSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Update Credentials
                    </button>
                  </form>
                </div>
              </div>

              {/* Recent Requests Table */}
              <div className="lg:col-span-2">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 h-[500px] flex flex-col">
                  <h2 className="text-lg font-bold mb-6">Recent Requests (Latest 50)</h2>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {recent.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                        No requests found yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                          <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/80 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 rounded-l-lg">Time (UTC)</th>
                              <th className="px-4 py-3 rounded-r-lg">Email Address</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/50">
                            {recent.map((req, i) => (
                              <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                                  {new Date(req.timestamp).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 font-medium text-zinc-200">
                                  {req.email}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'emails' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 h-[700px] flex flex-col">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
              <Mail className="w-5 h-5 text-indigo-400" />
              Saved Incoming Emails
            </h2>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              {savedEmails.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                  No emails saved yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/80 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 rounded-l-lg">Account</th>
                        <th className="px-4 py-3">From</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 rounded-r-lg text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {savedEmails.map((email, i) => (
                        <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-indigo-400">
                            {email.accountEmail}
                          </td>
                          <td className="px-4 py-3 text-zinc-300 truncate max-w-[150px]">
                            {typeof email.from === 'object' ? email.from.address : email.from}
                          </td>
                          <td className="px-4 py-3 text-zinc-300 truncate max-w-[200px]">
                            {email.subject}
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-xs">
                            {email.date || email.createdAt || "Unknown"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => setViewEmail(email)}
                                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
                                title="View Email"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => deleteEmail(email._key)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-rose-400 transition-colors"
                                title="Delete Email"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* View Email Modal */}
      {viewEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="font-bold text-lg truncate pr-4">{viewEmail.subject}</h3>
              <button 
                onClick={() => setViewEmail(null)}
                className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/30 text-sm space-y-2">
              <div className="flex gap-2">
                <span className="text-zinc-500 w-16">From:</span>
                <span className="text-zinc-200">{typeof viewEmail.from === 'object' ? viewEmail.from.address : viewEmail.from}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-500 w-16">To:</span>
                <span className="text-indigo-400">{viewEmail.accountEmail}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-500 w-16">Date:</span>
                <span className="text-zinc-400">{viewEmail.date || viewEmail.createdAt || "Unknown"}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white text-black">
              {viewEmail.html ? (
                <iframe 
                  srcDoc={viewEmail.html}
                  className="w-full h-full min-h-[400px] border-0"
                  sandbox="allow-same-origin"
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm p-4 text-zinc-800">
                  {viewEmail.text || viewEmail.body_preview || "No content available."}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
