const {profileName} = require('../profileName');

describe('profileName', () => {
  test('uses a display name the user chose', () => {
    expect(profileName({displayName: 'Ada'}, 'Someone')).toBe('Ada');
  });

  test('never returns an email address, whatever the profile carries', () => {
    // The property that matters. These functions run on the Admin SDK, so the
    // rule that refuses `email` on a profile does not protect them, and a
    // document written before that rule can still have one.
    const profiles = [
      {email: 'ada@example.com'},
      {displayName: '', email: 'ada@example.com'},
      {displayName: '   ', email: 'ada@example.com'},
      {displayName: null, email: 'ada@example.com'},
    ];
    for (const profile of profiles) {
      expect(profileName(profile, 'Someone')).toBe('Someone');
    }
  });

  test('falls back for a missing or unreadable profile', () => {
    expect(profileName(null, 'Someone')).toBe('Someone');
    expect(profileName(undefined, 'User')).toBe('User');
    expect(profileName({}, 'User')).toBe('User');
  });

  test('ignores a display name that is not a string', () => {
    expect(profileName({displayName: 42}, 'Someone')).toBe('Someone');
    expect(profileName({displayName: {}}, 'Someone')).toBe('Someone');
  });

  test('trims, so whitespace cannot pass as a name', () => {
    expect(profileName({displayName: '  Ada  '}, 'Someone')).toBe('Ada');
  });
});
