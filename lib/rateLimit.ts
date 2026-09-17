/**
 * Rate Limiting System for API calls
 * Prevents abuse and controls costs
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed for a given key (e.g., user ID, session ID)
   */
  checkLimit(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    // If no entry exists or window has expired, create new entry
    if (!entry || now >= entry.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetIn: this.config.windowMs,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: entry.resetTime - now,
      };
    }

    // Increment count
    entry.count++;

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetIn: entry.resetTime - now,
    };
  }

  /**
   * Reset limits for a specific key
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Clear all limits
   */
  clearAll(): void {
    this.limits.clear();
  }

  /**
   * Get current usage for a key
   */
  getUsage(key: string): { count: number; limit: number; resetTime: number } | null {
    const entry = this.limits.get(key);
    if (!entry) return null;

    return {
      count: entry.count,
      limit: this.config.maxRequests,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Clean up expired entries (run periodically to free memory)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// Rate limiters for different services
export const geminiTextRateLimiter = new RateLimiter({
  maxRequests: 20, // 20 requests
  windowMs: 60 * 1000, // per minute
  message: 'Has alcanzado el límite de consultas de texto. Por favor espera un momento.',
});

export const geminiVoiceRateLimiter = new RateLimiter({
  maxRequests: 10, // 10 voice sessions
  windowMs: 60 * 1000, // per minute
  message: 'Has alcanzado el límite de consultas de voz. Por favor espera un momento.',
});

export const geminiPairingRateLimiter = new RateLimiter({
  maxRequests: 30, // 30 pairing requests
  windowMs: 60 * 1000, // per minute
  message: 'Has alcanzado el límite de sugerencias de maridaje. Por favor espera un momento.',
});

// Cleanup expired entries every 5 minutes
setInterval(() => {
  geminiTextRateLimiter.cleanup();
  geminiVoiceRateLimiter.cleanup();
  geminiPairingRateLimiter.cleanup();
}, 5 * 60 * 1000);

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    } else {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * Format time remaining in human-readable format
 */
export function formatTimeRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000);

  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
}

/**
 * Get a unique key for rate limiting (session-based or user-based)
 */
export function getRateLimitKey(participantId?: string | null): string {
  if (participantId) {
    return `user:${participantId}`;
  }

  // Use session storage for anonymous users
  let sessionId = sessionStorage.getItem('rate_limit_session');
  if (!sessionId) {
    sessionId = `session:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('rate_limit_session', sessionId);
  }

  return sessionId;
}
