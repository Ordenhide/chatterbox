import {effectForAccent, themeById} from '../themeCatalog';

describe('effectForAccent', () => {
  it('returns the curated stops/particles for a catalog accent', () => {
    const midnight = themeById('midnight')!;
    expect(effectForAccent(midnight.accent)).toEqual({
      gradientStops: midnight.gradientStops,
      particles: midnight.particles,
    });
  });

  it('matches case-insensitively, same as activeThemeId', () => {
    const midnight = themeById('midnight')!;
    expect(effectForAccent(midnight.accent.toLowerCase())).toEqual({
      gradientStops: midnight.gradientStops,
      particles: midnight.particles,
    });
  });

  it('derives a 3-stop gradient for an accent outside the catalog', () => {
    const effect = effectForAccent('#123456');
    expect(effect.gradientStops).toHaveLength(3);
    expect(effect.particles.density).toBe(8);
    expect(effect.particles.style).toBe('dot');
  });

  it('derives distinct fallback stops for a light vs a dark custom accent', () => {
    const light = effectForAccent('#EEEEEE');
    const dark = effectForAccent('#111111');
    expect(light.gradientStops).not.toEqual(dark.gradientStops);
  });

  // The two branches place the accent differently: light ramps up *from* the
  // accent, dark puts it in the middle between a tint and a shade. Asserting
  // that position is what actually pins which branch ran — comparing two
  // different accents' stops passes either way, so it can't catch a
  // dark-check that's stuck true (which it was: the old test's `#EEEEEE`
  // took the dark branch).
  it.each([
    ['#EEEEEE', 'near-white'],
    ['#FFD700', 'bright gold'],
    ['#38BDF8', 'sky blue'],
  ])('treats %s (%s) as light: the accent leads the gradient', accent => {
    expect(effectForAccent(accent).gradientStops[0]).toBe(accent);
  });

  it.each([
    ['#111111', 'near-black'],
    ['#1E1B4B', 'deep indigo'],
  ])('treats %s (%s) as dark: the accent sits mid-gradient', accent => {
    expect(effectForAccent(accent).gradientStops[1]).toBe(accent);
  });
});
