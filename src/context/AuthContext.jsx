import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/auth.service';

export const AuthContext = createContext();

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

  const loginWithGoogle = async (token) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.loginWithGoogle(token);
      if (res.success && res.user) {
        setUser(res.user);
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
    try {
      await authService.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, loginWithGoogle, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
