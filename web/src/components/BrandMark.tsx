import {accentGradient} from '../theme';

export default function BrandMark({size = 40}: {size?: number}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: accentGradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 10px 26px -8px rgba(124,107,255,0.75)',
        flexShrink: 0,
      }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H10l-4 4v-4H6.5A2.5 2.5 0 0 1 4 12.5v-6z"
          fill="#fff"
        />
        <path d="M8.5 8.5h7M8.5 11h4.5" stroke="#7C6BFF" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
