import {applyUploadedUrl} from '../mediaUploads';

describe('applyUploadedUrl', () => {
  it('fills the field named by the slot', () => {
    expect(applyUploadedUrl({image: undefined, text: ''}, 'image', 'https://o/1')).toEqual({
      image: 'https://o/1',
      text: '',
    });
    expect(applyUploadedUrl({video: undefined}, 'video', 'https://o/2')).toEqual({
      video: 'https://o/2',
    });
    expect(applyUploadedUrl({audio: undefined}, 'audio', 'https://o/3')).toEqual({
      audio: 'https://o/3',
    });
  });

  /**
   * The slot whose URL is not a field of its own. Writing `file: url` would
   * replace the descriptor the picker filled in, so the attachment would
   * arrive with no name, type or size — and writing nothing at all would
   * leave its metadata intact with nothing to download.
   */
  it('fills file.uri and keeps the rest of the descriptor', () => {
    const message = {file: {uri: null, name: 'notes.pdf', type: 'application/pdf', size: 12}};
    expect(applyUploadedUrl(message, 'file', 'https://o/4')).toEqual({
      file: {uri: 'https://o/4', name: 'notes.pdf', type: 'application/pdf', size: 12},
    });
  });

  it('still produces a usable descriptor when the message had no file object', () => {
    expect(applyUploadedUrl({}, 'file', 'https://o/5')).toEqual({file: {uri: 'https://o/5'}});
  });

  // A send that fails has to leave the queued copy exactly as it was, so this
  // may not write through to the object the outbox is holding.
  it('does not modify the message it was given', () => {
    const message = {image: undefined, file: {uri: null, name: 'a'}};
    const before = JSON.stringify(message);
    applyUploadedUrl(message, 'image', 'https://o/6');
    applyUploadedUrl(message, 'file', 'https://o/7');
    expect(JSON.stringify(message)).toBe(before);
  });

  it('leaves every other field alone', () => {
    const message = {
      _id: 'm1',
      text: '',
      mediaSealed: true,
      mediaKeys: {image: {alg: 'x'}},
      replyTo: {_id: 'm0'},
      image: undefined,
    };
    const next = applyUploadedUrl(message, 'image', 'https://o/8');
    expect(next).toEqual({...message, image: 'https://o/8'});
    expect(next.mediaKeys).toBe(message.mediaKeys);
  });
});
