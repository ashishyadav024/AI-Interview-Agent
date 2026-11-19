import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from '../components1/Sidebar';

const RouteTracker = () => {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
};

const renderWithRouter = (initialPath = '/dashboard') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar candidateCount={5} />
      <RouteTracker />
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/candidates" element={<div>Candidates Page</div>} />
        <Route path="/interview" element={<div>Interviews Page</div>} />
        <Route path="/reports" element={<div>Reports Page</div>} />
        <Route path="/job-roles" element={<div>Job Roles Page</div>} />
        <Route path="/settings" element={<div>Settings Page</div>} />
        <Route path="/help" element={<div>Help Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Left Sidebar Navigation', () => {
  test('renders all 7 navigation items and recruiter workspace branding', () => {
    renderWithRouter('/dashboard');

    expect(screen.getByText('AI Interview Agent')).toBeInTheDocument();
    expect(screen.getByText('RECRUITER WORKSPACE')).toBeInTheDocument();

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Candidates')).toBeInTheDocument();
    expect(screen.getByText('Interviews')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Job Roles')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Help & Support')).toBeInTheDocument();
  });

  test('highlights Overview when on /dashboard', () => {
    renderWithRouter('/dashboard');
    const overviewBtn = screen.getByText('Overview').closest('button');
    expect(overviewBtn).toHaveClass('bg-[#706ea9]');
    expect(overviewBtn).toHaveClass('text-white');
  });

  test('highlights Candidates when on /candidates', () => {
    renderWithRouter('/candidates');
    const candidatesBtn = screen.getByText('Candidates').closest('button');
    expect(candidatesBtn).toHaveClass('bg-[#706ea9]');
    expect(candidatesBtn).toHaveClass('text-white');
  });

  test('highlights Interviews when on /interview and does not get stuck', () => {
    renderWithRouter('/interview');
    const interviewsBtn = screen.getByText('Interviews').closest('button');
    expect(interviewsBtn).toHaveClass('bg-[#706ea9]');
    expect(interviewsBtn).toHaveClass('text-white');

    // Clicking Overview navigates away from /interview
    const overviewBtn = screen.getByText('Overview').closest('button');
    fireEvent.click(overviewBtn!);
    expect(screen.getByTestId('current-route')).toHaveTextContent('/dashboard');
  });

  test('navigates to each route when sidebar items are clicked', () => {
    renderWithRouter('/dashboard');

    // Click Candidates
    fireEvent.click(screen.getByText('Candidates').closest('button')!);
    expect(screen.getByTestId('current-route')).toHaveTextContent('/candidates');

    // Click Reports
    fireEvent.click(screen.getByText('Reports').closest('button')!);
    expect(screen.getByTestId('current-route')).toHaveTextContent('/reports');

    // Click Job Roles
    fireEvent.click(screen.getByText('Job Roles').closest('button')!);
    expect(screen.getByTestId('current-route')).toHaveTextContent('/job-roles');

    // Click Settings
    fireEvent.click(screen.getByText('Settings').closest('button')!);
    expect(screen.getByTestId('current-route')).toHaveTextContent('/settings');

    // Click Help & Support
    fireEvent.click(screen.getByText('Help & Support').closest('button')!);
    expect(screen.getByTestId('current-route')).toHaveTextContent('/help');

    // Click Interviews
    fireEvent.click(screen.getByText('Interviews').closest('button')!);
    expect(screen.getByTestId('current-route')).toHaveTextContent('/interview');

    // Click Overview
    fireEvent.click(screen.getByText('Overview').closest('button')!);
    expect(screen.getByTestId('current-route')).toHaveTextContent('/dashboard');
  });

  test('user profile dropdown toggles and allows navigation', () => {
    renderWithRouter('/dashboard');

    const profilePill = screen.getByLabelText('User profile menu');
    expect(profilePill).toBeInTheDocument();

    // Initially dropdown items are not in document
    expect(screen.queryByText('alex.morgan@company.com')).not.toBeInTheDocument();

    // Click to open dropdown
    fireEvent.click(profilePill);
    expect(screen.getByText('alex.morgan@company.com')).toBeInTheDocument();
    expect(screen.getByText('Profile & Account')).toBeInTheDocument();
    expect(screen.getByText('Documentation & Help')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();

    // Click Profile & Account -> navigates to /settings and closes dropdown
    fireEvent.click(screen.getByText('Profile & Account'));
    expect(screen.getByTestId('current-route')).toHaveTextContent('/settings');
    expect(screen.queryByText('alex.morgan@company.com')).not.toBeInTheDocument();
  });
});

