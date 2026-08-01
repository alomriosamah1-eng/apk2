import { Component, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';
import { Icon } from '@ui/components/atoms/Icon';
import { spacing } from '@core/theme';
import { logger } from '@core/utils';
import i18n from '@core/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

/** Top-level error boundary: catches render errors instead of a white screen (Recovery/02 §0.8). */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: (error as Error)?.message ?? i18n.t('errors.general') };
  }

  override componentDidCatch(error: unknown, info: { componentStack?: string | null }): void {
    logger.error('ErrorBoundary caught error', error as Error, { componentStack: info.componentStack });
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, message: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Icon name="alert-decagram-outline" size={64} color="#EF5350" />
          <Typography variant="headlineSmall" style={styles.title}>{i18n.t('errors.boundaryTitle')}</Typography>
          <Typography variant="bodyMedium" color="rgba(0,0,0,0.6)" style={styles.message}>
            {this.state.message}
          </Typography>
          <Button title={i18n.t('common.reload')} onPress={this.handleReload} variant="primary" fullWidth style={styles.button} />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: '#F6F2EE',
  },
  title: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.xl,
    maxWidth: 300,
  },
});
