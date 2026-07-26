import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, RefreshControl, Image, Dimensions, ScrollView } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Paths, Directory } from 'expo-file-system';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { EmptyState } from '@ui/components/atoms/EmptyState';
import { Loading } from '@ui/components/atoms/Loading';
import { ErrorView } from '@ui/components/atoms/ErrorView';

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface MediaItem {
  id: string;
  uri: string;
  name: string;
}

export default function MediaScreen() {
  const { colors } = useTheme();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    try {
      setError(null);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Media library permission is required to view photos and videos');
        return;
      }

      const mediaDir = new Directory(Paths.document, 'khaznati', 'media');
      if (!mediaDir.exists) {
        setMedia([]);
        return;
      }

      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      const list = mediaDir.list();
      const items: MediaItem[] = list
        .filter((entry) => {
          const ext = entry.name.toLowerCase().split('.').pop();
          return ext && imageExtensions.includes(`.${ext}`);
        })
        .map((entry) => ({
          id: entry.uri,
          uri: entry.uri,
          name: entry.name,
        }));

      setMedia(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadMedia();
  }, [loadMedia]);

  if (loading && media.length === 0) {
    return <Loading fullScreen message="Loading media..." />;
  }

  if (error && media.length === 0) {
    return <ErrorView message={error} onRetry={loadMedia} />;
  }

  return (
    <ScreenLayout title="Media" subtitle={`${media.length} item${media.length !== 1 ? 's' : ''}`}>
      <ScrollView
        contentContainerStyle={styles.grid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {media.length === 0 ? (
          <EmptyState
            icon="image-multiple-outline"
            title="No media yet"
            description="Photos and videos you add will appear here"
          />
        ) : (
          <View style={styles.gridRow}>
            {media.map((item) => (
              <View key={item.id} style={styles.mediaItem}>
                <Image
                  source={{ uri: item.uri }}
                  style={styles.thumbnail}
                  accessibilityLabel={item.name}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#E4E8F0',
  },
});
