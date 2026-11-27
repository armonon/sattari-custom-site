const setarBodyPhoto = {
  author: 'Ahmadelahi',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:%D8%B3%D9%87_%D8%AA%D8%A7%D8%B1.jpeg',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

const rajabianPhoto = {
  author: 'Mif.dang, with design by Rajabian.co',
  sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=64843709',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  edit: 'Cropped and converted to WebP.',
};

const metPhoto = {
  author:
    'The Metropolitan Museum of Art, The Crosby Brown Collection of Musical Instruments, 89.4.327',
  sourceUrl: 'https://www.metmuseum.org/art/collection/search/500954',
  license: 'CC0 1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  edit: 'Cropped and converted to WebP.',
};

const workshop = 'https://setarsaz.blogfa.com/post/2';
const lesson = 'https://www.youtube.com/watch?v=t0nuGBqOaWU';

export const setarStringChangeGuide = {
  slug: 'how-to-change-setar-strings',
  title: 'How to Change Persian Setar Strings, Step by Step',
  category: 'Setar care',
  description:
    'Replace a wire on a four-string Persian setar. Close-up photos show how to seat the tailpiece loop, follow the bridge and nut grooves, and wind a wooden peg.',
  answer:
    'For a single broken wire, replace just that string. For a full set, finish one wire at a time so the other three hold the bridge in place. This guide follows a four-string Persian setar (setār) with a toothed string holder and wooden tuning pegs. Have a matching setar string, a folded towel to cradle the bowl, a phone camera and a recording of your intended tuning. For your first change, ask for wire already looped at the ends your setar requires.',
  sections: [
    {
      id: 'identify-your-string',
      stringCheck: {
        question: 'How do I identify a broken setar string?',
        answer:
          'Starting at the usual playing edge, name each wire in turn: white, yellow, moshtāq and bam. A close-set drone and bass still have separate gauges. Mark the missing one on the packet before opening it.',
      },
      title: '1. Match the wire and record the tuning',
      paragraphs: [
        'Rest the round bowl in the towel with the wooden face upward and support the neck. From the playing edge across the neck, the usual string names are white, yellow, drone (moshtāq) and bass (bam). The drone and bass sit close enough to be struck together. Each has its own wire, peg and pitch. Trace the one you intend to change and match its position and gauge to the packet or the maker’s recommendation.',
        'Pluck each open string separately and record it if the instrument is in tune. For a broken string, get its target note and octave from the tuning used for your lesson or piece. Photograph the bridge position, the loop at the end of the bowl and the winding at the peg. Look for a second loop at the peg or a straight end threaded through a hole. This determines which replacement you need.',
      ],
      sourceUrl:
        'https://www.farabisoft.com/Pages/FarabiSchool/InstrumentsDetails.aspx?PID=4&SID=31&lang=en',
      photos: [
        {
          ...setarBodyPhoto,
          src: '/images/guides/setar-string-change/identify-the-setar.webp',
          width: 1024,
          height: 547,
          alt: 'Two Persian setars lie on a cloth. The right one shows its wooden soundboard, small bridge, string holder and fretted neck.',
          caption:
            'Use the face-up instrument at right to trace the whole route. The string begins at the bowl rim, clears the small bridge and runs the length of the neck to a peg.',
          edit: 'Converted to WebP.',
        },
      ],
    },
    {
      id: 'loosen-one-wire',
      stringCheck: {
        question: 'How do I find the peg for a broken setar wire?',
        answer:
          'Look at the fragment still wound near the neck. Trace its shaft out to the handle, then take a close-up of its attachment before undoing the coils.',
      },
      title: '2. Find the matching peg and loosen just that string',
      paragraphs: [
        'Follow your wire from the nut, the ridged strip where the neck meets the pegs. Hold the neck in one hand. Pluck the wire and move its peg a fraction. If the pitch rises, reverse direction. If a different string changes pitch, restore that note and trace your wire again. Keep lowering the pitch until the wire hangs slack.',
        'Unwind the coils. Slip a looped end off the peg or ease a straight end back through its hole. At the bowl rim, lift the slack loop off its tooth and save the old wire for comparison. If the wire snapped, collect both pieces. Leave the bridge and the other pegs where they are.',
      ],
      sourceUrl: lesson,
      photos: [
        {
          ...rajabianPhoto,
          src: '/images/guides/setar-string-change/follow-the-wire-to-the-peg.webp',
          width: 560,
          height: 350,
          alt: 'Four wooden pegs on Mehdi Rajabian’s setar, with thin wire coiled along the shafts of the two pegs facing upward in the photograph.',
          caption:
            'Start at the pale nut on the left and follow one wire to its shaft. Two pegs face the camera and two project above the wood. Use the route on your own instrument to identify the right one.',
        },
      ],
    },
    {
      id: 'anchor-the-string',
      stringCheck: {
        question: 'How do I check the setar tailpiece loop?',
        answer:
          'Look along the line of pull from the bridge to the simgir. The loop should settle around one tooth without lifting a neighboring loop or straddling two teeth.',
      },
      title: '3. Seat the new loop on the tailpiece tooth',
      paragraphs: [
        'Find the simgir, the small string holder on the rim at the far end of the bowl. Look at an intact neighboring string. Its loop straddles a tooth, with one leg in each of the cuts beside the tooth. Set your new loop over the same tooth the old wire occupied. Point the twisted neck of the loop toward the bridge and keep the long wire running straight up the soundboard.',
        'With a fingertip holding the loop in place, draw the long wire gently toward the neck. Both sides of the loop should settle into the cuts. If it rides on top of a tooth, release it and try again. A loop that is open, kinked or too small to sit down fully needs replacing.',
        'Working from bare setar wire? Make the body loop before putting it on the instrument. The Sakhaei workshop starts by folding about 5 cm (2 in) of wire back on itself. Keep an opening that fits your old tooth and twist the two legs together just below it to form a closed eye. Test it with a gentle pull. For a looped peg, match the old wire’s length and make the second eye to fit its peg. A drilled peg takes a straight end. If you cannot match the original length or the twist opens, use a prepared string.',
      ],
      sourceUrl: workshop,
      photos: [
        {
          src: '/images/guides/setar-string-change/seat-the-tailpiece-loop.webp',
          width: 320,
          height: 359,
          alt: 'The two legs of each metal string loop spread apart into slots in the pale toothed holder on the rim of a setar bowl.',
          caption:
            'Follow the silver wire nearest the bottom of the photo. Its twisted section opens into two legs, one on either side of a tooth in the pale holder. The separate brown bar to the left is the bridge.',
          author: 'Leyth (Ghazy Kelay), Persian Wikipedia',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Setar_Body.jpg',
          license: 'GNU FDL 1.2 or later · photo history and full license',
          licenseUrl:
            'https://sattarimusic.com/images/guides/setar-string-change/photo-license.txt',
          edit: 'Upper and lower margins cropped and converted to WebP at the original scale.',
        },
        {
          ...setarBodyPhoto,
          src: '/images/guides/setar-string-change/look-behind-the-bridge.webp',
          width: 344,
          height: 288,
          alt: 'Angled view of the setar’s pale bridge on its dark wooden top, with the string holder visible around the curve of the bowl below it.',
          caption:
            'Seen from the side, the holder extends down the rim. Tilt your view of the instrument until you can see exactly where your loop catches.',
          edit: 'Cropped and converted to WebP.',
        },
      ],
    },
    {
      id: 'follow-the-grooves',
      stringCheck: {
        question: 'How can I check the setar’s loose bridge while the wire is slack?',
        answer:
          'Compare the feet with your starting photograph. Keep a fingertip on the body loop as you lay the wire in its old groove. A bridge that has shifted needs its position checked before tuning.',
      },
      title: '4. Guide the wire across the bridge and nut',
      paragraphs: [
        'Hold just enough pull to keep the loop seated. Lay the wire into its old groove in the top of the bridge, then into its matching groove at the nut. Compare the route against your first photograph. The bass and drone should remain in their own grooves. A crossed pair can make it hard to sound either string cleanly.',
        'Some setars have a retaining tie around the neck immediately beyond the nut. If the old wire went under it, feed the new wire under it from the same side. Leave that tie and the movable frets in place. If the loose bridge has tipped or slid and you cannot identify its original position, stop before tuning and have the placement checked.',
      ],
      sourceUrl: workshop,
      photos: [
        {
          ...metPhoto,
          src: '/images/guides/setar-string-change/check-the-bridge-grooves.webp',
          width: 418,
          height: 365,
          alt: 'Individual wires cross a light-colored strip along the top of a dark setar bridge, each in its own narrow line.',
          caption:
            'Look across the top of the bridge, as in this detail of a nineteenth-century Iranian setar. Each string keeps a distinct path. Check yours while there is still enough slack to lift it into its groove.',
        },
      ],
    },
    {
      id: 'wind-the-peg',
      stringPhotoLabels: [
        'Loop over the projecting wooden peg',
        'Straight tip through the drilled shaft',
      ],
      stringCheck: {
        question: 'Does my setar peg need a loop or a straight tip?',
        answer:
          'Follow the last inch of the old wire. A loop surrounds a projecting tip. A straight tip passes through a hole in the shaft. The two photographs below show the feature to look for.',
      },
      title: '5. Catch the peg end and wind the shaft',
      paragraphs: [
        'For a wooden peg that used a loop, place the new peg-end loop over the projecting tip in the same position as the one you removed. Hold the loop against the peg while turning it slowly in the direction that takes up slack. Guide the long wire onto the narrow round shaft. If your old wire went through a drilled shaft instead, feed its straight replacement tip through that same hole and leave enough slack for several turns.',
        'Keep light tension with the other hand, checking the body loop stays seated. Guide the turns alongside one another on the shaft with clearance from the neighboring wire. A friction peg seats with gentle inward pressure as it turns. Stop once the wire stays in both grooves. If a loop lifts, the coils pile up or the peg springs back, unwind a little and correct it before approaching pitch.',
      ],
      sourceUrl: workshop,
      photos: [
        {
          ...metPhoto,
          src: '/images/guides/setar-string-change/loop-and-wind-the-peg.webp',
          width: 325,
          height: 344,
          alt: 'Wire loops around the projecting ends of wooden tuning pegs and forms several close coils nearer the wood of an Iranian setar’s neck.',
          caption:
            'On the lower left peg the wire hooks around the projecting end. The turns next to the neck sit on the round shaft. This is a winding detail from a historical setar with an extra peg. Match the route on your four-peg instrument.',
        },
        {
          src: '/images/guides/setar-string-change/recognize-a-drilled-peg.webp',
          width: 820,
          height: 547,
          alt: 'Two loose setar tuning pegs on a white background, with a small round opening visible on the face of the left shaft.',
          caption:
            'The small round hole in the left shaft shows another attachment you may encounter. Use the through-hole method only when that is how the old wire was fitted. A geared peg should be operated according to its maker’s instructions.',
          author: 'Samasama87',
          sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=157604942',
          license: 'CC0 1.0',
          licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
          edit: 'Resized and converted to WebP.',
        },
      ],
    },
    {
      id: 'tune-and-check',
      stringCheck: {
        question: 'Why does the pitch suddenly fall on my setar?',
        answer:
          'Pluck once while looking at the peg, then again while watching the tailpiece loop. If a part moves as the pitch falls, release tension and correct that attachment before tuning again.',
      },
      title: '6. Tune up to the reference and listen for slipping',
      paragraphs: [
        'Play your reference note, then pluck the new wire without pressing a fret. Lightly mute its neighbor if both ring. In the live tuner’s Instrument menu, choose “Chromatic · any single note.” Tighten in small turns from below the target. A repeated letter in the next octave is much higher. If the wire already feels tight and the note seems wrong, stop and check the string, reference and octave.',
        'Open-string tunings change with the piece and teacher. For a pitch between the tuner’s semitones, compare with the supplied reference by ear. Check both ends again after a minute of playing. A sudden drop accompanied by a moving peg or an unseated loop calls for loosening the wire and reseating it. A buzz is a reason to check the two grooves and look for a loose tail touching another wire. When the note holds, move on to the next string.',
      ],
      photos: [
        {
          ...rajabianPhoto,
          src: '/images/guides/setar-string-change/pluck-one-open-string.webp',
          width: 1280,
          height: 547,
          alt: 'A player’s picking hand rests over the body beside the lower end of the fretted setar neck.',
          caption:
            'Pick lightly near the neck joint so you can hear one clear note. For an open-string check, keep the fretting hand clear of the string.',
        },
      ],
      link: { label: 'Open the live chromatic tuner', path: '/studio/keybpm#live-tuner' },
    },
  ],
  sources: [
    { label: 'Ali Eghbal demonstrates a complete setar string change in Persian', url: lesson },
    {
      label:
        'Mostafa Sakhaei’s setar workshop describes forming the loops and attaching them at both ends (section eight, in Persian)',
      url: workshop,
    },
    {
      label:
        'Farabi School of Music shows the string names, peg layouts and examples of several tunings',
      url: 'https://www.farabisoft.com/Pages/FarabiSchool/InstrumentsDetails.aspx?PID=4&SID=31&lang=en',
    },
    {
      label:
        'See drawings of the setar’s peg, string loop and string holder in the construction manual (PDF)',
      url: 'https://nexp.pt/pdf/setarconstruction.pdf',
    },
  ],
  related: [
    '/guides/tar-setar-and-sitar',
    '/guides/instruments-of-iran',
    '/guides/how-to-change-persian-tar-strings',
  ],
};
