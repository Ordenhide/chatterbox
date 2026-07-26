import {useEffect, useRef, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {addStroke, clearWhiteboard, listenWhiteboard, removeStrokes} from '../services/whiteboard';
import Icon from './Icon';
import type {WhiteboardStroke} from '../types';

// Fixed logical drawing space so every client renders identically regardless of
// its physical canvas size (points are stored as fractions of this space × these
// dimensions). Mobile stores raw device pixels, so mobile drawings still render
// but may be positioned differently — see README note.
const LOGICAL_W = 1000;
const LOGICAL_H = 700;
const ERASER_SLACK = 9; // extra hit radius, in logical units

const PALETTE = ['#7C6BFF', '#FF5A72', '#2FE0A6', '#FFB454', '#28D6EE', '#111111', '#FFFFFF'];
const WIDTHS = [2, 4, 6];

type Pt = {x: number; y: number};
type Tool = 'pen' | 'eraser';

const round = (n: number) => Math.round(n * 10) / 10;

function pointsToPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  return 'M ' + pts.map(p => `${round(p.x)} ${round(p.y)}`).join(' L ');
}

/** Shortest distance from point p to segment a–b. */
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function strokeHit(s: WhiteboardStroke, p: Pt): boolean {
  const pts = s.points || [];
  const threshold = s.width / 2 + ERASER_SLACK;
  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= threshold;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(p, pts[i - 1], pts[i]) <= threshold) return true;
  }
  return false;
}

export default function WhiteboardModal({
  chatId,
  myUid,
  onClose,
}: {
  chatId: string;
  myUid: string;
  onClose: () => void;
}) {
  const {t} = useT();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const svgRef = useRef<SVGSVGElement>(null);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(PALETTE[0]);
  const [width, setWidth] = useState(WIDTHS[1]);

  // Refs hold the authoritative in-progress value (state mirrors it for render),
  // so committing on pointer-up never runs a side effect inside a state updater.
  const [current, setCurrent] = useState<Pt[]>([]);
  const currentRef = useRef<Pt[]>([]);
  const [erased, setErased] = useState<string[]>([]);
  const erasedRef = useRef<string[]>([]);
  const activeRef = useRef(false);

  useEffect(() => listenWhiteboard(chatId, setStrokes), [chatId]);

  const toLogical = (e: React.PointerEvent): Pt => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_W,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_H,
    };
  };

  const eraseAt = (p: Pt) => {
    const hits = strokes
      .filter(s => !erasedRef.current.includes(s.id) && strokeHit(s, p))
      .map(s => s.id);
    if (hits.length === 0) return;
    erasedRef.current = [...erasedRef.current, ...hits];
    setErased(erasedRef.current);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    activeRef.current = true;
    const p = toLogical(e);
    if (tool === 'eraser') {
      eraseAt(p);
    } else {
      currentRef.current = [p];
      setCurrent(currentRef.current);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeRef.current) return;
    const p = toLogical(e);
    if (tool === 'eraser') {
      eraseAt(p);
      return;
    }
    const last = currentRef.current[currentRef.current.length - 1];
    if (last && Math.abs(last.x - p.x) < 1.5 && Math.abs(last.y - p.y) < 1.5) return;
    currentRef.current = [...currentRef.current, p];
    setCurrent(currentRef.current);
  };

  const onPointerEnd = () => {
    if (!activeRef.current) return;
    activeRef.current = false;

    if (tool === 'eraser') {
      const ids = erasedRef.current;
      erasedRef.current = [];
      setErased([]);
      const victims = strokes.filter(s => ids.includes(s.id));
      if (victims.length) removeStrokes(chatId, victims).catch(() => undefined);
      return;
    }

    const pts = currentRef.current;
    currentRef.current = [];
    setCurrent([]);
    if (pts.length < 2) return;
    const stroke: WhiteboardStroke = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      userId: myUid,
      color,
      width,
      points: pts.map(p => ({x: round(p.x), y: round(p.y)})),
    };
    addStroke(chatId, stroke).catch(() => undefined);
  };

  const undo = () => {
    const mine = [...strokes].reverse().find(s => s.userId === myUid);
    if (mine) removeStrokes(chatId, [mine]).catch(() => undefined);
  };
  const canUndo = strokes.some(s => s.userId === myUid);

  const handleClear = () => {
    if (window.confirm(t('whiteboard.confirmClear'))) clearWhiteboard(chatId).catch(() => undefined);
  };

  const pickPen = (fn: () => void) => () => {
    setTool('pen');
    fn();
  };

  const visible = strokes.filter(s => !erased.includes(s.id));

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('chat.whiteboard')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.toolbar}>
          <div style={styles.tools}>
            <button
              title={t('whiteboard.pen')}
              aria-label={t('whiteboard.pen')}
              onClick={() => setTool('pen')}
              style={{...styles.toolBtn, ...(tool === 'pen' ? styles.toolBtnOn : null)}}>
              <Icon name="edit" size={16} />
            </button>
            <button
              title={t('whiteboard.eraser')}
              aria-label={t('whiteboard.eraser')}
              onClick={() => setTool('eraser')}
              style={{...styles.toolBtn, ...(tool === 'eraser' ? styles.toolBtnOn : null)}}>
              <Icon name="eraser" size={16} />
            </button>
            <span style={styles.divider} />
            {PALETTE.map(c => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={pickPen(() => setColor(c))}
                style={{
                  ...styles.swatch,
                  background: c,
                  outline: tool === 'pen' && color === c ? `2px solid ${colors.primary}` : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
            <span style={styles.divider} />
            {WIDTHS.map(w => (
              <button
                key={w}
                aria-label={`Width ${w}`}
                onClick={pickPen(() => setWidth(w))}
                style={{
                  ...styles.widthBtn,
                  borderColor: tool === 'pen' && width === w ? colors.primary : colors.border,
                }}>
                <span style={{width: w + 2, height: w + 2, borderRadius: 999, background: colors.text}} />
              </button>
            ))}
          </div>

          <div style={styles.tools}>
            <button
              title={t('whiteboard.undo')}
              aria-label={t('whiteboard.undo')}
              onClick={undo}
              disabled={!canUndo}
              style={{...styles.toolBtn, opacity: canUndo ? 1 : 0.4}}>
              <Icon name="undo" size={16} />
            </button>
            <button className="btn btn-soft" style={styles.clearBtn} onClick={handleClear}>
              <Icon name="trash" size={15} /> {t('whiteboard.clear')}
            </button>
            <button style={styles.close} onClick={onClose} aria-label={t('common.close')}>
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        <div style={styles.canvasWrap}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${LOGICAL_W} ${LOGICAL_H}`}
            preserveAspectRatio="none"
            style={{...styles.canvas, cursor: tool === 'eraser' ? 'cell' : 'crosshair'}}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerLeave={onPointerEnd}
            onPointerCancel={onPointerEnd}>
            {visible.map(s => (
              <path
                key={s.id}
                d={pointsToPath(s.points)}
                stroke={s.color}
                strokeWidth={s.width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {current.length > 1 && (
              <path
                d={pointsToPath(current)}
                stroke={color}
                strokeWidth={width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(6,7,16,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 40,
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  modal: {
    width: '100%',
    maxWidth: 920,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: colors.shadow,
  },
  toolbar: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10},
  tools: {display: 'flex', alignItems: 'center', gap: 8},
  toolBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toolBtnOn: {background: colors.primaryLight, borderColor: colors.primary, color: colors.primary},
  swatch: {width: 26, height: 26, borderRadius: 999, border: `1px solid ${colors.border}`, cursor: 'pointer', flexShrink: 0},
  divider: {width: 1, height: 24, background: colors.border, margin: '0 4px'},
  widthBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: `1.5px solid ${colors.border}`,
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13},
  close: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    color: colors.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasWrap: {width: '100%', aspectRatio: '10 / 7', maxHeight: '68vh', margin: '0 auto'},
  canvas: {
    width: '100%',
    height: '100%',
    background: colors.menuSolid,
    borderRadius: 14,
    border: `1px solid ${colors.border}`,
    touchAction: 'none',
    display: 'block',
  },
};
