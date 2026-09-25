/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SourceChooser from './SourceChooser';

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  // jsdom models the element, but not the browser's native modal top layer.
  HTMLDialogElement.prototype.showModal ??= function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function () {
    this.removeAttribute('open');
  };
});
describe('SourceChooser', () => {
  it('lists inputs without monitoring the permission stream and connects the chosen device', async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: async () => [
          { kind: 'audioinput', deviceId: 'built-in', label: 'Built-in mic' },
          { kind: 'audioinput', deviceId: 'interface', label: 'USB interface' },
          { kind: 'audiooutput', deviceId: 'speaker', label: 'Speaker' },
        ],
      },
    });
    const onConnect = vi.fn(async () => {}),
      onClose = vi.fn();
    render(<SourceChooser onConnect={onConnect} onClose={onClose} onTrack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Input', exact: true }));
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Connect input' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Find inputs' }));
    await screen.findByRole('option', { name: 'USB interface' });
    expect(stop).toHaveBeenCalled();
    expect(screen.queryByRole('option', { name: 'Speaker' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Audio input'), { target: { value: 'interface' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect input' }));
    await waitFor(() => expect(onConnect).toHaveBeenCalledWith('interface', 'USB interface'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('keeps permission failures visible and allows retry', async () => {
    const onConnect = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Denied'), { name: 'NotAllowedError' }));
    const onClose = vi.fn();
    render(<SourceChooser onConnect={onConnect} onClose={onClose} onTrack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mic', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect mic' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was denied');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Connect mic' })).toBeEnabled();
  });
  it('does not open a second live input and closes on Escape', () => {
    const onClose = vi.fn();
    render(<SourceChooser inputActive onConnect={vi.fn()} onClose={onClose} onTrack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mic', exact: true }));
    expect(screen.getByRole('button', { name: 'Connect mic' })).toBeDisabled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
