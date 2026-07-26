import { DatabaseService } from '@data/database/DatabaseService';
import { FileSystemSource } from '@data/datasources/FileSystemSource';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { DIContainer } from '@core/di/container';

/** Overall health evaluation result. */
export interface HealthStatus {
  /** Aggregated health status. */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Individual check results. */
  checks: HealthCheck[];
  /** ISO timestamp of when the check was performed. */
  timestamp: string;
}

/** Result of a single health check. */
export interface HealthCheck {
  /** Name of the checked component. */
  name: string;
  /** Whether the check passed, failed, or issued a warning. */
  status: 'pass' | 'fail' | 'warn';
  /** Optional human-readable message. */
  message?: string;
  /** Measured latency of the check in milliseconds. */
  latencyMs?: number;
}

/** Performs health checks on critical application services. */
export class HealthService {
  /** Runs all health checks and returns the aggregated status. */
  async checkAll(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkFileSystem(),
      this.checkSecureStorage(),
    ]);

    const failed = checks.filter((c) => c.status === 'fail');
    const warnings = checks.filter((c) => c.status === 'warn');

    let status: HealthStatus['status'] = 'healthy';
    if (failed.length > 0) status = 'unhealthy';
    else if (warnings.length > 0) status = 'degraded';

    return { status, checks, timestamp: new Date().toISOString() };
  }

  private async measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
    const start = Date.now();
    const result = await fn();
    return { result, latencyMs: Date.now() - start };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const db = DIContainer.resolve<DatabaseService>('DatabaseService');
      const { result: ok, latencyMs } = await this.measureLatency(() => db.integrityCheck());
      return {
        name: 'database',
        status: ok ? 'pass' : 'fail',
        message: ok ? undefined : 'Database integrity check failed',
        latencyMs,
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'fail',
        message: (error as Error).message,
        latencyMs: Date.now() - start,
      };
    }
  }

  private async checkFileSystem(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const fs = DIContainer.resolve<FileSystemSource>('FileSystemSource');
      const basePath = fs.getBasePath();
      return {
        name: 'filesystem',
        status: 'pass',
        message: `Base path: ${basePath}`,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'filesystem',
        status: 'warn',
        message: (error as Error).message,
        latencyMs: Date.now() - start,
      };
    }
  }

  private async checkSecureStorage(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      void DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
      return {
        name: 'secure_storage',
        status: 'pass',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'secure_storage',
        status: 'warn',
        message: (error as Error).message,
        latencyMs: Date.now() - start,
      };
    }
  }
}
