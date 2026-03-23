import React, { useState, useEffect } from 'react';
import { Shield, Users, Activity, Settings, Save, ArrowLeft, RefreshCw, Database } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ daily: 0, weekly: 0, monthly: 0, total: 0 });
  const [recent, setRecent] = useState<{email: string, timestamp: string}[]>([]);
  const [config, setConfig] = useState({ dailyLimit: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setStats(data.stats || { daily: 0, weekly: 0, monthly: 0, total: 0 });
      setRecent(data.recentRequests || []);
      setConfig(data.config || { dailyLimit: 0 });
    } catch (err: any) {
      setError(err.message || "Failed to load admin stats. Is R2 bound?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyLimit: config.dailyLimit })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert('Configuration saved successfully!');
    } catch (err: any) {
      alert(`Error saving config: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

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
              <p className="text-sm text-zinc-500">Manage email generation requests and limits</p>
            </div>
          </div>
          <button 
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
                  <table className="w-full text-sm text-left">
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
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
