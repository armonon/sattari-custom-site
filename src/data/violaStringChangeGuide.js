const sizing = {
  label: 'Larsen’s Aurora viola size chart and vibrating string lengths',
  url: 'https://larsenstrings.com/aurora-viola-size-guide/',
};
const demonstration = {
  label: 'Watch Larsen Strings change the strings on a viola',
  url: 'https://larsenstrings.com/how-to-change-your-viola-strings/',
};
const stringManual = {
  label: 'Pirastro on fitting string ends, keeping the bridge upright and settling new strings',
  url: 'https://www.pirastro.de/public_pirastro/pages/en/String-Manual/',
};
const gearedPeg = {
  label: 'Wittner’s winding instructions for its geared Finetune-Peg',
  url: 'https://wittner-gmbh.de/mobil/wittner-finetune-peg-instruction-manual.html',
};

const images = '/images/guides/viola-string-change';
const commons = 'https://commons.wikimedia.org/wiki/File:';
const crop = 'Cropped and converted to WebP.';
const resize = 'Cropped, resized and converted to WebP.';
const met = {
  author: 'The Metropolitan Museum of Art',
  license: 'CC0 1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
};
const shareAlike3 = {
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
};
const shareAlike4 = {
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

export const violaStringChangeGuide = {
  slug: 'how-to-change-a-viola-string',
  title: 'How to Change a Viola String, Step by Step',
  category: 'Viola care',
  description:
    'Replace a viola string with close-up photos. Measure the playing length, match the end fitting, wind the peg, check the bridge feet and tune C3 to A4.',
  answer:
    'A broken string usually calls for one replacement. To change a whole set, bring each new string to pitch before taking off the next. The other three keep tension on the bridge and soundpost. Gather a viola string in the right size, a ruler, a folded towel and a tuner that can sound a reference note.',
  sections: [
    {
      id: 'measure-and-match',
      title: '1. Measure the playing length and match the packet',
      paragraphs: [
        'Follow an intact open string from the nut, the small ridge just below the tuning pegs, to the top edge of the bridge. Measure between those two points along the string with a ruler held beside it. Write that measurement in centimeters. A viola’s body length in inches and its vibrating string length are different measurements. Check which one the string maker asks for.',
        'Choose the same note as the old string and check the size chart for that particular set. For example, Larsen lists 35 cm of vibrating length for its 3/4 Aurora viola strings and 37 cm for its full-size Aurora strings. Other makers use their own size labels. If the A string has a fine tuner, look at the old end too. It may have a metal ball or a bare loop that fits a hook.',
      ],
      sourceUrl: sizing.url,
      photos: [
        {
          src: images + '/playing-length.webp',
          width: 1100,
          height: 666,
          alt: 'Front of a viola turned sideways, with the nut at the pegbox on the left and the pale bridge on the right.',
          caption:
            'Measure the part that can sound. Start where the string leaves the nut on the left, cross the entire fingerboard and end where the string touches the bridge on the right.',
          sourceUrl: 'https://www.metmuseum.org/art/collection/search/503931',
          ...met,
          edit: 'Cropped, rotated, resized and converted to WebP.',
        },
      ],
    },
    {
      id: 'loosen-one-peg',
      title: '2. Trace the old string and loosen its peg',
      paragraphs: [
        'Lay the viola face up on the towel with the neck supported and the pegs free to turn. Take a photo of the bridge from the side and another of the strings at the pegs. Trace the string you are replacing into the pegbox. On unfamiliar instruments, tracing the string is more reliable than guessing from the peg handle.',
        'Pluck the string and turn that peg a little. When the sound drops in pitch, keep turning in that direction until the string hangs loose. Unwind it, withdraw the tip from the hole in the peg, then release the other end from the tailpiece. For a snapped string, collect both pieces. If the peg resists gentle movement or several strings have broken in the same spot, ask a teacher or violin-family repairer to look before continuing.',
      ],
      sourceUrl: demonstration.url,
      photos: [
        {
          src: images + '/follow-to-the-peg.webp',
          width: 564,
          height: 700,
          alt: 'Front of a viola scroll showing the four separate strings entering the pegbox and the four black peg handles.',
          caption:
            'Start at the bottom of this close-up and follow one string upward. The shaft it wraps around tells you which handle to turn.',
          sourceUrl: 'https://www.metmuseum.org/art/collection/search/504948',
          ...met,
          edit: crop,
        },
      ],
    },
    {
      id: 'fit-the-tailpiece',
      title: '3. Seat the new string at the tailpiece',
      paragraphs: [
        'Open just the packet for this string. If you have a fine-tuner screw for it, leave room for small turns in both directions. Identify the fitting on your own viola before pulling on the new string.',
        'For a keyhole slot, pass the ball through the wide opening, then slide the string toward the bridge into the narrow part so the ball catches underneath. For a forked fine tuner, slide the string between the prongs with its ball resting against the fork. A loop-end string slips over a single hook. If your ball-end string and the hook do not match, check the maker’s instructions for that exact string before trying to remove its ball. Gently pull along the string toward the pegbox and watch that its end stays in place.',
      ],
      sourceUrl: stringManual.url,
      photos: [
        {
          src: images + '/tailpiece-ends.webp',
          width: 910,
          height: 712,
          alt: 'Three viola strings enter slots in a wooden tailpiece. At the right the A string has a gold-colored ball held at a separate fine tuner.',
          caption:
            'This viola has two kinds of fitting. The red, yellow and green windings enter slots in the wood. The blue winding on the right ends in a visible metal ball at the fine tuner.',
          author: 'j_arlecchino',
          sourceUrl: commons + 'Viola_Bridge.jpg',
          ...shareAlike4,
          edit: resize,
        },
      ],
    },
    {
      id: 'thread-the-peg',
      title: '4. Thread the peg and guide the first turns',
      paragraphs: [
        'Find the hole through the bare peg shaft and thread the free tip through, leaving about 5 mm showing on the far side. Keep light tension on the long part with one hand so the tailpiece end stays put. Turn a conventional wooden peg so the string from the nut passes over the top of its shaft. Guide the coils toward the handle, laying them beside one another with a little clearance from the pegbox wall.',
        'Support the pegbox with your hand and use gentle inward pressure as you turn a wooden friction peg. Stop with enough slack to guide the string into both grooves. A geared peg has its own winding area. On a Wittner Finetune-Peg, wind onto the moving middle section and leave the peg installed.',
      ],
      sourceUrl: gearedPeg.url,
      photos: [
        {
          src: images + '/thread-and-wind.webp',
          width: 611,
          height: 340,
          alt: 'Close-up inside a viola pegbox showing colored string coils wound side by side on the peg shafts.',
          caption:
            'Look at the pink windings on the left. Each turn sits next to the previous turn. The neighboring shaft has dark windings and a small metal tip emerging from its hole.',
          author: 'Lemonedo',
          sourceUrl: commons + 'Pegs_of_viola.JPG',
          ...shareAlike3,
          edit: 'Cropped, rotated and converted to WebP.',
        },
      ],
    },
    {
      id: 'inspect-the-bridge',
      title: '5. Check the grooves and both bridge feet',
      paragraphs: [
        'At the nut, place the new string in the same groove as the old one. Do the same at the bridge and follow the string from end to end. On a standard four-string viola the order from thickest to thinnest is C, G, D, A. Take up just enough slack to keep it seated, then check that it has stayed in its lane.',
        'Look across the instrument from each side. Both feet of the bridge should meet the wooden top without daylight underneath. Compare the bridge angle with your starting photo. The flatter face toward the tailpiece should be roughly perpendicular to the top beneath it. If the bridge tilts as you raise the pitch or either foot lifts, stop and get help. If the bridge has fallen or the soundpost is loose inside, leave the instrument unplayed and have a repairer reset it before tuning.',
      ],
      photos: [
        {
          src: images + '/bridge-grooves.webp',
          width: 950,
          height: 608,
          alt: 'Four strings pass over separate points on the curved top of a pale wooden viola bridge.',
          caption:
            'Look from the tailpiece toward the fingerboard. Compare your new string with its two neighbors, or with the one beside it for the outside C or A. It should sit in its own shallow groove.',
          author: 'Anoixe',
          sourceUrl: commons + 'Ponticello_viola.jpg',
          ...shareAlike3,
          edit: resize,
        },
        {
          src: images + '/bridge-foot.webp',
          width: 950,
          height: 536,
          alt: 'Side-on close-up of the near bridge foot meeting the polished wooden top of a viola beside the f-hole.',
          caption:
            'Look at the bottom edge of the light-colored wood in the center. This is the join to check for a gap. View the other bridge foot from the opposite side of your viola.',
          author: 'Lexis0124',
          sourceUrl: commons + 'Viola_f_hole.jpg',
          ...shareAlike4,
          edit: resize,
        },
      ],
    },
    {
      id: 'tune-and-settle',
      title: '6. Tune from below and check the string again',
      paragraphs: [
        'Select viola on the tuner. The open strings, lowest first, are C3, G3, D4 and A4. Play the reference for your string, then pluck yours with no finger on the fingerboard. For the thick C string, listen for C3. An app that shows only “C” can give the same letter an octave away.',
        'Keep your face clear of the new string. Bring it up slowly with the peg, pausing to pluck and compare after each small turn. When you are close, use the fine tuner if fitted. Looking down at its screw, clockwise raises the pitch and counterclockwise lowers it. Stop at the reference pitch. Check the bridge again and play a few minutes, then check all four notes. It is normal to bring a new string back up to pitch several times as it settles.',
      ],
      link: { label: 'Play the C3, G3, D4 and A4 reference notes', path: '/tuner/viola' },
      photos: [
        {
          src: images + '/fine-tuner.webp',
          width: 796,
          height: 417,
          alt: 'Side view of an A-string fine tuner on a viola, with a brass adjustment screw and the string’s ball at the other end of the lever.',
          caption:
            'The brass screw on the right makes the small pitch correction for this A string. Pluck again after each turn. Your viola may have one of these adjusters or one for each string.',
          author: 'Lemonedo',
          sourceUrl: commons + 'Fine_tuner.jpg',
          ...shareAlike3,
          edit: crop,
        },
      ],
    },
  ],
  sources: [sizing, demonstration, stringManual, gearedPeg],
  related: [
    '/guides/how-to-choose-a-viola',
    '/guides/how-to-change-a-cello-string',
    '/guides/violin-vs-viola',
    '/tuner/viola',
  ],
};
