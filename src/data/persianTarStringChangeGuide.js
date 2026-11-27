const courses = {
  label:
    'Tar player Parham Nassehpoor on the six strings, their gauges and tunings for different dastgahs',
  url: 'https://parhamnassehpoor.com/persian-tar.html',
};
const playerDemo = {
  label: 'Watch tar player Sahba Motallebi replace a string on her instrument',
  url: 'https://www.youtube.com/watch?v=dcWCuCPmDro',
};
const workshop = {
  label:
    'Watch Ramin Jazayeri’s workshop demonstrate string attachment on tar and setar (in Persian)',
  url: 'https://www.youtube.com/watch?v=RoSd5J2nKL4',
};
const gearedPeg = {
  label: 'Wittner’s stringing instructions for its geared tar pegs',
  url: 'https://wittner-gmbh.de/mobil/wittner-feinstimmwirbel-gebrauchsanweisung-tar-saz.html',
};
const images = '/images/guides/persian-tar-string-change';
const sandika = {
  author: 'Sandika7',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Persian_Tar.jpg',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};
const crop = 'Cropped and converted to WebP.';

export const persianTarStringChangeGuide = {
  slug: 'how-to-change-persian-tar-strings',
  title: 'How to Change Persian Tar Strings, Step by Step',
  category: 'Persian tar care',
  description:
    'Change one string on a six-string Persian tar. See real close-ups of the tailpiece loop, peg winding, bridge and nut, then tune the new string to its course.',
  answer:
    'Before you loosen anything, identify the exact wire you need and the pitch you want back. This walkthrough fits a six-string Iranian tar with a toothed tailpiece and drilled wooden tuning pegs. Use a matching string with a prepared loop at the body end. Gather a folded towel, a phone for reference photos and a chromatic tuner. For a whole set, finish and tune one string at a time so the others hold the loose bridge in place on the skin.',
  sections: [
    {
      id: 'identify-the-course',
      stringAid: 'tar-courses',
      stringCheck: {
        question: 'Which wire in the course broke?',
        answer:
          'At the bridge, find the empty groove and follow its neighbor back to the tailpiece. Write down the course and which wire is missing. In the last course, mark drone or bass separately.',
      },
      title: '1. Find the broken string’s place in its pair',
      paragraphs: [
        'A course is a pair of strings you usually strike together. On a common Persian tar the first pair has two thin steel “white” strings. The second has two “yellow” strings, often bronze. The last combines a thin drone with a much thicker bass. Look at those last two carefully. Their pitches can be an octave apart or different notes altogether. A setar and an Azerbaijani tar have different string layouts.',
        'Choose wire labeled for that position on a Persian tar. Match the material and thickness printed on your existing packet or specified by your teacher or the maker. Color alone cannot tell you the gauge. If the old string still sounds, record its open note on your phone and write down its octave. For a broken white or yellow string, its intact partner can give you the unison pitch. Get a separate reference for a broken drone or bass.',
      ],
      sourceUrl: courses.url,
      photos: [
        {
          src: images + '/bowl-and-six-strings.webp',
          width: 980,
          height: 580,
          alt: 'Six metal strings cross the two skin-covered chambers of a Persian tar, pass over a pale bridge and spread out toward the tailpiece.',
          caption:
            'Follow one wire from the bridge toward the body end on the right. The wires spread apart there, which makes it easier to identify the attachment for the one you need.',
          ...sandika,
          edit: 'Cropped, resized and converted to WebP.',
        },
      ],
    },
    {
      id: 'loosen-one-string',
      stringCheck: {
        question: 'Which tar peg should I loosen?',
        answer:
          'Follow the winding to the shaft, then along that shaft to its handle. For a broken wire you can trace the short piece left at the peg even when there is no note to pluck.',
      },
      title: '2. Trace one wire to its peg and let it go slack',
      paragraphs: [
        'Nest the rounded wooden bowl in a folded towel so it cannot roll. Support the neck with the pegs free to turn and the skin facing up. Photograph the bridge from the side and both ends of the old string. Follow that wire over the nut, the small ridge at the top of the fingerboard, into the pegbox and around its shaft. Note which way the wire winds around it.',
        'Pluck the string and turn that peg a small amount. Once you hear the pitch drop, keep loosening until you can lift the string freely. Unwind it, take the tip out of the peg and lift the slack loop off the tailpiece. A broken wire can leave a sharp piece at either end. If you find a cord tied to the peg, leave it tied. That attachment calls for a string prepared to fit the cord. A seized peg, a torn skin or a loose tailpiece needs a repairer’s attention before you add tension.',
      ],
      sourceUrl: playerDemo.url,
      photos: [
        {
          src: images + '/trace-the-peg.webp',
          width: 780,
          height: 600,
          alt: 'Angled close-up of the six wooden tuning pegs on Milad Mohammadi’s Persian tar, with the shafts crossing the open pegbox.',
          caption:
            'Start at the nut on the left. Follow the wire into the opening until it meets a shaft, then follow the shaft out to its handle. The handle closest to a wire may belong to another string.',
          author: 'آوای پارس',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Milad_mohammadi.jpg',
          license: 'CC BY-SA 3.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
          edit: crop,
        },
      ],
    },
    {
      id: 'anchor-the-string',
      stringCheck: {
        question: 'How do I know the loop is on the simgir tooth?',
        answer:
          'Keep the wire slack, settle the loop down around the base of the empty tooth and draw the wire toward the bridge with two fingers. Watch whether the loop walks up the tip.',
      },
      title: '3. Hook the prepared loop onto the tailpiece',
      paragraphs: [
        'Find the small string holder at the wooden end of the bowl, beyond the bridge. It is called the simgir. On the toothed style pictured here, each wire has a loop that catches around a tooth. Find the spot left by the old loop. Lower the replacement loop over that tooth and guide the long part of the wire back toward the bridge. A gentle lengthwise pull should seat the loop against the base of the tooth. Watch that the neighboring loops stay in place.',
        'If both ends of your new wire are straight, it still needs its tailpiece loop. A tar-string supplier or teacher can form one to match the old string with a string-twisting tool called a simtab. Keep the old loop as a sample. A tailpiece with through-holes or a different catch needs the attachment made for that fitting. A tooth that is cracked or moves under a gentle pull needs repair.',
      ],
      sourceUrl: workshop.url,
      photos: [
        {
          src: images + '/tailpiece-loops.webp',
          width: 520,
          height: 440,
          alt: 'Metal string loops turn around the individual teeth on the pale tailpiece at the end of a Persian tar.',
          caption:
            'Look at the lowest wire in the picture. The two sides of its loop open out around one pale tooth. Follow the single wire back to the left to see which string that loop holds.',
          ...sandika,
          edit: crop,
        },
      ],
    },
    {
      id: 'wind-the-peg',
      stringCheck: {
        question: 'What should the first turn at the peg do?',
        answer:
          'Watch both ends during one slow turn. The free wire should begin wrapping onto its own shaft while the body loop stays on its tooth. Ease the peg back if the loop lifts.',
      },
      title: '4. Thread the peg and take up the slack',
      paragraphs: [
        'Run the free end along the old path over the bridge and nut. At the correct wooden peg, locate the small drilled hole in the shaft. With the wire still loose, pass its tip through so a short end emerges on the far side. Leave enough slack along the neck for several turns. If your peg uses a cord leader, an undrilled shaft or a geared mechanism, follow the instructions for that fitting. A little cord inside the pegbox can be a working part.',
        'Keep a light pull on the long wire to hold the body loop in place. Turn the peg in the winding direction you photographed. Guide each new turn beside the previous one. Watch that the coils stay clear of the pegbox walls, the other strings and the neighboring shafts. Pause as soon as the wire just starts to hold its shape. You still need enough slack to place it in its grooves.',
      ],
      sourceUrl: playerDemo.url,
      photos: [
        {
          src: images + '/wound-peg.webp',
          width: 336,
          height: 288,
          alt: 'Inside a historic Iranian tar pegbox, turns of gold-colored wire wrap around a wooden shaft and the string runs down toward the nut.',
          caption:
            'Look inside the vertical opening just above its midpoint. The gold-colored turns around the exposed shaft show where the string winds. This historic tar illustrates the winding. Use your own peg layout to identify the correct shaft.',
          author:
            'The Metropolitan Museum of Art, The Crosby Brown Collection of Musical Instruments',
          sourceUrl: 'https://www.metmuseum.org/art/collection/search/502242',
          license: 'CC0 1.0',
          licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
          edit: crop,
        },
      ],
    },
    {
      id: 'check-the-bridge',
      stringCheck: {
        question: 'Which bridge groove belongs to the new wire?',
        answer:
          'Sight from the tailpiece toward the nut. The two wires in each white or yellow course should run alongside each other. A wire that crosses its partner before the nut is in the wrong path.',
      },
      title: '5. Seat the string on the bridge and nut',
      paragraphs: [
        'While the string is still loose, guide it into its original groove on the bridge, then into the corresponding groove at the nut. Sight along the neck. The new wire should run alongside its partner without crossing it. Check the loop at the tailpiece once more, then take up just enough slack to keep the string seated.',
        'Compare the bridge with your side photo. Its feet should still meet the skin in their original places and the bridge should have the same angle. If it starts to tip, slide or dig into the skin, slacken the new string. Leave a displaced or fallen bridge for a tar specialist to position. Pushing it across the tensioned skin can damage the membrane.',
      ],
      sourceUrl: playerDemo.url,
      photos: [
        {
          src: images + '/bridge-grooves.webp',
          width: 630,
          height: 504,
          alt: 'Six strings run across a narrow, pale Persian tar bridge above the skin soundboard, with gaps between the pairs.',
          caption:
            'Follow the two middle wires across the pale bridge. Each has a place of its own. Check the same spacing at both the bridge and the nut before bringing your string up to pitch.',
          ...sandika,
          edit: crop,
        },
      ],
    },
    {
      id: 'tune-your-course',
      stringCheck: {
        question: 'What should I listen for when tuning a pair?',
        answer:
          'Sound the unchanged partner alone, then the replacement alone, then both together. Use the slowing pulse as a check only for a pair meant to share a pitch. Refer to your separate notes for the drone and bass.',
      },
      title: '6. Tune one open string and listen to the pair',
      paragraphs: [
        'Choose “Chromatic · any single note” under Instrument in the live tuner. Lightly touch the other strings to silence them and pluck the new string alone, with no finger pressing it to a fret. Raise the pitch from below in small steps, plucking again after each turn. Match the note and octave you recorded, your teacher’s reference or the correct unison partner. A note letter by itself can be an octave too high. For a tuning with an altered pitch, use your teacher’s sounding reference.',
        'Release the neighboring strings and pluck the course together. For a unison pair, listen for a pulsing or wavering sound that slows as the two approach the same pitch. Check the loop, windings and bridge once more. Play for a few minutes, then recheck each open string. If the wire keeps slipping or breaks twice at the same contact point, save the broken end and have the fitting checked.',
      ],
      sourceUrl: courses.url,
      link: { label: 'Open the live chromatic tuner', path: '/studio/keybpm#live-tuner' },
      photos: [
        {
          src: images + '/nut-and-strings.webp',
          width: 700,
          height: 569,
          alt: 'Three pairs of strings on a modern Persian tar pass over a polished nut at the top of the dark fingerboard.',
          caption:
            'The two middle wires travel together over the nut. When checking a pair like this, quiet its partner and pluck just the replacement first. Then let both ring.',
          author: 'Jldin',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Taar_Persian_musical_instrument_head.jpg',
          license: 'CC BY-SA 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          edit: 'Cropped, resized and converted to WebP.',
        },
      ],
    },
  ],
  sources: [playerDemo, workshop, courses, gearedPeg],
  related: [
    '/guides/history-of-the-persian-tar',
    '/guides/tar-setar-and-sitar',
    '/guides/how-to-change-setar-strings',
  ],
};
