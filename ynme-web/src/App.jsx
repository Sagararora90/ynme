import React, { useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  if (!token) {
    return <Auth setToken={setToken} />;
  }

  return <Dashboard />;
}

export default App;
