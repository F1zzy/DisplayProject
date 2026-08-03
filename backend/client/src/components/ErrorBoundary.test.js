import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Boom() {
  throw new Error('boom');
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

test('renders fallback when a child throws', () => {
  render(
    <ErrorBoundary title="Section unavailable">
      <Boom />
    </ErrorBoundary>
  );

  expect(screen.getByRole('alert')).toHaveTextContent(/section unavailable/i);
  expect(screen.getByText(/other parts of the display keep running/i)).toBeInTheDocument();
});

test('renders children when there is no error', () => {
  render(
    <ErrorBoundary>
      <p>All good</p>
    </ErrorBoundary>
  );

  expect(screen.getByText('All good')).toBeInTheDocument();
});
