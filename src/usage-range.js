/**
 * Applies normalized range settings to parsed usage rows.
 *
 * @param {object[]} rows Parsed usage rows.
 * @param {{ fromDate: Date, toDate: Date, inScope: boolean, scope: string }} range Normalized range.
 * @returns {{ rows: object[], excludedSessionsWithoutTimestamps: number }} Filtered rows and diagnostics.
 */
export function filterUsageRowsByRange(rows, range) {
    const sessionRanges = buildSessionRanges(rows);
    const inRangeSessionKeys = selectSessionKeys(sessionRanges, range);
    const filteredRows =
        range.scope === 'sessions'
            ? rows.filter((row) => inRangeSessionKeys.has(sessionKey(row)))
            : rows.filter(
                  (row) =>
                      isTimestampInRange(row.timestamp, range) &&
                      inRangeSessionKeys.has(sessionKey(row))
              );

    return {
        rows: filteredRows,
        excludedSessionsWithoutTimestamps: 0,
    };
}

/**
 * Builds the timestamp range for each parsed session.
 *
 * @param {object[]} rows Parsed usage rows.
 * @returns {Map<string, { start: Date, end: Date }>} Session timestamp ranges.
 */
function buildSessionRanges(rows) {
    /** @type {Map<string, { start: Date, end: Date }>} */
    const ranges = new Map();

    for (const row of rows) {
        const timestamp = new Date(String(row.timestamp ?? ''));

        if (Number.isNaN(timestamp.getTime())) {
            continue;
        }

        const key = sessionKey(row);
        const range = ranges.get(key);

        if (!range) {
            ranges.set(key, { start: timestamp, end: timestamp });
            continue;
        }

        if (timestamp < range.start) {
            range.start = timestamp;
        }
        if (timestamp > range.end) {
            range.end = timestamp;
        }
    }

    return ranges;
}

/**
 * Selects sessions allowed by scope and completeness settings.
 *
 * @param {Map<string, { start: Date, end: Date }>} sessionRanges Session timestamp ranges.
 * @param {{ fromDate: Date, toDate: Date, inScope: boolean, scope: string }} range Normalized range.
 * @returns {Set<string>} Included session keys.
 */
function selectSessionKeys(sessionRanges, range) {
    /** @type {Set<string>} */
    const keys = new Set();

    for (const [key, sessionRange] of sessionRanges.entries()) {
        if (range.inScope) {
            if (isSessionContained(sessionRange, range)) {
                keys.add(key);
            }
            continue;
        }

        if (range.scope === 'sessions') {
            if (doesSessionIntersect(sessionRange, range)) {
                keys.add(key);
            }
            continue;
        }

        keys.add(key);
    }

    return keys;
}

/**
 * Checks whether a session is fully contained in the selected range.
 *
 * @param {{ start: Date, end: Date }} sessionRange Session timestamp range.
 * @param {{ fromDate: Date, toDate: Date }} range Normalized range.
 * @returns {boolean} True when the complete session is inside the range.
 */
function isSessionContained(sessionRange, range) {
    return (
        sessionRange.start >= range.fromDate && sessionRange.end < range.toDate
    );
}

/**
 * Checks whether a session overlaps the selected range.
 *
 * @param {{ start: Date, end: Date }} sessionRange Session timestamp range.
 * @param {{ fromDate: Date, toDate: Date }} range Normalized range.
 * @returns {boolean} True when the session overlaps the range.
 */
function doesSessionIntersect(sessionRange, range) {
    return (
        sessionRange.start < range.toDate && sessionRange.end >= range.fromDate
    );
}

/**
 * Checks whether an event timestamp is in the selected range.
 *
 * @param {unknown} value Timestamp value.
 * @param {{ fromDate: Date, toDate: Date }} range Normalized range.
 * @returns {boolean} True when the timestamp is inside the range.
 */
function isTimestampInRange(value, range) {
    const timestamp = new Date(String(value ?? ''));

    return (
        !Number.isNaN(timestamp.getTime()) &&
        timestamp >= range.fromDate &&
        timestamp < range.toDate
    );
}

/**
 * Builds the grouping key used to identify one session before normalization.
 *
 * @param {object} row Parsed usage row.
 * @returns {string} Session key.
 */
function sessionKey(row) {
    return String(row.file ?? '');
}
