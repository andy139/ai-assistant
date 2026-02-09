export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class AuthError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "AUTH_ERROR");
    this.name = "AuthError";
  }
}

export class PlannerError extends AppError {
  constructor(
    message: string,
    public readonly rawOutput?: string,
  ) {
    super(message, 502, "PLANNER_ERROR");
    this.name = "PlannerError";
  }
}

export class ToolNotFoundError extends AppError {
  constructor(toolName: string) {
    super(`Unknown tool: ${toolName}`, 400, "TOOL_NOT_FOUND");
    this.name = "ToolNotFoundError";
  }
}

export class ConfirmationRequiredError extends AppError {
  constructor(
    public readonly actionId: string,
    public readonly toolName: string,
  ) {
    super(`Action requires confirmation: ${toolName} (ID: ${actionId})`, 202, "CONFIRMATION_REQUIRED");
    this.name = "ConfirmationRequiredError";
  }
}
