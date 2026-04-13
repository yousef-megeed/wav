// Base application error with optional code and context metadata.
export class AppError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  public constructor(
    message: string,
    code = "APP_ERROR",
    context?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.context = context;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
