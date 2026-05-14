import { TOKEN_FIELDS } from './constants.js';

const DEFAULT_TEXT_DATETIME_FORMAT = 'MMM D, h:mm AP';
const COLUMNS = [
    'timestamp',
    'model',
    'intelligence_level',
    'observed_token_volume',
    ...TOKEN_FIELDS,
];
/** @type {Record<string, string>} */
const FIELD_LABELS = {
    observed_token_volume: 'Total Tokens',
};

/**
 * Renders the text usage report.
 *
 * @param {object} report Structured usage report.
 * @param {{ datetimeFormat?: string }} [options] Text rendering options.
 * @returns {string} Terminal report text.
 */
export function renderTextReport(report, options = {}) {
    const datetimeFormat =
        options.datetimeFormat || DEFAULT_TEXT_DATETIME_FORMAT;
    /** @type {string[]} */
    const lines = [
        `Codex token usage from ${formatDatetime(report.window.cutoff, datetimeFormat)} to ${formatDatetime(report.window.now, datetimeFormat)}`,
        '',
        ...formatSummary(report),
        '',
        ...formatQuota(report.quota, datetimeFormat),
    ];

    if (report.insights.length > 0) {
        lines.push('', 'Insights');
        for (const insight of report.insights) {
            lines.push(`${insight.severity}: ${insight.message}`);
        }
    }

    if (report.rows.length === 0) {
        lines.push('', 'No token usage events found in the selected window.');
    } else {
        lines.push('', formatTable(report.rows, datetimeFormat));
    }

    return `${lines.join('\n')}\n`;
}

/**
 * Formats account quota details for terminal output.
 *
 * @param {object} quota Normalized quota report.
 * @param {string} datetimeFormat Date and time display pattern.
 * @returns {string[]} Quota lines.
 */
function formatQuota(quota, datetimeFormat) {
    if (!quota?.available) {
        return [
            'Quota',
            'Available: false',
            ...(quota?.warnings ?? []).map((warning) => `Warning: ${warning}`),
        ];
    }

    /** @type {string[]} */
    const lines = [
        'Quota',
        `Captured At: ${formatDatetime(quota.captured_at, datetimeFormat)}`,
        `Session: ${quota.session_id}`,
    ];

    for (const limit of quota.limits ?? []) {
        const resetLabel = limit.resets_at_local
            ? `, resets ${limit.resets_at_local}`
            : '';
        lines.push(
            `${displayLabel(String(limit.name ?? 'limit'))}: ${formatPercentValue(limit.remaining_percent)} remaining (${formatPercentValue(limit.used_percent)} used${resetLabel})`
        );
    }

    const credits = formatCredits(quota.credits);
    if (credits) {
        lines.push(credits);
    }

    return lines;
}

/**
 * Formats quota credit information.
 *
 * @param {object | undefined} credits Normalized credits data.
 * @returns {string} Credit line or empty string.
 */
function formatCredits(credits) {
    if (!credits?.has_credits) {
        return '';
    }
    if (credits.unlimited) {
        return 'Credits: unlimited';
    }
    if (credits.balance) {
        return `Credits: ${credits.balance}`;
    }
    return 'Credits: available';
}

/**
 * Formats summary totals using the same groups, labels, order, and values as
 * the HTML Summary cards.
 *
 * @param {object} report Structured usage report.
 * @returns {string[]} Summary lines.
 */
function formatSummary(report) {
    return [
        'Summary',
        'Input',
        `Input Tokens: ${formatInteger(report.totals.input_tokens)}`,
        `Cached Input Tokens: ${formatInteger(report.totals.cached_input_tokens)}`,
        `Effective Input Tokens: ${formatInteger(report.totals.effective_input_tokens)}`,
        `Cache Hit Rate: ${formatPercent(report.totals.cache_hit_rate)}`,
        '',
        'Output',
        `Output Tokens: ${formatInteger(report.totals.output_tokens)}`,
        `Reasoning Output Tokens: ${formatInteger(report.totals.reasoning_output_tokens)}`,
        '',
        'Totals',
        `Total Tokens: ${formatInteger(report.totals.observed_token_volume)}`,
        `Sessions: ${formatInteger(report.sessions.length)}`,
        `Events: ${formatInteger(report.rows.length)}`,
    ];
}

/**
 * Formats usage rows as a fixed-width terminal table.
 *
 * @param {object[]} rows Usage rows.
 * @param {string} datetimeFormat Date and time display pattern.
 * @returns {string} Table text.
 */
function formatTable(rows, datetimeFormat) {
    const widths = columnWidths(rows, datetimeFormat);
    const header = COLUMNS.map((column) =>
        pad(displayLabel(column), widths[column])
    ).join('  ');
    const ruler = COLUMNS.map((column) => '-'.repeat(widths[column])).join(
        '  '
    );
    const body = rows.map((row) =>
        COLUMNS.map((column) =>
            pad(formatCellValue(row, column, datetimeFormat), widths[column])
        ).join('  ')
    );

    return [header, ruler, ...body].join('\n');
}

/**
 * Computes column widths for the report table.
 *
 * @param {object[]} rows Usage rows.
 * @param {string} datetimeFormat Date and time display pattern.
 * @returns {Record<string, number>} Width by column name.
 */
function columnWidths(rows, datetimeFormat) {
    /** @type {Record<string, number>} */
    const widths = Object.fromEntries(
        COLUMNS.map((column) => [column, displayLabel(column).length])
    );

    for (const row of rows) {
        for (const column of COLUMNS) {
            widths[column] = Math.max(
                widths[column],
                formatCellValue(row, column, datetimeFormat).length
            );
        }
    }

    return widths;
}

/**
 * Formats one table cell for terminal display.
 *
 * @param {object} row Usage row.
 * @param {string} column Field key.
 * @param {string} datetimeFormat Date and time display pattern.
 * @returns {string} Display value.
 */
function formatCellValue(row, column, datetimeFormat) {
    const value = row[column];

    if (column === 'timestamp') {
        return formatDatetime(value, datetimeFormat);
    }

    return String(value ?? '');
}

/**
 * Pads a cell for table output.
 *
 * @param {string} value Cell value.
 * @param {number} width Target cell width.
 * @returns {string} Padded cell value.
 */
function pad(value, width) {
    return value.padEnd(width, ' ');
}

/**
 * Formats an integer for display.
 *
 * @param {number} value Value to format.
 * @returns {string} Formatted integer.
 */
function formatInteger(value) {
    return Math.round(Number(value ?? 0)).toLocaleString('en-US');
}

/**
 * Formats a rate as a percent.
 *
 * @param {number} value Rate to format.
 * @returns {string} Formatted percent.
 */
function formatPercent(value) {
    return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

/**
 * Formats an already-percent value.
 *
 * @param {number} value Percent value.
 * @returns {string} Formatted percent.
 */
function formatPercentValue(value) {
    return `${Number(value ?? 0).toFixed(1)}%`;
}

/**
 * Converts report field keys to user-facing text labels.
 *
 * @param {string} field Report field key.
 * @returns {string} Display label.
 */
function displayLabel(field) {
    return (
        FIELD_LABELS[field] ??
        field
            .split(/[_ ]/u)
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
    );
}

/**
 * Formats a timestamp-like value with the configured display mask.
 *
 * @param {unknown} value Timestamp value.
 * @param {string} datetimeFormat Date and time display pattern.
 * @returns {string} Formatted display value.
 */
function formatDatetime(value, datetimeFormat) {
    const date = value instanceof Date ? value : new Date(String(value ?? ''));

    if (Number.isNaN(date.getTime())) {
        return String(value ?? '');
    }

    const monthShort = new Intl.DateTimeFormat(undefined, {
        month: 'short',
    }).format(date);
    const day = String(date.getDate());
    const hour24 = date.getHours();
    const hour12 = String(hour24 % 12 || 12);
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    const meridiem = hour24 < 12 ? 'AM' : 'PM';

    /** @type {Record<string, string>} */
    const tokens = {
        MMM: monthShort,
        DD: day.padStart(2, '0'),
        D: day,
        HH: String(hour24).padStart(2, '0'),
        H: String(hour24),
        hh: hour12.padStart(2, '0'),
        h: hour12,
        mm: minute,
        ss: second,
        AP: meridiem,
        A: meridiem,
        a: meridiem.toLowerCase(),
    };

    return datetimeFormat.replace(
        /MMM|DD|D|HH|H|hh|h|mm|ss|AP|A|a/gu,
        (token) => tokens[token] ?? token
    );
}
