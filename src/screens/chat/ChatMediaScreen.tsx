/**
 * Every photo and video in a conversation, decrypted.
 *
 * ## Why this screen needs its own resolver
 *
 * It used to filter `m.image || m.video` off the raw snapshot and hand those
 * straight to an <Image>. Both halves of that are wrong now that media is
 * encrypted, and they fail in opposite directions:
 *
 *   - When the attachment's *bytes* are encrypted (`mediaSealed`), the URL
 *     stays in the clear on purpose — so the message was listed, and the tile
 *     fetched ciphertext and rendered nothing.
 *   - When only the *pointer* is sealed, `image` is blanked and the URL lives
 *     in `encryptedImage` — so the message was not listed at all.
 *
 * The result was a screen that was always empty, showing nothing but the
 * CipherTexture behind it, which reads as corruption rather than as "no
 * media". That is how it was reported.
 *
 * ## Why it does not open message bodies
 *
 * The content key for an attachment lives inside the message body, and a
 * ratchet envelope opens exactly once — ChatScreen has already spent that one
 * open. So this screen never touches the ratchet. It reads the keys from
 * messageBodyStore, which keeps the *encoded* body precisely so they outlive
 * the envelope, and resolves the bytes through mediaVault, which is keyed per
 * message and slot and shared with ChatScreen. Nothing here can consume state
 * the chat view needs.
 *
 * Sealed pointers are different and are handled here directly: openSealed is
 * pure X25519 with the device key, so it can be opened as often as anyone
 * likes.
 */
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  View,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Pressable,
  Modal,
  Text,
  useColorScheme,
} from 'react-native';
import {useFocusEffect, useRoute} from '@react-navigation/native';
import {listenMessages} from '../../services/firebaseChat';
import Video from 'react-native-video';
import {getColors} from '../../theme/colors';
import ImageViewing from 'react-native-image-viewing';
import GlassScreen from '../../components/GlassScreen';
import {useTranslation} from 'react-i18next';
import {bodyWeight} from '../../theme/typography';
import {useAuth} from '../../contexts/AuthContext';
import {getDeviceKeypairIfEnrolled} from '../../services/e2eeKeys';
import {loadBodies} from '../../services/messageBodyStore';
import {decodeBody, type MediaSlot} from '../../services/messageBody';
import {planMediaTiles, type MediaJob, type MediaTile} from '../../services/chatMediaTiles';
import {resolveSealedMedia} from '../../services/mediaVault';
import {type MediaKeyInfo} from '../../services/mediaCrypto';
import {runPool} from '../../utils/pool';
import {reportError} from '../../services/errorLog';

/** Matches ChatScreen's pool: these are network reads streaming to disk. */
const MEDIA_CONCURRENCY = 4;

export default function ChatMediaScreen() {
  const route = useRoute();
  const {t} = useTranslation();
  const {user} = useAuth();
  const chatId = (route.params as any)?.chatId as string;
  const [tiles, setTiles] = useState<MediaTile[]>([]);
  // Videos only: a photo opens in ImageViewing, which has its own overlay.
  const [preview, setPreview] = useState<{uri: string} | null>(null);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const colors = getColors(useColorScheme());

  /**
   * Resolved uris by `${id}:${slot}`. A present-but-null entry is a slot that
   * failed, recorded so the pool does not retry it on every snapshot.
   */
  const resolved = useRef<Map<string, string | null>>(new Map());

  const imageList = useMemo(
    () => tiles.filter(x => x.slot === 'image' && x.uri).map(x => ({uri: x.uri as string})),
    [tiles],
  );

  useFocusEffect(
    useCallback(() => {
      if (!chatId || !user?.uid) return;
      const uid = user.uid;
      let active = true;
      let unsubscribe: (() => void) | undefined;

      (async () => {
        // Non-enrolling, deliberately. Minting a key here would overwrite the
        // account's published one and strand every message sealed to it, and
        // an empty gallery is a far smaller loss.
        const keypair = await getDeviceKeypairIfEnrolled(uid);
        const bodies = await loadBodies(uid, chatId);
        if (!active) return;

        const keysFor = (id: string): Partial<Record<MediaSlot, MediaKeyInfo>> => {
          const stored = bodies.get(id);
          return stored ? decodeBody(stored).media ?? {} : {};
        };

        unsubscribe = listenMessages(chatId, messages => {
          if (!active) return;
          const {tiles: planned, jobs} = planMediaTiles(
            messages as unknown as Record<string, unknown>[],
            {uid, chatId, secretKey: keypair?.secretKey ?? null, keysFor, resolved: resolved.current},
          );
          setTiles(planned);

          if (jobs.length === 0) return;
          runPool<MediaJob>(
            jobs,
            MEDIA_CONCURRENCY,
            async job => {
              try {
                const path = await resolveSealedMedia(job.id, job.slot, job.url, job.info);
                // Players need a scheme; a bare path silently fails on iOS.
                resolved.current.set(job.key, `file://${path}`);
              } catch (error) {
                // Never fall back to rendering job.url: it is ciphertext, and
                // showing it produces a broken-image icon that reads as a
                // network problem rather than the integrity failure it may be.
                reportError(error, 'chat_media_decrypt_failed');
                resolved.current.set(job.key, null);
              }
              if (!active) return;
              // Each tile appears as it lands rather than the whole grid
              // waiting out the slowest attachment.
              setTiles(prev =>
                prev.map(tile =>
                  tile.key === job.key
                    ? {...tile, uri: resolved.current.get(job.key) ?? null}
                    : tile,
                ),
              );
            },
            () => active,
          );
        });
      })().catch(error => {
        reportError(error, 'chat_media_open_failed');
      });

      return () => {
        active = false;
        unsubscribe?.();
      };
    }, [chatId, user?.uid]),
  );

  const openTile = (tile: MediaTile) => {
    if (!tile.uri) return;
    if (tile.slot === 'image') {
      const index = imageList.findIndex(img => img.uri === tile.uri);
      setImageViewerIndex(index >= 0 ? index : 0);
      setImageViewerVisible(true);
      return;
    }
    setPreview({uri: tile.uri});
  };

  return (
    <GlassScreen style={styles.container} textureSeed={chatId}>
      <FlatList
        data={tiles}
        numColumns={3}
        keyExtractor={item => item.key}
        ListEmptyComponent={
          // Words, because the texture behind this screen is a field of cipher
          // glyphs: an empty grid over it looks like a corrupted render, and
          // that is how the blank version of this screen got reported.
          <View style={styles.empty}>
            <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
              {t('chatMedia.empty')}
            </Text>
          </View>
        }
        renderItem={({item}) => (
          <Pressable
            style={styles.cell}
            accessibilityRole="button"
            disabled={!item.uri}
            accessibilityLabel={
              !item.uri
                ? t('chatMedia.unavailable')
                : item.slot === 'image'
                  ? t('chatMedia.openPhoto')
                  : t('chatMedia.playVideo')
            }
            onPress={() => openTile(item)}>
            {!item.uri ? (
              // Says so rather than showing an empty square. A tile that
              // cannot be decrypted on this device is a fact about the device,
              // not a broken image.
              <View style={[styles.unavailable, {borderColor: colors.glassBorder}]}>
                <Text style={[styles.unavailableText, {color: colors.textSecondary}]}>
                  {t('chatMedia.unavailable')}
                </Text>
              </View>
            ) : item.slot === 'image' ? (
              <Image
                source={{uri: item.uri}}
                style={styles.thumb}
                resizeMode="cover"
                resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
              />
            ) : (
              <View style={[styles.videoThumbWrap, {backgroundColor: colors.mediaOverlayBg}]}>
                <Video source={{uri: item.uri}} style={styles.videoThumb} paused />
                <Text style={[styles.videoIcon, {color: colors.mediaOverlayText}]}>▶</Text>
                {item.durationSeconds ? (
                  <Text style={[styles.videoDuration, {color: colors.mediaOverlayText, backgroundColor: colors.mediaOverlayBadge}]}>
                    {t('chatMedia.seconds', {count: Math.round(item.durationSeconds)})}
                  </Text>
                ) : null}
              </View>
            )}
          </Pressable>
        )}
        initialNumToRender={24}
        maxToRenderPerBatch={24}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
      />
      <ImageViewing
        images={imageList}
        imageIndex={imageViewerIndex}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
        swipeToCloseEnabled
      />
      <Modal
        visible={!!preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={[styles.previewBackdrop, {backgroundColor: colors.mediaOverlayBackdrop}]}
          onPress={() => setPreview(null)}>
          <Video source={{uri: preview?.uri}} style={styles.previewVideo} resizeMode="contain" controls />
        </Pressable>
      </Modal>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cell: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 1,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  unavailableText: {
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  empty: {
    paddingTop: 64,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  videoThumbWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  videoIcon: {
    position: 'absolute',
    fontSize: 20,
    fontFamily: bodyWeight('600'),
  },
  videoDuration: {
    position: 'absolute',
    bottom: 6,
    end: 6,
    fontSize: 11,
    fontFamily: bodyWeight('600'),
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  previewBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewVideo: {
    width: '90%',
    height: '80%',
  },
});
