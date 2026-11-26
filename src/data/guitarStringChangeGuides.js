const taylorSteel = {
  label: 'Taylor’s illustrated guide to pinned steel-string guitars',
  url: 'https://www.taylorguitars.com/support/strings/changing-steel-strings',
};
const taylorNylon = {
  label: 'Taylor’s illustrated reference for a nylon-string tie bridge',
  url: 'https://www.taylorguitars.com/support/strings/changing-nylon-strings',
};
const sit = {
  label: 'S.I.T. Strings on seating ball ends and winding acoustic strings',
  url: 'https://sitstrings.com/blogs/news/how-to-restring-an-acoustic-guitar',
};
const fender = {
  label: 'Watch Fender change strings on a string-through guitar and a stop-tailpiece guitar',
  url: 'https://www.fender.com/articles/maintenance/the-easy-way-to-change-your-electric-guitar-strings',
};
const fenderKeys = {
  label: 'Fender’s winding instructions for standard, vintage and locking keys',
  url: 'https://support.fender.com/hc/en-us/articles/42584764005019-How-do-I-set-up-my-Stratocaster-guitar-properly',
};
const esp = {
  label: 'Follow ESP’s step-by-step Floyd Rose restringing demonstration',
  url: 'https://www.espguitars.com/videos/2027722',
};

export const acousticStringChangeGuide = {
  slug: 'how-to-change-acoustic-guitar-strings',
  title: 'How to Change Acoustic Guitar Strings, Step by Step',
  category: 'Acoustic guitar care',
  description:
    'Restring a six-string steel-string acoustic with close-up photos of bridge pins, ball ends and tuner wraps. Learn what to do if a pin starts to lift.',
  answer:
    'Start by looking at the bridge. The steps below fit a six-string steel-string acoustic with removable bridge pins and ordinary tuning posts. For your first change, finish one string before taking off the next. The five strings still in place show you where everything goes.',
  sections: [
    {
      id: 'identify-your-acoustic-bridge',
      title: '1. Match the strings to the guitar and bridge',
      paragraphs: [
        'On a pinned bridge, six round pin heads sit just behind the saddle, the narrow strip the strings pass over. Look up your model’s string specification or check your previous packet. Choose a ball-end steel-string acoustic set in the same gauge (thickness). If just one string broke, match that string’s gauge and note.',
        'Compare the two bridges in the photos. If the strings loop around a wooden tie block on a classical guitar, use classical strings and follow the classical guitar guide below. Steel strings put too much tension on that instrument. Some steel-string guitars also have pinless bridges. If yours has neither pins nor ties, check its model instructions before pulling on anything.',
        'Set the guitar on a clean folded towel and support the neck clear of the tuners. Have a tuner, string cutters and a bridge-pin puller ready. Take a photo of the bridge and the winding at the headstock. Keep each string in its labeled envelope until you need it.',
      ],
      photos: [
        {
          src: '/images/guides/acoustic-string-change/pinned-bridge.webp',
          width: 1040,
          height: 339,
          alt: 'Six round black bridge pins sit behind a pale saddle on a steel-string acoustic guitar.',
          caption:
            'Look for the row of removable pins behind the saddle, the thin light-colored strip the strings cross. Each pin belongs to one string.',
          author: 'cogdogblog',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:2015-365-60_All_Along_the_Bridge_Line_(16690590192).jpg',
          license: 'CC BY 2.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
          edit: 'Cropped and converted to WebP.',
        },
        {
          src: '/images/guides/acoustic-string-change/classical-tie-block.webp',
          width: 1011,
          height: 458,
          alt: 'Nylon strings loop around a wooden classical guitar tie block behind the saddle.',
          caption:
            'This classical bridge has a row of tied loops. If your strings attach this way, use the nylon-string lesson linked in this step.',
          author: 'Dirkjot',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Classical_Guitar_Bridge_Bone.jpg',
          license: 'CC BY-SA 3.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
          edit: 'Cropped and converted to WebP.',
        },
      ],
      link: {
        label: 'Change the strings on a classical guitar, step by step',
        path: '/guides/how-to-change-classical-guitar-strings',
      },
      sourceUrl: taylorNylon.url,
    },
    {
      id: 'unwind-the-old-string',
      title: '2. Loosen one string until it goes limp',
      paragraphs: [
        'To change a whole set, start with the thick low E, string 6. Follow it from the nut (the narrow strip at the headstock end of the neck) to its winding post. Pluck, turn that tuning button a little, then pluck again. A lower sound tells you that you are unwinding it. Reverse direction if the pitch rises.',
        'Once the string is floppy, unwind the coils and ease the tip out of the hole in the post. For a string that has snapped, remove the piece at the post and keep hold of the piece still attached to the bridge. The bent wire ends can scratch the finish.',
      ],
      photos: [
        {
          src: '/images/guides/acoustic-string-change/loosen-the-key.webp',
          width: 801,
          height: 850,
          alt: 'A hand grips a tuning button on the right side of an acoustic guitar headstock. The string can be traced across the nut to its post.',
          caption:
            'Follow your string up from the white nut to its winding post. Turn that post’s button a little and pluck again. The sound should get lower as you loosen it.',
          author: 'Elenaf',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Cambio_corde-_girare_in_avanti_la_meccanica.jpg',
          license: 'CC BY-SA 3.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
          edit: 'Cropped and converted to WebP.',
        },
      ],
    },
    {
      id: 'free-the-bridge-pin',
      title: '3. Free the ball end and lift the bridge pin',
      paragraphs: [
        'Push the loose string a little farther down into its bridge hole. That moves the ball off its seat and often frees the pin. Try lifting the pin straight out with your fingers. If it is snug, slide the fork of a pin puller under its head and lift gently. Set the pin beside its hole.',
        'Remove the old string and check that its metal ball came out. If the pin resists, check again for slack and push the ball down a little before trying once more. A pin that still will not move is a good reason to stop and have it checked. Prying against the wooden top can dent it.',
      ],
      photos: [
        {
          src: '/images/guides/acoustic-string-change/pin-pulling-notch.webp',
          width: 1040,
          height: 687,
          alt: 'A combination string winder and cutter has a forked notch in the lower handle.',
          caption:
            'The fork on the end of the lower handle is the pin puller. The winding cup and cutting jaws are separate parts of this tool. Slip the notch under the pin head after the string is slack.',
          author: 'Tim Walker',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Planet_Waves_String_Winder_Pro_(2014-09-22_22.15.53_by_Tim_Walker).jpg',
          license: 'CC BY 2.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
          edit: 'Cropped and converted to WebP.',
        },
      ],
    },
    {
      id: 'seat-the-acoustic-ball-end',
      title: '4. Seat the new ball end beneath the bridge',
      paragraphs: [
        'Uncoil the matching replacement away from your face. Lower its metal ball into the open bridge hole. Return the same pin to that hole. On the common grooved pin shown here, the string runs along the groove toward the saddle. If the pin is smooth and the slot is cut into the bridge itself, follow that slot.',
        'Rest a fingertip on the pin head and gently draw the string up until it catches. The ball should rest against the bridge plate, the piece of wood directly below the top, beside the pin. Give the string a light tug. If it keeps sliding or the pin rises with it, push the string back down and seat it again before winding. Press the pin by hand only.',
      ],
      photos: [
        {
          src: '/images/guides/acoustic-string-change/ball-and-pin.webp',
          width: 738,
          height: 850,
          alt: 'A player holds a slotted black bridge pin beside the metal ball end of an acoustic string, above the open bridge hole.',
          caption:
            'Outside the guitar you can see the brass ball and the groove in the pin. Once installed, the ball catches beside the pin against the wood under the bridge.',
          author: 'Elenaf',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Corda_chitarra_in_bridge_pin_(piolo)_in_ponte_acustica.jpg',
          license: 'CC BY-SA 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          edit: 'Cropped and converted to WebP.',
        },
      ],
      sourceUrl: sit.url,
    },
    {
      id: 'wind-the-acoustic-tuning-post',
      title: '5. Thread the post and wind a single layer',
      paragraphs: [
        'Lay the string across the saddle and in the nut slot vacated by the old string. Line up the hole in its post, pass the thin tip through, then pull a little slack back to the playing side. On a typical three-per-side headstock, about one post spacing of slack is a starting point for a thick wound string. A thin plain string needs a little more to get enough wraps.',
        'Keep the tip bent to the side and light tension on the playing length while turning the button. Follow the winding direction of the old string. On the headstock pictured, the string comes off the side of the post facing the center of the headstock. Guide each new wrap below the last, toward the headstock face. Aim for about two to three neat wraps on wound strings, a few more on the fine plain ones. If coils pile up or drop off the post, unwind and adjust the slack.',
      ],
      photos: [
        {
          src: '/images/guides/acoustic-string-change/tuning-post-hole.webp',
          width: 777,
          height: 850,
          alt: 'A bare metal post with a side hole sits in the upper right of a three-per-side headstock.',
          caption:
            'Look at the empty post at the upper right. Turn its button to bring the small side hole into reach, then pass the string tip through.',
          author: 'Elenaf',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Cambio_corde-_buco_piolo_frontale.jpg',
          license: 'CC BY-SA 3.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
          edit: 'Cropped and converted to WebP.',
        },
        {
          src: '/images/guides/acoustic-string-change/descending-coils.webp',
          width: 796,
          height: 850,
          alt: 'A bronze wound string makes three neighboring coils around a metal tuning post.',
          caption:
            'Seen from the side, the coils sit beside one another down the post. Keep light tension on the string as you wind so one turn stays below the preceding turn.',
          author: 'keith ellwood',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Bronze_strings_Taylor_Acoustic_(14619649315).jpg',
          license: 'CC BY 2.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
          edit: 'Cropped and converted to WebP.',
        },
      ],
      sourceUrl: taylorSteel.url,
    },
    {
      id: 'tune-the-acoustic-and-settle',
      title: '6. Tune, settle and check the pin again',
      paragraphs: [
        'Pluck the open string with one hand while turning the matched tuner slowly with the other. In standard tuning, thick to thin, strings 6 through 1 are E2, A2, D3, G3, B3 and E4. Listen to the matching reference tone before tightening farther. Both E strings show the same letter on many tuners, two octaves apart.',
        'Approach pitch from below and watch the pin. If it rises, loosen the string and repeat step 4. Once the note is right, gently lift the string a little at several places along its length, release, then retune. Two gentle passes and a short strum usually tell you whether it is settling. Hold the excess tip as you cut it near the tuning post, leaving a short end clear of the next string. Collect the offcuts and repeat with the next string. Check all six after playing your first chord.',
      ],
      photos: [
        {
          src: '/images/guides/acoustic-string-change/clip-on-tuner.webp',
          width: 671,
          height: 850,
          alt: 'A green clip-on tuner on a six-string guitar headstock displays the letter G.',
          caption:
            'This display shows G. Compare with the G3 reference when tuning the third string. A letter-only display cannot tell you which octave you are hearing.',
          author: '8joKeaton',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Guiter_cliptuner.jpg',
          license: 'CC BY-SA 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          edit: 'Cropped and converted to WebP.',
        },
      ],
      link: { label: 'Hear each open string on the guitar tuner', path: '/tuner/guitar' },
    },
  ],
  sources: [taylorSteel, sit, taylorNylon],
  related: [
    '/guides/nylon-vs-steel-string-guitar',
    '/guides/how-to-care-for-a-guitar',
    '/tuner/guitar',
  ],
};

export const electricStringChangeGuide = {
  slug: 'how-to-change-electric-guitar-strings',
  title: 'How to Change Electric Guitar Strings, Step by Step',
  category: 'Electric guitar care',
  description:
    'Change electric guitar strings with photos of through-body holes, a stopbar, bridge saddles and tuner wraps. Identify locking hardware before you begin.',
  answer:
    'First find where a string enters the body and where it winds around its tuning post. This lesson covers a six-string electric with ball-end strings and an ordinary fixed bridge or non-locking vibrato bridge. You can do the work unplugged on a padded table with a fresh set, string cutters and a tuner.',
  sections: [
    {
      id: 'choose-the-electric-string-set',
      title: '1. Read the gauge and identify locking hardware',
      paragraphs: [
        'Find the gauge on the old packet or in your guitar’s specifications. A set marked 10–46 runs from .010 inch on the fine high E to .046 inch on the thick low E. Use the same gauges for a first change, particularly with a spring-balanced vibrato bridge. A different gauge can shift its resting angle.',
        'Look where the strings leave the fretboard. Three metal clamping blocks with hex screws across the nut, together with string clamps at the bridge, identify a double-locking setup. For a Floyd Rose of this type, follow ESP’s restringing demonstration linked here before loosening a string. A thumbwheel on the back of an individual tuning machine is a different part, covered in step 5.',
      ],
      photos: [
        {
          src: '/images/guides/electric-string-change/string-gauges.webp',
          width: 698,
          height: 850,
          alt: 'A packet of nickel-wound electric guitar strings lists the six gauges 10, 13, 17, 26, 36 and 46.',
          caption:
            'Read the six numbers down the left side. On this example .010 is the thin first string and .046 the thick sixth. Match the gauges already suited to your guitar.',
          author: 'Skimel',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Ernie_Ball_Regular_Slinky_10-46_nickel_wound_electric_guitar_strings.jpg',
          license: 'CC BY-SA 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          edit: 'Cropped and converted to WebP.',
        },
        {
          src: '/images/guides/electric-string-change/locking-nut.webp',
          width: 910,
          height: 654,
          alt: 'Three gold clamps with black hex-socket screws hold pairs of strings across the nut. A separate bar with two screws sits above them.',
          caption:
            'Count the three square clamps along the edge of the fretboard. This is a locking nut. Use the Floyd Rose lesson for this type of setup. The gold bar higher on the headstock is a string retainer.',
          author: 'Nenad Stojkovic',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Charvel_San_Dimas_KOA_headstock_with_a_black_background._(2021-03-29_20.52.29_by_Nenad_Stojkovic).jpg',
          license: 'CC BY 2.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
          edit: 'Cropped, resized and converted to WebP.',
        },
      ],
      sourceUrl: esp.url,
    },
    {
      id: 'trace-and-release-the-electric-string',
      title: '2. Trace one string and release its tension',
      paragraphs: [
        'Take a picture of both ends of the strings. Start with the broken string or the thick low E. Trace it along the neck to its own tuning post. Notice any little metal guide (a string tree) it passes underneath. Pluck and turn the button a few degrees. If the note falls, continue loosening until the string hangs slack.',
        'Unwind it and lift it out of the post. If that post has a locking thumbwheel, release the wheel once the string is slack. If the old winding is too kinked to pass through the bridge easily, clip off the kink on the fully slack string and hold the cut piece as you snip. Change one at a time. That keeps a loose stopbar in place and reduces movement on a spring-balanced bridge.',
      ],
      photos: [
        {
          src: '/images/guides/electric-string-change/follow-the-string.webp',
          width: 478,
          height: 850,
          alt: 'The strings on a Telecaster pass over the nut toward six tuning posts. Small metal retainers guide some strings.',
          caption:
            'Trace the string from the pale nut to its post. If it passes under one of the small metal retainers in the middle of the headstock, take the same path with the replacement.',
          author: 'Dave Arcari',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Fender_Telecaster_(SN5089056,_c1973~76)_headstock.jpg',
          license: 'CC BY-SA 2.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
          edit: 'Cropped and converted to WebP.',
        },
      ],
    },
    {
      id: 'load-the-electric-bridge',
      title: '3. Feed the new string from the correct end',
      paragraphs: [
        'Follow the old string to its ball end before removing it. On a string-through hardtail, push the slack string toward the back until the ball emerges from the metal-lined hole. On many Strat-style vibrato bridges, the equivalent holes are in the metal block reached through the opening in the back cover. Feed the tip of the new string in from the back, then draw it through from the front until the ball seats.',
        'If your guitar has a separate stopbar on its front, the ball usually comes out of the back edge of that bar. For the straight-through arrangement pictured, feed the new string from the strap-button side of the bar toward the pickups. Some fixed bridges load from the rear edge of the bridge plate itself. Follow the path you photographed. If the old ball remains stuck or the new tip misses the exit, back off and check the opening rather than forcing it.',
      ],
      photos: [
        {
          src: '/images/guides/electric-string-change/back-ferrules.webp',
          width: 1040,
          height: 551,
          alt: 'Six small metal-lined string holes form a row on the back of an electric guitar body.',
          caption:
            'These rings mark the entry points on a string-through body. Feed the thin end through the correct hole. The ball end stays here when the string is pulled through.',
          author: 'Michael Pardo',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Guitar_Ferules_(16608747837).jpg',
          license: 'CC BY 2.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
          edit: 'Cropped and converted to WebP.',
        },
        {
          src: '/images/guides/electric-string-change/stop-tailpiece.webp',
          width: 999,
          height: 500,
          alt: 'Colored string ball ends sit in the rear face of a metal stopbar, with the bridge and its individual saddles just beyond.',
          caption:
            'This guitar loads at the metal bar on the front of the body. The colored ends stop at the bar. The long end of each string runs forward over its own saddle.',
          author: 'Elenaf',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Estremit%C3%A0_corde_colorate_chitarra.jpg',
          license: 'Public domain',
          licenseUrl:
            'https://commons.wikimedia.org/wiki/File:Estremit%C3%A0_corde_colorate_chitarra.jpg#Licensing',
          edit: 'Cropped and converted to WebP.',
        },
      ],
      sourceUrl: fender.url,
    },
    {
      id: 'follow-the-saddle-and-nut',
      title: '4. Lay the string across its saddle and nut slot',
      paragraphs: [
        'On the front of the guitar, each string has a resting place called a saddle. Some bridges have six separate saddles. The Telecaster pictured has three barrels shared by pairs of strings. Guide the new string across the same spot as its predecessor, then into its matching narrow slot at the nut.',
        'If the string used a tree, slip it under that guide on the way to its tuning post. Look down the neck. A string crossing its neighbor, sitting on a screw or missing its slot needs repositioning while it is still loose. A routine string change does not require moving a saddle or turning its adjustment screws.',
      ],
      photos: [
        {
          src: '/images/guides/electric-string-change/bridge-saddles.webp',
          width: 553,
          height: 325,
          alt: 'Six strings run across three metal barrel saddles on a Telecaster bridge.',
          caption:
            'Each barrel on this bridge carries two strings. Follow the neighboring string to see how yours should cross the top of the barrel. Leave the adjustment screws where they are.',
          author: 'Dave Arcari',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Fender_Telecaster_(SN5089056,_c1973~76)_bridge_pickup_%26_bridge.jpg',
          license: 'CC BY-SA 2.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
          edit: 'Cropped and converted to WebP.',
        },
      ],
    },
    {
      id: 'wind-or-lock-the-tuning-post',
      title: '5. Wind or lock the string for your tuner type',
      paragraphs: [
        'On a conventional post with a hole through the side, pass the tip through, then pull back enough slack for about two or three wraps. A thin plain string may need an extra turn. Bend the free tip to the side, hold the playing length lightly taut and turn the button. Follow the original winding direction so the string leads cleanly back to the nut. Guide each new coil down beneath the previous one.',
        'A vintage split post has a slot across the top and a hole going straight down. On Fender-style split posts, measure about two to three post spacings of extra length, trim first, insert the tip down the center, bend it into the slot and wind. On a locking tuner with a rear thumbwheel, feed the string through almost taut and finger-tighten the wheel before tuning. It usually needs less than a full turn around the post. For other designs, use the maker’s instructions.',
      ],
      photos: [
        {
          src: '/images/guides/electric-string-change/tuning-post-wraps.webp',
          width: 898,
          height: 761,
          alt: 'Three winds sit around a metal electric-guitar tuner post, with the clipped wire tip visible at the top.',
          caption:
            'The top of this post is solid and its hole passes through the side. The coils sit below the hole in a single layer. A split-top or locking tuner takes a different winding method.',
          author: 'Superplus',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Electric_guitar_tuner.JPG',
          license: 'Public domain',
          licenseUrl: 'https://commons.wikimedia.org/wiki/File:Electric_guitar_tuner.JPG#Licensing',
          edit: 'Cropped and converted to WebP.',
        },
      ],
      sourceUrl: fenderKeys.url,
    },
    {
      id: 'tune-and-test-the-electric',
      title: '6. Tune up, play a bend and recheck',
      paragraphs: [
        'Use a clip-on, plug into a tuner pedal, or pick softly near your tuner’s microphone. Mute the other strings and pluck the new one open. In standard tuning the targets from thickest to thinnest are E2, A2, D3, G3, B3 and E4. Raise the pitch gradually and listen for the correct octave using the reference tones. If you go sharp, lower the note slightly and come back up.',
        'Play a gentle bend or lift the string lightly along its length, then retune. Trim the excess tip near an ordinary post while holding the offcut. Repeat for the other strings and play a chord. On a floating bridge, bringing one string to pitch moves the others slightly. Make several passes across all six. If the bridge ends up tilted far from its starting position, recheck the gauges and tuning before adjusting any hardware.',
      ],
      photos: [
        {
          src: '/images/guides/electric-string-change/check-the-tuner.webp',
          width: 858,
          height: 513,
          alt: 'A clip-on tuner displays E with a pitch indicator and a 440 Hz reference setting.',
          caption:
            'The E is the detected note name. The small 440 Hz label is the tuner’s reference for A4. For the two E strings, compare against E2 for the thick string and E4 for the thin one.',
          author: 'yoppy',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:KORG_AW-2_Clip-On_Tuner.jpg',
          license: 'CC BY 2.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
          edit: 'Cropped and converted to WebP.',
        },
      ],
      link: { label: 'Play E2 through E4 on the guitar tuner', path: '/tuner/guitar' },
    },
  ],
  sources: [fender, fenderKeys, esp],
  related: [
    '/guides/how-to-choose-an-electric-guitar',
    '/guides/when-does-my-guitar-need-a-setup',
    '/tuner/guitar',
  ],
};
