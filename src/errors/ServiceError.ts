// Error type thrown by services for business logic violations.
import { AppError } from "./AppError";

export class ServiceError extends AppError {
  public constructor(
    message: string,
    context?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(message, "SERVICE_ERROR", context, cause);
    this.name = "ServiceError";
  }
}
