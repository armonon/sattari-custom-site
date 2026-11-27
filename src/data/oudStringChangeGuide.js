const aquila = {
  label: 'Aquila’s oud string chart, with tunings and individual course sizes',
  url: 'https://aquilacorde.com/en/oud-guide/',
};
const navid = {
  label: 'Oud teacher Navid Goldrick demonstrates a one-string change',
  url: 'https://www.oudforguitarists.com/how-to-change-oud-strings/',
};
const bridge = {
  label: 'Arab Instruments illustrates how a string locks at the bridge',
  url: 'https://www.arabinstruments.com/pages/stringing-the-oud',
};
const sala = {
  label: 'Sala Muzik demonstrates fitting strings to an oud bridge and pegs',
  url: 'https://salamuzik.com/blogs/news/how-to-change-oud-strings',
};

const images = '/images/guides/oud-string-change';
const commons = 'https://commons.wikimedia.org/wiki/File:';
const shareAlike = {
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};
const publicDomain = {
  license: 'CC0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
};
const fixedBridgeCredit = {
  author: 'Mutaz Awad',
  sourceUrl: commons + 'Arabic_musical_instruments_OUD.jpg',
  ...shareAlike,
};
const manolCredit = {
  author: 'The Metropolitan Museum of Art, Manol’s 1916 oud, 2014.522a, b',
  ...publicDomain,
};

export const oudStringChangeGuide = {
  slug: 'how-to-change-oud-strings',
  title: 'How to Change Oud Strings, Step by Step',
  category: 'Oud care',
  description:
    'Change a string on a fixed-bridge oud. See close-up photos of the bridge knot and peg windings, identify a floating bridge, and tune a paired course.',
  answer:
    'If one string in a pair has snapped, leave its partner in place. It shows you the path at the bridge and helps you spot the empty nut groove. If the two strings sound the same note in the same octave, the surviving string also gives you a pitch to match. This guide walks through a fixed tie bridge and wooden friction pegs. Gather the matching oud string, its tuning chart, a tuner, a folded towel and small string cutters.',
  sections: [
    {
      id: 'identify-the-bridge',
      title: '1. Find where your oud’s strings end',
      paragraphs: [
        'Follow one string from the round soundhole toward the wide end of the bowl. On a fixed tie bridge, the string goes through a hole in the wooden bridge and loops around it. You can see the short end there. This is the bridge used in the tying step below.',
        'On a floating-bridge oud, the strings pass over a separate bridge and keep going to an anchor at the rim. If yours matches the second picture, keep the bridge in its original position and use your maker’s directions for the tail anchor. A loose or lifting joint under a fixed bridge needs an oud repairer before you add tension.',
      ],
      photos: [
        {
          ...fixedBridgeCredit,
          src: images + '/fixed-bridge-and-body.webp',
          width: 1100,
          height: 766,
          alt: 'Oud strings run from the large soundhole to individual loops on a brown fixed bridge.',
          caption:
            'Fixed bridge. Follow any pair toward the lower left. Both strings end on the dark wooden ridge, each with its own tie.',
          edit: 'Cropped, resized and converted to WebP.',
        },
        {
          author: 'Jo Dusepo',
          sourceUrl: commons + 'Syrian_oud_(orig).jpg',
          ...shareAlike,
          src: images + '/floating-bridge-and-tail.webp',
          width: 844,
          height: 432,
          alt: 'Strings on a Syrian oud cross a pale floating bridge and continue to individual anchors at the rim.',
          caption:
            'Floating bridge. Look at the stretch of string between the pale bridge and the bottom edge. The short ends appear at that edge.',
          edit: 'Cropped and converted to WebP.',
        },
      ],
    },
    {
      id: 'match-the-course',
      title: '2. Match the new string to its course',
      paragraphs: [
        'A course is a string, or a pair of strings, played as one. Count the courses, then count the strings in each. An eleven-string oud often has five pairs and one single bass. Some ouds have a sixth pair. Make a sketch of yours and write down the open notes, including their octaves, from your teacher, maker or existing set.',
        'Choose a string specified for that course, tuning and vibrating length. To check the length, measure along a string from the nut at the top of the fingerboard to the point where the playing length ends at the bridge. Aquila lists different sets for Arabic, Turkish and Iraqi tunings. Use the envelope for your particular course. Two strings that look alike can be intended for different pitches.',
      ],
      sourceUrl: aquila.url,
      photos: [
        {
          ...manolCredit,
          sourceUrl: commons + '%C5%AAd_MET_DP340079.jpg',
          src: images + '/pairs-at-the-soundhole.webp',
          width: 680,
          height: 630,
          alt: 'Close pairs of oud strings pass over a carved circular rosette, with wider gaps separating the courses.',
          caption:
            'Count strings against the plain wood just above the rosette. A narrow gap divides the two members of a pair. The next course is farther away.',
          edit: 'Cropped and converted to WebP.',
        },
      ],
    },
    {
      id: 'loosen-one-string',
      title: '3. Follow one string to its peg and loosen it',
      paragraphs: [
        'Cradle the rounded bowl in the towel so it cannot roll. Support the neck and leave the angled pegbox free. Photograph the bridge from the side and the open pegbox from above. Follow your string over the nut and into the box until you see which wooden shaft carries its coils. The nearest peg handle can belong to a different string.',
        'Pluck the string and turn its peg a little in the direction that lowers the note. Once the string hangs slack, unwind the remaining turns and slide its tip out of the peg hole. At the bridge, push slack into the loop, free the short tail with your fingers and pull the string back through its hole. For a broken string, remove both loose pieces and keep the old tie as a pattern.',
      ],
      sourceUrl: navid.url,
      photos: [
        {
          ...manolCredit,
          sourceUrl: commons + '%C5%AAd_MET_DP346448.jpg',
          src: images + '/trace-the-string.webp',
          width: 800,
          height: 860,
          alt: 'Strings cross a pale oud nut and fan into an open pegbox, where they wind onto different lateral wooden pegs.',
          caption:
            'Start at one groove in the pale nut. Follow that line up through the open box to a coil, then across the shaft to its handle.',
          edit: 'Cropped and converted to WebP.',
        },
        {
          author: 'Cleveland Museum of Art, The Charles G. King Jr. collection, 1918.350',
          sourceUrl: 'https://www.clevelandart.org/art/1918.350',
          ...publicDomain,
          src: images + '/row-of-bridge-loops.webp',
          width: 1000,
          height: 521,
          alt: 'Separate loops clasp the bridge of a historical oud, with individual short string tails visible beside the long strings.',
          caption:
            'Notice the different tail direction on this older oud. Photograph the tie on the string beside your broken one before you undo anything.',
          edit: 'Cropped from the museum photograph, resized and converted to WebP.',
        },
      ],
    },
    {
      id: 'anchor-the-string',
      title: '4. Tie the new string at the fixed bridge',
      paragraphs: [
        'For the rear-facing tie pictured here, thread one end through the empty bridge hole, starting on the soundhole side and coming out toward the rim. Leave several inches of short tail to work with. Bring that tail up over the ridge and pass it under the long string where it comes out toward the neck. This forms a loose loop around the ridge.',
        'Turn the tail back toward the rim and tuck it through the loop, winding it around the part that lies across the ridge. A slippery plain treble can need more turns than a textured wound bass. Follow the string maker’s wrap count or the secure tie on its matching partner. Hold the final tuck against the rear face. Draw the long end gently toward the neck while keeping the tail clear of the soundboard.',
        'Check at very low tension. The new string should leave the bridge beside its partner at the same height. If the tail pulls into the tie, slacken and retie it before winding the peg. Keep enough tail to redo the knot.',
      ],
      sourceUrl: bridge.url,
      photos: [
        {
          ...fixedBridgeCredit,
          src: images + '/tie-at-the-bridge.webp',
          width: 1080,
          height: 790,
          alt: 'Close-up of oud string loops crossing a dark fixed bridge and trapping the short tails at the rear edge.',
          caption:
            'Follow the leftmost pale pair. Each long strand leads toward the upper right, crosses its own wrap at the ridge and leaves a short tail on the lower-left side. Tie each string separately.',
          edit: 'Cropped and converted to WebP.',
        },
      ],
    },
    {
      id: 'wind-the-peg',
      title: '5. Thread the peg and guide the coils',
      paragraphs: [
        'Lay the long string along the fingerboard and into its original nut groove. Turn the empty peg until its drilled hole is accessible. Feed the tip through and leave a short end projecting. Allow enough slack between bridge and peg for a few turns. Keep the bridge tie seated with light finger tension as you turn the peg in the direction recorded in your photo.',
        'Let the first turn catch the short end, then guide the coils side by side. Leave room beside the pegbox wall. Check that the short tip and the length running back to the nut both clear neighboring strings and coils. If the wraps bunch up or a second string moves when you turn the peg, slacken and start the winding again. Apply light inward pressure while turning a tapered friction peg so it seats. A peg that jams or will stay put only under strong pressure needs attention from an oud repairer.',
      ],
      sourceUrl: sala.url,
      photos: [
        {
          ...manolCredit,
          sourceUrl: commons + '%C5%AAd_MET_DP340079.jpg',
          src: images + '/wraps-on-the-peg.webp',
          width: 540,
          height: 570,
          alt: 'Front view inside an oud pegbox showing pale string wraps side by side on individual dark peg shafts.',
          caption:
            'Look near the top of the open slot. The pale coils wrap around horizontal shafts inside the box. Follow a shaft outward to see which black handle turns it.',
          edit: 'Cropped and converted to WebP.',
        },
      ],
    },
    {
      id: 'tune-one-string',
      title: '6. Tune one string, then listen to the pair',
      paragraphs: [
        'Start below your recorded pitch. Lightly touch the other string of the pair to mute it, then pluck the new open string alone. In the linked tuner choose “Chromatic · any single note” under Instrument. Raise the note in small turns and check the octave as well as the letter. For example, the highest course on Aquila’s Arabic C2–C4 set is C4, with both strings at C4. Use the targets on your own chart.',
        'Release the partner and play both strings together. For a unison pair, a pulsing sound slows as the pitches come together. Check each one separately if you are unsure which to adjust. Play a few notes and tune again as the new string settles. For a full set, repeat with one string at a time.',
        'If the pitch suddenly drops, watch the bridge tail and the winding while you pluck again. A moving tail or an unwinding coil needs reseating with the string slack. Once it holds pitch, trim the surplus clear of neighboring strings, leaving a short tail beyond the tie. Hold each offcut as you snip so it cannot scratch the top.',
      ],
      sourceUrl: aquila.url,
      link: {
        label: 'Open the live tuner and choose Chromatic for oud',
        path: '/studio/keybpm#live-tuner',
      },
      photos: [
        {
          author: 'Sinikka Halme',
          sourceUrl: commons + 'Oud_player_01.jpg',
          ...shareAlike,
          src: images + '/pluck-one-string.webp',
          width: 1050,
          height: 713,
          alt: 'A player holds a pale risha against the oud strings between the bridge and the round soundhole.',
          caption:
            'The picking hand holds a risha, the oud pick. A single light stroke is enough for a tuner reading. Start again if the neighboring string rings along.',
          edit: 'Cropped, resized and converted to WebP.',
        },
      ],
    },
  ],
  sources: [navid, bridge, aquila, sala],
  related: [
    '/studio/keybpm#live-tuner',
    '/guides/how-to-change-setar-strings',
    '/guides/how-to-change-persian-tar-strings',
  ],
};
