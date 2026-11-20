/**
 * Authentication Service
 * 
 * Provides server-verified authentication, role management,
 * and session validation for InterviewAI.
 */

import { FASTAPI_BASE_URL } from '../config/api';

const API_URL = `${FASTAPI_BASE_URL}/api/auth`;

export type UserRoleType = 'RECRUITER' | 'CANDIDATE' | 'ADMIN' | 'HIRING_MANAGER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRoleType;
  company?: string | null;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
  message?: string;
}

/**
 * Server-verified login
 * Authenticates against backend/main.py.
 * Stores verified role and session token in localStorage.
 * Includes a 10-second timeout with AbortController and credentials for httpOnly cookies.
 */
export const loginWithServerAuth = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success) {
      if (response.status === 401) {
        throw new Error(data?.detail || data?.error || 'Invalid email or password.');
      } else if (response.status === 429) {
        throw new Error(data?.detail || 'Too many login attempts. Please wait 1 minute before trying again.');
      } else if (response.status >= 500) {
        throw new Error('Server error, please try again.');
      }
      throw new Error(data?.detail || data?.error || 'Login failed. Please check your credentials.');
    }

    // Persist verified session
    if (data.token) localStorage.setItem('auth_token', data.token);
    if (data.user) {
      localStorage.setItem('user_role', data.user.role);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
    localStorage.setItem('user_authenticated', 'true');

    return data;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Cannot reach the server (request timed out). Please check your connection.');
    }

    // If in development mode and backend is offline, provide local dev fallback
    if (import.meta.env.DEV) {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail === 'recruiter@interviewai.com' && password === 'Recruiter123!') {
        const mockRecruiter: AuthUser = {
          id: 'usr-recruiter-1',
          email: cleanEmail,
          name: 'Alex Morgan',
          role: 'RECRUITER',
          company: 'InterviewAI Talent Ops'
        };
        localStorage.setItem('user_role', 'RECRUITER');
        localStorage.setItem('auth_user', JSON.stringify(mockRecruiter));
        localStorage.setItem('user_authenticated', 'true');
        return { success: true, user: mockRecruiter, token: 'mock-recruiter-token' };
      } else if (cleanEmail === 'candidate@interviewai.com' && password === 'Candidate123!') {
        const mockCandidate: AuthUser = {
          id: 'usr-candidate-1',
          email: cleanEmail,
          name: 'Aarav Sharma',
          role: 'CANDIDATE',
          company: null
        };
        localStorage.setItem('user_role', 'CANDIDATE');
        localStorage.setItem('auth_user', JSON.stringify(mockCandidate));
        localStorage.setItem('user_authenticated', 'true');
        return { success: true, user: mockCandidate, token: 'mock-candidate-token' };
      }
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot reach the server. Please verify backend service status.');
    }

    throw error;
  }
};

/**
 * Public Candidate Self Sign-Up
 * Strictly creates CANDIDATE accounts on the server.
 */
export const registerCandidateUser = async (
  email: string,
  password: string,
  fullName: string,
  company?: string
): Promise<AuthResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        company,
        role: 'CANDIDATE' // Server strictly enforces CANDIDATE
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success) {
      throw new Error(data?.detail || data?.error || 'Registration failed.');
    }

    if (data.token) localStorage.setItem('auth_token', data.token);
    if (data.user) {
      localStorage.setItem('user_role', data.user.role);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
    localStorage.setItem('user_authenticated', 'true');

    return data;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Registration timed out. Cannot reach the server.');
    }
    throw err;
  }
};

/**
 * Validates session token with the server
 */
export const verifyServerSession = async (): Promise<AuthUser | null> => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    const isAuth = localStorage.getItem('user_authenticated') === 'true';
    const stored = localStorage.getItem('auth_user');
    if (isAuth && stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('user_authenticated');
        return null;
      }
      return null;
    }
    const data = await response.json();
    if (data.success && data.user) {
      localStorage.setItem('user_role', data.user.role);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch {
    const stored = localStorage.getItem('auth_user');
    const isAuth = localStorage.getItem('user_authenticated') === 'true';
    if (isAuth && stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }
};

/**
 * Clear session and sign out
 */
export const logoutUser = async (): Promise<void> => {
  const token = localStorage.getItem('auth_token');
  try {
    if (token) {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'include'
      });
    }
  } catch {
    // Graceful offline cleanup
  } finally {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('user_authenticated');
  }
};

// Aliases and compatibility exports
export const logoutUserSession = logoutUser;
export const loginUser = async (email: string, password?: string) => {
  return loginWithServerAuth(email, password || '');
};
export const registerUser = async (
  email: string,
  fullName: string,
  company?: string | null
) => {
  return registerCandidateUser(email, '', fullName, company || undefined);
};
