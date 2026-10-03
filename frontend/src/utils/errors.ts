import { ERROR_CODES } from "../constants/errorCodes";
import { ERROR_MESSAGES } from "../constants/errorMessages";

export type ErrorCode = keyof typeof ERROR_CODES;

// Service-level wrapped error. Controllers wrap again when they translate it
// for the UI; nothing is swallowed in one global place.
export class ServiceError extends Error {
  readonly code: ErrorCode;
  readonly cause?: unknown;

  constructor(code: ErrorCode, cause?: unknown, message?: string) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "ServiceError";
    this.code = code;
    this.cause = cause;
  }
}

export function isServiceError(value: unknown): value is ServiceError {
  return value instanceof ServiceError;
}
