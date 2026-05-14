const DEFAULT_TEXT_DATETIME_FORMAT = 'MMM D, h:mm AP';
const COLUMNS = [
    'timestamp',
    'session_id',
    'seconds_since_previous',
    'input_tokens',
    'cached_input_tokens',
    'effective_input_tokens',
    'cache_hit_rate',
    'output_tokens',
    'reasoning_output_tokens',
    'observed_token_volume',
];
/** @type {Record<string, string>} */
const FIELD_LABELS = {
    observed_token_volume: 'Total Tokens',
    session_id: 'Event',
};
const INTEGER_FIELDS = new Set([
    'input_tokens',
    'cached_input_tokens',
    'effective_input_tokens',
    'output_tokens',
    'reasoning_output_tokens',
    'observed_token_volume',
]);
const RIGHT_ALIGNED_FIELDS = new Set([
    'session_id',
    'seconds_since_previous',
    ...INTEGER_FIELDS,
    'cache_hit_rate',
]);

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
        lines.push('', formatSessionTables(report.rows, datetimeFormat));
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
 * Formats usage rows as fixed-width tables grouped by source session file.
 *
 * @param {object[]} rows Usage rows.
 * @param {string} datetimeFormat Date and time display pattern.
 * @returns {string} Grouped session table text.
 */
function formatSessionTables(rows, datetimeFormat) {
    return groupRowsBySessionFile(rows)
        .map(
            (sessionRows) =>
                `Session: ${String(sessionRows[0]?.file ?? '')}\n${formatTable(sessionRows, datetimeFormat)}`
        )
        .join('\n\n');
}

/**
 * Formats one session's usage rows as a fixed-width terminal table.
 *
 * @param {object[]} rows Usage rows for one session file.
 * @param {string} datetimeFormat Date and time display pattern.
 * @returns {string} Session table text.
 */
function formatTable(rows, datetimeFormat) {
    const totalsRow = buildTotalsRow(rows);
    const tableRows = [...rows, totalsRow];
    const widths = columnWidths(tableRows, datetimeFormat);
    const header = COLUMNS.map((column) =>
        padCell(displayLabel(column), widths[column], column)
    ).join('  ');
    const ruler = COLUMNS.map((column) => '-'.repeat(widths[column])).join(
        '  '
    );
    const body = tableRows.map((row) =>
        COLUMNS.map((column) =>
            padCell(
                formatCellValue(row, column, datetimeFormat),
                widths[column],
                column
            )
        ).join('  ')
    );

    return [header, ruler, ...body].join('\n');
}

/**
 * Groups rows by source session file and sorts each group by timestamp.
 *
 * @param {object[]} rows Usage rows.
 * @returns {object[][]} Rows grouped by source session file.
 */
function groupRowsBySessionFile(rows) {
    /** @type {Map<string, object[]>} */
    const groups = new Map();

    for (const row of rows) {
        const file = String(row.file ?? '');
        const group = groups.get(file) ?? [];
        group.push(row);
        groups.set(file, group);
    }

    return [...groups.values()]
        .map((group) =>
            [...group].sort((first, second) =>
                String(first.timestamp ?? '').localeCompare(
                    String(second.timestamp ?? '')
                )
            )
        )
        .sort((first, second) =>
            String(first[0]?.timestamp ?? '').localeCompare(
                String(second[0]?.timestamp ?? '')
            )
        );
}

/**
 * Builds the totals row for one session detail table.
 *
 * @param {object[]} rows Usage rows for one session file.
 * @returns {object} Display row containing aggregate numeric values.
 */
function buildTotalsRow(rows) {
    const inputTokens = sumField(rows, 'input_tokens');
    const cachedInputTokens = sumField(rows, 'cached_input_tokens');
    const outputTokens = sumField(rows, 'output_tokens');

    return {
        timestamp: 'Totals',
        session_id: '',
        seconds_since_previous: sumField(rows, 'seconds_since_previous'),
        input_tokens: inputTokens,
        cached_input_tokens: cachedInputTokens,
        effective_input_tokens: sumField(rows, 'effective_input_tokens'),
        cache_hit_rate: rate(cachedInputTokens, inputTokens),
        output_tokens: outputTokens,
        reasoning_output_tokens: sumField(rows, 'reasoning_output_tokens'),
        observed_token_volume: sumField(rows, 'observed_token_volume'),
    };
}

/**
 * Sums a numeric field across rows.
 *
 * @param {object[]} rows Usage rows.
 * @param {string} field Numeric field key.
 * @returns {number} Field total.
 */
function sumField(rows, field) {
    return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
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
        if (value === 'Totals') {
            return value;
        }
        return formatDatetime(value, datetimeFormat);
    }
    if (column === 'session_id') {
        return String(row.turn_index ?? value ?? '');
    }
    if (column === 'seconds_since_previous' && value === null) {
        return '';
    }
    if (INTEGER_FIELDS.has(column)) {
        return formatInteger(Number(value ?? 0));
    }
    if (column === 'cache_hit_rate') {
        return formatPercent(Number(value ?? 0));
    }

    return String(value ?? '');
}

/**
 * Pads a cell for table output, right-aligning numeric columns.
 *
 * @param {string} value Cell value.
 * @param {number} width Target cell width.
 * @param {string} column Field key.
 * @returns {string} Padded cell value.
 */
function padCell(value, width, column) {
    if (RIGHT_ALIGNED_FIELDS.has(column)) {
        return value.padStart(width, ' ');
    }

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
 * Computes a guarded rate.
 *
 * @param {number} numerator Rate numerator.
 * @param {number} denominator Rate denominator.
 * @returns {number} Rate or zero when the denominator is unavailable.
 */
function rate(numerator, denominator) {
    if (!Number.isFinite(denominator) || denominator <= 0) {
        return 0;
    }

    return numerator / denominator;
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
