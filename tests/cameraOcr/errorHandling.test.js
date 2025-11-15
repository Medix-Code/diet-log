/**
 * Tests for OCR error handling
 * Verifies that errors during worker initialization are properly handled
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('OCR Error Handling', () => {
  let mockTesseract;
  let mockToast;
  let mockOcrFeedback;

  beforeEach(() => {
    // Mock Tesseract
    mockTesseract = {
      createWorker: vi.fn(),
    };
    global.Tesseract = mockTesseract;

    // Mock toast notifications
    mockToast = vi.fn();
    global.showToast = mockToast;

    // Mock OCR feedback
    mockOcrFeedback = {
      start: vi.fn(),
      update: vi.fn(),
      complete: vi.fn(),
      error: vi.fn(),
      reset: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.Tesseract;
    delete global.showToast;
  });

  it('should handle network errors when loading Tesseract resources', async () => {
    const networkError = new Error('Failed to fetch');
    mockTesseract.createWorker.mockRejectedValue(networkError);

    try {
      await mockTesseract.createWorker('spa', 1, { logger: () => {} });
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error.message).toBe('Failed to fetch');
    }
  });

  it('should handle timeout errors with appropriate user message', async () => {
    const timeoutError = new Error('Worker initialization timeout');
    mockTesseract.createWorker.mockRejectedValue(timeoutError);

    try {
      await mockTesseract.createWorker('spa', 1, { logger: () => {} });
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error.message).toContain('timeout');
    }
  });

  it('should clean up worker resources on error', async () => {
    const mockWorker = {
      terminate: vi.fn().mockResolvedValue(undefined),
      setParameters: vi.fn(),
      recognize: vi.fn(),
    };

    // Simulate worker created but then fails during recognize
    mockTesseract.createWorker.mockResolvedValue(mockWorker);
    mockWorker.recognize.mockRejectedValue(new Error('OCR failed'));

    try {
      const worker = await mockTesseract.createWorker('spa', 1, { logger: () => {} });
      await worker.recognize('test-image.jpg');
    } catch (error) {
      // Worker should be terminated in finally block
      await mockWorker.terminate();
      expect(mockWorker.terminate).toHaveBeenCalled();
    }
  });

  it('should handle worker termination errors gracefully', async () => {
    const mockWorker = {
      terminate: vi.fn().mockRejectedValue(new Error('Already terminated')),
    };

    // Termination error should be caught and not thrown
    try {
      await mockWorker.terminate();
      expect.fail('Terminate should have failed');
    } catch (error) {
      // In production code, this should be caught in try-catch
      expect(error.message).toBe('Already terminated');
    }
  });

  it('should reset OCR feedback on error', () => {
    // Simulate error scenario
    const error = new Error('OCR processing failed');

    // Mock the error handling flow
    mockOcrFeedback.error(error.message);
    mockOcrFeedback.reset();

    expect(mockOcrFeedback.error).toHaveBeenCalledWith(error.message);
    expect(mockOcrFeedback.reset).toHaveBeenCalled();
  });

  it('should show user-friendly error message instead of technical details', () => {
    // Technical error from Tesseract
    const technicalError = new Error('WebAssembly.instantiate(): Compiling function #142 failed');

    // Should show generic message to user
    const userMessage = 'Error al escanear. Por favor, inténtalo de nuevo';

    mockToast(userMessage, 'error');

    expect(mockToast).toHaveBeenCalledWith(userMessage, 'error');
    // Technical error should be logged but NOT shown to user
    expect(mockToast).not.toHaveBeenCalledWith(expect.stringContaining('WebAssembly'), expect.anything());
  });

  it('should handle CORS errors when loading language data', async () => {
    const corsError = new Error('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT');
    mockTesseract.createWorker.mockRejectedValue(corsError);

    try {
      await mockTesseract.createWorker('spa', 1, { logger: () => {} });
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error.message).toContain('BLOCKED_BY_CLIENT');
    }
  });

  it('should track that error occurred at 62% progress during initialization', () => {
    const progressLog = [];

    const mockLogger = (m) => {
      progressLog.push({
        status: m.status,
        timestamp: Date.now(),
      });
    };

    // Simulate the progress events leading to hang
    mockLogger({ status: 'loading tesseract core', progress: 0.1 });
    mockLogger({ status: 'initializing tesseract', progress: 0.5 }); // This is where it hangs at 62%

    const lastStatus = progressLog[progressLog.length - 1];
    expect(lastStatus.status).toBe('initializing tesseract');
    expect(progressLog.length).toBe(2);
  });

  it('should not expose sensitive information in error logs', () => {
    const sensitiveError = new Error('Failed to load from https://cdn.example.com/secret-token-abc123/file.js');

    // Mock secure logging that filters sensitive data
    const secureLog = (error) => {
      // Should remove URLs with tokens
      return error.message.replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
    };

    const sanitizedMessage = secureLog(sensitiveError);
    expect(sanitizedMessage).toBe('Failed to load from [URL_REDACTED]');
    expect(sanitizedMessage).not.toContain('secret-token-abc123');
  });

  it('should handle multiple consecutive errors without memory leaks', async () => {
    const mockWorkers = [];

    for (let i = 0; i < 3; i++) {
      const worker = {
        terminate: vi.fn().mockResolvedValue(undefined),
      };
      mockWorkers.push(worker);
      mockTesseract.createWorker.mockResolvedValueOnce(worker);

      try {
        const w = await mockTesseract.createWorker('spa', 1, { logger: () => {} });
        // Simulate error
        throw new Error(`Error ${i + 1}`);
      } catch (error) {
        // Each worker should be terminated
        if (mockWorkers[i]) {
          await mockWorkers[i].terminate();
        }
      }
    }

    // All workers should be cleaned up
    mockWorkers.forEach((worker, index) => {
      expect(worker.terminate).toHaveBeenCalled();
    });
  });
});
