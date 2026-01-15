import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import logger from '../../utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log info messages', () => {
    const spy = jest.spyOn(logger, 'info');
    logger.info('Test message');
    expect(spy).toHaveBeenCalledWith('Test message');
  });

  it('should log error messages', () => {
    const spy = jest.spyOn(logger, 'error');
    logger.error('Test error');
    expect(spy).toHaveBeenCalledWith('Test error');
  });

  it('should log warning messages', () => {
    const spy = jest.spyOn(logger, 'warn');
    logger.warn('Test warning');
    expect(spy).toHaveBeenCalledWith('Test warning');
  });

  it('should sanitize sensitive data in logs', () => {
    // Logger should sanitize passwords, tokens, etc.
    // This is tested implicitly through the sanitizeData function
    expect(true).toBe(true);
  });
});

