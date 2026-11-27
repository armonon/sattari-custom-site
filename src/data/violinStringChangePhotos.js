const photoDirectory = '/images/guides/violin-string-change';
const shopOriginals = 'https://sattarimusic.com/sattari%20site/violins';
const commons = 'https://commons.wikimedia.org/wiki/File:';
const edit = 'Cropped, resized and converted to WebP.';

export const violinStringChangePhotos = {
  'match-the-string': [
    {
      src: `${photoDirectory}/string-packets.webp`,
      width: 780,
      height: 780,
      alt: 'Four separate violin string packets marked e–1, a–2, d–3 and g–4.',
      caption:
        'Look for the letter on the packet. On this set, e–1 is the thin E string and g–4 is the thick G string. Leave the other packets closed.',
      author: 'Sattari Music',
      sourceUrl: `${shopOriginals}/violin-strings-2.jpg`,
      edit,
    },
  ],
  'remove-one-string': [
    {
      src: `${photoDirectory}/trace-the-peg.webp`,
      width: 810,
      height: 717,
      alt: 'Four tuning pegs around the scroll. The strings extend from the end of the fingerboard into the open pegbox.',
      caption:
        'Before loosening a peg, follow your string across the nut at the end of the fingerboard and into the pegbox. Check which peg it actually wraps around.',
      author: 'Sattari Music',
      sourceUrl: `${shopOriginals}/cremona-acoustic-3.jpg`,
      edit,
    },
  ],
  'seat-the-tailpiece-end': [
    {
      src: `${photoDirectory}/ball-end-in-fork.webp`,
      width: 805,
      height: 575,
      alt: 'Side view of an E-string fine tuner. A dark metal ball sits against the upright fork at the right, beside the adjustment screw.',
      caption:
        'Look to the right of the brass screw. The ball catches against the fork and the string extends toward the bridge. A loop-end string needs a compatible hook.',
      author: 'Kjerstin',
      sourceUrl: `${commons}Violin_tuning_peg.jpg`,
      license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
      edit,
    },
    {
      src: `${photoDirectory}/loop-hook-and-keyholes.webp`,
      width: 570,
      height: 430,
      alt: 'Three strings sit in keyhole slots in a wooden tailpiece. At the far right a bare metal string loop wraps around a single fine-tuner hook.',
      caption:
        'Compare the fittings. At the far right, the E string’s loop slips over a single hook. To its left, three ball ends anchor beneath the tailpiece, with each string resting in the narrow part of its slot.',
      author: 'Just plain Bill',
      sourceUrl: `${commons}Violin_tailpiece.jpg`,
      license: 'Public domain',
      licenseUrl: `${commons}Violin_tailpiece.jpg#Licensing`,
      edit: 'Cropped and converted to WebP.',
    },
  ],
  'wind-the-peg': [
    {
      src: `${photoDirectory}/peg-hole-and-winding.webp`,
      width: 910,
      height: 388,
      alt: 'Inside a violin pegbox. Round holes are visible in the dark peg shafts beside existing string windings.',
      caption:
        'Find the small round hole in the peg shaft. On the left you can see one just below several turns of string. With your old string out, rotate its peg until you can thread the new tip through.',
      author: 'Wouter Hagens',
      sourceUrl: `${commons}D800_A4348_viool.jpg`,
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      edit,
    },
  ],
  'check-the-bridge': [
    {
      src: `${photoDirectory}/bridge-grooves.webp`,
      width: 810,
      height: 734,
      alt: 'Four strings cross separate grooves along the curved top of a violin bridge. A blue protective sleeve sits at one contact point.',
      caption:
        'Look along the curved top of the bridge. Each string should follow its own shallow groove. The blue tube on this instrument is a protective sleeve.',
      author: 'Adam Shaylor',
      sourceUrl: `${commons}Violin_bridge.jpg`,
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      edit,
    },
    {
      src: `${photoDirectory}/bridge-foot-profile.webp`,
      width: 880,
      height: 448,
      alt: 'Side view of a violin with the tailpiece on the left. The near bridge foot rests flat against the curved wooden top.',
      caption:
        'Get level with the side of your violin and look where the bridge foot meets the top. The near foot on this Amati violin sits flush against the wood. Look at the other foot from the opposite side.',
      author: 'The Metropolitan Museum of Art',
      sourceUrl: `${commons}Violin_MET_DP232341.jpg`,
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      edit,
    },
  ],
  'tune-and-recheck': [
    {
      src: `${photoDirectory}/fine-tuning-screws.webp`,
      width: 850,
      height: 611,
      alt: 'Four black fine-tuner screws on a violin tailpiece, one below each string.',
      caption:
        'This tailpiece has four fine tuners. Follow your new string down to its screw. Once you are close to pitch, turn it a little, then pluck and check the note again.',
      author: 'Kyle McDonald',
      sourceUrl: `${commons}Four_violin_tuning_pegs.jpg`,
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      edit,
    },
  ],
};
