import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ArrangementRack from './ArrangementRack';
import { audioTrack } from '../../utils/arrangementModel';
import { EFFECT_DRAG_TYPE } from '../../utils/arrangementEffects';
let tracks, structural;
function Host() {
  const [value, set] = useState([audioTrack('Vocals'), audioTrack('Keys')]);
  tracks = value;
  return (
    <ArrangementRack
      tracks={value}
      busy={false}
      onSelectTrack={() => {}}
      onInstrument={() => {}}
      onEffects={(id, effects, rebuild) => {
        structural = rebuild;
        set(value.map((track) => (track.id === id ? { ...track, effects } : track)));
      }}
    />
  );
}
it('adds track effects, edits parameters, bypasses, reorders and removes without touching other tracks', () => {
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'Add Sattari EQ' }));
  expect(structural).toBe(true);
  fireEvent.change(screen.getByLabelText('Sattari EQ 1 Low'), { target: { value: '6' } });
  expect(tracks[0].effects[0].params.low).toBe(6);
  expect(structural).toBe(false);
  fireEvent.click(screen.getByLabelText('Bypass Sattari EQ 1'));
  expect(tracks[0].effects[0].bypass).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Add Sattari Comp' }));
  fireEvent.click(screen.getByLabelText('Move effect 2 earlier'));
  expect(tracks[0].effects.map((e) => e.type)).toEqual(['comp', 'eq']);
  fireEvent.click(screen.getByLabelText('Remove effect 1'));
  expect(tracks[0].effects).toHaveLength(1);
  expect(tracks[1].effects).toBeUndefined();
  fireEvent.change(screen.getByLabelText('Device rack track'), { target: { value: tracks[1].id } });
  expect(
    within(screen.getByRole('list', { name: 'Track insert effects' })).queryAllByRole('listitem')
  ).toHaveLength(0);
});
it('exposes instruments and clearly separates native suite products from web editions', () => {
  const add = vi.fn();
  render(
    <ArrangementRack tracks={[]} onSelectTrack={() => {}} onEffects={() => {}} onInstrument={add} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Instruments', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: /Studio piano/ }));
  expect(add).toHaveBeenCalledWith('piano');
  fireEvent.click(screen.getByRole('button', { name: 'Sattari suite', exact: true }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Auto Pitch' } });
  expect(screen.getByText('Sattari Auto Pitch')).toBeInTheDocument();
  expect(
    screen.getByText('Desktop host required · Native edition is not playable here')
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Add web/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Desktop host required', exact: true }));
  expect(screen.getByText(/This is an inventory/)).toBeInTheDocument();
});
it('drags a browser effect as a validated copy without changing the source track', () => {
  render(<Host />);
  const transfer = { setData: vi.fn() };
  fireEvent.dragStart(screen.getByRole('button', { name: 'Add Sattari EQ' }), {
    dataTransfer: transfer,
  });
  expect(transfer.setData).toHaveBeenCalledWith(EFFECT_DRAG_TYPE, '["eq"]');
  expect(tracks[0].effects).toBeUndefined();
});
