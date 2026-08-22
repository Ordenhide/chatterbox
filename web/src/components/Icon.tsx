import type {CSSProperties} from 'react';

export type IconName =
  | 'phone'
  | 'phoneOff'
  | 'video'
  | 'more'
  | 'sparkles'
  | 'pin'
  | 'bellOff'
  | 'globe'
  | 'bookmark'
  | 'trash'
  | 'heart'
  | 'heartFilled'
  | 'comment'
  | 'mic'
  | 'micOff'
  | 'camera'
  | 'cameraOff'
  | 'screenShare'
  | 'close'
  | 'search'
  | 'plus'
  | 'back'
  | 'image'
  | 'paperclip'
  | 'file'
  | 'download'
  | 'play'
  | 'pause'
  | 'stop'
  | 'edit'
  | 'sun'
  | 'moon'
  | 'bell'
  | 'flame'
  | 'eye'
  | 'eyeOff'
  | 'timer'
  | 'eraser'
  | 'undo'
  | 'reply'
  | 'gif'
  | 'settings'
  | 'music'
  | 'calendar'
  | 'list'
  | 'check'
  | 'smile'
  | 'lock'
  | 'key'
  | 'shield'
  | 'ghost'
  | 'blocked'
  | 'alertTriangle'
  | 'forward'
  | 'droplet'
  | 'wallet'
  | 'person'
  | 'book'
  | 'muteSpeaker'
  | 'rain'
  | 'oceanWave'
  | 'forest'
  | 'coffee'
  | 'lightning'
  | 'wind'
  | 'gift'
  | 'square'
  | 'checkSquare'
  | 'seedling'
  | 'cat'
  | 'dog'
  | 'rabbit'
  | 'fox'
  | 'faceNeutral'
  | 'faceSad'
  | 'faceSleepy';

const FILLED = new Set<IconName>(['more', 'heartFilled', 'play', 'pause', 'stop']);

export default function Icon({
  name,
  size = 18,
  strokeWidth = 1.9,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  const filled = FILLED.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{flexShrink: 0, ...style}}
      aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<IconName, React.ReactNode> = {
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  ),
  phoneOff: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" transform="rotate(135 12 12)" />,
  video: (
    <>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2.5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6L12 3z" />
      <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
    </>
  ),
  pin: <path d="M9 3h6l-1 7 3 2.5V14H8v-1.5L11 10 10 3M12 14v7" />,
  bellOff: (
    <>
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      <path d="M18.6 13A17.9 17.9 0 0 1 18 8M6.3 6.3A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.3-5" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  bookmark: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />,
  trash: (
    <>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  heart: <path d="M20.8 5.1a5.5 5.5 0 0 0-7.8 0L12 6.1l-1-1a5.5 5.5 0 0 0-7.8 7.7l1 1.1L12 21l7.8-7.1 1-1.1a5.5 5.5 0 0 0 0-7.7z" />,
  heartFilled: <path d="M20.8 5.1a5.5 5.5 0 0 0-7.8 0L12 6.1l-1-1a5.5 5.5 0 0 0-7.8 7.7l1 1.1L12 21l7.8-7.1 1-1.1a5.5 5.5 0 0 0 0-7.7z" />,
  comment: (
    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
    </>
  ),
  micOff: (
    <>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.6" />
      <path d="M17 17a7 7 0 0 1-12-5v-1M12 18v4" />
    </>
  ),
  camera: (
    <>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2.5" />
    </>
  ),
  cameraOff: (
    <>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M16 16H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1M9.5 5H15a2 2 0 0 1 2 2v3.5M23 7l-7 5" />
    </>
  ),
  // A display with an upward arrow — the arrow is what separates it from a
  // plain monitor/window icon and reads as "send this outward".
  screenShare: (
    <>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
      <path d="M12 13V8m0 0L9.5 10.5M12 8l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  close: <path d="M18 6L6 18M6 6l12 12" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 19l-7-7 7-7" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8.5" cy="8.5" r="1.6" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  paperclip: (
    <path d="M21.4 11l-9.2 9.2a5 5 0 0 1-7.1-7.1l9.2-9.2a3.33 3.33 0 0 1 4.72 4.72l-9.2 9.2a1.67 1.67 0 0 1-2.36-2.36l8.49-8.48" />
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>
  ),
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  play: <path d="M8 5v14l11-7z" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  flame: <path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1.5.6-2.7 1.3-3.6.2 1 .9 1.8 1.7 1.8 1 0 1.5-.8 1.3-2.4C11.2 5.6 12 3.6 12 2z" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.6M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3.3-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </>
  ),
  eraser: (
    <>
      <path d="M14.5 3.5a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 19H6l-2.5-2.5a2 2 0 0 1 0-2.8L14.5 3.5z" />
      <path d="M8.5 9.5l6 6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  reply: <path d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v2" />,
  gif: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M9 10.5a2.2 2.2 0 1 0 0 3h.6V12M13 9.5v5M16 9.5h3M16 12h2.4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2.5a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V2.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.3a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2.5" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  check: <path d="M20 6L9 17l-5-5" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3M14 9l2 2" />
    </>
  ),
  shield: <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />,
  ghost: (
    <>
      <path d="M6 20V10a6 6 0 0 1 12 0v10l-2.5-2-2 2-1.5-1.5L10.5 20 8 18l-2 2z" />
      <path d="M9 10h.01M15 10h.01" />
    </>
  ),
  blocked: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 3L2 21h20L12 3z" />
      <path d="M12 10v5M12 18h.01" />
    </>
  ),
  forward: <path d="M15 17l5-5-5-5M20 12H9a5 5 0 0 0-5 5v2" />,
  droplet: <path d="M12 3s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z" />,
  wallet: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M16 12h2" />
    </>
  ),
  person: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  muteSpeaker: (
    <>
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <line x1="16" y1="9" x2="21" y2="14" />
      <line x1="21" y1="9" x2="16" y2="14" />
    </>
  ),
  rain: (
    <>
      <path d="M17 13a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A4 4 0 0 0 7 14h10z" />
      <path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" />
    </>
  ),
  oceanWave: (
    <>
      <path d="M2 14c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0" />
      <path d="M2 19c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0" />
    </>
  ),
  forest: (
    <>
      <path d="M12 2L6 12h3l-4 8h14l-4-8h3L12 2z" />
      <path d="M12 22v-4" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" />
      <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M8 3c0 1-1 1-1 2M12 3c0 1-1 1-1 2" />
    </>
  ),
  lightning: <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />,
  wind: (
    <>
      <path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M3 13h15a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M3 18h9a2 2 0 1 0-2-2" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="13" rx="1.5" />
      <path d="M3 12h18M12 8v13" />
      <path d="M7.5 8a2.5 2.5 0 1 1 4.5-2 2.5 2.5 0 1 1 4.5 2" />
    </>
  ),
  square: <rect x="4" y="4" width="16" height="16" rx="3" />,
  checkSquare: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12l2.5 2.5L16 9" />
    </>
  ),
  seedling: (
    <>
      <path d="M12 21V10" />
      <path d="M12 10C12 10 6 10 6 4c6 0 6 6 6 6z" />
      <path d="M12 14c0 0 6 0 6-6c-6 0-6 6-6 6z" />
    </>
  ),
  cat: (
    <>
      <path d="M5 9l2-5 3 3h4l3-3 2 5" />
      <circle cx="12" cy="13" r="8" />
      <path d="M9 13h.01M15 13h.01" />
      <path d="M10 17c.6.5 1.3.5 2 .5s1.4 0 2-.5" />
    </>
  ),
  dog: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M5 9c-2-2-3-1-3 2s2 3 3 2M19 9c2-2 3-1 3 2s-2 3-3 2" />
      <path d="M9 13h.01M15 13h.01" />
      <path d="M10 19c.6.4 1.3.4 2 .4s1.4 0 2-.4" />
    </>
  ),
  rabbit: (
    <>
      <circle cx="12" cy="15" r="6" />
      <path d="M9 9C8 4 8 2 9.5 2S11 5 11 9M15 9c1-5 1-7-.5-7S13 5 13 9" />
      <path d="M10 15h.01M14 15h.01" />
      <path d="M11 18h2" />
    </>
  ),
  fox: (
    <>
      <path d="M4 8l4 2 4-4 4 4 4-2-2 6a6 6 0 0 1-12 0z" />
      <path d="M10 14h.01M14 14h.01" />
      <path d="M12 16l-1 1.5h2L12 16z" />
    </>
  ),
  faceNeutral: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 15h8" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  faceSad: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 16s1.5-2 4-2 4 2 4 2" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  faceSleepy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 9c.5.5 1.5.5 2 0M14 9c.5.5 1.5.5 2 0" />
      <path d="M9 15c1 1 5 1 6 0" />
    </>
  ),
};
