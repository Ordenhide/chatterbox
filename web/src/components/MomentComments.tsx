import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {addComment, listenComments} from '../services/moments';
import {getUserById} from '../services/chat';
import type {MomentComment, UserProfile} from '../types';

export default function MomentComments({
  momentId,
  myUid,
}: {
  momentId: string;
  myUid: string;
}) {
  const [comments, setComments] = useState<MomentComment[]>([]);
  const [names, setNames] = useState<Record<string, UserProfile>>({});
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => listenComments(momentId, setComments), [momentId]);

  useEffect(() => {
    const missing = Array.from(new Set(comments.map(c => c.authorId))).filter(u => !names[u]);
    if (missing.length === 0) return;
    Promise.all(missing.map(u => getUserById(u).then(p => [u, p] as const))).then(pairs =>
      setNames(prev => {
        const next = {...prev};
        for (const [u, p] of pairs) if (p) next[u] = p;
        return next;
      }),
    );
  }, [comments, names]);

  const nameOf = (uid: string) =>
    uid === myUid ? 'You' : names[uid]?.displayName || names[uid]?.email || 'Someone';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await addComment(momentId, myUid, text);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.wrap}>
      {comments.map(c => (
        <div key={c.id} style={styles.comment}>
          <span style={styles.author}>{nameOf(c.authorId)}</span> {c.text}
        </div>
      ))}
      <form onSubmit={submit} style={styles.form}>
        <input
          style={styles.input}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button type="submit" style={styles.btn} disabled={!text.trim() || busy}>
          Post
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}`},
  comment: {fontSize: 14, color: colors.text, marginBottom: 6, lineHeight: 1.4},
  author: {fontWeight: 700},
  form: {display: 'flex', gap: 8, marginTop: 8},
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 14,
    color: colors.text,
  },
  btn: {
    padding: '0 16px',
    borderRadius: 999,
    border: 'none',
    background: colors.primary,
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
  },
};
