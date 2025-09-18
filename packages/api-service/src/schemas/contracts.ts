import { z } from 'zod';

// Contract Instance Schema
export const contractInstanceSchema = z.object({
  id: z.number().optional(),
  address: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  original_contract_class_id: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .nullable(),
  current_contract_class_id: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .nullable(),
  initialization_hash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .nullable(),
  deployment_params: z.any().nullable(),
  version: z.number(),
  artifact_hash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
  artifact: z.any().optional(),
  contract_class_id: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
});

// Contract Artifact Schema
export const contractArtifactSchema = z.object({
  id: z.number().optional(),
  artifact_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  artifact: z.any(),
  contract_class_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

// Query Parameters
export const contractQueryParamsSchema = z.object({
  includeArtifact: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

// For OpenAPI documentation (without transforms)
export const contractQueryParamsJsonSchema = z.object({
  includeArtifact: z.string().optional().describe('Include artifact data in the response (true/false)'),
});

// Response schemas
export const contractInstancesResponseSchema = z.object({
  data: z.array(z.string().regex(/^0x[a-fA-F0-9]{64}$/)),
});

// Path Parameters
export const contractAddressParamsSchema = z.object({
  address: z.string(),
});

export const contractArtifactParamsSchema = z.object({
  identifier: z.string(), // Can be contractClassId or artifactHash
});

export const contractClassIdParamsSchema = z.object({
  contractClassId: z.string(),
});

// Export types
export type ContractInstance = z.infer<typeof contractInstanceSchema>;
export type ContractArtifact = z.infer<typeof contractArtifactSchema>;
export type ContractQueryParams = z.infer<typeof contractQueryParamsSchema>;
export type ContractInstancesResponse = z.infer<typeof contractInstancesResponseSchema>;
export type ContractAddressParams = z.infer<typeof contractAddressParamsSchema>;
export type ContractArtifactParams = z.infer<typeof contractArtifactParamsSchema>;
export type ContractClassIdParams = z.infer<typeof contractClassIdParamsSchema>;
