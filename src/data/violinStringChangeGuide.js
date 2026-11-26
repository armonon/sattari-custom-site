import { violinStringChangePhotos } from './violinStringChangePhotos.js';

const pirastro = {
  label: 'Pirastro’s string manual on end fittings, bridge protectors and tuning',
  url: 'https://www.pirastro.de/public_pirastro/pages/en/String-Manual/',
};
const yamaha = {
  label: 'Watch Yamaha educator Nicole Lamphier change a violin string',
  url: 'https://hub.yamaha.com/strings/s-acoustic/how-to-restring-a-violin/',
};
const wittner = {
  label: 'Wittner’s diagram of the winding area on its geared Finetune-Peg',
  url: 'https://wittner-gmbh.de/mobil/wittner-finetune-peg-instruction-manual.html',
};
const violinWorkshop = {
  label: 'Violin maker Tim Wright demonstrates the string change and bridge checks',
  url: 'https://www.wrightviolins.com/blog/changing-the-strings-on-a-string-instrument',
};

export const violinStringChangeGuide = {
  slug: 'how-to-change-a-violin-string',
  title: 'How to Change a Violin String, Step by Step',
  category: 'Violin care',
  description:
    'Change one violin string with close-up photos. Match the ball or loop end, wind the peg, check the bridge feet and tune to the correct octave.',
  answer:
    'If a single string breaks, you can replace just that string. Leave the other three at playing tension to help hold the bridge and soundpost in place. Have the replacement, a tuner and a folded towel ready. If you have never used the pegs, ask your teacher to guide your hand through the first change.',
  sections: [
    {
      id: 'match-the-string',
      title: '1. Match the string and its end fitting',
      paragraphs: [
        'Read the packet for both the note and the violin size. For example, choose an A string marked for a 3/4 violin if that is the size you play. Follow the old string with a finger from its tailpiece slot to its peg. Take a photo of that path and a side view of the upright bridge before you loosen anything.',
        'Look at the tailpiece end, especially on an E string. A ball end has a small metal bead held by a slot or fork. A loop end has a bare loop that slips over a single hook. Match the new string to the fitting on your violin. Keep the string in its labeled envelope until you are ready to fit it.',
      ],
    },
    {
      id: 'remove-one-string',
      title: '2. Unwind only the string you are changing',
      paragraphs: [
        'Spread the towel on a firm table and rest the violin on its back. Support the neck so the scroll carries no weight and the pegs are free to turn. Turn the correct peg a little and pluck to confirm the note goes down. Once the string is slack, unwind the coils, slip the tip out of the peg hole and release the ball or loop at the tailpiece. If it already snapped, remove both loose pieces.',
        'With the string out, check where it broke. If replacements keep breaking at the same groove or you can see a sharp edge there, have a violin repairer inspect it before fitting another string.',
      ],
      sourceUrl: violinWorkshop.url,
    },
    {
      id: 'seat-the-tailpiece-end',
      title: '3. Seat the ball or loop at the tailpiece',
      paragraphs: [
        'On a keyhole tailpiece, feed the ball through the wide opening and slide the string into the narrow slot toward the bridge. On a forked fine tuner, slide the string between the prongs so the ball rests against them. On a loop tuner, slip the loop over the hook. The hole through a ball is not an attachment point for a loop hook.',
        'Hold a little tension with one finger and check that the end stays seated. If there is a fine-tuner screw for this string, leave room to turn it in both directions. If the fitting does not hold the end securely, check the packet and hardware again before winding.',
      ],
      sourceUrl: pirastro.url,
    },
    {
      id: 'wind-the-peg',
      title: '4. Thread the correct peg and take up the slack',
      paragraphs: [
        'On a conventional wooden peg, line up the small hole in the shaft and feed the free tip through until about 5 mm shows on the far side. Keep light tension on the long part. Turn the peg so the string comes from the nut and passes over the top of the shaft. Guide the winding toward the peg handle in tidy coils, leaving it clear of the pegbox wall and the other strings.',
        'Support the pegbox and use gentle inward pressure as you turn a wooden friction peg. Stop while the string is still loose enough to guide into its grooves. A geared peg works differently. On a Wittner Finetune-Peg, wind only on the rotating center section and leave the peg installed. For another geared model, follow its maker’s winding instructions.',
      ],
      sourceUrl: wittner.url,
    },
    {
      id: 'check-the-bridge',
      title: '5. Check the two grooves and the bridge feet',
      paragraphs: [
        'Trace the string from the peg over the nut (the narrow ridge at the end of the fingerboard) and across the bridge. Set it in its own groove at each point. If your E string includes a protective sleeve, follow its maker’s directions. For a Pirastro sleeve, position it over the bridge groove with most of the tube on the tailpiece side. A bridge with a fitted parchment protector may already have the protection it needs.',
        'Take up a little more slack, then look from the side. Both bridge feet should sit flush on the top. The flatter face toward the tailpiece should stand roughly at a right angle to the top beneath it. Compare with your starting photo. If a foot lifts or the bridge starts leaning toward the scroll, stop tightening and ask for help. If the bridge falls or you hear the soundpost rolling inside, gently ease any remaining string tension and have a violin repairer reset the instrument before playing.',
      ],
    },
    {
      id: 'tune-and-recheck',
      title: '6. Tune from below and check again after playing',
      paragraphs: [
        'Choose violin mode on your tuner. From lowest to highest, the open strings are G3, D4, A4 and E5. Pluck the new string with no finger holding it down. Compare the sound with the reference for that string. For example, an A string should match A4. A tuner that shows only the letter A can also light up for a different octave.',
        'Keep your face away from the string. Raise the pitch a little at a time, plucking after each small turn. For the last small correction, use the fine tuner if you have one. Looking down at its screw, turn clockwise to raise the pitch or counterclockwise to lower it. Stop at the target pitch. Check the bridge again, play a short passage, then recheck all four open strings. A new string can settle flat several times during the first practice sessions.',
      ],
      link: { label: 'Hear G3, D4, A4 and E5 on the violin tuner', path: '/tuner/violin' },
    },
  ].map((section) => ({ ...section, photos: violinStringChangePhotos[section.id] })),
  sources: [yamaha, pirastro, violinWorkshop, wittner],
  related: [
    '/guides/beginner-violin-care',
    '/guides/choose-a-violin-for-beginners',
    '/tuner/violin',
  ],
};
