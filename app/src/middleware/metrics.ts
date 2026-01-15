/**
 * Metrics Middleware
 * Collects application metrics for monitoring and alerting
 * Uses Prometheus format for compatibility with monitoring systems
 */

import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import logger from '../utils/logger';

// Create metrics registry
const register = new client.Registry();

// Default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// HTTP request metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestErrors = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// Database query metrics
const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Metrics middleware
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const route = req.route?.path || req.path;

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route: route || 'unknown',
      status: res.statusCode.toString(),
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);

    if (res.statusCode >= 400) {
      httpRequestErrors.inc(labels);
    }
  });

  next();
}

/**
 * Track database query duration
 * Wrap database queries with this function
 */
export function trackDbQuery<T>(
  queryType: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  return fn().finally(() => {
    const duration = (Date.now() - start) / 1000;
    dbQueryDuration.observe({ query_type: queryType, table }, duration);
  });
}

/**
 * Metrics endpoint handler
 * Returns Prometheus metrics in text format
 */
export async function metricsHandler(req: Request, res: Response) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error: any) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
}

/**
 * Get metrics summary (for health checks or custom endpoints)
 */
export async function getMetricsSummary() {
  const metrics = await register.getMetricsAsJSON();
  return {
    timestamp: new Date().toISOString(),
    metrics: metrics.map((m: any) => ({
      name: m.name,
      help: m.help,
      type: m.type,
      values: m.values,
    })),
  };
}

export { register };

