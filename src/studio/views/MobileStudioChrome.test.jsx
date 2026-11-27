import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileStudioChrome from './MobileStudioChrome';

function props(overrides = {}) {
  return {
    activeView: 'decks',
    onViewChange: vi.fn(),
    mixerOpen: false,
    onShowMixer: vi.fn(),
    onHideMixer: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenInput: vi.fn(),
    session: { sessionName: 'Night set', masterBpm: 124, restored: true },
    transport: { playing: false, available: true, onToggle: vi.fn() },
    capture: {
      captureActive: false,
      captureBusy: false,
      toggleCapture: vi.fn(),
    },
    ...overrides,
  };
}

describe('Songboard mobile chrome', () => {
  it('maps the native Perform, Edit and Mix surfaces to the shared web engine', () => {
    const input = props();
    render(<MobileStudioChrome {...input} />);
    const modes = within(screen.getByRole('navigation', { name: 'Mobile studio modes' }));

    fireEvent.click(modes.getByRole('button', { name: 'Edit' }));
    expect(input.onHideMixer).toHaveBeenCalled();
    expect(input.onViewChange).toHaveBeenCalledWith('arranger');

    fireEvent.click(modes.getByRole('button', { name: 'Mix' }));
    expect(input.onViewChange).toHaveBeenCalledWith('decks');
    expect(input.onShowMixer).toHaveBeenCalled();
  });

  it('keeps transport, capture, voice, Bounce and Projects within thumb reach', () => {
    const input = props();
    render(<MobileStudioChrome {...input} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Record set' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bounce' }));
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));

    expect(input.transport.onToggle).toHaveBeenCalled();
    expect(input.capture.toggleCapture).toHaveBeenCalled();
    expect(input.onOpenInput).toHaveBeenCalled();
    expect(input.onViewChange).toHaveBeenCalledWith('library');
    expect(input.onViewChange).toHaveBeenCalledWith('files');
  });
});
