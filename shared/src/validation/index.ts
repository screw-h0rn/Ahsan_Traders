/**
 * Shared Zod validation schemas.
 *
 * These are imported by both the client (form validation) and the server
 * (edge functions / API route handlers) so validation rules live in one place.
 */
import { z } from 'zod';

/** A non-empty, trimmed display name. */
export const nameSchema = z.string().trim().min(1, 'Required').max(200);

/** Email used for auth and contact. */
export const emailSchema = z.string().trim().email('Enter a valid email');

/** Loose phone schema — distributors in this market use varied formats. */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(20);

/** A monetary amount stored as a number; non-negative by default. */
export const moneySchema = z.number().finite().nonnegative();

/** UUID identifier as used by Supabase/Postgres. */
export const uuidSchema = z.string().uuid();

export const addressSchema = z
  .string()
  .trim()
  .max(500, 'Address cannot exceed 500 characters')
  .refine(
  (value) => value === '' || /\p{L}/u.test(value),
  {
    message: 'Address must contain at least one letter',
  },
)

export const phoneNumberSchema = z
  .string()
  .trim()
  .refine((value) => {
    // Allow empty string here if the field is optional
    if (value === '') return true;

    // Only allow digits, spaces, parentheses, hyphens and a leading +
    if (!/^\+?[\d\s()-]+$/.test(value)) {
      return false;
    }

    // Remove formatting characters except +
    const normalized = value.replace(/[\s()-]/g, '');

    // Pakistani mobile:
    // 03XXXXXXXXX
    if (/^03\d{9}$/.test(normalized)) {
      return true;
    }

    // Pakistani mobile:
    // 923XXXXXXXXX
    if (/^923\d{9}$/.test(normalized)) {
      return true;
    }

    // Pakistani mobile:
    // +923XXXXXXXXX
    if (/^\+923\d{9}$/.test(normalized)) {
      return true;
    }

    // Pakistani landline
    // Starts with 0 and has 10–12 digits total.
    // This intentionally stays a little flexible until exact specs are decided.
    if (/^0\d{9,11}$/.test(normalized)) {
      return true;
    }

    return false;
  }, {
    message: 'Enter a valid Pakistani phone number',
  });

export { z };

/**
 * Pass an optional value to a Postgres function.
 *
 * `supabase gen types` marks a parameter as required and non-nullable whenever
 * it has no SQL DEFAULT — but Postgres happily accepts NULL for all of these
 * (a null note, a null date, "no filter"). This makes that explicit at the call
 * site instead of scattering casts:
 *
 *   p_notes: optionalArg(notes)
 */
export function optionalArg<T>(value: T | null | undefined): T {
  return (value ?? null) as T;
}
