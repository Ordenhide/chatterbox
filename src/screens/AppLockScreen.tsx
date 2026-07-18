import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Vibration,
} from 'react-native';
import {getColors} from '../theme/colors';
import {
  verifyPIN,
  authenticateWithBiometrics,
  isBiometricsEnabled,
  isDecoyPIN,
  setDecoyMode,
} from '../services/appLock';

interface Props {
  onUnlock: () => void;
}

const MAX_ATTEMPTS = 5;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

function AppLockScreen({onUnlock}: Props) {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [biometrics, setBiometrics] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const bioEnabled = isBiometricsEnabled();
    setBiometrics(bioEnabled);
    if (bioEnabled) {
      authenticateWithBiometrics().then(ok => {
        if (ok) {
          setDecoyMode(false);
          onUnlock();
        }
      });
    }
  }, [onUnlock]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (locked) return;
      setError('');
      if (key === 'del') {
        setPin(p => p.slice(0, -1));
      } else if (pin.length < 6) {
        setPin(p => p + key);
      }
    },
    [locked, pin.length],
  );

  const handleUnlock = useCallback(async () => {
    if (locked || pin.length < 4) return;

    if (await isDecoyPIN(pin)) {
      setDecoyMode(true);
      onUnlock();
      return;
    }

    if (await verifyPIN(pin)) {
      setDecoyMode(false);
      onUnlock();
      return;
    }

    const next = attempts + 1;
    setAttempts(next);
    Vibration.vibrate(300);
    setPin('');

    if (next >= MAX_ATTEMPTS) {
      setLocked(true);
      setError('Too many attempts. Try again later.');
    } else {
      setError('Incorrect PIN');
    }
  }, [pin, locked, attempts, onUnlock]);

  const handleBiometrics = useCallback(async () => {
    const ok = await authenticateWithBiometrics();
    if (ok) {
      setDecoyMode(false);
      onUnlock();
    }
  }, [onUnlock]);

  const dots = Array.from({length: 6}, (_, i) => (
    <View
      key={i}
      style={[
        styles.dot,
        {
          backgroundColor:
            i < pin.length ? colors.primary : 'rgba(255,255,255,0.2)',
          borderColor: colors.primary,
        },
      ]}
    />
  ));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔒 Chatterbox</Text>
      <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
        Enter PIN to unlock
      </Text>

      <View style={styles.dotsRow}>{dots}</View>

      {!!error && <Text style={[styles.error, {color: colors.danger}]}>{error}</Text>}

      <View style={styles.keypad}>
        {KEYS.map((key, i) => {
          if (key === '') return <View key={i} style={styles.keySlot} />;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.keySlot]}
              onPress={() => handleKeyPress(key)}
              disabled={locked}
              activeOpacity={0.6}>
              <View style={[styles.keyBtn, {backgroundColor: colors.surface}]}>
                <Text style={styles.keyText}>
                  {key === 'del' ? '⌫' : key}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.unlockBtn, {backgroundColor: colors.primary}]}
        onPress={handleUnlock}
        disabled={locked || pin.length < 4}>
        <Text style={[styles.unlockText, {color: colors.textOnPrimary}]}>
          Unlock
        </Text>
      </TouchableOpacity>

      {biometrics && (
        <TouchableOpacity style={styles.bioBtn} onPress={handleBiometrics}>
          <Text style={[styles.bioText, {color: colors.primary}]}>
            Use Face ID / Touch ID
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  error: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '500',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 252,
    marginTop: 20,
  },
  keySlot: {
    width: 84,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtn: {
    width: 68,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#fff',
  },
  unlockBtn: {
    marginTop: 24,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 14,
  },
  unlockText: {
    fontSize: 17,
    fontWeight: '600',
  },
  bioBtn: {
    marginTop: 18,
    padding: 10,
  },
  bioText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default AppLockScreen;
