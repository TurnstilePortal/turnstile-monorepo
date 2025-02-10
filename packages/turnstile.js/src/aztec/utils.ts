/**
 * Converts a `FieldCompressedString` value returned from a contract to a string.
 *
 * This helper function takes a `bigint` value, typically returned from a contract's
 * `FieldCompressedString`, and converts it to a human-readable string.
 *
 * @param {bigint} value - The `FieldCompressedString` value to convert.
 * @returns {string} - The decoded string.
 *
 * @example
 * const ret = await token.methods.get_symbol_public().simulate();
 * const symbol = fieldCompressedStringToString(ret.value);
 */
export function fieldCompressedStringToString(value: bigint) {
  const buffer = Buffer.from(value.toString(16), 'hex');
  const nonZero = new Uint8Array(buffer.filter((byte) => byte !== 0));
  return new TextDecoder().decode(nonZero);
}
