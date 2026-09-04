import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  useColorScheme,
  PanResponder,
  Dimensions,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import Svg, {Path} from 'react-native-svg';
import {useAuth} from '../../contexts/AuthContext';
import {getColors} from '../../theme/colors';
import {listenWhiteboard, addStroke, clearWhiteboard} from '../../services/whiteboard';
import {WhiteboardStroke} from '../../types';
import GlassScreen from '../../components/GlassScreen';

const COLORS = ['#000000', '#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA'];

function pointsToPath(points: Array<{x: number; y: number}>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');
}

export default function WhiteboardScreen() {
  const route = useRoute();
  const chatId = (route.params as any)?.chatId as string;
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Array<{x: number; y: number}>>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  useEffect(() => {
    if (!chatId) return;
    return listenWhiteboard(chatId, setStrokes);
  }, [chatId]);

  const handleClear = useCallback(() => {
    if (!chatId) return;
    Alert.alert('Clear Whiteboard', 'Clear all drawings?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Clear', style: 'destructive', onPress: () => clearWhiteboard(chatId)},
    ]);
  }, [chatId]);

  const strokePointsRef = useRef<Array<{x: number; y: number}>>([]);
  const colorRef = useRef(color);
  const widthRef = useRef(strokeWidth);
  colorRef.current = color;
  widthRef.current = strokeWidth;

  const commitStroke = useCallback(
    async (points: Array<{x: number; y: number}>) => {
      if (!chatId || !user?.uid || points.length < 2) return;
      const stroke: WhiteboardStroke = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        userId: user.uid,
        color: colorRef.current,
        width: widthRef.current,
        points,
      };
      try {
        await addStroke(chatId, stroke);
      } catch {
        // ignore
      }
    },
    [chatId, user?.uid],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        const {locationX, locationY} = evt.nativeEvent;
        strokePointsRef.current = [{x: locationX, y: locationY}];
        setCurrentStroke([{x: locationX, y: locationY}]);
      },
      onPanResponderMove: evt => {
        const {locationX, locationY} = evt.nativeEvent;
        strokePointsRef.current = [...strokePointsRef.current, {x: locationX, y: locationY}];
        setCurrentStroke(strokePointsRef.current);
      },
      onPanResponderRelease: evt => {
        const {locationX, locationY} = evt.nativeEvent;
        const points = [...strokePointsRef.current, {x: locationX, y: locationY}];
        strokePointsRef.current = [];
        setCurrentStroke([]);
        commitStroke(points);
      },
    }),
  ).current;

  const {width, height} = Dimensions.get('window');
  const canvasHeight = height - 180;

  return (
    <GlassScreen textureSeed={chatId}>
      <View style={styles.container}>
        <View style={[styles.toolbar, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}>
          <View style={styles.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                accessibilityRole="button"
                accessibilityLabel={`Pen color ${c}`}
                accessibilityState={{selected: color === c}}
                onPress={() => setColor(c)}
                style={[
                  styles.colorBtn,
                  {backgroundColor: c, borderColor: colors.text},
                  color === c && styles.colorBtnActive,
                ]}
              />
            ))}
          </View>
          <View style={styles.widthRow}>
            {[2, 4, 6].map(w => (
              <TouchableOpacity
                key={w}
                accessibilityRole="button"
                accessibilityLabel={`Stroke width ${w}`}
                accessibilityState={{selected: strokeWidth === w}}
                onPress={() => setStrokeWidth(w)}
                style={[
                  styles.widthBtn,
                  {borderColor: colors.glassBorder},
                  strokeWidth === w && {borderColor: colors.primary, borderWidth: 2},
                ]}>
                <View style={[styles.widthDot, {width: w, height: w, backgroundColor: colors.text}]} />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={handleClear}
            style={[styles.clearBtn, {borderColor: colors.glassBorder}]}>
            <Text style={[styles.clearText, {color: colors.danger}]}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View
          style={[styles.canvas, {backgroundColor: colors.background}]}
          {...panResponder.panHandlers}>
          <Svg width={width} height={canvasHeight} style={StyleSheet.absoluteFill}>
            {strokes.map(s => (
              <Path
                key={s.id}
                d={pointsToPath(s.points)}
                stroke={s.color}
                strokeWidth={s.width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {currentStroke.length > 1 && (
              <Path
                d={pointsToPath(currentStroke)}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        </View>
      </View>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  toolbar: {
    padding: 12,
    borderBottomWidth: 1,
  },
  colorRow: {flexDirection: 'row', gap: 8, marginBottom: 8},
  colorBtn: {
    width: 28,
    height: 28,
    borderRadius: 2,
    borderWidth: 2,
  },
  colorBtnActive: {borderWidth: 3},
  widthRow: {flexDirection: 'row', gap: 8, marginBottom: 8},
  widthBtn: {
    padding: 8,
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  widthDot: {borderRadius: 2},
  clearBtn: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 2,
    borderWidth: 1,
  },
  clearText: {fontSize: 14},
  canvas: {flex: 1},
});
