import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PanelLayoutActions, PanelLayoutProvider, StudioPanel } from './StudioPanel';

describe('workspace panel layout', () => {
  it('keeps a single summary and its safety status outside the collapsed content', () => {
    render(
      <StudioPanel panelId="input" label="Input" summary={<span role="status">Connected</span>}>
        <input aria-label="Input gain" defaultValue="0" />
      </StudioPanel>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Input' }));
    const button = screen.getByRole('button', { name: 'Expand Input' });
    expect(screen.getByRole('status').closest('[data-panel-summary]')).toBe(button.parentElement);
    expect(screen.getByLabelText('Input gain')).toBeInTheDocument();
  });

  it('dismisses the layout menu with Escape and returns keyboard focus', () => {
    render(
      <PanelLayoutProvider workspace="library">
        <PanelLayoutActions />
      </PanelLayoutProvider>
    );
    const summary = screen.getByText('Layout');
    fireEvent.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Collapse all' }), { key: 'Escape' });
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(summary).toHaveFocus();
  });

  it('collapses without unmounting a running child or losing an edit', () => {
    const cleanup = vi.fn();
    function Content() {
      useEffect(() => cleanup, []);
      return <input aria-label="Unsaved name" defaultValue="Take 1" />;
    }
    render(
      <StudioPanel panelId="notes" label="Notes">
        <Content />
      </StudioPanel>
    );
    const input = screen.getByLabelText('Unsaved name');
    fireEvent.change(input, { target: { value: 'My edited take' } });
    const button = screen.getByRole('button', { name: 'Collapse Notes' });
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    fireEvent.click(button);
    expect(panel).toHaveAttribute('data-panel-collapsed', 'true');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(input).toBeInTheDocument();
    expect(cleanup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Notes' }));
    expect(panel).toHaveAttribute('data-panel-collapsed', 'false');
    expect(input).toHaveValue('My edited take');
  });

  it('keeps workspace layouts independent and lets one panel reopen after collapse all', () => {
    function Workspace() {
      const [view, setView] = useState('library');
      const [extra, setExtra] = useState(false);
      return (
        <PanelLayoutProvider workspace={view}>
          <button onClick={() => setView(view === 'library' ? 'arrange' : 'library')}>
            Switch view
          </button>
          <button onClick={() => setExtra(true)}>Add panel</button>
          <PanelLayoutActions />
          <StudioPanel panelId="one" label="One">
            <input aria-label="Persistent edit" />
          </StudioPanel>
          <StudioPanel panelId="two" label="Two">
            Second
          </StudioPanel>
          {extra && (
            <StudioPanel panelId="extra" label="Extra">
              Third
            </StudioPanel>
          )}
        </PanelLayoutProvider>
      );
    }
    render(<Workspace />);
    fireEvent.click(screen.getByText('Layout'));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.getByText('Layout').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Layout')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Expand One' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand One' }));
    expect(screen.getByRole('button', { name: 'Expand Two' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }));
    expect(screen.getByRole('button', { name: 'Collapse Two' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }));
    expect(screen.getByRole('button', { name: 'Expand Two' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add panel' }));
    expect(screen.getByRole('button', { name: 'Expand Extra' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Layout'));
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByRole('button', { name: 'Collapse Two' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Extra' })).toBeInTheDocument();
  });

  it('retains hidden workspace roots and forwarded refs', () => {
    const ref = { current: null };
    render(
      <StudioPanel ref={ref} panelId="hidden" label="Hidden" hidden aria-label="Hidden panel">
        Contents
      </StudioPanel>
    );
    expect(ref.current).toHaveAttribute('hidden');
    expect(ref.current).toHaveAttribute('aria-label', 'Hidden panel');
  });
});
