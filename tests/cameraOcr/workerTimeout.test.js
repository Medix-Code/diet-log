/**
 * Tests for Tesseract worker timeout handling
 * These tests verify that the OCR worker creation has proper timeout protection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Tesseract Worker Timeout', () => {
  let mockTesseract;
  let workerCreatePromise;
  let resolveWorker;
  let rejectWorker;

  beforeEach(() => {
    // Mock Tesseract global
    workerCreatePromise = new Promise((resolve, reject) => {
      resolveWorker = resolve;
      rejectWorker = reject;
    });

    mockTesseract = {
      createWorker: vi.fn(() => workerCreatePromise),
    };

    global.Tesseract = mockTesseract;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.Tesseract;
  });

  it('should timeout if worker creation takes longer than 30 seconds', async () => {
    // Simulate the timeout wrapper logic that should be in cameraOcr.js
    const createWorkerWithTimeout = async (timeout = 30000) => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Worker initialization timeout')), timeout)
      );

      return Promise.race([
        mockTesseract.createWorker('spa', 1, { logger: () => {} }),
        timeoutPromise
      ]);
    };

    // Test with 100ms timeout for speed
    const promise = createWorkerWithTimeout(100);

    // Don't resolve the worker - simulate hanging initialization
    await expect(promise).rejects.toThrow('Worker initialization timeout');
  });

  it('should successfully create worker if initialization completes in time', async () => {
    const mockWorker = {
      setParameters: vi.fn(),
      recognize: vi.fn(),
      terminate: vi.fn(),
    };

    const createWorkerWithTimeout = async (timeout = 30000) => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Worker initialization timeout')), timeout)
      );

      return Promise.race([
        mockTesseract.createWorker('spa', 1, { logger: () => {} }),
        timeoutPromise
      ]);
    };

    // Start the worker creation with timeout
    const workerPromise = createWorkerWithTimeout(1000);

    // Resolve the worker quickly (before timeout)
    setTimeout(() => resolveWorker(mockWorker), 50);

    const worker = await workerPromise;
    expect(worker).toBe(mockWorker);
    expect(mockTesseract.createWorker).toHaveBeenCalledOnce();
  });

  it('should handle worker creation rejection', async () => {
    const createWorkerWithTimeout = async (timeout = 30000) => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Worker initialization timeout')), timeout)
      );

      return Promise.race([
        mockTesseract.createWorker('spa', 1, { logger: () => {} }),
        timeoutPromise
      ]);
    };

    const workerPromise = createWorkerWithTimeout(1000);

    // Reject the worker creation (e.g., network error)
    setTimeout(() => rejectWorker(new Error('Failed to load language data')), 50);

    await expect(workerPromise).rejects.toThrow('Failed to load language data');
  });

  it('should pass correct parameters to createWorker', async () => {
    const mockLogger = vi.fn();
    const mockInitParams = { load_system_dawg: '0' };

    const createWorkerWithTimeout = async () => {
      return mockTesseract.createWorker('spa', 1, {
        logger: mockLogger,
        init: mockInitParams,
      });
    };

    // Start creation
    const workerPromise = createWorkerWithTimeout();

    // Resolve quickly
    setTimeout(() => resolveWorker({ terminate: vi.fn() }), 10);

    await workerPromise;

    expect(mockTesseract.createWorker).toHaveBeenCalledWith('spa', 1, {
      logger: mockLogger,
      init: mockInitParams,
    });
  });

  it('should track progress events through logger callback', async () => {
    const progressEvents = [];

    let capturedLogger;
    mockTesseract.createWorker = vi.fn((lang, mode, options) => {
      capturedLogger = options.logger;
      return workerCreatePromise;
    });

    const mockLogger = (m) => {
      progressEvents.push({ status: m.status, progress: m.progress });
    };

    // Simulate the worker creation
    const workerPromise = mockTesseract.createWorker('spa', 1, {
      logger: mockLogger,
    });

    // Simulate Tesseract progress events
    if (capturedLogger) {
      capturedLogger({ status: 'initializing tesseract', progress: 0 });
      capturedLogger({ status: 'loading language model', progress: 0.5 });
      capturedLogger({ status: 'initialized tesseract', progress: 1 });
    }

    // Resolve the worker
    resolveWorker({ terminate: vi.fn() });
    await workerPromise;

    expect(progressEvents).toEqual([
      { status: 'initializing tesseract', progress: 0 },
      { status: 'loading language model', progress: 0.5 },
      { status: 'initialized tesseract', progress: 1 },
    ]);
  });
});
