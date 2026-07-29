import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
import { Icon } from '@ui/components/atoms/Icon';
import { Input } from '@ui/components/atoms/Input';
import { Button } from '@ui/components/atoms/Button';
import { useSecureStorage } from '@ui/hooks/useSecureStorage';
import { useTranslation } from 'react-i18next';

interface PasswordEntry {
  id: string;
  serviceName: string;
  serviceUrl: string;
  username: string;
  password: string;
  category: string;
  notes: string;
  createdAt: number;
}

const CATEGORIES = ['social', 'email', 'finance', 'shopping', 'work', 'entertainment', 'other'];
const STORAGE_KEY = 'khaznati_passwords';

export default function PasswordsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { getItem, setItem } = useSecureStorage();
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('social');
  const [formData, setFormData] = useState({ serviceName: '', serviceUrl: '', username: '', password: '', notes: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      setError(null);
      const stored = await getItem(STORAGE_KEY);
      setEntries(stored ? JSON.parse(stored) : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getItem]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const saveEntries = useCallback(async (updated: PasswordEntry[]) => {
    await setItem(STORAGE_KEY, JSON.stringify(updated));
    setEntries(updated);
  }, [setItem]);

  const generatePassword = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let pwd = '';
    for (let i = 0; i < 16; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: pwd }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.serviceName || !formData.username || !formData.password) return;

    const timestamp = Date.now();
    let updated: PasswordEntry[];

    if (editingId) {
      updated = entries.map((e) => (e.id === editingId ? { ...e, ...formData, createdAt: e.createdAt } : e));
    } else {
      updated = [{ id: timestamp.toString(), ...formData, category: selectedCategory, createdAt: timestamp }, ...entries];
    }

    await saveEntries(updated);
    setShowForm(false);
    setEditingId(null);
    setFormData({ serviceName: '', serviceUrl: '', username: '', password: '', notes: '' });
  }, [formData, selectedCategory, editingId, entries, saveEntries]);

  const handleEdit = useCallback((entry: PasswordEntry) => {
    setEditingId(entry.id);
    setFormData({ serviceName: entry.serviceName, serviceUrl: entry.serviceUrl, username: entry.username, password: entry.password, notes: entry.notes });
    setSelectedCategory(entry.category);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await saveEntries(entries.filter((e) => e.id !== id));
  }, [entries, saveEntries]);

  const handleCopy = useCallback(async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const toggleShowPassword = useCallback((id: string) => {
    setShowPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadEntries();
  }, [loadEntries]);

  const filtered = search
    ? entries.filter((e) => e.serviceName.toLowerCase().includes(search.toLowerCase()) || e.username.toLowerCase().includes(search.toLowerCase()) || e.serviceUrl.toLowerCase().includes(search.toLowerCase()))
    : entries;

  if (showForm) {
    return (
      <ScreenLayout title={editingId ? t('passwords.edit') : t('passwords.add')} showBack onBack={() => { setShowForm(false); setEditingId(null); }}>
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          <Input label={t('passwords.serviceName')} value={formData.serviceName} onChangeText={(t) => setFormData((p) => ({ ...p, serviceName: t }))} placeholder={t('passwords.serviceNamePlaceholder')} />
          <Input label={t('passwords.serviceUrl')} value={formData.serviceUrl} onChangeText={(t) => setFormData((p) => ({ ...p, serviceUrl: t }))} placeholder={t('passwords.serviceUrlPlaceholder')} keyboardType="url" />
          <Input label={t('passwords.username')} value={formData.username} onChangeText={(t) => setFormData((p) => ({ ...p, username: t }))} placeholder={t('passwords.usernamePlaceholder')} />
          <View style={styles.passwordRow}>
            <View style={styles.passwordInput}>
              <Input label={t('passwords.password')} value={formData.password} onChangeText={(t) => setFormData((p) => ({ ...p, password: t }))} placeholder={t('passwords.passwordPlaceholder')} secureTextEntry />
            </View>
            <TouchableOpacity onPress={generatePassword} style={[styles.generateBtn, { backgroundColor: colors.primaryContainer }]}>
              <Icon name="auto-fix" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Input label={t('passwords.notes')} value={formData.notes} onChangeText={(t) => setFormData((p) => ({ ...p, notes: t }))} placeholder="Additional notes" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.categoryChip, { backgroundColor: selectedCategory === cat ? colors.primary : colors.surfaceVariant }]}
              >
                <Typography variant="labelSmall" color={selectedCategory === cat ? '#FFFFFF' : colors.onSurface}>
                  {t(`passwords.categories.${cat}`)}
                </Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button title={t('common.save')} onPress={handleSave} variant="primary" fullWidth size="lg" disabled={!formData.serviceName || !formData.username || !formData.password} />
        </ScrollView>
      </ScreenLayout>
    );
  }

  if (loading && entries.length === 0) {
    return <Loading fullScreen message={t('common.loading')} />;
  }

  if (error && entries.length === 0) {
    return <ErrorView message={error} onRetry={loadEntries} />;
  }

  return (
    <ScreenLayout title={t('passwords.title')} subtitle={t('passwords.savedCount', { count: entries.length })} showBack onBack={() => router.push('/(app)/(tabs)/vault')}>
      <SearchBar value={search} onChangeText={setSearch} placeholder={t('passwords.search')} onClear={() => setSearch('')} />
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="lock-outline"
            title={search ? t('common.noResults') : t('passwords.empty')}
            description={search ? t('common.noResults') : t('passwords.emptyDesc')}
            actionLabel={search ? undefined : t('passwords.add')}
            onAction={search ? undefined : () => setShowForm(true)}
          />
        ) : (
          filtered.map((item) => (
            <View key={item.id} style={[styles.entryItem, { borderBottomColor: colors.outlineVariant }]}>
              <TouchableOpacity onPress={() => handleEdit(item)} style={styles.entryMain}>
                <View style={[styles.entryIcon, { backgroundColor: colors.primaryContainer }]}>
                  <Icon name="lock" size={20} color={colors.primary} />
                </View>
                <View style={styles.entryInfo}>
                  <Typography variant="bodyMedium">{item.serviceName}</Typography>
                  <Typography variant="bodySmall" color={colors.onSurfaceVariant}>{item.username}</Typography>
                </View>
              </TouchableOpacity>
              <View style={styles.entryActions}>
                <TouchableOpacity onPress={() => toggleShowPassword(item.id)}>
                  <Icon name={showPasswords.has(item.id) ? 'eye-off' : 'eye'} size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleCopy(item.password, `pwd-${item.id}`)}>
                  <Icon name="content-copy" size={20} color={copiedField === `pwd-${item.id}` ? colors.primary : colors.onSurfaceVariant} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Icon name="delete-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <FloatingButton icon="plus" onPress={() => { setShowForm(true); setEditingId(null); setFormData({ serviceName: '', serviceUrl: '', username: '', password: '', notes: '' }); }} accessibilityLabel={t('passwords.add')} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entryMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  entryInfo: {
    flex: 1,
  },
  entryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  formContainer: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  passwordInput: {
    flex: 1,
  },
  generateBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  categoryRow: {
    marginVertical: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    marginRight: spacing.sm,
  },
});
