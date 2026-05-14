import {
    DEFAULT_IN_SCOPE,
    DEFAULT_MAX_EVENTS,
    DEFAULT_MAX_FILES,
    DEFAULT_MAX_MODELS,
    DEFAULT_MAX_SESSIONS,
    DEFAULT_MAX_TURNS,
    DEFAULT_RANGE_SCOPE,
    DEFAULT_WINDOW_MINUTES,
} from './constants.js';

/**
 * @typedef {object} RangeOptionInput
 * @property {string | undefined} fromDate Absolute inclusive start value.
 * @property {number | undefined} fromMinutes Relative inclusive start minutes.
 * @property {boolean | undefined} inScope Whether only complete sessions are included.
 * @property {number | undefined} maxEvents Maximum event rows in detail tables.
 * @property {number | undefined} maxFiles Maximum session JSONL files after file scanning.
 * @property {number | undefined} maxModels Maximum model groups in generated grouped tables.
 * @property {number | undefined} maxSessions Maximum session rows in tables.
 * @property {number | undefined} maxTurns Maximum turn rows in detail tables.
 * @property {number | undefined} minutes Existing rolling window shorthand.
 * @property {boolean | undefined} minutesExplicit Whether `--minutes` was supplied by the user.
 * @property {string | undefined} rangeScope Range matching scope.
 * @property {string | undefined} toDate Absolute exclusive end value.
 * @property {number | undefined} toMinutes Relative exclusive end minutes.
 */

/**
 * @typedef {object} NormalizedRange
 * @property {Date} fromDate Inclusive start timestamp.
 * @property {Date} toDate Exclusive end timestamp.
 * @property {boolean} inScope Whether only complete sessions are included.
 * @property {number} maxEvents Maximum event rows in detail tables.
 * @property {number} maxFiles Maximum session JSONL files after file scanning.
 * @property {number} maxModels Maximum model groups in generated grouped tables.
 * @property {number} maxSessions Maximum session rows in tables.
 * @property {number} maxTurns Maximum turn rows in detail tables.
 * @property {number} minutes Window length in minutes.
 * @property {'events' | 'sessions'} scope Range matching scope.
 */

/**
 * Normalizes CLI and environment range settings for one report run.
 *
 * @param {RangeOptionInput} options Runtime options containing range settings.
 * @param {Date} now Timestamp captured for this report run.
 * @returns {NormalizedRange} Normalized range settings.
 */
export function normalizeRangeOptions(options, now) {
    const scope = normalizeScope(options.rangeScope);
    const fromDate = buildFromDate(options, now);
    const toDate = buildToDate(options, now);
    const minutes = Math.max(
        1,
        Math.round((toDate.getTime() - fromDate.getTime()) / 60000)
    );

    validateRangeBounds(fromDate, toDate);

    return {
        fromDate,
        toDate,
        inScope: Boolean(options.inScope ?? DEFAULT_IN_SCOPE),
        maxEvents: options.maxEvents ?? DEFAULT_MAX_EVENTS,
        maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES,
        maxModels: options.maxModels ?? DEFAULT_MAX_MODELS,
        maxSessions: options.maxSessions ?? DEFAULT_MAX_SESSIONS,
        maxTurns: options.maxTurns ?? DEFAULT_MAX_TURNS,
        minutes,
        scope,
    };
}

/**
 * Validates the user supplied range option combination before dates are built.
 *
 * @param {RangeOptionInput} options Runtime options containing range settings.
 * @returns {void}
 */
export function validateRangeOptionCombination(options) {
    const hasFromDate = options.fromDate !== undefined;
    const hasFromMinutes = options.fromMinutes !== undefined;
    const hasToDate = options.toDate !== undefined;
    const hasToMinutes = options.toMinutes !== undefined;
    const hasExplicitRange =
        hasFromDate || hasFromMinutes || hasToDate || hasToMinutes;

    if (hasFromDate && hasFromMinutes) {
        throw new Error(
            'Range options are invalid: use only one of --from-date or --from-minutes.'
        );
    }
    if (hasToDate && hasToMinutes) {
        throw new Error(
            'Range options are invalid: use only one of --to-date or --to-minutes.'
        );
    }
    if ((hasToDate || hasToMinutes) && !hasFromDate && !hasFromMinutes) {
        throw new Error(
            'Range options are invalid: --to-date and --to-minutes require --from-date or --from-minutes.'
        );
    }
    if (hasFromMinutes && hasToDate) {
        throw new Error(
            'Range options are invalid: --from-minutes cannot be combined with --to-date. Use --from-date with --to-date, or --from-minutes with --to-minutes.'
        );
    }
    if (options.minutesExplicit && hasExplicitRange) {
        throw new Error(
            'Range options are invalid: --minutes is shorthand and cannot be combined with --from-date, --from-minutes, --to-date, or --to-minutes.'
        );
    }
}

/**
 * Normalizes the range scope setting.
 *
 * @param {string | undefined} scope Raw scope value.
 * @returns {'events' | 'sessions'} Validated scope.
 */
function normalizeScope(scope) {
    const normalized = String(scope ?? DEFAULT_RANGE_SCOPE).trim();

    if (normalized === 'events' || normalized === 'sessions') {
        return normalized;
    }

    throw new Error('--scope must be one of: events, sessions.');
}

/**
 * Builds the inclusive range start timestamp.
 *
 * @param {RangeOptionInput} options Runtime options containing range settings.
 * @param {Date} now Timestamp captured for this report run.
 * @returns {Date} Inclusive range start.
 */
function buildFromDate(options, now) {
    if (options.fromDate !== undefined) {
        return parseDateOption('--from-date', options.fromDate, now);
    }
    if (options.fromMinutes !== undefined) {
        return subtractMinutes(now, options.fromMinutes);
    }

    return subtractMinutes(now, options.minutes ?? DEFAULT_WINDOW_MINUTES);
}

/**
 * Builds the exclusive range end timestamp.
 *
 * @param {RangeOptionInput} options Runtime options containing range settings.
 * @param {Date} now Timestamp captured for this report run.
 * @returns {Date} Exclusive range end.
 */
function buildToDate(options, now) {
    if (options.toDate !== undefined) {
        return parseDateOption('--to-date', options.toDate, now);
    }
    if (options.toMinutes !== undefined) {
        return subtractMinutes(now, options.toMinutes);
    }

    return now;
}

/**
 * Parses and validates a CLI date option.
 *
 * @param {string} optionName CLI option name for error text.
 * @param {string} value Raw date value.
 * @param {Date} now Timestamp captured for this report run.
 * @returns {Date} Parsed date.
 */
function parseDateOption(optionName, value, now) {
    const date = parseShortDate(value, now) ?? new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new Error(`${optionName} must be a valid date.`);
    }

    return date;
}

/**
 * Parses month/day values without a year using the current or prior year.
 *
 * @param {string} value Raw date value.
 * @param {Date} now Timestamp captured for this report run.
 * @returns {Date | undefined} Parsed date, or undefined for non-short dates.
 */
function parseShortDate(value, now) {
    const match = /^\s*(\d{1,2})[/-](\d{1,2})\s*$/u.exec(value);

    if (!match) {
        return undefined;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    const currentYear = now.getFullYear();
    const date = createLocalDate(currentYear, month, day);

    if (!date) {
        return new Date(Number.NaN);
    }
    if (date > startOfToday(now)) {
        return createLocalDate(currentYear - 1, month, day) ?? date;
    }

    return date;
}

/**
 * Creates a local midnight date and rejects overflowed month/day values.
 *
 * @param {number} year Full year.
 * @param {number} month One-based month number.
 * @param {number} day One-based day of month.
 * @returns {Date | undefined} Valid local date.
 */
function createLocalDate(year, month, day) {
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return undefined;
    }

    return date;
}

/**
 * Gets local midnight for the captured run date.
 *
 * @param {Date} now Timestamp captured for this report run.
 * @returns {Date} Local start of the current day.
 */
function startOfToday(now) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Subtracts minutes from a timestamp.
 *
 * @param {Date} date Base timestamp.
 * @param {number} minutes Minutes to subtract.
 * @returns {Date} Calculated timestamp.
 */
function subtractMinutes(date, minutes) {
    return new Date(date.getTime() - minutes * 60 * 1000);
}

/**
 * Validates final normalized range bounds.
 *
 * @param {Date} fromDate Inclusive start timestamp.
 * @param {Date} toDate Exclusive end timestamp.
 * @returns {void}
 */
function validateRangeBounds(fromDate, toDate) {
    if (fromDate >= toDate) {
        throw new Error(
            'Range options are invalid: the normalized from time must be earlier than the normalized to time.'
        );
    }
}
