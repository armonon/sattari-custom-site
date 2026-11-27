const sizing = {
  label: 'Larsen’s vibrating lengths for its fractional Aurora cello strings (PDF)',
  url: 'https://larsenstrings.com/wp-content/uploads/2023/08/larsen-aurora-fractional-cello-2023.pdf',
};
const demonstration = {
  label: 'Watch Larsen Strings fit and tune a cello string',
  url: 'https://larsenstrings.com/how-to-change-your-cello-strings/',
};
const sweetcare = {
  label: 'Sweetwater’s cello workshop shows the ball end seated in a fine tuner',
  url: 'https://www.sweetwater.com/sweetcare/articles/cello-care-and-maintenance-guide/',
};
const gearedPeg = {
  label: 'Wittner shows where to wind the string on a Finetune-Peg',
  url: 'https://wittner-gmbh.de/mobil/wittner-finetune-peg-instruction-manual.html',
};
const stringManual = {
  label: 'Pirastro on bridge feet, winding and tuning new strings',
  url: 'https://www.pirastro.de/public_pirastro/pages/en/String-Manual/',
};

const images = '/images/guides/cello-string-change';
const commons = 'https://commons.wikimedia.org/wiki/File:';
const shareAlike3 = {
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
};
const royansCredit = {
  author: 'Jorge Royan',
  ...shareAlike3,
};
const crop = 'Cropped and converted to WebP.';

export const celloStringChangeGuide = {
  slug: 'how-to-change-a-cello-string',
  title: 'How to Change a Cello String, Step by Step',
  category: 'Cello care',
  description:
    'Replace one cello string with close-up photos of the endpin, tailpiece, peg windings and bridge feet. Check the size and tune to C2, G2, D3 or A3.',
  answer:
    'Keep the other three strings at playing tension while you replace one. Their pull helps hold the bridge and soundpost in position. If you are fitting a whole set, finish and tune each string before starting the next. Have the replacement, a ruler, your endpin stop and a tuner with cello reference notes within reach.',
  sections: [
    {
      id: 'match-the-cello-string',
      stringCheck: {
        question: 'Where do I measure a cello for a replacement string?',
        answer:
          'Measure alongside an intact open string, from the fingerboard edge of the nut to the string’s contact on the bridge. Compare the result with the chart for the particular set.',
      },
      title: '1. Match the note and playing length',
      paragraphs: [
        'Read the note and instrument size on the packet. A 3/4 cello needs a string designed for its playing length. With the cello supported, hold a ruler or flexible tape alongside an intact string. Measure from the fingerboard side of the nut, where the string starts to vibrate freely, to its contact point on top of the bridge. The black fingerboard ends short of the bridge.',
        'Compare the measurement with the chart for that particular set. For example, Larsen lists 650 mm for its 3/4 Aurora cello strings and 600 mm for its 1/2 set. To identify a broken string, follow its empty groove and compare the three strings still in place. From thickest to thinnest the four are C, G, D and A. Colored thread at the ends follows the maker’s own code.',
      ],
      sourceUrl: sizing.url,
      photos: [
        {
          src: images + '/playing-length.webp',
          width: 1120,
          height: 535,
          alt: 'Sideways front view of a cello. The four strings run from the nut beside the pegs at left across the black fingerboard to the pale bridge at right.',
          caption:
            'Measure along one string between its two contact points. On this cello the nut is on the far left and the bridge is on the right, beyond the end of the fingerboard.',
          author: 'The Metropolitan Museum of Art',
          sourceUrl: 'https://www.metmuseum.org/art/collection/search/505461',
          license: 'CC0 1.0',
          licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
          edit: 'Cropped, rotated, resized and converted to WebP.',
        },
      ],
    },
    {
      id: 'steady-and-loosen',
      stringCheck: {
        question: 'How do I steady the cello for a first string change?',
        answer:
          'Keep the cello in a supported playing position with the endpin secured against slipping. Have someone steady the instrument if you need both hands before you release tension.',
      },
      title: '2. Steady the cello and unwind just one string',
      paragraphs: [
        'Sit on a stable chair and hold the cello in your usual playing position. Tighten the endpin clamp by hand at your usual height and seat the tip in a secure endpin stop so it cannot skid. Keep the cello supported between your knees. If the endpin slips or you need both hands just to balance the cello, have someone steady it before you touch a peg.',
        'Take a side photo of the bridge and a front photo of the pegbox. Trace the string to the shaft it wraps around. Pluck it, move that peg a little, and pluck again. Once the note goes lower, continue unwinding until you can lift the loose coils off and withdraw the tip. Then free the old string from its tailpiece fitting. If it already snapped, collect both pieces. If the peg is stuck, ask for help before applying more force.',
      ],
      sourceUrl: demonstration.url,
      photos: [
        {
          src: images + '/endpin-clamp.webp',
          width: 571,
          height: 219,
          alt: 'A metal cello endpin extends to the right from a black collar with a tightening knob at the base of the instrument.',
          caption:
            'Find the knob where the endpin emerges. It secures the rod at your chosen length. The tip at the far end needs a firm stop on the floor.',
          author: 'SMasters',
          sourceUrl: commons + 'Cello_endpin.JPG',
          ...shareAlike3,
          edit: crop,
        },
        {
          src: images + '/trace-the-peg.webp',
          width: 950,
          height: 589,
          alt: 'Cello strings cross the black nut and enter the pegbox, where red and blue windings are visible on separate shafts.',
          caption:
            'Follow your string upward from the fingerboard in this view. The colored wraps help you see which shaft turns when you move a handle.',
          sourceUrl: commons + 'Cello_-_3224.jpg',
          ...royansCredit,
          edit: '© Jorge Royan / www.royan.com.ar. Cropped, rotated, resized and converted to WebP.',
        },
      ],
    },
    {
      id: 'anchor-the-ball',
      stringCheck: {
        question: 'Where does the ball end of a cello string rest?',
        answer:
          'On a fork it bears against the prongs. On a keyhole tailpiece it sits underneath the narrow slot. Take up slack gently and watch the ball stay seated before turning the peg.',
      },
      title: '3. Seat the new string in its tailpiece fitting',
      paragraphs: [
        'Open the packet for that one note and ease the coil open, keeping its tip away from your face. Find the little metal ball fixed at one end. If there is a fine-tuner screw for this string, check that it can turn a little in either direction.',
        'On a forked fine tuner, guide the string between the two prongs and draw it toward the bridge until the ball rests against the fork. On a plain keyhole tailpiece made for ball ends, pass the ball through the round opening and slide the string into the narrow slot toward the bridge. Hold a little tension and check it stays captured. If you see a knot, loop or unfamiliar attachment on the old string, match the fitting before continuing.',
      ],
      sourceUrl: sweetcare.url,
      photos: [
        {
          src: images + '/ball-end-forks.webp',
          width: 729,
          height: 418,
          alt: 'Four colored cello string ends run between the black jaws at the head of an integrated fine-tuner tailpiece, above four adjustment screws.',
          caption:
            'Look at the first string on the left. The wrapped string runs between the two black sides, with its metal end seated below. Follow your original string to the same fitting.',
          author: 'Turidoth',
          sourceUrl: commons + 'Cello_bridge2.JPG',
          license: 'CC BY-SA 2.5',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5/',
          edit: crop,
        },
        {
          src: images + '/tailpiece-slots.webp',
          width: 850,
          height: 714,
          alt: 'Four round openings in a black cello tailpiece lead into narrow slots toward the raised rim.',
          caption:
            'A plain tailpiece can have a keyhole for each string. Notice how each round opening narrows into a slot on the bridge side. This photo shows the shape of the fitting from above.',
          author: 'Auckland Museum',
          sourceUrl: commons + 'Cello_(AM_2004.133.1-10).jpg',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
          edit: 'Cropped, rotated, resized and converted to WebP.',
        },
      ],
    },
    {
      id: 'wind-the-cello-peg',
      stringCheck: {
        question: 'What should I check after threading a cello peg?',
        answer:
          'With the winding still loose, sight from the nut to the first turn. Check that the tip clears other coils and that the winding has room beside the pegbox wall.',
      },
      title: '4. Thread the peg and form the winding',
      paragraphs: [
        'With the ball end still seated, lay the string in its own grooves at the bridge and nut. On a conventional wooden peg, turn the shaft until you can see its small drilled hole. Feed the free tip through so a few millimeters show on the other side. Keep a light pull on the string as you start the peg in the direction you photographed.',
        'The string should approach the peg from the nut and pass over its shaft. Guide the turns side by side toward the handle, leaving a little clearance from the wooden wall of the pegbox. Support the pegbox as you turn a friction peg with gentle inward pressure. Stop once the string can just stay in its grooves. Geared pegs use a different mechanism. On a Wittner Finetune-Peg the string winds on the rotating center section and the fitted peg stays in the cello.',
      ],
      sourceUrl: gearedPeg.url,
      photos: [
        {
          src: images + '/peg-winding.webp',
          width: 1050,
          height: 340,
          alt: 'Inside a cello pegbox, blue string winding forms several adjacent turns around a pale peg. The strings extend across the nut at the right.',
          caption:
            'Look at the blue coils beside the nut. The turns sit next to each other on the shaft. Watch this area as you wind so the string stays clear of its neighbors and the pegbox wall.',
          sourceUrl: commons + 'Vienna_-_Detail_of_a_Violoncello_-_9526.jpg',
          ...royansCredit,
          edit: '© Jorge Royan / www.royan.com.ar. Cropped, resized and converted to WebP.',
        },
      ],
    },
    {
      id: 'check-the-cello-bridge',
      stringCheck: {
        question: 'How can I check both feet of the cello bridge?',
        answer:
          'Look from each side at eye level with the top. Compare each foot with your starting photo. An opening under either foot is a reason to stop tightening.',
      },
      title: '5. Check the grooves and the feet of the bridge',
      paragraphs: [
        'Pluck gently at low tension. Look from the peg to the tailpiece and confirm that the new string runs in its own shallow groove at the nut and at the top of the bridge. If it has hopped onto an edge, ease the peg until you can guide it back with a fingertip.',
        'Compare the bridge from the side with your starting photo as you bring up the tension. Check both feet against the curved top. Each should make contact all along its bottom edge, and the flatter face of the bridge toward the tailpiece should stand roughly upright. If the bridge starts to lean or daylight appears under a foot, stop tightening and get help. If the bridge falls or the soundpost comes loose inside the cello, leave the instrument unplayed and have a violin-family repairer reset it before returning to pitch.',
      ],
      sourceUrl: stringManual.url,
      photos: [
        {
          src: images + '/bridge-grooves.webp',
          width: 340,
          height: 292,
          alt: 'Four separated strings cross a curved pale cello bridge between the end of the fingerboard and the tailpiece.',
          caption:
            'Trace each string from the fingerboard over the crown of the bridge. The new string should follow the line of its own groove with an even gap to the next string.',
          author: 'Georg Feitscher',
          sourceUrl: commons + 'CelloCloseup1.jpg',
          ...shareAlike3,
          edit: crop,
        },
        {
          src: images + '/bridge-foot.webp',
          width: 397,
          height: 316,
          alt: 'One pale bridge foot on the varnished top of a cello, beside the curved sound hole.',
          caption:
            'Lower your eye to the seam between the pale bridge foot and the varnished top. Check that seam from each side of the cello so you inspect both feet.',
          author: 'Georg Feitscher',
          sourceUrl: commons + 'CelloCloseup4.jpg',
          ...shareAlike3,
          edit: crop,
        },
      ],
    },
    {
      id: 'tune-and-recheck',
      stringAid: 'cello-octave',
      stringCheck: {
        question: 'Is the cello’s open A A3 or A4?',
        answer:
          'The cello target is A3, 220 Hz at concert pitch A4 = 440 Hz. Hear both references below, then return to the lower one before tuning your cello.',
      },
      title: '6. Tune from below and recheck after playing',
      paragraphs: [
        'Select cello on the tuner. From thickest to thinnest the open strings are C2, G2, D3 and A3. Listen to the reference for the string you changed, then pluck that string with no finger on the fingerboard. On cello the open A is A3, one octave below a violin’s open A. A tuner displaying only a letter cannot tell those two A notes apart on its screen.',
        'As long as the pitch is below the target, use small peg movements and pluck again after each turn. When the note is close, use its fine tuner if fitted. Looking down at a conventional adjustment screw, clockwise raises pitch and counterclockwise lowers it. Stop at the target, check the bridge again, then play a short passage and recheck all four notes. A new string may need several small corrections as it settles. A sudden large drop is a reason to inspect the peg winding and the ball end before adding tension again.',
      ],
      link: { label: 'Hear C2, G2, D3 and A3 on the cello tuner', path: '/tuner/cello' },
      photos: [
        {
          src: images + '/fine-tuners.webp',
          width: 504,
          height: 550,
          alt: 'Four separate adjustment knobs on a cello tailpiece, one aligned with each colored string end.',
          caption:
            'Trace your new string to its own knob. Keep the others where they are while you make the last small correction, then check every open string.',
          author: 'MichaelMaggs',
          sourceUrl: commons + 'Cello_study.jpg',
          ...shareAlike3,
          edit: crop,
        },
      ],
    },
  ],
  sources: [sizing, demonstration, sweetcare, gearedPeg, stringManual],
  related: [
    '/tuner/cello',
    '/guides/how-to-change-a-viola-string',
    '/guides/how-to-change-a-violin-string',
  ],
};
