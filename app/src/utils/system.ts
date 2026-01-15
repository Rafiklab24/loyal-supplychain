/**
 * System utilities for health checks
 */

import checkDiskSpace from 'check-disk-space';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Check available disk space
 */
export async function checkDiskSpaceInfo() {
  try {
    // Check root directory or current working directory
    const checkPath = process.platform === 'win32' ? 'C:\\' : '/';
    const diskInfo = await checkDiskSpace(checkPath);
    
    return {
      free: diskInfo.free,
      size: diskInfo.size,
      freeGB: (diskInfo.free / (1024 * 1024 * 1024)).toFixed(2),
      sizeGB: (diskInfo.size / (1024 * 1024 * 1024)).toFixed(2),
      usedPercent: ((diskInfo.size - diskInfo.free) / diskInfo.size * 100).toFixed(2),
    };
  } catch (error: any) {
    throw new Error(`Disk space check failed: ${error.message}`);
  }
}

/**
 * Check memory usage
 */
export function checkMemoryUsage() {
  const memUsage = process.memoryUsage();
  const memUsageMB = memUsage.heapUsed / (1024 * 1024);
  const memTotalMB = memUsage.heapTotal / (1024 * 1024);
  const rssMB = memUsage.rss / (1024 * 1024);
  
  return {
    heapUsed: memUsageMB.toFixed(2),
    heapTotal: memTotalMB.toFixed(2),
    rss: rssMB.toFixed(2),
    external: (memUsage.external / (1024 * 1024)).toFixed(2),
    utilization: ((memUsageMB / memTotalMB) * 100).toFixed(2),
  };
}

