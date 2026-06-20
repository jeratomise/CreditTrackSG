import { z } from "zod";

// Request-body schemas. Identity fields (userId/email) are intentionally absent —
// the server always derives those from the verified JWT, never from the body.

export const checkoutSchema = z.object({
  billingCycle: z.enum(["monthly", "annual"]).optional(),
});

export const scheduleReminderSchema = z.object({
  cardName: z.string().min(1).max(200),
  bankName: z.string().max(200).optional().default(""),
  amount: z.coerce.number().finite().nonnegative(),
  dueDate: z.string().min(1),
  billId: z.string().min(1),
});

export const cancelReminderSchema = z.object({
  reminderEmailId: z.string().min(1).max(200),
});

export const referralTrackSchema = z.object({
  referralCode: z.string().min(1).max(64),
});

export const extractBillSchema = z.object({
  filePath: z.string().min(1).max(512),
});

export const insightsSchema = z.object({
  transactions: z.array(z.unknown()).max(2000),
});

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Safe-parse a body against a schema, returning a flat error string on failure. */
export function validate<S extends z.ZodTypeAny>(schema: S, body: unknown): ValidationResult<z.infer<S>> {
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error.issues.map((i) => i.message).join("; ") || "Invalid request body" };
}
