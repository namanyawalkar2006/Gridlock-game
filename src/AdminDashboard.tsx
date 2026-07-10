import { useState, useEffect } from 'react';
import { ScoreEntry } from './types';
import { Loader2, Trash2, ArrowLeft, Database } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminDashboard({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      setIsAuthenticated(true);
      fetchData(password);
    }
  };

  const fetchData = async (pass: string) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/admin/data', {
        headers: {
          'x-admin-password': pass
        }
      });
      if (!res.ok) {
        setIsAuthenticated(false);
        setPassword('');
        setError('Invalid password');
        return;
      }
      const json = await res.json();
      setData(json.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/data/${id}`, { 
        method: 'DELETE',
        headers: {
          'x-admin-password': password
        }
      });
      if (res.ok) {
        fetchData(password);
      } else {
        console.error("Failed to delete", await res.text());
      }
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  if (!isAuthenticated) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900/80 p-8 rounded-3xl border border-slate-700 shadow-2xl flex flex-col items-center gap-6 w-full max-w-sm backdrop-blur-xl mx-auto"
      >
        <div className="flex flex-col items-center gap-3 w-full border-b border-slate-700 pb-6">
          <Database className="text-emerald-400" size={32} />
          <h2 className="text-2xl font-bold text-white">Admin Access</h2>
        </div>
        
        <form onSubmit={handleLogin} className="w-full space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter Admin Password"
            className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-center"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={!password}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              Unlock
            </button>
          </div>
        </form>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 shadow-2xl flex flex-col gap-6 w-full max-w-4xl backdrop-blur-xl"
    >
      <div className="flex justify-between items-center border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <Database className="text-emerald-400" size={24} />
          <h2 className="text-2xl font-bold text-white">Database Management</h2>
        </div>
        <button 
          onClick={onClose}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Game
        </button>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center text-slate-500 py-12 bg-slate-950/50 rounded-xl border border-slate-800">
            No database records found.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 text-sm">
                <th className="p-3 border-b border-slate-800 rounded-tl-xl">Username</th>
                <th className="p-3 border-b border-slate-800">Date</th>
                <th className="p-3 border-b border-slate-800">Difficulty</th>
                <th className="p-3 border-b border-slate-800">Level</th>
                <th className="p-3 border-b border-slate-800">Time (s)</th>
                <th className="p-3 border-b border-slate-800 rounded-tr-xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 text-emerald-400 font-medium">{entry.username}</td>
                  <td className="p-3 text-slate-300 text-sm">{entry.dateStr}</td>
                  <td className="p-3 text-amber-400 text-sm font-bold">{entry.difficulty}</td>
                  <td className="p-3 text-slate-300">Lvl {entry.level}</td>
                  <td className="p-3 text-slate-300 font-mono">{(entry.timeMs / 1000).toFixed(2)}s</td>
                  <td className="p-3 text-right">
                    <button 
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
}
