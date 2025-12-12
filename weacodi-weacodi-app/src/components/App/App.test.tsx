import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('Components/App', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('renders the overview information', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /Weacodi/i })).toBeInTheDocument();
    expect(screen.getByText(/Weacodi – Overview/)).toBeInTheDocument();
    expect(screen.getByText(/No app configuration is required/i)).toBeInTheDocument();
  });
});
