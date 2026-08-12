import "server-only";

import { validationApiError, type ApiError } from "@/lib/api/errors";
import type { CreateStaffInput } from "./repository";
import { validateAndNormalizeStaffInput } from "./validation";

type ValidationResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export async function validateCreateStaffRequest(
  request: Request,
): Promise<ValidationResult<CreateStaffInput>> {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return {
      data: null,
      error: validationApiError({ message: "Invalid Staff request body." }),
    };
  }

  const validation = validateAndNormalizeStaffInput({
    displayName: body.displayName,
    email: body.email,
    password: body.password,
  });

  if (validation.fieldErrors) {
    return {
      data: null,
      error: validationApiError({
        message: "Check Staff account information before saving.",
        details: { fieldErrors: validation.fieldErrors },
      }),
    };
  }

  return {
    data: validation.data,
    error: null,
  };
}
