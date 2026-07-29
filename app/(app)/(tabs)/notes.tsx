import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, RefreshControl, TouchableOpacity, TextInput as RNTextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Typography } from '@ui/components/atoms/Typography';
import { EmptyState } from '@ui/components/atoms/EmptyState';
import { SearchBar } from '@ui/components/molecules/SearchBar';
import { FloatingButton } from '@ui/components/molecules/FloatingButton';
import { Loading } from '@ui/components/atoms/Loading';
import { ErrorView } from '@ui/components/atoms/ErrorView';
import { useTranslation } from 'react-i18next';
import { Icon } from '@ui/components/atoms/Icon';
import { useSecureStorage } from '@ui/hooks/useSecureStorage';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  isPinned: boolean;
}

const NOTES_STORAGE_KEY = 'khaznati_notes';

export default function NotesScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { getItem, setItem } = useSecureStorage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const loadNotes = useCallback(async () => {
    try {
      setError(null);
      const stored = await getItem(NOTES_STORAGE_KEY);
      setNotes(stored ? JSON.parse(stored) : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getItem]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const saveNotes = useCallback(async (updatedNotes: Note[]) => {
    await setItem(NOTES_STORAGE_KEY, JSON.stringify(updatedNotes));
    setNotes(updatedNotes);
  }, [setItem]);

  const handleCreate = useCallback(() => {
    setEditingNote({ id: Date.now().toString(), title: '', content: '', updatedAt: Date.now(), isPinned: false });
    setEditTitle('');
    setEditContent('');
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (!editingNote) return;
    const updated = { ...editingNote, title: editTitle, content: editContent, updatedAt: Date.now() };

    let updatedNotes: Note[];
    const existingIndex = notes.findIndex((n) => n.id === editingNote.id);
    if (existingIndex >= 0) {
      updatedNotes = [...notes];
      updatedNotes[existingIndex] = updated;
    } else {
      updatedNotes = [updated, ...notes];
    }

    await saveNotes(updatedNotes);
    setEditingNote(null);
  }, [editingNote, editTitle, editContent, notes, saveNotes]);

  const handleDelete = useCallback(async (id: string) => {
    await saveNotes(notes.filter((n) => n.id !== id));
  }, [notes, saveNotes]);

  const handleTogglePin = useCallback(async (id: string) => {
    await saveNotes(notes.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n)));
  }, [notes, saveNotes]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotes();
  }, [loadNotes]);

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const filteredNotes = search
    ? sortedNotes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
    : sortedNotes;

  if (editingNote) {
    return (
      <ScreenLayout title={notes.find((n) => n.id === editingNote.id) ? t('notes.edit') : t('notes.create')} showBack onBack={() => setEditingNote(null)}>
        <View style={styles.editorContainer}>
          <RNTextInput
            style={[styles.titleInput, { color: colors.onSurface }]}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder={t('notes.titlePlaceholder')}
            placeholderTextColor={colors.onSurfaceVariant}
            autoFocus
          />
          <RNTextInput
            style={[styles.contentInput, { color: colors.onSurface }]}
            value={editContent}
            onChangeText={setEditContent}
            placeholder={t('notes.contentPlaceholder')}
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.editorActions}>
            <TouchableOpacity onPress={() => setEditingNote(null)} style={[styles.editorBtn, { borderColor: colors.outline }]}>
              <Typography color={colors.onSurfaceVariant}>{t('common.cancel')}</Typography>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveNote} style={[styles.editorBtn, styles.saveBtn, { backgroundColor: colors.primary }]}>
              <Typography color="#FFFFFF">{t('common.save')}</Typography>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenLayout>
    );
  }

  if (loading && notes.length === 0) {
    return <Loading fullScreen message={t('common.loading')} />;
  }

  if (error && notes.length === 0) {
    return <ErrorView message={error} onRetry={loadNotes} />;
  }

  return (
    <ScreenLayout title={t('notes.title')} subtitle={t('vault.itemsCount', { count: notes.length })} showBack onBack={() => router.push('/(app)/(tabs)/vault')}>
      <SearchBar value={search} onChangeText={setSearch} placeholder={t('notes.search')} onClear={() => setSearch('')} />
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredNotes.length === 0 ? (
          <EmptyState
            icon="note-text-outline"
            title={search ? t('common.noResults') : t('notes.empty')}
            description={search ? t('common.noResults') : t('notes.emptyDesc')}
            actionLabel={search ? undefined : t('notes.create')}
            onAction={search ? undefined : handleCreate}
          />
        ) : (
          filteredNotes.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => { setEditingNote(item); setEditTitle(item.title); setEditContent(item.content); }}
              style={[styles.noteItem, { borderBottomColor: colors.outlineVariant }]}
            >
              <View style={styles.noteHeader}>
                <Typography variant="bodyLarge" numberOfLines={1} style={styles.noteTitle}>
                  {item.title || t('notes.untitled')}
                </Typography>
                {item.isPinned && <Icon name="pin" size={16} color={colors.primary} />}
              </View>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} numberOfLines={2}>
                {item.content || t('notes.noContent')}
              </Typography>
              <View style={styles.noteFooter}>
                <Typography variant="labelSmall" color={colors.onSurfaceVariant}>
                  {new Date(item.updatedAt).toLocaleDateString()}
                </Typography>
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => handleTogglePin(item.id)}>
                    <Icon name="pin-outline" size={18} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Icon name="delete-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <FloatingButton icon="plus" onPress={handleCreate} accessibilityLabel={t('notes.create')} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  noteItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  noteTitle: {
    flex: 1,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  noteActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  editorContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: spacing.sm,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  editorBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  saveBtn: {
    borderWidth: 0,
  },
});
