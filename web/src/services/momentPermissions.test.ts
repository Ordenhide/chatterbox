import {describe, expect, it} from 'vitest';
import {canDeleteMomentComment} from './momentPermissions';

/**
 * The rule this mirrors: a comment may be removed by whoever wrote it, or by
 * the owner of the post it sits on. The second half is the one that matters —
 * without it, a comment left on your own moment could only ever be removed by
 * the person who left it, which for a harassing comment is nobody.
 */
describe('canDeleteMomentComment', () => {
  const mine = {authorId: 'me'};
  const theirs = {authorId: 'them'};

  it('lets me delete my own comment, wherever it sits', () => {
    expect(canDeleteMomentComment(mine, 'someone-else', 'me')).toBe(true);
    expect(canDeleteMomentComment(mine, 'me', 'me')).toBe(true);
  });

  it("lets the moment's author delete somebody else's comment on it", () => {
    expect(canDeleteMomentComment(theirs, 'me', 'me')).toBe(true);
  });

  it('refuses a bystander, who is neither', () => {
    expect(canDeleteMomentComment(theirs, 'someone-else', 'me')).toBe(false);
  });

  // Signed out mid-render, every id comparison against '' must come out false
  // rather than matching an empty authorId that slipped into a document.
  it('refuses an empty uid even against an empty authorId', () => {
    expect(canDeleteMomentComment({authorId: ''}, '', '')).toBe(false);
  });
});
