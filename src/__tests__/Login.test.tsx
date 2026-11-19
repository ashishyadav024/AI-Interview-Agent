import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../components/ui/login';

// Mock Firebase auth and services
jest.mock('../lib/firebase', () => ({
  auth: null,
  db: null
}));

jest.mock('../services/authService', () => ({
  loginUser: jest.fn().mockResolvedValue({ success: true, user: { role: 'hr' } }),
  registerUser: jest.fn().mockResolvedValue({ success: true })
}));

describe('Login Component Redesign', () => {
  const renderLogin = () => {
    return render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
  };

  test('renders browser-window layout with dots and InterviewAI branding', () => {
    renderLogin();

    // Verify brand name
    expect(screen.getByText('Interview')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();

    // Verify heading & subtitle
    expect(screen.getByText('Login to your account')).toBeInTheDocument();
    expect(screen.getByText('Enter your details to login.')).toBeInTheDocument();
  });

  test('renders email and password input fields with forgot password link', () => {
    renderLogin();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByText(/forgot password\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('toggles password visibility when eye button is clicked', () => {
    renderLogin();

    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleButton = screen.getByLabelText(/show password/i);
    fireEvent.click(toggleButton);

    expect(passwordInput.type).toBe('text');

    const hideButton = screen.getByLabelText(/hide password/i);
    fireEvent.click(hideButton);

    expect(passwordInput.type).toBe('password');
  });

  test('switches to sign up view and allows role selection', () => {
    renderLogin();

    const signUpLink = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(signUpLink);

    expect(screen.getByText('Create an account')).toBeInTheDocument();
    expect(screen.getByText('HR / Recruiter')).toBeInTheDocument();
    expect(screen.getByText('Candidate')).toBeInTheDocument();

    // Can toggle to candidate role
    const candidateBtn = screen.getByText('Candidate');
    fireEvent.click(candidateBtn);

    // Can switch back to sign in
    const signInLink = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(signInLink);

    expect(screen.getByText('Login to your account')).toBeInTheDocument();
  });

  test('switches to forgot password view and allows entering email', () => {
    renderLogin();

    const forgotBtn = screen.getByText(/forgot password\?/i);
    fireEvent.click(forgotBtn);

    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();

    const backBtn = screen.getByRole('button', { name: /back to sign in/i });
    fireEvent.click(backBtn);

    expect(screen.getByText('Login to your account')).toBeInTheDocument();
  });

  test('renders footer with copyright and legal links', () => {
    renderLogin();

    expect(screen.getByText(/© 2026 AI Interview Agent. All rights reserved./i)).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });
});
