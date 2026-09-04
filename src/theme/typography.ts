/**
 * The app's three typefaces, and how to name them.
 *
 * Until now every screen rendered in San Francisco or Roboto — `fontFamily`
 * appeared exactly twice in the whole app, both times for a per-message
 * effect. The palette, the motion system and the glass layer were all
 * designed; the type never was.
 *
 *   Chakra Petch   display — squared terminals and tight apertures. This was
 *                  originally chosen *because* it stops short of the sci-fi
 *                  costume Orbitron wears; the terminal redesign deliberately
 *                  goes there, and Chakra Petch Bold carries it. Orbitron
 *                  itself stays unbundled: adding a face means shipping the
 *                  file and rebuilding natively, and at display sizes the two
 *                  are close enough that the rebuild buys very little.
 *   IBM Plex Sans  body — drawn for technical products, still warm enough to
 *                  read as conversation at message sizes.
 *   IBM Plex Mono  data — same superfamily as the body face, so a timestamp
 *                  and the sentence above it look related rather than merely
 *                  adjacent. The web client already reserves mono for exactly
 *                  this (see --cb-mono in web/src/styles.css).
 *
 * ---
 *
 * Faces are named individually rather than by family-plus-weight, and that is
 * not a style preference — it is the only thing that works on both platforms.
 *
 * iOS resolves `fontFamily` against a font's *PostScript* name; Android
 * resolves it against the *filename* of the linked asset. These files are
 * named so those two strings are identical (verified against each file's
 * `name` table), which is why one constant serves both.
 *
 * Going through the family name instead — `fontFamily: 'IBM Plex Sans'` plus
 * `fontWeight: '600'` — breaks in two directions at once. Android ignores
 * weight for custom families and would render Regular. And Google splits this
 * superfamily so that Medium and SemiBold each register as their *own* family
 * ("IBM Plex Sans SemiBold"), so even iOS would not find them under the base
 * name. Naming the face directly sidesteps both.
 *
 * Corollary: do not pair these with `fontWeight`. The weight is already in the
 * file, and asking for it twice invites Android to synthesise a faux-bold on
 * top of a face that is already bold.
 */

export const fonts = {
  /** Headings and the wordmark. Used sparingly — it is a display face. */
  display: {
    semibold: 'ChakraPetch-SemiBold',
    bold: 'ChakraPetch-Bold',
  },
  /** Running text: messages, labels, buttons. */
  body: {
    regular: 'IBMPlexSans-Regular',
    medium: 'IBMPlexSans-Medium',
    semibold: 'IBMPlexSans-SemiBold',
    bold: 'IBMPlexSans-Bold',
  },
  /** Timestamps, key counts, fingerprints, ciphertext. */
  mono: {
    regular: 'IBMPlexMono-Regular',
    medium: 'IBMPlexMono-Medium',
  },
} as const;

/**
 * The body face matching a React Native `fontWeight`.
 *
 * For migrating existing styles: an style that reads `fontWeight: '600'` keeps
 * its intent by swapping to `fontFamily: bodyWeight('600')` and dropping the
 * weight, rather than by someone deciding case by case which face '600' meant.
 *
 * Weights between the four shipped faces round to the nearest available one —
 * '800' and '900' resolve to Bold, since shipping two more files to serve a
 * handful of styles is not worth ~400KB in the bundle.
 */
export function bodyWeight(weight?: string | number): string {
  const numeric = typeof weight === 'string' ? parseInt(weight, 10) : weight;
  if (weight === 'bold') return fonts.body.bold;
  if (!numeric || Number.isNaN(numeric)) return fonts.body.regular;
  if (numeric >= 700) return fonts.body.bold;
  if (numeric >= 600) return fonts.body.semibold;
  if (numeric >= 500) return fonts.body.medium;
  return fonts.body.regular;
}

/**
 * The terminal type scale.
 *
 * Small, wide-tracked, uppercase monospace is the redesign's signature — it is
 * what makes a row of metadata read as instrument output rather than as small
 * body text. Sizes are genuinely tiny (8–11px) because tracking, not size, is
 * doing the work; at these sizes letterSpacing below ~1.5 turns the label back
 * into ordinary small text.
 *
 * `micro` and `label` are decoration and metadata only. Body copy never gets
 * uppercased — a message is read, not scanned, and all-caps costs real reading
 * speed for anything longer than a few words.
 */
export const terminal = {
  /** Section eyebrows, status strips, cipher footers. */
  micro: {
    fontFamily: fonts.mono.regular,
    fontSize: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  /** Field labels, buttons, tab titles. */
  label: {
    fontFamily: fonts.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  /** Handles, key fingerprints, timestamps — mono, but not shouted. */
  data: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  /** The wordmark and numeric readouts. */
  display: {
    fontFamily: fonts.display.bold,
    fontSize: 18,
    letterSpacing: 3,
  },
} as const;
