const daddario = {
  label: 'D’Addario’s guide to measuring bass string winding length',
  url: 'https://support.daddario.com/hc/en-us/articles/4402235053460-What-are-the-scale-lengths-for-your-bass-strings',
};
const fender = {
  label: 'Fender’s instructions and cut lengths for standard and vintage bass keys',
  url: 'https://support.fender.com/hc/en-us/articles/42584762257819-How-do-I-set-up-my-bass-guitar-properly',
};
const stewmac = {
  label: 'Watch a D’Addario bass string change and see the bridge and tuner checks at StewMac',
  url: 'https://www.stewmac.com/video-and-ideas/tool-demo-videos/strings-and-accessories-videos/daddario-core-how-to-restring-an-electric-bass-guitar/',
};

const directory = '/images/guides/bass-string-change';
const commons = 'https://commons.wikimedia.org/wiki/File:';
const bySa4 = {
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};
const bySa3 = {
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
};
const edit = 'Cropped, resized and converted to WebP.';

export const bassStringChangeGuide = {
  slug: 'how-to-change-bass-guitar-strings',
  title: 'How to Change Bass Guitar Strings, Step by Step',
  category: 'Bass guitar care',
  description:
    'Restring a four- or five-string electric bass with close-up photos. Check winding length, load the bridge, wind the tuning post and tune each open string.',
  answer:
    'For a first change on a fretted electric bass, replace and tune one string before you take off the next. You can use the other strings as a map. Have the correct set, a tape measure, a tuner, cutters rated for bass strings and a folded towel ready. This guide covers basses with ordinary tuning machines on the headstock. A headless bass or a locking system needs its own loading instructions.',
  sections: [
    {
      id: 'match-the-bass-set',
      title: '1. Match the gauges and the winding length',
      paragraphs: [
        'Start with the string count and gauges on your old packet or your bass maker’s original specifications. Gauge is thickness in thousandths of an inch. For example, a .105 is thicker than a .095. Staying with the same gauges for your first change helps preserve the feel and setup. Read each string’s envelope before opening it.',
        'A bass’s scale length is twice the distance from the fingerboard edge of the nut to the middle of the 12th fret wire. The string also needs enough full-width winding to reach past the nut. Before removal, mark the old string with a small piece of tape where it leaves the nut toward the headstock. Once it is off, straighten it and measure from the string side of its ball to that mark. This includes the hidden portion on a through-body bass. Compare that measurement with the string maker’s ball-to-taper chart. With a standard tapered set, the string should still be full thickness across the nut.',
      ],
      sourceUrl: daddario.url,
      photos: [
        {
          src: `${directory}/string-gauges.webp`,
          width: 840,
          height: 600,
          alt: 'Bass string packet marked Bass 5, roundwound, with gauges 45, 65, 80, 100 and 130.',
          caption:
            'Read the count and gauges together. This example has five strings. The 130 is the thick low B for a five-string set.',
          author: 'Skimel',
          sourceUrl: `${commons}Ernie_Ball_5-string_regular_slinky_bass_strings_45-130_(cropped).jpg`,
          ...bySa4,
          edit,
        },
      ],
    },
    {
      id: 'remove-the-old-bass-string',
      title: '2. Trace one string and loosen it completely',
      paragraphs: [
        'Unplug the bass. Lay it face up on a padded, stable surface with the neck supported and the keys free to turn. Photograph the bridge and headstock. Follow the string you want to change all the way to its post. Notice the side it wraps around and whether it passes under a string guide.',
        'Pluck and turn that key a little. Once you hear the pitch drop, keep turning in that direction until the string is floppy. Unwind the coils and free the tip from the post. Ease it back out through the same bridge opening it came through. If a curled tip catches, straighten it or clip off only the loose curl, controlling both pieces. Keep the old string for a length check.',
      ],
      photos: [
        {
          src: `${directory}/trace-the-old-string.webp`,
          width: 734,
          height: 760,
          alt: 'Four strings lead to four silver posts on an ESP bass headstock with tuning keys on both sides.',
          caption:
            'Follow the individual string to its silver post before turning a key. On a two-per-side headstock the keys on either side can wind in opposite directions.',
          author: 'Elmschrat',
          sourceUrl: `${commons}1-headstock-ESP_LTD_bass_guitar_B50.jpg`,
          ...bySa4,
          edit,
        },
      ],
    },
    {
      id: 'load-the-bass-bridge',
      title: '3. Feed the new string through its bridge opening',
      paragraphs: [
        'Uncoil the matching string slowly. The ball is the small metal stop on one end. On a top-loading bridge with holes in its back edge, feed the plain tip in from that edge toward the neck. If yours has an open slot, slide the string into the slot and seat the ball in its recess. On a through-body bass, feed the tip through the corresponding metal-lined hole on the back of the body.',
        'Draw the string through by hand until the ball settles against its anchor. Lay it over the same saddle as the old string. The saddle is the small support under that string at the bridge. Keep a little pull on the string and check the fit before winding. Leave the saddle screws in their original positions.',
      ],
      sourceUrl: stewmac.url,
      photos: [
        {
          src: `${directory}/ball-end.webp`,
          width: 330,
          height: 233,
          alt: 'Brass-colored ball attached to the end of a loose, coiled bass E string.',
          caption:
            'Find this end first. The ball stays at the bridge or the back of the body. The free tip travels toward the tuner.',
          author: 'Pastorius',
          sourceUrl: `${commons}BassStringE.jpg`,
          ...bySa3,
          edit: 'Cropped and converted to WebP.',
        },
        {
          src: `${directory}/top-load-bridge.webp`,
          width: 880,
          height: 681,
          alt: 'Four strings on a Hohner bass run from the back lip of a metal bridge over four separate cylindrical saddles.',
          caption:
            'Top-loading example. Follow one string from the rear lip at the bottom of the photo up over its own saddle. The springs beside the strings are part of the bridge adjustment.',
          author: 'Elmschrat',
          sourceUrl: `${commons}Bridge_of_Hohner_bass_guitar_LX90B.jpg`,
          ...bySa4,
          edit,
        },
        {
          src: `${directory}/through-body-ferrules.webp`,
          width: 810,
          height: 413,
          alt: 'Four round metal string ferrules in a row on the back of a black Hondo bass.',
          caption:
            'Through-body example. These four metal-lined holes are on the back of the bass, directly behind the bridge. Use the hole that lines up with the saddle you just emptied.',
          author: 'Elmschrat',
          sourceUrl: `${commons}2-Hondo_bass_guitar_1980s_Vintage.jpg`,
          ...bySa4,
          edit,
        },
      ],
    },
    {
      id: 'allow-for-the-tuning-post',
      title: '4. Measure the extra length before cutting',
      paragraphs: [
        'With the ball seated, lay the new string across the nut and straight past its own post. Check the tuner-end taper against the old string. If the thinner section would land in the nut groove, pause and recheck the set. Identify your post before trimming. A split post has a slot across its top and a hole down the center. An eyelet post has a hole through its side.',
        'Use the cut allowance for your post and string. For a four-string Fender with its vintage split posts, Fender specifies 4 inches (10 cm) beyond the E post and 4½ inches (11.4 cm) for A, D and G. For its standard side-eyelet keys, the allowances are 3 inches (7.6 cm) for E and 3½ inches (8.9 cm) for the other three. Other post sizes and low-B strings have their own allowances. Read the packet before cutting flatwounds, tapewounds or round-core strings. Some require a bend on the retained side of the cut to hold the winding in place, and some come ready to length. Control both sides of the cut and keep the sharp end away from your face.',
      ],
      sourceUrl: fender.url,
      photos: [
        {
          src: `${directory}/empty-split-post.webp`,
          width: 665,
          height: 620,
          alt: 'Close-up of an empty silver split tuning post with a dark hole between the two halves at the top.',
          caption:
            'Look into the slot on this empty split post. The cut tip goes down the center hole. The long part bends sideways through the slot as you start the wrap.',
          author: 'Elmschrat',
          sourceUrl: `${commons}0_Fender_Squier_Precision_Bass_headstock.jpg`,
          ...bySa4,
          edit,
        },
      ],
    },
    {
      id: 'wind-and-seat-the-string',
      title: '5. Wind down the post and check both grooves',
      paragraphs: [
        'For a split post, push the cut tip into its center hole, then bend the long string through the slot. For an ordinary side-eyelet post, pass the tip through the side hole and follow that tuner’s loading directions. Hold the long string lightly and turn the key so it wraps on the same side as the old string. Each turn should sit below the previous turn, working toward the headstock face. If the wraps cross, unwind them while the string is still slack and start the winding again.',
        'Before bringing the string up to pitch, follow it from the bridge to the tuner. Confirm the ball is seated, the string is centered on its saddle and it sits in its own groove in the nut. Return it under its original string guide if fitted. If the new string wedges above the nut slot or its winding starts to separate, back off the tension and check its fit.',
      ],
      photos: [
        {
          src: `${directory}/wound-split-post.webp`,
          width: 890,
          height: 350,
          alt: 'Two wound bass strings enter the sides of split posts on a Fender headstock, with their cut tips tucked into the centers.',
          caption:
            'Compare this with the empty post above. Each cut end disappears into its post. The long string makes a smooth turn around the outside and leaves toward the nut.',
          author: 'Frank Behnsen',
          sourceUrl: `${commons}Fender_1951_Precision_Bass_Headstock.jpg`,
          ...bySa3,
          edit,
        },
      ],
    },
    {
      id: 'tune-and-check-the-bass',
      title: '6. Tune up one string at a time and play it',
      paragraphs: [
        'Select bass mode on the tuner. On a standard four-string bass, the open notes from thickest to thinnest are E1, A1, D2 and G2. A standard low-B five-string adds B0 below E1. Pluck the new string without fretting it and lightly mute its neighbors. Compare with a reference tone if your tuner shows only a letter. An E an octave too high can still make the display say E.',
        'Approach pitch from below with small turns, plucking again after each turn. Stop at the target. Replace the next string the same way. When all are fitted, play each string open and then at a few frets. Retune after a short passage. If a string repeatedly slips sharply flat, check its ball end and wraps. If a new buzz or a jump in pitch persists after checking the nut and saddle, have the setup checked before moving bridge or neck adjustments.',
      ],
      photos: [
        {
          src: `${directory}/pluck-one-string.webp`,
          width: 870,
          height: 557,
          alt: 'A bass player’s fingers touch the strings between the end of the fingerboard and the pickup.',
          caption:
            'Pluck one open string here, then give the tuner a moment to settle. Silencing the neighboring strings helps the tuner follow the note you want.',
          author: 'Geezer Butler (German-language Wikipedia)',
          sourceUrl: `${commons}Finger-Picking-Technik.jpg`,
          ...bySa3,
          edit,
        },
      ],
      link: {
        label: 'Hear the four- and five-string reference notes on the bass tuner',
        path: '/tuner/bass',
      },
    },
  ],
  sources: [daddario, fender, stewmac],
  related: ['/tuner/bass', '/guides/how-to-choose-a-bass-guitar'],
};
