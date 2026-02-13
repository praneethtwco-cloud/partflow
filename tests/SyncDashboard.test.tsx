import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyncDashboard } from '../components/SyncDashboard';
import { db } from '../services/db';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

// Mock the dependencies
jest.mock('../services/db', () => ({
  db: {
    getSyncStats: jest.fn(),
    getSettings: jest.fn(),
    saveSettings: jest.fn(),
    performSync: jest.fn(),
    checkForConflicts: jest.fn(),
    resolveConflictsAndSync: jest.fn(),
  },
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('../context/ToastContext', () => ({
  useToast: jest.fn(),
}));

const mockOnSyncComplete = jest.fn();

const defaultProps = {
  onSyncComplete: mockOnSyncComplete,
};

beforeEach(() => {
  (db.getSyncStats as jest.MockedFunction<any>).mockReturnValue({
    pendingCustomers: 0,
    pendingItems: 0,
    pendingOrders: 0,
    pendingAdjustments: 0,
    last_sync: '2023-01-01T00:00:00Z',
  });

  (db.getSettings as jest.MockedFunction<any>).mockReturnValue({
    company_name: 'Test Company',
    show_advanced_sync_options: false, // Default to false
    google_sheet_id: 'test-sheet-id',
  });

  (useTheme as jest.MockedFunction<any>).mockReturnValue({
    themeClasses: {
      bg: 'bg-blue-500',
      bgSoft: 'bg-blue-100',
      text: 'text-blue-500',
      textDark: 'text-blue-800',
      bgHover: 'hover:bg-blue-600',
      shadow: 'shadow-blue-500',
      ring: 'ring-blue-500',
      border: 'border-blue-200',
      gradient: 'from-blue-500 to-blue-700',
    },
  });

  (useToast as jest.MockedFunction<any>).mockReturnValue({
    showToast: jest.fn(),
  });
});

describe('SyncDashboard Component', () => {
  test('renders Incremental Sync button by default', () => {
    render(<SyncDashboard {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /Sync & Push|Incremental Sync/ })).toBeInTheDocument();
  });

  test('does not show advanced sync options by default when setting is false', () => {
    (db.getSettings as jest.MockedFunction<any>).mockReturnValue({
      company_name: 'Test Company',
      show_advanced_sync_options: false,
      google_sheet_id: 'test-sheet-id',
    });

    render(<SyncDashboard {...defaultProps} />);
    
    expect(screen.queryByText(/Upload All to Cloud \(Overwrite\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Download Latest Master Record \(Pull\)/)).not.toBeInTheDocument();
  });

  test('shows advanced sync options when setting is true and toggle is activated', () => {
    (db.getSettings as jest.MockedFunction<any>).mockReturnValue({
      company_name: 'Test Company',
      show_advanced_sync_options: true,
      google_sheet_id: 'test-sheet-id',
    });

    render(<SyncDashboard {...defaultProps} />);
    
    // Initially, advanced options should not be visible
    expect(screen.queryByText(/Upload All to Cloud \(Overwrite\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Download Latest Master Record \(Pull\)/)).not.toBeInTheDocument();
    
    // Click the "Show advanced sync options" button
    fireEvent.click(screen.getByText(/Show advanced sync options/));
    
    // Now the advanced options should be visible
    expect(screen.getByText(/Upload All to Cloud \(Overwrite\)/)).toBeInTheDocument();
    expect(screen.getByText(/Download Latest Master Record \(Pull\)/)).toBeInTheDocument();
  });

  test('hides advanced sync options when "Hide Advanced Options" button is clicked', () => {
    (db.getSettings as jest.MockedFunction<any>).mockReturnValue({
      company_name: 'Test Company',
      show_advanced_sync_options: true,
      google_sheet_id: 'test-sheet-id',
    });

    render(<SyncDashboard {...defaultProps} />);
    
    // Activate advanced options
    fireEvent.click(screen.getByText(/Show advanced sync options/));
    
    // Verify they are visible
    expect(screen.getByText(/Upload All to Cloud \(Overwrite\)/)).toBeInTheDocument();
    expect(screen.getByText(/Download Latest Master Record \(Pull\)/)).toBeInTheDocument();
    
    // Click the "Hide Advanced Options" button
    fireEvent.click(screen.getByText(/Hide Advanced Options/));
    
    // Now the advanced options should be hidden again
    expect(screen.queryByText(/Upload All to Cloud \(Overwrite\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Download Latest Master Record \(Pull\)/)).not.toBeInTheDocument();
  });

  test('shows hint about advanced options in settings when they are not available', () => {
    (db.getSettings as jest.MockedFunction<any>).mockReturnValue({
      company_name: 'Test Company',
      show_advanced_sync_options: false,
      google_sheet_id: 'test-sheet-id',
    });

    render(<SyncDashboard {...defaultProps} />);
    
    expect(screen.getByText(/Advanced options available in Settings/)).toBeInTheDocument();
  });
});