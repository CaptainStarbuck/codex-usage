import { TOKEN_FIELDS } from './constants.js';

const COLUMNS = [
    'timestamp',
    'model',
    'intelligence_level',
    'observed_token_volume',
    ...TOKEN_FIELDS,
];

/**
 * Renders the text usage report.
 *
 * @param {object} report Structured usage report.
 * @returns {string} Terminal report text.
 */
export function renderTextReport(report) {
    /** @type {string[]} */
    const lines = [
        `Codex token usage from ${report.window.cutoff} to ${report.window.now}`,
        '',
        ...formatSummary(report),
        '',
        ...formatQuota(report.quota),
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
        lines.push('', formatTable(report.rows));
    }

    return `${lines.join('\n')}\n`;
}

/**
 * Formats account quota details for terminal output.
 *
 * @param {object} quota Normalized quota report.
 * @returns {string[]} Quota lines.
 */
function formatQuota(quota) {
    if (!quota?.available) {
        return [
            'Quota',
            'available: false',
            ...(quota?.warnings ?? []).map((warning) => `warning: ${warning}`),
        ];
    }

    /** @type {string[]} */
    const lines = [
        'Quota',
        `captured_at: ${quota.captured_at}`,
        `session_id: ${quota.session_id}`,
    ];

    for (const limit of quota.limits ?? []) {
        const resetLabel = limit.resets_at_local
            ? `, resets ${limit.resets_at_local}`
            : '';
        lines.push(
            `${limit.name}: ${formatPercentValue(limit.remaining_percent)} remaining (${formatPercentValue(limit.used_percent)} used${resetLabel})`
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
 * Formats raw and derived totals for the text summary.
 *
 * @param {object} report Structured usage report.
 * @returns {string[]} Summary lines.
 */
function formatSummary(report) {
    return [
        'Summary',
        `observed_token_volume: ${formatInteger(report.totals.observed_token_volume)}`,
        `raw_total_tokens: ${formatInteger(report.totals.raw_total_tokens)}`,
        `effective_input_tokens: ${formatInteger(report.totals.effective_input_tokens)}`,
        `cached_input_tokens: ${formatInteger(report.totals.cached_input_tokens)}`,
        `cache_hit_rate: ${formatPercent(report.totals.cache_hit_rate)}`,
        `output_tokens: ${formatInteger(report.totals.output_tokens)}`,
        `reasoning_output_tokens: ${formatInteger(report.totals.reasoning_output_tokens)}`,
        `session_count: ${formatInteger(report.sessions.length)}`,
    ];
}

/**
 * Formats usage rows as a fixed-width terminal table.
 *
 * @param {object[]} rows Usage rows.
 * @returns {string} Table text.
 */
function formatTable(rows) {
    const widths = columnWidths(rows);
    const header = COLUMNS.map((column) => pad(column, widths[column])).join(
        '  '
    );
    const ruler = COLUMNS.map((column) => '-'.repeat(widths[column])).join(
        '  '
    );
    const body = rows.map((row) =>
        COLUMNS.map((column) =>
            pad(String(row[column] ?? ''), widths[column])
        ).join('  ')
    );

    return [header, ruler, ...body].join('\n');
}

/**
 * Computes column widths for the report table.
 *
 * @param {object[]} rows Usage rows.
 * @returns {Record<string, number>} Width by column name.
 */
function columnWidths(rows) {
    /** @type {Record<string, number>} */
    const widths = Object.fromEntries(
        COLUMNS.map((column) => [column, column.length])
    );

    for (const row of rows) {
        for (const column of COLUMNS) {
            widths[column] = Math.max(
                widths[column],
                String(row[column] ?? '').length
            );
        }
    }

    return widths;
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
