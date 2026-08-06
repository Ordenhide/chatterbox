import {useState} from 'react';
import type {CSSProperties, InputHTMLAttributes} from 'react';
import Icon from './Icon';
import {colors} from '../theme';
import {useT} from '../i18n';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'style'> & {
  style?: CSSProperties;
};

// Password field with a show/hide toggle. Wraps the margin from the passed
// style onto the outer container so spacing in flex-column forms is
// unaffected by the extra wrapper div.
export default function PasswordInput({style, ...rest}: Props) {
  const {t} = useT();
  const [visible, setVisible] = useState(false);
  const {
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    ...inputStyle
  } = style || {};

  return (
    <div
      style={{
        position: 'relative',
        margin,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
      }}>
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        style={{...inputStyle, width: '100%', boxSizing: 'border-box', paddingRight: 42}}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? t('common.hidePassword') : t('common.showPassword')}
        style={styles.toggle}>
        <Icon name={visible ? 'eyeOff' : 'eye'} size={18} style={{color: colors.textSecondary}} />
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  toggle: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  },
};
