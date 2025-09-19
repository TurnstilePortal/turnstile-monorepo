import { contractArtifactToBuffer } from '@aztec/stdlib/abi';
import {
  PortalContractArtifact,
  ShieldGatewayContractArtifact,
  TokenContractArtifact,
} from '@turnstile-portal/aztec-artifacts';
import { describe, expect, it } from 'vitest';
import { stripArtifact } from '../strip-artifact.js';

const ARTIFACT_FIXTURES = [
  ['Token', TokenContractArtifact],
  ['ShieldGateway', ShieldGatewayContractArtifact],
  ['Portal', PortalContractArtifact],
] as const;

describe('stripArtifact', () => {
  it.each(ARTIFACT_FIXTURES)('removes debug data from %s artifacts', (_, artifact) => {
    const sanitized = stripArtifact(artifact);

    expect(Object.keys(sanitized.fileMap)).toHaveLength(0);
    expect(sanitized.functions.every((fn) => fn.debugSymbols === '')).toBe(true);
    expect(sanitized.functions.every((fn) => !('debug' in fn))).toBe(true);

    expect(Object.keys(artifact.fileMap).length).toBeGreaterThan(0);
    expect(artifact.functions.some((fn) => fn.debugSymbols.length > 0)).toBe(true);

    expect(() => contractArtifactToBuffer(sanitized)).not.toThrow();

    const serialized = JSON.parse(contractArtifactToBuffer(sanitized).toString('utf-8')) as {
      fileMap?: Record<string, unknown>;
      functions: Array<Record<string, unknown>>;
    };

    expect(serialized.fileMap ?? {}).toEqual({});
    expect(serialized.functions.every((fn) => fn.debugSymbols === '')).toBe(true);
  });

  it('does not mutate original artifacts', () => {
    const copyBefore = {
      fileMapEntries: Object.keys(TokenContractArtifact.fileMap).length,
      debugSymbols: TokenContractArtifact.functions.map((fn) => fn.debugSymbols.length),
    };

    const sanitized = stripArtifact(TokenContractArtifact);

    expect(TokenContractArtifact.functions.map((fn) => fn.debugSymbols.length)).toEqual(copyBefore.debugSymbols);
    expect(Object.keys(TokenContractArtifact.fileMap)).toHaveLength(copyBefore.fileMapEntries);

    expect(sanitized).not.toBe(TokenContractArtifact);
    expect(sanitized.functions).not.toBe(TokenContractArtifact.functions);
    expect(sanitized.functions.map((fn) => fn.debugSymbols.length)).not.toEqual(copyBefore.debugSymbols);
  });
});
