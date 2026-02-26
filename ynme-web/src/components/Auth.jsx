import React, { useState } from 'react';
import axios from 'axios';

const Auth = ({ setToken }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const url = `http://localhost:5001/api/auth/${isLogin ? 'login' : 'register'}`;
    try {
      const { data } = await axios.post(url, { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700">
        <h1 className="text-3xl font-bold text-center mb-8 text-sky-400">ynme</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="p-3 bg-red-500/20 border border-red-500 text-red-200 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">Email Address</label>
            <input 
              type="email" 
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">Password</label>
            <input 
              type="password" 
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="w-full py-3 bg-sky-500 hover:bg-sky-600 rounded-lg font-bold transition-colors shadow-lg shadow-sky-500/20">
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <p className="mt-6 text-center text-slate-400 text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-sky-400 hover:text-sky-300 font-medium">
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
