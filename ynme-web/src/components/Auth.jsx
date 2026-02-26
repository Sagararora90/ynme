import React, { useState } from 'react';
import axios from 'axios';
import { Mail, Lock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

const Auth = ({ setToken }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    
    // Use dynamic VITE_API_URL or fallback to localhost
    const baseUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`;
    const url = `${baseUrl}/api/auth/${isLogin ? 'login' : 'register'}`;
    
    try {
      const { data } = await axios.post(url, { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Background Gradient Effect */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Logo Component */}
      <div className="mb-10 text-center z-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
          ynme<span className="text-blue-500">.</span>
        </h1>
        <p className="text-white/40 text-[13px] font-medium tracking-wide uppercase">Music Without Limits</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-[400px] bg-[#121212] p-8 md:p-10 rounded-3xl border border-white/[0.05] shadow-2xl z-10">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">
          {isLogin ? 'Log in to Ynme' : 'Sign up for free'}
        </h2>

        {error && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-200/90 leading-relaxed font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-white/70 ml-1">Email address</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail size={18} className="text-white/30 group-focus-within:text-white/70 transition-colors" />
              </div>
              <input 
                type="email" 
                className="w-full bg-[#1e1e1e] border-2 border-transparent focus:border-white/20 hover:border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-[14px] text-white placeholder-white/20 outline-none transition-all"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-white/70 ml-1">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={18} className="text-white/30 group-focus-within:text-white/70 transition-colors" />
              </div>
              <input 
                type="password" 
                className="w-full bg-[#1e1e1e] border-2 border-transparent focus:border-white/20 hover:border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-[14px] text-white placeholder-white/20 outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            disabled={loading || !email || !password}
            className="w-full mt-8 py-3.5 bg-white text-black hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed rounded-full font-bold text-[15px] transition-all flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                {isLogin ? 'Log In' : 'Sign Up'}
                <ArrowRight size={18} className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/[0.06] text-center">
          <p className="text-[13px] text-white/50 font-medium">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); setEmail(''); setPassword(''); }} 
              className="text-white hover:underline transition-colors ml-1 font-semibold"
            >
              {isLogin ? 'Sign up for Ynme' : 'Log in here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
