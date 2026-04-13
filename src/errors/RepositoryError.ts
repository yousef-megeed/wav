// Error type thrown by repository implementations for data access failures.
import { AppError } from "./AppError";

export class RepositoryError extends AppError {
  public constructor(
    message: string,
    context?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(message, "REPOSITORY_ERROR", context, cause);
    this.name = "RepositoryError";
  }
}
