import { decodeFromAbi, EventSelector } from '@aztec/aztec.js';
import type { EventMetadataDefinition } from '@aztec/stdlib/interfaces/client';
import type { ExtendedPublicLog } from '@aztec/stdlib/logs';

export async function decodePublicAztecEvents<T>(
  eventMetadataDef: EventMetadataDefinition,
  logs: ExtendedPublicLog[],
): Promise<T[]> {
  const decodedEvents = logs
    .map((log) => {
      // +1 for the event selector
      const expectedLength = eventMetadataDef.fieldNames.length + 1;
      if (log.log.emittedLength !== expectedLength) {
        throw new Error(
          `Something is weird here, we have matching EventSelectors, but the actual payload has mismatched length. Expected ${expectedLength}. Got ${log.log.emittedLength}.`,
        );
      }

      const logFields = log.log.getEmittedFields();
      // We are assuming here that event logs are the last 4 bytes of the event. This is not enshrined but is a function of aztec.nr raw log emission.
      const lastField = logFields[logFields.length - 1];
      if (!lastField || !EventSelector.fromField(lastField).equals(eventMetadataDef.eventSelector)) {
        return undefined;
      }
      return decodeFromAbi([eventMetadataDef.abiType], log.log.fields) as T;
    })
    .filter((log) => log !== undefined) as T[];

  return decodedEvents;
}
