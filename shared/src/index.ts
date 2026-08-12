/**
 * @at/shared — code shared by the web portal, the mobile apps and any edge
 * function.
 *
 *  types       domain types + generated Supabase database types
 *  validation  Zod schemas used on both client and server
 *  permissions the role/permission matrix
 */
export * from './types/index';
export * from './types/database';
export * from './validation/index';
export * from './permissions';
