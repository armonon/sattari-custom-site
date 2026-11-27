// The public catalog supplies model names, specifications, prices and stock.
// These groups describe the choices a player can try before ordering.
export const instrumentShopping = {
  'guitar-bass': {
    heading: 'Guitars and basses for sale',
    introduction:
      'Compare electric guitars, steel-string acoustics, nylon-string classical guitars and five-string basses. Shop online or call to arrange a Woodland Hills visit with the model you want to try.',
    families: [
      {
        id: 'steel-string-acoustic-guitars',
        name: 'Steel-string acoustic guitars',
        advice:
          'For songwriting or singing, strum a familiar chord softly, then at your usual volume. Listen for a clear bass note beneath your voice. Try the body seated and check whether your fretting hand can reach the first fret comfortably.',
        models: ['steel-string-acoustic-guitar'],
      },
      {
        id: 'classical-guitars',
        name: 'Nylon-string classical guitars',
        advice:
          'If your teacher requests a classical guitar, start here. Try an open-string melody with your fingertips and check the space between neighboring strings. Use a nylon set made for the instrument when it needs restringing.',
        models: ['classic-nylon-string-guitar'],
      },
      {
        id: 'electric-guitars',
        name: 'Electric guitars',
        advice:
          'Play a chord and a single-note line through a clean amp so you can hear the instrument before adding effects. Check its balance on a strap and whether you will need a cable, an amp or a headphone practice setup.',
        models: ['flame-stratocaster-electric-guitar'],
      },
      {
        id: 'bass-guitars',
        name: 'Bass guitars',
        advice:
          'A five-string bass adds a low B below the E. Try a two-bar line, then leave a rest. Listen for any unused strings still ringing and check whether your fretting hand can reach the low B comfortably.',
        models: ['five-string-bass-guitar'],
      },
    ],
  },
  violins: {
    heading: 'Violins for sale',
    introduction:
      'Compare acoustic violins for lessons and ensemble playing with electric violins for amplified performance or headphone practice. Check size and outfit contents before ordering online or arranging a Woodland Hills visit.',
    families: [
      {
        id: 'acoustic-violins',
        name: 'Acoustic violins',
        advice:
          'For a first lesson, ask your teacher which size to try and whether you need a bow, case and rosin. If you already play, bring a familiar passage and compare how two instruments respond to the same bow at a quiet dynamic.',
        models: ['cremona-handmade-acoustic-violin', 'brescia-acoustic-violin'],
      },
      {
        id: 'electric-violins',
        name: 'Electric violins',
        advice:
          'For private practice, look for a listed headphone connection or ask which equipment will drive your headphones. For stage use, check the amplifier output, cable and battery. The strings and bow still make some sound in the room.',
        models: [
          'chiara-wooden-electric-violin',
          'miami-electric-violin',
          'matilde-electric-violin',
        ],
      },
      {
        id: 'violin-accessories',
        name: 'Violin strings, rosin and pickup bridges',
        advice:
          'Match replacement strings to violin size and tailpiece fitting. Rosin belongs on bow hair. To amplify an acoustic violin with a pickup bridge, have the feet and string height checked for your instrument before fitting.',
        models: ['violin-strings', 'sattari-rosin', 'violin-pickup-bridge'],
      },
    ],
  },
};

// Model-specific audition advice. Buyers can compare it with the live specs
// directly above it, including staff changes to the accessories in a package.
export const modelBuyingAdvice = {
  'steel-string-acoustic-guitar': {
    heading: 'Trying a steel-string acoustic',
    tip: 'Play an open chord, then pick each string separately. A useful songwriting guitar lets the melody come through at the same volume you would use while singing. Check the action with both hands before choosing a heavier or lighter string gauge.',
    guide: ['Compare nylon and steel strings', '/guides/nylon-vs-steel-string-guitar'],
  },
  'classic-nylon-string-guitar': {
    heading: 'Trying a nylon-string classical guitar',
    tip: 'Rest the guitar where you normally play and try a simple first-position chord. The overall body length and the distance your left hand reaches are different measurements. If you are buying for a smaller player, ask about the scale length and neck width.',
    guide: ['Try the first-position reach test', '/guides/choose-a-beginner-acoustic-guitar'],
  },
  'flame-stratocaster-electric-guitar': {
    heading: 'Trying the Flame electric guitar',
    tip: 'Bring a short riff and play it with the amp set clean. Start quietly, then try a bend and listen as the note dies away. If this is your first electric guitar, check the cable, amp or headphone equipment you will use at home.',
    guide: [
      'Compare electric guitars by feel and sound',
      '/guides/how-to-choose-an-electric-guitar',
    ],
  },
  'five-string-bass-guitar': {
    heading: 'Trying a five-string bass',
    tip: 'Compare the low B with the E string at the same amp setting, then play your usual groove with a rest at the end of each bar. Check string spacing with your plucking hand and listen for the other four strings during the rest.',
    guide: ['Compare four- and five-string basses', '/guides/how-to-choose-a-bass-guitar'],
  },
  'cremona-handmade-acoustic-violin': {
    heading: 'Trying the Cremona acoustic violin',
    tip: 'Use the same bow on each instrument. Draw one slow bow on D, then play the same short phrase quietly and strongly. Ask another player to repeat it while you listen from across the room. Check the outfit contents if you also need a bow or case.',
    guide: ['Use the violin trial card', '/guides/choose-a-violin-for-beginners'],
  },
  'brescia-acoustic-violin': {
    heading: 'Choosing a violin for lessons',
    tip: 'Confirm the size your teacher recommends. During a trial, reach from first to fourth finger with a relaxed wrist, then test a soft open-string bow stroke. Compare the listed outfit with your teacher’s supply list before buying accessories.',
    guide: ['Check violin size, bow and sound', '/guides/choose-a-violin-for-beginners'],
  },
  'chiara-wooden-electric-violin': {
    heading: 'Planning a Chiara practice setup',
    tip: 'Bring the amplifier or headphone practice device you intend to use. Plug into the instrument output at low volume and draw a soft bow stroke, then check the response when playing more strongly. Confirm the headphone signal path before choosing this model for quiet practice.',
    guide: ['Compare acoustic and electric violin practice', '/guides/acoustic-vs-electric-violin'],
  },
  'miami-electric-violin': {
    heading: 'Trying the Miami for headphones or stage',
    tip: 'Try the headphone connection at low volume for practice, then test the amplifier output with a clean signal for rehearsal. Listen for even volume across the strings and check the space your cable needs when the violin is under your chin.',
    guide: ['Follow the electric violin signal path', '/guides/acoustic-vs-electric-violin'],
  },
  'matilde-electric-violin': {
    heading: 'Trying the Matilde electric violin',
    tip: 'With your normal shoulder support, check the balance at the collarbone and the room your left hand has to shift. Try a soft phrase through your intended practice or stage equipment. Check the connection and power requirements in the listing before a rehearsal.',
    guide: [
      'Compare the violin’s sound in your playing space',
      '/guides/acoustic-vs-electric-violin',
    ],
  },
  'violin-strings': {
    heading: 'Checking whether these violin strings fit',
    tip: 'Trace the old string to the tailpiece. A ball sits in a slot or fork while a loop catches a single hook. Check the fitting, especially on the E string, and the size marked on the violin or its current packet before selecting a replacement.',
    guide: [
      'See the ball and loop fittings up close',
      '/guides/how-to-change-a-violin-string#seat-the-tailpiece-end',
    ],
  },
  'violin-pickup-bridge': {
    heading: 'Checking a pickup bridge for an acoustic violin',
    tip: 'Bring the violin and tell the shop what you plan to plug into. The bridge must fit the curve of the top and leave the strings at a playable height. Ask about fitting and the route for the output cable before removing the old bridge.',
    guide: ['Compare acoustic and electric signal paths', '/guides/acoustic-vs-electric-violin'],
  },
  'sattari-rosin': {
    heading: 'Choosing rosin for your bow',
    tip: 'Draw a slow open-string stroke. If the hair slips rather than catching the string, try a little rosin and test the stroke again. Wipe loose dust off the instrument with a clean dry cloth after playing.',
    guide: ['Learn a violin after-practice routine', '/guides/beginner-violin-care'],
  },
};
