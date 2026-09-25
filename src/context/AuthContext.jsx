import { useState, useEffect } from 'react';
import authService from '../services/auth.service';
import { AuthContext } from './AuthContextDefinition';
const AUTH_EVENT_KEY = 'noema-auth-event';

const broadcastAuthChange = (type) => {
  localStorage.setItem(AUTH_EVENT_KEY, `${type}:${Date.now()}`);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await authService.getCurrentUser();
        if (res.success && res.user) {
          setUser(res.user);
        }
      } catch {
        console.log('No active session found.');
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();
  }, []);

  useEffect(() => {
    const handleAuthEvent = (event) => {
      if (event.key !== AUTH_EVENT_KEY) return;
      const type = event.newValue?.split(':')[0];

      if (type === 'logout') {
        setUser(null);
        setError(null);
        return;
      }

      if (type === 'login') {
        authService.getCurrentUser()
          .then((res) => {
            if (res.success && res.user) setUser(res.user);
          })
          .catch(() => setUser(null));
      }
    };

    window.addEventListener('storage', handleAuthEvent);
    return () => window.removeEventListener('storage', handleAuthEvent);
  }, []);

  const loginWithGoogle = async (token) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.loginWithGoogle(token);
      if (res.success && res.user) {
        setUser(res.user);
        broadcastAuthChange('login');
        return res;
      }
      throw new Error('Invalid response from server');
    } catch (err) {
      setError(err.response?.data?.message || 'Google login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.login(username, password);
      if (res.success && res.user) {
        setUser(res.user);
        broadcastAuthChange('login');
        return res;
      }
      throw new Error('Invalid response from server');
    } catch (err) {
      if (!err.response?.data?.errors) setError(err.response?.data?.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.register(username, password);
      if (res.success && res.user) {
        setUser(res.user);
        broadcastAuthChange('login');
        return res;
      }
      throw new Error('Invalid response from server');
    } catch (err) {
      if (!err.response?.data?.errors) setError(err.response?.data?.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await authService.logout();
      setUser(null);
      broadcastAuthChange('logout');
    } catch (err) {
      console.error('Logout error:', err);
      setError(err.response?.data?.message || 'Logout failed. Please try again.');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, loginWithGoogle, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
