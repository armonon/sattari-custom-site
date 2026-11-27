const drumsetTuning =
  'https://www.daddario.com/blogs/percussion/how-to-tune-a-snare-drum-drumset-concert-snare';
const snareWires = 'https://www.daddario.com/blogs/percussion/how-to-tune-a-snare-drum-snare-wires';

export const snareTuningGuide = {
  slug: 'how-to-tune-a-snare-drum',
  title: 'How to Tune a Snare Drum by Ear',
  category: 'Drums',
  description:
    'Hear one acoustic snare at two tunings, then try it on yours. Learn to match the lugs by ear, raise or lower the top head and check the wire response.',
  answer:
    'You need a drum key, a stick and a few quiet minutes. Start with the top head, the one you play. Tap near each tension rod to compare pitches, then strike the center to hear the whole drum. Those two sounds answer different questions.',
  sections: [
    {
      id: 'before-and-after',
      title: 'Listen before and after a change in tuning',
      lead: true,
      paragraphs: [
        'These are center hits on the same 14 × 8-inch Tama birch snare at two drum tunings. The recordist used the same microphone setup and labeled both takes with the same strike strength and tight snare-wire setting. Keep your playback volume the same.',
      ],
      audioExamples: [
        {
          id: 'snare-take-a',
          label: 'Take A · before tuning',
          src: '/audio/snare-tuning/before.wav',
          description:
            'Listen past the sharp stick attack. Hum the body of the note that follows it.',
        },
        {
          id: 'snare-take-b',
          label: 'Take B · after tuning',
          src: '/audio/snare-tuning/after.wav',
          description:
            'Follow that same part of the hit. Decide which take sounds higher before revealing the answer.',
        },
      ],
      audioCredit: {
        author: 'quartertone',
        before: 'https://freesound.org/people/quartertone/sounds/143681/',
        after: 'https://freesound.org/people/quartertone/sounds/142665/',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        note: 'Each hit repeats three times with the same gain adjustment applied to both clips. Both tunings are usable musical choices.',
      },
    },
    {
      id: 'take-a-baseline',
      title: '1. Record the drum as it sounds now',
      paragraphs: [
        'This exercise is for a drum-set or concert snare with its heads already installed. The metal hoop holds the head in place. The tension rods are the bolts around that hoop. On the side of the shell, a lever called the throw-off brings the snare wires against the bottom head or moves them away.',
        'Put your phone in one spot and record three center hits, then three soft taps with the wires on. Leave the phone, drum and any muffling in place for the whole comparison. Flip the throw-off to release the wires and listen again. The buzz that disappears comes from the wires. The pitch you can still hear is the part to follow while tuning.',
      ],
    },
    {
      id: 'match-the-lugs',
      title: '2. Match the taps around the top head',
      sourceUrl: drumsetTuning,
      steps: [
        'With the wires off, tap lightly about an inch inside the hoop, directly in front of a tension rod. Tap at the same distance and with the same stick height by the rod opposite. Sing the two sounds back, even if all you can say is “lower, higher.”',
        'If one tap is clearly lower than the others, turn that rod clockwise by about an eighth of a turn to begin. Retap that spot and the one across from it. A change at one rod can affect its neighbors.',
        'Work through opposing pairs, then listen once around the circle. On an eight-lug drum, number the rods clockwise and try 1–5, 3–7, 2–6, 4–8. Aim for a similar ringing pitch at each spot. You can leave an already even head at its present tension.',
      ],
    },
    {
      id: 'change-the-pitch',
      title: '3. Choose a lower or higher center sound',
      paragraphs: [
        'To try the higher direction you heard in the clip, give every top rod the same small clockwise turn, working across the drum. To try the lower direction, back each rod off by a small equal amount. Keep the head taut and stop lowering if wrinkles appear. You can return to your starting point by keeping track of each pass.',
        'After one pass, leave the key on the table. Compare the lug taps again, switch the wires on, and use the same center hits and soft taps as your first recording. One pass is enough to learn something. The number of turns that works on your drum depends on its starting tension and heads.',
      ],
    },
    {
      id: 'check-wire-response',
      title: '4. Check the wires at a soft volume',
      sourceUrl: snareWires,
      paragraphs: [
        'Play alternating soft taps with the throw-off engaged. Listen for a little snare sound on each tap. If the response is choked, try releasing a small amount of wire tension with the strainer adjustment knob and listen again. If a loose rattle masks the next note, try a small increase. Leave the head tuning alone while you do this comparison.',
        'The thin bottom head supports the wires. Leave a working bottom head alone for this first exercise. If it is torn, a wire strand is hanging loose, a rod binds, or the hoop pulls down unevenly, stop turning and have the part checked. Extra force can make a hardware problem worse.',
      ],
    },
    {
      id: 'listen-to-your-result',
      title: '5. Compare your own before and after',
      steps: [
        'Replay the first and last phone recordings at the same volume. Listen once for body pitch, then again for wire response on the quiet hits. Phone microphones can change levels automatically, so the louder recording is a poor way to choose a tuning.',
        'Play a short groove at the volume you normally use. A little ring can help the drum carry past the kit. If the pitch feels right and the ring is too long for the song, try a small amount of removable damping near the rim and repeat the groove.',
        'Write down which head you changed, approximately how far, and what you heard. A useful note is “top head up one eighth-turn per rod; quiet strokes still speak.” You now have a way to find or undo that change at your next rehearsal.',
      ],
    },
  ],
  sources: [
    { label: 'EVANS · tuning the heads of a drum-set or concert snare', url: drumsetTuning },
    { label: 'EVANS · setting up the snare wires', url: snareWires },
    {
      label: 'Yamaha · how head choice and tuning affect snare response',
      url: 'https://hub.yamaha.com/music-educators/instruments/perc/snare-drum-selection-prep-tuning/',
    },
  ],
  related: [
    '/guides/choose-a-practice-drum-pad',
    '/guides/drumsticks-for-beginners',
    '/guides/choose-your-first-cymbals',
  ],
};
