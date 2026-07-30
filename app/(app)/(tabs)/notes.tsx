import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, TouchableOpacity, TextInput as RNTextInput, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Typography } from '@ui/components/atoms/Typography';
import { EmptyState } from '@ui/components/atoms/EmptyState';
import { SearchBar } from '@ui/components/molecules/SearchBar';
import { FloatingButton } from '@ui/components/molecules/FloatingButton';
import { SelectionBar } from '@ui/components/organisms/SelectionBar';
import { Loading } from '@ui/components/atoms/Loading';
import { ErrorView } from '@ui/components/atoms/ErrorView';
import { useTranslation } from 'react-i18next';
import { Icon } from '@ui/components/atoms/Icon';
import { DIContainer } from '@core/di/container';
import { INoteRepository } from '@domain/repositories/INoteRepository';
import { Note } from '@domain/entities/Note';
import { generateId } from '@core/utils';

export default function NotesScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { vaultId: paramsVaultId } = useLocalSearchParams<{ vaultId: string }>();
  const vaultId = paramsVaultId || '';
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  const repo = useMemo(
    () => DIContainer.resolve<INoteRepository>('NoteRepository'),
    [],
  );

  const loadNotes = useCallback(async () => {
    setError(null);
    const result = await repo.findByVaultId(vaultId);
    if (result.success) {
      setNotes(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, [repo, vaultId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleCreate = useCallback(() => {
    setEditingNote({
      id: generateId(),
      vaultId,
      title: '',
      encryptedContent: '',
      isEncrypted: false,
      color: null,
      isPinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setEditTitle('');
    setEditContent('');
  }, [vaultId]);

  const handleSaveNote = useCallback(async () => {
    if (!editingNote) return;
    const updated: Note = {
      ...editingNote,
      title: editTitle,
      encryptedContent: editContent,
      updatedAt: Date.now(),
    };

    const existingIndex = notes.findIndex((n) => n.id === editingNote.id);
    const result = existingIndex >= 0
      ? await repo.update(updated)
      : await repo.create(updated);
    if (result.success) {
      await loadNotes();
    }
    setEditingNote(null);
  }, [editingNote, editTitle, editContent, notes, repo, loadNotes]);

  const handleDelete = useCallback(async (id: string) => {
    const result = await repo.delete(id);
    if (result.success) {
      await loadNotes();
    }
  }, [repo, loadNotes]);

  const handleTogglePin = useCallback(async (id: string) => {
    await repo.togglePin(id);
    await loadNotes();
  }, [repo, loadNotes]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotes();
  }, [loadNotes]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) setIsSelecting(false);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelecting(false);
  }, []);

  const handleLongPress = useCallback((id: string) => {
    setIsSelecting(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleBatchDelete = useCallback(async () => {
    for (const id of selectedIds) {
      await repo.delete(id);
    }
    clearSelection();
    await loadNotes();
  }, [selectedIds, repo, clearSelection, loadNotes]);

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const filteredNotes = search
    ? sortedNotes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()) || n.encryptedContent.toLowerCase().includes(search.toLowerCase()))
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
      {isSelecting && (
        <SelectionBar
          selectedCount={selectedIds.size}
          onClearSelection={clearSelection}
          actions={[
            { icon: 'delete-outline', label: t('common.delete'), onPress: handleBatchDelete, destructive: true },
          ]}
        />
      )}
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
              onPress={() => {
                if (isSelecting) {
                  toggleSelection(item.id);
                } else {
                  setEditingNote(item);
                  setEditTitle(item.title);
                  setEditContent(item.encryptedContent);
                }
              }}
              onLongPress={() => handleLongPress(item.id)}
              style={[styles.noteItem, { borderBottomColor: colors.outlineVariant }, selectedIds.has(item.id) && { backgroundColor: colors.primaryContainer }]}
            >
              <View style={styles.noteHeader}>
                {isSelecting && (
                  <View style={styles.checkboxIcon}>
                    <Icon
                      name={selectedIds.has(item.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={22}
                      color={selectedIds.has(item.id) ? colors.primary : colors.onSurfaceVariant}
                    />
                  </View>
                )}
                <Typography variant="bodyLarge" numberOfLines={1} style={styles.noteTitle}>
                  {item.title || t('notes.untitled')}
                </Typography>
                {item.isPinned && <Icon name="pin" size={16} color={colors.primary} />}
              </View>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} numberOfLines={2}>
                {item.encryptedContent || t('notes.noContent')}
              </Typography>
              {!isSelecting && (
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
              )}
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
  checkboxIcon: {
    marginRight: spacing.sm,
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
