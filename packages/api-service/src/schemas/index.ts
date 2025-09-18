import { z } from 'zod';

// Health schemas
export const healthResponseSchema = z.object({
  status: z.enum(['healthy']),
});

export const readyResponseSchema = z.object({
  status: z.enum(['ready']),
});

export const unavailableResponseSchema = z.object({
  status: z.enum(['unavailable']),
  error: z.string(),
});

// Token schemas
export const tokenSchema = z.object({
  id: z.number().optional(),
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  decimals: z.number().nullable(),
  l1_address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  l2_address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  l1_allow_list_status: z.enum(['PROPOSED', 'ACCEPTED', 'REJECTED']).nullable().optional(),
  l1_allow_list_proposal_tx: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .nullable()
    .optional(),
  l1_allow_list_proposer: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .nullable()
    .optional(),
  l1_allow_list_approver: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .nullable()
    .optional(),
  l1_allow_list_resolution_tx: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .nullable()
    .optional(),
  l1_registration_submitter: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .nullable()
    .optional(),
  l1_registration_block: z.number().nullable().optional(),
  l2_registration_available_block: z.number().nullable().optional(),
  l2_registration_block: z.number().nullable().optional(),
  l2_registration_submitter: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .nullable()
    .optional(),
  l2_registration_fee_payer: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .nullable()
    .optional(),
  l1_registration_tx: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .nullable()
    .optional(),
  l2_registration_tx: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .nullable()
    .optional(),
  l2_registration_tx_index: z.number().nullable().optional(),
  l2_registration_log_index: z.number().nullable().optional(),
});

// For runtime validation with transforms
export const paginationParamsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 100;
      const num = Number.parseInt(val, 10);
      return Math.min(Math.max(1, num), 1000);
    }),
  cursor: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 0;
      return Number.parseInt(val, 10);
    }),
});

// For OpenAPI documentation (without transforms)
export const paginationParamsJsonSchema = z.object({
  limit: z.string().optional().describe('Maximum number of items to return (1-1000)'),
  cursor: z.string().optional().describe('Cursor for pagination'),
});

export const paginationResponseSchema = z.object({
  limit: z.number(),
  cursor: z.number().optional(),
  nextCursor: z.number().optional(),
  hasMore: z.boolean(),
});

export const paginatedTokenResponseSchema = z.object({
  data: z.array(tokenSchema),
  pagination: paginationResponseSchema,
});

export const errorResponseSchema = z.object({
  error: z.string(),
});

export const tokenAddressParamsSchema = z.object({
  address: z.string(),
});

// Contract schemas exports
export {
  type ContractAddressParams,
  type ContractArtifact,
  type ContractArtifactParams,
  type ContractClassIdParams,
  type ContractClassInstanceMatch,
  type ContractClassInstancesQueryParams,
  type ContractInstance,
  type ContractInstancesResponse,
  type ContractQueryParams,
  contractAddressParamsSchema,
  contractArtifactParamsSchema,
  contractArtifactSchema,
  contractClassIdParamsSchema,
  contractClassInstanceMatchSchema,
  contractClassInstancesQueryParamsJsonSchema,
  contractClassInstancesQueryParamsSchema,
  contractInstanceSchema,
  contractInstancesResponseSchema,
  contractQueryParamsJsonSchema,
  contractQueryParamsSchema,
} from './contracts.js';

// Export types
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadyResponse = z.infer<typeof readyResponseSchema>;
export type UnavailableResponse = z.infer<typeof unavailableResponseSchema>;
export type Token = z.infer<typeof tokenSchema>;
export type PaginationParams = z.infer<typeof paginationParamsSchema>;
export type PaginationResponse = z.infer<typeof paginationResponseSchema>;
export type PaginatedTokenResponse = z.infer<typeof paginatedTokenResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type TokenAddressParams = z.infer<typeof tokenAddressParamsSchema>;

// Convert Zod schemas to JSON Schema for OpenAPI
export function zodToJsonSchema(schema: z.ZodSchema, options?: Parameters<typeof z.toJSONSchema>[1]) {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    ...options,
  });
}
