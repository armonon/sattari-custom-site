const stringMaker = {
  label: 'S.I.T. Strings on matching a ukulele set, bridge type and tuning',
  url: 'https://sitstrings.com/pages/help-center/how-do-i-restring-a-ukulele',
};
const bridgeGuide = {
  label: 'Wilfried Welti shows a figure-eight stopper and three ukulele bridge types',
  url: 'https://www.ukulele-arts.com/learn/changing-strings/?lang=en',
};
const collings = {
  label: 'Collings’ photographs of stopper knots for thinner and thicker ukulele strings (PDF)',
  url: 'https://collingsguitars.com/wp-content/uploads/2024/04/collings-ukulele-restringing-guide.pdf',
};
const myaMoe = {
  label: 'Mya-Moe demonstrates tie blocks, through-body bridges and different tuning posts',
  url: 'https://www.myamoeukuleles.com/restringing.html',
};
const lanikai = {
  label: 'Lanikai’s guide to string order, high-G tuning and baritone tuning (PDF)',
  url: 'https://lanikaiukuleles.com/wp-content/uploads/2023/03/Lanikai_CareGuide_2023.pdf',
};

const images = '/images/guides/ukulele-string-change';
const commons = 'https://commons.wikimedia.org/wiki/File:';
const crop = 'Cropped and converted to WebP.';
const resize = 'Cropped, resized and converted to WebP.';
const by2 = { license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' };
const by4 = { license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' };
const sa3 = {
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
};
const sa4 = {
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

export const ukuleleStringChangeGuide = {
  slug: 'how-to-change-ukulele-strings',
  title: 'How to Change Ukulele Strings, Step by Step',
  category: 'Ukulele care',
  description:
    'Restring a four-string ukulele with close-up photos of tie bars, slotted bridges and tuning posts. Check high-G, low-G and baritone notes as you tune.',
  answer:
    'Start with one string. The three still in place show you where the new one should go at both ends. For this lesson, gather a matching ukulele string or set, a tuner, a folded towel and a small pair of cutters. Keep each string in its marked envelope until you need it.',
  sections: [
    {
      id: 'match-your-set',
      stringCheck: {
        question: 'How can I tell which ukulele string set fits?',
        answer:
          'Read the model label inside the soundhole and check the maker’s intended tuning. For a GCEA instrument, verify whether you want a high-G or low-G fourth string before opening the set.',
      },
      title: '1. Match the set to your ukulele and tuning',
      paragraphs: [
        'Look through the soundhole for a model name or number. Check its specifications and the old string packet if you have it. Match the replacement to the size the maker lists, such as soprano, concert, tenor or baritone. String packs can cover more than one size. Use a set made for that instrument, including any wound strings the set calls for. Ordinary steel guitar strings can overload a ukulele built for nylon or fluorocarbon.',
        'On a standard four-string ukulele held in playing position, string 4 is nearest your face and string 1 nearest the floor. Many soprano, concert and tenor sets have a high G on string 4. A low-G set gives that string a different thickness or construction so it can sound an octave lower. A standard baritone takes a different tuning again. Match the note or number on the envelope to the string you are replacing.',
      ],
      sourceUrl: stringMaker.url,
      photos: [
        {
          src: images + '/model-label.webp',
          width: 900,
          height: 888,
          alt: 'Four strings run across the soundhole of a Mahalo ukulele, with the model label visible inside.',
          caption:
            'Look under the strings. This paper label identifies a Mahalo U50. A model number lets you look up the intended size and tuning when the old packet is gone.',
          author: 'Tim Walker',
          sourceUrl: commons + 'Mahalo_U50_Soprano_Ukulele_soundhole_%26_label.jpg',
          ...by2,
          edit: 'Cropped, rotated, resized and converted to WebP.',
        },
      ],
    },
    {
      id: 'identify-the-bridge',
      stringCheck: {
        question: 'How do I recognize a ukulele tie-bar bridge?',
        answer:
          'Look behind the saddle. Loops across a raised bar identify a tie bridge. A string entering a narrow slot in front of a recessed knot calls for a stopper instead.',
      },
      title: '2. Identify the bridge before you loosen anything',
      paragraphs: [
        'Lay the ukulele face up on the towel and support its neck so the tuning buttons can turn freely. Photograph the bridge and the front of the headstock. The bridge is the anchor on the body. The saddle is the narrow strip across it that the strings pass over.',
        'Look behind the saddle. On a tie bar, each string loops around a raised block. On a slotted bridge, each slides into an open slit, with a stopper knot caught below the narrow part. Match your instrument to the pictures. If the string disappears into the body or sits under a removable pin, look up the instructions for your exact bridge before pulling it free. Mya-Moe shows the through-body method in the linked demonstration.',
      ],
      sourceUrl: myaMoe.url,
      photos: [
        {
          src: images + '/four-bridge-ties.webp',
          width: 887,
          height: 588,
          alt: 'Four light-colored strings loop around a dark wooden ukulele tie bar behind the pale saddle.',
          caption:
            'Tie bar. Follow a string from the pale saddle down to a separate wrap at the back. Take this same view of your bridge before undoing a tie.',
          author: 'cogdogblog',
          sourceUrl: commons + '2012-366-202_Happy_Strings_(7625300636).jpg',
          ...by2,
          edit: crop,
        },
        {
          src: images + '/slotted-bridge.webp',
          width: 1000,
          height: 695,
          alt: 'A black ukulele bridge has four open slits with wider pockets at the back edge beneath each string.',
          caption:
            'Slotted bridge. Each slit opens into a wider recess at the near edge. The stopper sits in that recess, with the string running up the narrow slit and over the white saddle.',
          author: 'Zapyon',
          sourceUrl:
            commons +
            '17_inch_pocket_ukulele_branded_%22ultnice%22,_detail_view_of_bridge,_soundhole,_top.jpg',
          ...sa4,
          edit: resize,
        },
      ],
    },
    {
      id: 'loosen-one-string',
      stringCheck: {
        question: 'Which ukulele tuning button should I turn?',
        answer:
          'Follow the wire or nylon strand you are changing into its nut groove, then to the shaft it wraps around. Pluck and make one tiny turn to confirm the pitch falls.',
      },
      title: '3. Trace one string to its post and unwind it',
      paragraphs: [
        'Follow the string along the fingerboard and over the nut, the little grooved strip where the headstock begins. Put a finger on the post it wraps around. Pluck the string and turn that post’s button a little. Listen for the pitch to fall. If it rises, turn the other way. Keep loosening until the string is floppy.',
        'Unwind the loose turns and ease the tip out of the tuning post. At a tie bar, push slack into the last turn, untuck the tail and draw the string back through its hole. At a slotted bridge, push the slack string toward its recess and lift the knot free through the wide opening. Keep the old end beside you as a pattern for the new one. If the bridge is separating from the top, stop and have the joint checked before fitting a string.',
      ],
      photos: [
        {
          src: images + '/follow-the-string.webp',
          width: 1000,
          height: 703,
          alt: 'Four white ukulele strings cross a pale nut and lead to four separate silver tuning posts.',
          caption:
            'Start at one nut groove on the left of this photo. Follow its white line to a silver post, then find that post’s black button. This works for a snapped string too if its short end is still wound on.',
          author: 'Zapyon',
          sourceUrl:
            commons +
            'Soprano_ukulele_from_China,_made_of_laminated_mahogany_wood,_head_with_brand_logo.jpg',
          ...sa4,
          edit: resize,
        },
      ],
    },
    {
      id: 'anchor-the-new-string',
      stringPhotoLabels: [
        'Tie bar · the last wrap holds the tail',
        'Slotted bridge · the stopper holds the string',
      ],
      stringCheck: {
        question: 'What keeps a ukulele string from pulling out of its bridge?',
        answer:
          'A tie bar grips the tail in its final wrap behind the bar. A slotted bridge traps a knot larger than its slot. Give a light pull while watching the part that supplies the anchor.',
      },
      title: '4. Anchor the new string at your type of bridge',
      paragraphs: [
        'For a tie bar with one hole per string, feed the tip through the empty hole from the soundhole side toward the tail. Leave a few inches free. Bring that short tail back over the block and under the long part of the string to form a loop. Turn the tail back toward the rear edge and pass it through its loop twice for a plain nylon tie of the type shown by Mya-Moe. Hold the last tuck against the rear face of the block as you gently pull the long string toward the neck. Follow the string maker’s tying directions if your set calls for a different wrap.',
        'For a slotted bridge, use a stopper that fits the pocket and is too large to pass through the slit. A figure-eight is a common option. Cross the short end over the long string to form a loop, circle the short end behind the long string, then bring the tip through the first loop. Snug it by pulling both ends. Slide the string into the slit and seat the knot in its recess. Some bridges need a larger stopper on a thin string. The Collings guide below shows examples for different diameters.',
        'Give the string a light pull toward the neck. Watch the tail or stopper. If it creeps forward, pulls through or rubs the wooden top, take the tension off and reseat it. Leave the spare tail until the string holds at pitch.',
      ],
      sourceUrl: bridgeGuide.url,
      photos: [
        {
          src: images + '/tie-block-turn.webp',
          width: 900,
          height: 600,
          alt: 'Macro photograph of a white ukulele string passing around itself at the wooden tie block.',
          caption:
            'On the tie bar, find the white loop that bends around the long string. Look at the rear edge on your own instrument to check the last tuck while applying a little tension.',
          author: 'Ukulelego',
          sourceUrl: commons + 'Ukulele_Tie_Bar_Bridge_and_Strings_Close_Up.jpg',
          ...by4,
          edit: 'Converted to WebP.',
        },
        {
          src: images + '/figure-eight-stopper.webp',
          width: 750,
          height: 1000,
          alt: 'Two photographs of a figure-eight stopper in white cord, loose above and tightened below.',
          caption:
            'For a slotted bridge, you can practice this stopper with spare cord. Trace the short tip through the loose figure-eight in the upper photo. The lower photo shows the compact knot that forms when the ends are pulled.',
          author: 'Just plain Bill',
          sourceUrl: commons + 'Figure_eight_knot.JPG',
          ...sa3,
          edit: 'Resized and converted to WebP.',
        },
      ],
    },
    {
      id: 'wind-the-post',
      stringCheck: {
        question: 'How do I check my ukulele post wraps?',
        answer:
          'Look at the coils from the side. The next coil can sit below the first one toward the headstock. Unwind a crossed coil while it is still slack.',
      },
      title: '5. Wind the tuning post and check the string path',
      paragraphs: [
        'Bring the long end over the saddle and into the nut groove you emptied. On an ordinary upright post with a hole through its side, rotate the post until you can feed the tip through. Leave enough slack in the playing length for a few wraps. Hold it lightly with one hand and turn the button with the other. Follow the winding direction in your starting photo so the string runs cleanly from its nut groove to the post.',
        'Guide the turns down the post toward the wood, next to each other. If the wraps pile on top of one another, loosen them and try again. As the slack disappears, check the bridge anchor, saddle and nut before increasing tension. On a slotted headstock the strings wind around horizontal rollers. Follow your maker’s loading instructions for those rollers.',
      ],
      sourceUrl: myaMoe.url,
      photos: [
        {
          src: images + '/wind-the-post.webp',
          width: 686,
          height: 438,
          alt: 'Two black posts on a patterned ukulele headstock with neatly layered string turns and short projecting tips.',
          caption:
            'The short tips show where the strings pass through these posts. Each longer length leaves its post from below the first wraps and leads toward the nut.',
          author: 'Epoire',
          sourceUrl: commons + 'Mya-Moe_ukulele_headstock.jpg',
          ...sa3,
          edit: crop,
        },
        {
          src: images + '/saddle-contact.webp',
          width: 900,
          height: 600,
          alt: 'A translucent ukulele string rests across the rounded top edge of a pale saddle.',
          caption:
            'Check the contact point. The string should pass over the saddle on its original path, in line with its own bridge anchor.',
          author: 'Ukulelego',
          sourceUrl: commons + 'Ukulele_Bridge_Close_Up.jpg',
          ...by4,
          edit: 'Converted to WebP.',
        },
      ],
    },
    {
      id: 'tune-and-recheck',
      stringCheck: {
        question: 'Is the fourth ukulele string G3 or G4?',
        answer:
          'A standard high-G set uses G4. A low-G set uses G3. Pluck your reference and compare the octave before tightening. A standard baritone set starts at D3.',
      },
      title: '6. Tune in the right octave and check again after playing',
      paragraphs: [
        'Pluck one open string with your fretting hand clear. In order from string 4 to string 1, a standard high-G set uses G4, C4, E4, A4. The first G sounds higher than the C beside it. With a low-G set the order is G3, C4, E4, A4. A standard baritone uses D3, G3, B3, E4. The number matters because a tuner can show the correct letter an octave away.',
        'Start below the target and raise the pitch in small turns, plucking again after each one. The ukulele tuner linked here plays the four high-G reference notes. For a low-G or baritone set, switch to Chromatic and check the octave on the display. Stop at the target. Repeat the change for the next string and recheck all four after a short passage.',
        'New nylon or fluorocarbon strings can drift flat between playing sessions. Tune back up as they settle. A sudden large pitch drop with a moving bridge tail or a loose coil tells you where to look. Slacken the string and correct the anchor or winding. Once it holds, control the offcut and trim the excess clear of neighboring strings, leaving a short tail beyond each knot.',
      ],
      sourceUrl: lanikai.url,
      link: {
        label: 'Hear high-G ukulele notes or check another tuning in Chromatic',
        path: '/tuner/ukulele',
      },
      photos: [
        {
          src: images + '/pluck-at-the-soundhole.webp',
          width: 692,
          height: 499,
          alt: 'A player’s picking hand reaches individual strings above the soundhole of a pink ukulele.',
          caption:
            'Pluck near the soundhole like this. For an open-string tuning check, lift any fretting fingers and remove a capo if you normally use one.',
          author: 'Prácticas Intraescolares',
          sourceUrl: commons + 'Artista_tocando_el_ukelele.jpg',
          ...sa4,
          edit: crop,
        },
      ],
    },
  ],
  sources: [stringMaker, myaMoe, bridgeGuide, collings, lanikai],
  related: ['/tuner/ukulele', '/guides/how-to-change-classical-guitar-strings'],
};
