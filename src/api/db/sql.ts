const IDENTIFIER: RegExp = /^[a-z_][a-z0-9_]*$/i;

const ALLOWED_TYPES = new Set([
    "BIGINT",
    "INTEGER",
    "SMALLINT",
    "TEXT",
    "BOOLEAN",
    "UUID",
    "TIMESTAMP",
    "SERIAL",
    "INT",
    // CUSTOM TYPES:
    "CASE_STATUS",
]);

const VARCHAR_REGEX = /^VARCHAR\(\d+\)$/i;

export const ALLOWED_ENUMS = new Map([
    ["case_status", new Set(["open", "closed", "sealed", "appeal", "duty_court"])],
]);

const CASE_CODE_COLUMNS = new Set([
  "civil",
  "criminal",
  "expungement",
  "special",
  "appeal",
  "admin",
  "duty_court"
]);

/**
 * Asserts that a value is a valid identifier.
 * 
 * @param value The value to check
 */
export function assert_identifier(value: string) {
    if (!IDENTIFIER.test(value)) throw new Error("NonIdentifier");
}

/**
 * Asserts that a type is valid.
 * 
 * @param value The value to check
 */
export function assert_allowed_type(value: string) {
    const base_type = value.trim().split(/\s+/)[0].toUpperCase();
    if (ALLOWED_TYPES.has(base_type)) return;
    if (VARCHAR_REGEX.test(base_type)) return;
    throw new Error(`InvalidType: ${base_type}`);
}

/**
 * Builds an update query.
 * 
 * @param table The table to update
 * @param column The column to update
 * @param placeholder The placeholder value
 * @returns A string of the query
 */
export function build_update(table: string, column: string, placeholder: string = "$1"): string {
    assert_identifier(table);
    assert_identifier(column);
    return `UPDATE ${table} SET ${column} = ${placeholder}`;
}

/**
 * Asserts that something is a valid case code
 * 
 * @param value The value to check
 */
export function assert_allowed_case_codes(value: string) {
    if (!CASE_CODE_COLUMNS.has(value)) throw new Error("InvalidCaseCode");
}