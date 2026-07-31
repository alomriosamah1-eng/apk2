import React from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { Icon } from '@ui/components/atoms/Icon';

export default function TabLayout(): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          display: 'none',
          height: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="vault"
        options={{
          title: t('vault.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="shield-home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="files"
        options={{
          title: t('files.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="folder" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="media"
        options={{
          title: t('media.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="image-multiple" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: t('notes.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="note-text" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="passwords"
        options={{
          title: t('passwords.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="lock" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
