import type { ContractArtifact, FunctionArtifact } from '@aztec/stdlib/abi';
import { logger } from './utils/logger.js';

type ContractArtifactWithLegacyFileMap = ContractArtifact & { file_map?: Record<string, unknown> };

function stripFunctionDebugData(fn: FunctionArtifact): FunctionArtifact {
  const { debug: _debug, debugSymbols: _debugSymbols, ...rest } = fn;
  return {
    ...rest,
    debugSymbols: '',
  };
}

export function stripArtifact(artifact: ContractArtifact): ContractArtifact {
  const { fileMap: _ignoredFileMap, functions, ...rest } = artifact as ContractArtifactWithLegacyFileMap;

  const hasFileMap = Boolean(_ignoredFileMap && Object.keys(_ignoredFileMap).length > 0);
  const hasLegacyFileMap = 'file_map' in artifact && Boolean((artifact as ContractArtifactWithLegacyFileMap).file_map);
  const functionsWithDebugSymbols = functions.filter((fn) => fn.debugSymbols && fn.debugSymbols.length > 0).length;
  const functionsWithDebugSection = functions.filter((fn) => 'debug' in fn).length;

  logger.debug(
    {
      contractName: (artifact as { name?: string }).name,
      totalFunctions: functions.length,
      functionsWithDebugSymbols,
      functionsWithDebugSection,
      hasFileMap,
      hasLegacyFileMap,
    },
    'Stripping contract artifact debug metadata',
  );

  const sanitized: ContractArtifactWithLegacyFileMap = {
    ...rest,
    functions: functions.map(stripFunctionDebugData),
    fileMap: {},
  };

  if ('file_map' in artifact) {
    delete (sanitized as unknown as Record<string, unknown>).file_map;
  }

  logger.debug(
    {
      contractName: (artifact as { name?: string }).name,
      totalFunctions: sanitized.functions.length,
    },
    'Contract artifact debug metadata stripped',
  );

  return sanitized;
}
