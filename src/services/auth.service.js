// auth.service.js — thin wrapper kept for AuthContext compatibility
import { authAPI } from './api';

const authService = {
  register: async (username, password) => {
    const res = await authAPI.register(username, password);
    return res.data;
  },
  login: async (username, password) => {
    const res = await authAPI.login(username, password);
    return res.data;
  },
  loginWithGoogle: async (token) => {
    const res = await authAPI.googleLogin(token);
    return res.data;
  },
  getCurrentUser: async () => {
    const res = await authAPI.me();
    return res.data;
  },
  logout: async () => {
    const res = await authAPI.logout();
    return res.data;
  },
};

export default authService;
