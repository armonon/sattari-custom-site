const stringTeacherGuide = {
  label: 'Barbara Barber in American String Teacher on choosing an instrument and bow (PDF)',
  url: 'https://www.robertsonviolins.com/_files/ugd/5138ba_5eb79d562bcd417295882708984b7b09.pdf',
};
const schoolInstrumentGuide = {
  label: '92NY School of Music on fitting, renting and the equipment for lessons (PDF)',
  url: 'https://www.92ny.org/ny92/media/92ny/arts%20and%20culture/school%20of%20the%20arts/school%20of%20music/pdfs/instrument-recommendations.pdf',
};
const violaSizingGuide = {
  label: 'British Viola Society on how makers measure a viola',
  url: 'https://britishviolasociety.co.uk/understanding-viola-size/',
};
const philharmoniaViola = {
  label: 'Hear a Philharmonia player demonstrate the viola and its strings',
  url: 'https://philharmonia.co.uk/resources/instruments/viola/',
};
const philharmoniaViolin = {
  label: 'Hear a Philharmonia player demonstrate the violin',
  url: 'https://philharmonia.co.uk/resources/instruments/violin/',
};

export const bowedInstrumentGuides = [
  {
    slug: 'choose-a-violin-for-beginners',
    trialSheet: true,
    title: 'How to Choose a Violin for Beginners',
    category: 'Choosing an instrument',
    description:
      'Learn how to fit a violin, test its bow and tuning, compare two instruments by ear, and decide whether to borrow, rent or buy your first violin.',
    answer:
      'A first violin should fit your reach, stay in tune through a short lesson and let you start a note on each string. You can check all three before you know a tune. Bring the person who will play it and, if possible, someone who can play the same short passage on two violins.',
    image: '/sattari site/violins/brescia-acoustic.jpg',
    imageAlt: 'Front view of a four-string acoustic violin with its bow',
    sections: [
      {
        title: 'Your first violin trial',
        lead: true,
        steps: [
          'Ask the teacher what the first lesson involves, whether the ensemble expects an acoustic violin and whether the school lends instruments.',
          'Try the suggested size in playing position. Have the teacher watch your shoulder as you reach the low string and your wrist as you place the fourth finger.',
          'Ask someone to tune it and play across all four strings. Listen for a clear start to each note and for any rattle that returns on the same pitch.',
          'Play or listen to two instruments in the same room with the same bow. Write down which one felt easier and which sound you wanted to hear again.',
          'Get the full cost for your first term, including the bow, case, rosin, any setup work and the terms for returning or exchanging the instrument.',
        ],
      },
      {
        title: 'What size violin do you need?',
        paragraphs: [
          'A 4/4 violin is called full size. Labels such as 1/2 and 3/4 name smaller student sizes. An arm measurement can suggest a starting point, but two children of the same age can need different instruments. Take the player to the fitting, even if the violin will be a gift.',
          'With the instrument supported, let the teacher guide your hand into first position, the area nearest the tuning pegs. Can your fingertips land with a curved hand? Try a few gentle bow strokes. If you repeatedly lift the left shoulder, lock the elbow or squeeze the neck, try changing the support or trying the next size down. Repeat the test sitting as you would at rehearsal.',
        ],
      },
      {
        title: 'Check the setup and bow before judging the sound',
        paragraphs: [
          'Setup is the fit of the parts that let you tune, stop and bow a string. The pegs make large tuning changes. Fine tuners, where fitted, make small ones. The bridge holds the strings above the fingerboard and its curve helps the bow reach one string at a time. Ask a player to demonstrate each part.',
        ],
        table: {
          headers: ['What to try', 'What to listen or look for'],
          rows: [
            [
              'Tune, play a short phrase, then check the pitch again.',
              'A peg that visibly unwinds or a fine tuner that has run out of travel deserves attention. Recently fitted strings can also take time to settle.',
            ],
            [
              'Have a teacher stop a few notes near the peg end of the fingerboard.',
              'The strings should respond to manageable finger pressure. An unusually high string or a repeatable buzz is worth checking with a violin repairer.',
            ],
            [
              'Try a slow bow stroke, then several short starts.',
              'The hair should engage the string with control. Have a player check that the stick tracks straight from side to side and the screw adjusts smoothly.',
            ],
            [
              'Look over the seams, bridge and case.',
              'Ask about visible cracks, gaps or a leaning bridge. A luthier can inspect them and price the work before you commit. Check that the bow stays secured when the case is closed.',
            ],
          ],
        },
      },
      {
        title: 'Compare two violins by ear, even if you cannot play yet',
        paragraphs: [
          'Ask one player to use the same bow on both instruments. Listen from the same chair across the room. First ask for a slow stroke on each open string, from low G through D and A to high E. Then ask for the same four bars, played softly once and at a fuller volume once.',
          'Give yourself a specific question on each pass. Did the first quiet note speak straight away? Did one note jump out of the tune? Could you follow the low notes from your chair? Finally hold each violin and try a stroke yourself. Sound under your ear and sound across a room are different experiences, and both matter.',
        ],
      },
      {
        title: 'Borrowing, renting and buying a used violin',
        table: {
          headers: ['Route', 'A question to settle first'],
          rows: [
            [
              'Borrow from a school or family member',
              'Is it the right size and ready to play? Ask who covers a replacement string or bow repair and when the instrument must go back.',
            ],
            [
              'Rent for a term',
              'What is the total through the end of term? Check the deposit, damage coverage, size exchanges and any credit toward an eventual purchase in writing.',
            ],
            [
              'Buy new or used',
              'Can you take it to a lesson on trial? Check the return window and allow for any new strings, bow work, case or repairs in the total.',
            ],
          ],
        },
        paragraphs: [
          'For a growing player between sizes, an exchange policy can matter more than a low monthly rate. For an adult with access to a well-fitting borrowed violin, one lesson on that instrument can reveal what to look for in the next one.',
        ],
      },
      {
        id: 'compare-violins',
        title: 'Choose for the room where you will actually play',
        paragraphs: [
          'An acoustic violin fills a room without electronics, which is useful for lessons and unamplified groups. For late-night practice, try an acoustic violin with a practice mute and an electric instrument set up for headphones. Ask someone to listen from the next room. Both make some physical sound while being bowed.',
          'Before deciding, put three sentences on your trial card. “I could reach ___ comfortably.” “I preferred ___ when I heard the same tune.” “The complete outfit for one term will cost ___.” If a blank remains, you know exactly what to test at a second visit.',
        ],
      },
    ],
    sources: [
      stringTeacherGuide,
      schoolInstrumentGuide,
      {
        label: 'Yamaha’s illustrated guide to checking a violin before choosing it',
        url: 'https://www.yamaha.com/en/musical_instrument_guide/violin/selection/selection002.html',
      },
    ],
    related: [
      '/guides/acoustic-vs-electric-violin',
      '/guides/violin-vs-viola',
      '/guides/beginner-violin-care',
    ],
  },
  {
    slug: 'how-to-choose-a-viola',
    image: '/images/guides/italian-viola.webp',
    imageWidth: 713,
    imageHeight: 840,
    imageAlt:
      'A late 18th-century Italian viola with a bow, from the collection of The Metropolitan Museum of Art.',
    imageCredit: {
      label: 'The Metropolitan Museum of Art, public domain',
      url: 'https://www.metmuseum.org/art/collection/search/503401',
    },
    trialSheet: true,
    title: 'How to Choose a Viola That Fits',
    category: 'Choosing an instrument',
    description:
      'Compare viola body and string lengths, test the reach to the low C string, listen for a clean response and plan a useful trial before renting or buying.',
    answer:
      'A size stamped “16 inches” tells you the length of a viola’s back. It leaves two important questions open. How far apart will your fingers have to land, and how easily can you bow the low C string? A short playing trial can answer both.',
    sections: [
      {
        title: 'What a viola size tells you',
        paragraphs: [
          'Violas commonly carry measurements in inches, such as 15, 15½ or 16. Two instruments with the same back length can have different neck lengths and different distances from nut to bridge. That last distance is the vibrating string length. It affects how far the fingers travel for the same notes.',
          'The depth of the body and the shape of its upper shoulders also change how the instrument sits against you. Ask to try two nearby sizes and, if available, two different shapes in one size. Record back length and string length separately so you can identify what felt comfortable.',
        ],
      },
      {
        title: 'A reach test for both hands',
        steps: [
          'Adjust the chin and shoulder support with a teacher. Sit in a rehearsal chair and rest the viola in playing position. Notice if you have to shrug the left shoulder to keep it there.',
          'With a teacher guiding you, place the first and fourth fingers in turn on the D string. Move the same hand shape to the lower strings. Try a second viola if your wrist twists sharply or your fingertips have to flatten to reach.',
          'Draw the bow on C, G, D and A. Listen for a single string as you change bow angle. Try both ends of a comfortable stroke. A body that feels fine to the left hand may still make the C string awkward for the bow arm.',
          'Repeat after a few minutes of playing and once more standing. Note which movement was easier on each viola and where you felt yourself starting to grip.',
        ],
      },
      {
        title: 'Listen to the low C and the transition to the A string',
        paragraphs: [
          'Ask one player to use the same viola bow to start a quiet open C on each instrument. Listen for the pitch emerging at the start of the stroke. Next ask for the same short melody on the G and D strings, followed by a few upper notes on A. Can you follow the tune as it crosses strings? A striking low note alone tells you little about that transition.',
          'Listen from a few steps away and then try from playing position. If an attractive sound takes extra effort to produce, ask the player to try a second bow with that viola. Keeping the bow constant first lets you hear what changed when you switch it.',
        ],
      },
      {
        title: 'Bring one trial viola to a lesson',
        paragraphs: [
          'Choose a short passage you will actually play. For a first lesson that could be four open strings in a steady pulse. A violinist moving to viola could bring a familiar scale and use it to check the wider finger spacing. Ask the teacher to observe the reach as you play and again near the end of the lesson.',
          'For a student who is still growing, ask a school or rental program about an exchange mid-term. Confirm that a viola bow and a case that fits the particular body are included. Write down the string length as well as the body size for future string replacements, and bring those numbers back to your teacher.',
        ],
      },
    ],
    sources: [violaSizingGuide, schoolInstrumentGuide, philharmoniaViola],
    related: ['/guides/violin-vs-viola', '/tuner/viola', '/guides/choose-a-violin-for-beginners'],
  },
  {
    slug: 'violin-vs-viola',
    title: 'Violin vs. Viola in Sound, Size and Sheet Music',
    category: 'Instrument comparisons',
    description:
      'Hear how violin and viola differ, compare their open strings and clefs, and learn why a shared D can sound different on each instrument.',
    answer:
      'A four-string violin and viola share three open strings at exactly the same pitches. What changes at the ends is easy to hear. The viola adds a low C below the shared G. The violin adds a high E above the shared A. Compare the same note on both and you can also hear the difference in tone color.',
    sections: [
      {
        title: 'The differences side by side',
        table: {
          headers: ['Feature', 'Violin', 'Viola'],
          rows: [
            ['Usual open strings, low to high', 'G3, D4, A4, E5', 'C3, G3, D4, A4'],
            [
              'Usual clef',
              'Treble clef',
              'Alto clef, with treble clef also used in higher passages',
            ],
            [
              'Body and reach',
              'Student violins come in fractional sizes up to 4/4.',
              'The viola generally has a larger body. Adult violas come in several body and string lengths.',
            ],
            [
              'In a string quartet',
              'Two violins can share or exchange a melody, rhythm or inner line.',
              'One viola often links the violins and cello in register, and can take the melody in its own right.',
            ],
          ],
        },
      },
      {
        title: 'Hear pitch and tone color separately',
        paragraphs: [
          'An open string vibrates without a left-hand finger touching it. Listen to the viola’s lowest open C followed by the violin’s lowest open G. The G is a perfect fifth higher. Now have both players bow the open D. Both sound D4, the D just above middle C. Describe the start, brightness and sustain of the two sounds. You are hearing differences in timbre at the same pitch.',
          'With a friend, try three rounds with your eyes closed. First listen to low C and high E to establish the two extremes. Next hear the open D on both instruments. Finally hear the same short tune on each. A high phrase alone is a poor clue to identity because much of the two instruments’ ranges overlaps.',
        ],
        link: { path: '/tuner/viola', label: 'Hear C3, G3, D4 and A4 as reference pitches' },
      },
      {
        title: 'Read the same note in two clefs',
        paragraphs: [
          'Find the middle line of a five-line staff. In alto clef, that line is middle C (C4). The space just above it is D4, the viola’s open D. In treble clef, middle C sits on the short ledger line below the staff, and D4 sits in the space immediately below the bottom line. The written positions differ, yet the open D sounds in unison.',
          'Both instruments normally read at concert pitch. A written D4 sounds D4 on either one. When moving from violin to viola, the clef changes where you look for that note, and the string layout changes where your bow lands. On violin D is the second string up from the lowest. On viola it is the third.',
        ],
      },
      {
        title: 'Find their voices in an ensemble',
        paragraphs: [
          'Start with the individual instrument demonstrations in the sources below. Listen next to a string quartet and follow one repeated figure for several bars. Who starts it, who answers, and who keeps it moving when the tune passes to the cello? This reveals more of each part than listening only for the highest line.',
          'If you are choosing which to learn, ask a teacher to put both in your hands. Try one shared note and one note unique to each instrument’s open strings. Think about which sound you want to return to tomorrow and which instrument lets you reach comfortably today.',
        ],
      },
    ],
    sources: [
      philharmoniaViolin,
      philharmoniaViola,
      {
        label: 'Vienna Symphonic Library on viola tuning and notation',
        url: 'https://www.vsl.co.at/academy/strings/viola',
      },
    ],
    related: [
      '/guides/how-to-choose-a-viola',
      '/guides/choose-a-violin-for-beginners',
      '/tuner/violin',
    ],
  },
  {
    slug: 'acoustic-vs-electric-violin',
    title: 'Acoustic vs. Electric Violin for Lessons, Home and Stage',
    category: 'Instrument comparisons',
    description:
      'Compare an acoustic violin, an acoustic with a pickup and a solid-body electric. Hear what changes with a mute, headphones and amplification.',
    answer:
      'On an acoustic violin, vibrations pass through the bridge into a hollow body that radiates sound into the room. On an electric violin, a pickup converts vibration into an electrical signal. An amplified acoustic can do both. Your rehearsal room, teacher and usual practice hour help determine which arrangement will work.',
    image: '/sattari site/violins/matilde-electric.jpg',
    imageAlt: 'An electric violin with an open frame around the strings and bridge',
    sections: [
      {
        title: 'Follow the sound from string to listener',
        table: {
          headers: ['Design', 'What a listener hears', 'What to check'],
          rows: [
            [
              'Acoustic violin',
              'The hollow body projects sound with no power supply. A practice mute on the bridge can reduce the volume and change the tone.',
              'Listen from the next room during a realistic practice passage.',
            ],
            [
              'Acoustic violin with a pickup',
              'The acoustic body still projects in the room. A pickup also sends a signal to an amplifier or sound system.',
              'Listen unplugged and amplified. Turning down the amplifier leaves the acoustic sound.',
            ],
            [
              'Solid-body or open-frame electric',
              'Physical bow and string noise remains nearby. An amplifier or headphone system supplies most of the sound the player wants to hear.',
              'Identify the actual headphone jack, external control box or separate amplifier the model uses.',
            ],
          ],
        },
      },
      {
        title: 'Can you plug headphones straight into an electric violin?',
        paragraphs: [
          'Look for a connection specifically labeled for headphones. A passive pickup’s instrument output is designed for an amplifier, preamp or compatible audio interface. A headphone amplifier or a suitable interface with a headphone output can complete that setup. Some practice models supply a dedicated control box. Check the manual for the exact model and ask to try the whole chain.',
          '“Silent” commonly describes quiet headphone practice. With the power off you can still hear hair moving across a string. Have someone listen from your usual practice-room doorway while you play a full bow stroke. Then listen through wired headphones at a comfortable level to see whether you can hear how each note begins.',
        ],
      },
      {
        title: 'Match the violin to the music you will play',
        paragraphs: [
          'For a school orchestra, ask the director about instruments, amplification and rehearsal rules. An acoustic violin can join an unamplified group as it is. For lessons on an electric, agree with the teacher on a listening setup that lets both of you hear bow changes and pitch clearly.',
          'For a band with drums, consider an electric violin or an acoustic with a pickup. Try it through the rehearsal system at the level the group actually uses. A resonant acoustic body can feed back at louder settings. Ask the sound engineer to help check placement and gain, and listen to how the violin sits in the full band.',
        ],
      },
      {
        title: 'A three-pass listening test',
        steps: [
          'Play a short phrase twice, once softly and once more strongly. On the electric, start with a clean setting and turn off reverb so you can hear the start and release of each note.',
          'Have the same player repeat that phrase on the acoustic in the same room. Match the listening volumes as closely as practical and notice the change in texture when the bow crosses strings.',
          'Repeat in your intended setup, with the mute, headphones, effects or band. List everything needed to reproduce that sound at home or at rehearsal, including power, cable and any amplifier.',
        ],
      },
    ],
    sources: [
      {
        label: 'Yamaha on headphone practice instruments and passive electric violins',
        url: 'https://hub.yamaha.com/strings/s-electric/silent-violin-vs-electric-violin/',
      },
      {
        label: 'Yamaha on bridge mutes and quiet practice',
        url: 'https://hub.yamaha.com/strings/s-electric/how-to-silently-practice-your-string-instrument-at-home/',
      },
      philharmoniaViolin,
    ],
    related: ['/guides/choose-a-violin-for-beginners', '/guides/violin-vs-viola', '/tuner/violin'],
  },
];
