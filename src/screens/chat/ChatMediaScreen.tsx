import React, {useCallback, useMemo, useState} from 'react';
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
import {Message} from '../../types';
import {getColors} from '../../theme/colors';
import ImageViewing from 'react-native-image-viewing';
import GlassScreen from '../../components/GlassScreen';
import {useTranslation} from 'react-i18next';

export default function ChatMediaScreen() {
  const route = useRoute();
  const {t} = useTranslation();
  const chatId = (route.params as any)?.chatId as string;
  const [media, setMedia] = useState<Message[]>([]);
  const [preview, setPreview] = useState<{uri: string; type: 'image' | 'video'} | null>(
    null,
  );
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const colors = getColors(useColorScheme());

  const imageList = useMemo(
    () => media.filter(m => m.image).map(m => ({uri: m.image as string})),
    [media],
  );

  useFocusEffect(
    useCallback(() => {
      if (!chatId) return;
      try {
        const unsubscribe = listenMessages(chatId, messages => {
          const filtered = messages.filter(m => m.image || m.video);
          setMedia([...filtered].reverse());
        });
        return () => unsubscribe();
      } catch (err) {
        if (__DEV__) {
          console.warn('ChatMediaScreen: failed to listen to messages', err);
        }
        return () => {};
      }
    }, [chatId]),
  );

  return (
    <GlassScreen style={styles.container} textureSeed={chatId}>
      <FlatList
        data={media}
        numColumns={3}
        keyExtractor={item => String(item._id)}
        renderItem={({item}) => (
          <Pressable
            style={styles.cell}
            accessibilityRole="button"
            accessibilityLabel={item.image ? 'Open photo full size' : 'Play video'}
            onPress={() =>
              item.image
                ? (() => {
                    const index = imageList.findIndex(img => img.uri === item.image);
                    setImageViewerIndex(index >= 0 ? index : 0);
                    setImageViewerVisible(true);
                  })()
                : setPreview({
                    uri: item.image || item.video || '',
                    type: item.video ? 'video' : 'image',
                  })
            }>
            {item.image ? (
              <Image
                source={{uri: item.image}}
                style={styles.thumb}
                resizeMode="cover"
                resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
              />
            ) : (
              <View style={[styles.videoThumbWrap, {backgroundColor: colors.mediaOverlayBg}]}>
                <Video source={{uri: item.video}} style={styles.videoThumb} paused />
                <Text style={[styles.videoIcon, {color: colors.mediaOverlayText}]}>▶</Text>
                {item.videoDuration ? (
                  <Text style={[styles.videoDuration, {color: colors.mediaOverlayText, backgroundColor: colors.mediaOverlayBadge}]}>
                    {t('chatMedia.seconds', {count: Math.round(item.videoDuration)})}
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
        <Pressable style={[styles.previewBackdrop, {backgroundColor: colors.mediaOverlayBackdrop}]} onPress={() => setPreview(null)}>
          {preview?.type === 'image' ? (
            <Image source={{uri: preview.uri}} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <Video source={{uri: preview?.uri}} style={styles.previewVideo} resizeMode="contain" controls />
          )}
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
    fontWeight: '600',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '90%',
    height: '80%',
  },
  previewVideo: {
    width: '90%',
    height: '80%',
  },
});

