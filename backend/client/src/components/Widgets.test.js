import React from 'react';
import { render, screen, act } from '@testing-library/react';
import Widgets from './Widgets';

jest.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      widgetRotationMs: 1000,
      enabledWidgets: ['stock', 'news'],
    },
  }),
  SettingsProvider: ({ children }) => children,
}));

jest.mock('./WidgetComponents/StockMarket', () => ({
  __esModule: true,
  default: () => <div>Stocks widget</div>,
}));
jest.mock('./WidgetComponents/News', () => ({
  __esModule: true,
  default: () => <div>News widget</div>,
}));
jest.mock('./WidgetComponents/TimeTable', () => ({
  __esModule: true,
  default: () => <div>Schedule widget</div>,
}));
jest.mock('./WidgetComponents/NetworkStats', () => ({
  __esModule: true,
  default: () => <div>Network widget</div>,
}));
jest.mock('./WidgetComponents/NightSky', () => ({
  __esModule: true,
  default: () => <div>Sky widget</div>,
}));
jest.mock('./WidgetComponents/SpotifyNow', () => ({
  __esModule: true,
  default: () => <div>Spotify widget</div>,
}));
jest.mock('./WidgetComponents/F1Standings', () => ({
  __esModule: true,
  default: () => <div>Formula 1 widget</div>,
}));

function renderWidgets(props = {}) {
  return render(<Widgets {...props} />);
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('shows pinned badge and aria-live region', async () => {
  renderWidgets({ pinned: true });

  expect(await screen.findByText('Pinned')).toBeInTheDocument();
  expect(screen.getByRole('region')).toHaveAttribute('aria-live', 'polite');
});

test('rotates widgets on timer when not pinned', async () => {
  renderWidgets({ pinned: false });

  expect(await screen.findByText('Stocks widget')).toBeInTheDocument();

  await act(async () => {
    jest.advanceTimersByTime(1000);
  });

  expect(await screen.findByText('News widget')).toBeInTheDocument();
});

test('does not rotate when pinned', async () => {
  renderWidgets({ pinned: true });

  expect(await screen.findByText('Stocks widget')).toBeInTheDocument();

  await act(async () => {
    jest.advanceTimersByTime(5000);
  });

  expect(screen.getByText('Stocks widget')).toBeInTheDocument();
  expect(screen.queryByText('News widget')).not.toBeInTheDocument();
});

test('jumps to forced widget index', async () => {
  const onWidgetShown = jest.fn();
  const { rerender } = render(
    <Widgets forcedWidget={null} onWidgetShown={onWidgetShown} />
  );

  expect(await screen.findByText('Stocks widget')).toBeInTheDocument();

  rerender(<Widgets forcedWidget={1} onWidgetShown={onWidgetShown} />);

  expect(await screen.findByText('News widget')).toBeInTheDocument();
  expect(onWidgetShown).toHaveBeenCalled();
});
