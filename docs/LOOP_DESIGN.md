# Loop — the practice instrument

Loop should feel like a small, considered piece of music hardware: inviting to pick up, clear to operate, and satisfying to return to.

## Materials and color

- **Ceramic case:** warm ivory `#efede6`, paper `#faf8f2`, graphite ink `#292b28`. Use pale surfaces for reading and learning.
- **Display:** dark graphite green `#252b27` with pale LCD lettering. Reserve dark displays for the note, phrase, or signal being monitored.
- **Signal orange:** `#d64b24`. Use for the primary action, current fret, and the Loop mark. Success remains green and errors keep explicit text.
- **Song cartridges:** burnt orange, sage, ochre, graphite, and blue grey. The recurring tape window identifies a song throughout its journey.

Use a restrained top highlight, edge, and lower shadow to imply physical construction. Buttons depress on interaction. Avoid spreading bevels across every text container.

## Typography and identity

Sora gives titles their geometric silhouette. Inter remains the readable interface face. Small monospace labels evoke engraving and identify models, steps, and measurements. Essential instructions stay comfortably sized; miniature labels are decorative or redundant.

The custom two-loop mark connects the brand, cassette reels, and repeated practice. It is an inline SVG component, so it remains sharp without an image request.

## Interaction

The home player is functional: the first eight authored notes, actual audio, three playback speeds, current-note highlighting, and a direct path into the lesson. Playback never begins automatically and stops when the view closes or the document is hidden. Decorative screws and grille patterns are hidden from assistive technology.

The speed dial visualizes a standard labelled range input; it retains native keyboard operation. Selected controls use text or shape changes as well as color. Preserve focus outlines and reduced-motion rules when extending the system.

## Implementation

`src/loop/Hardware.jsx` contains `LoopMark` and `PracticeDeck`. `src/loop/Hardware.css` scopes the material system to `.loop-app` and is imported after the existing Loop styles. The library, song guides, microphone setup, practice screens, and upload dialog share these tokens and surfaces.

Keep the established flow: pick a song → get to know it → practice. New visual flourishes should clarify the current action or reinforce the instrument identity.
