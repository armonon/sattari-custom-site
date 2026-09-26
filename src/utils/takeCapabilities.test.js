import { expect, it } from 'vitest';
import { takeCapabilities } from './takeCapabilities';

it('never calls a printed or partially reconstructed recording fully editable', () => {
  expect(takeCapabilities({ assetId: 'audio', events: [] })).toMatchObject({
    label: 'Audio Take',
    safety: true,
  });
  expect(
    takeCapabilities({
      events: [
        { type: 'initialState', args: [{ decks: [{ playing: true }], inputCaptureVersion: 1 }] },
        { type: 'inputState', args: [{}] },
        { type: 'setLoop', disabled: true, args: [] },
      ],
    })
  ).toMatchObject({
    label: 'Performance Take',
    actions: 1,
    editable: [],
    printed: ['Input processing: compare its separate captured input lane'],
    safety: false,
  });
});
