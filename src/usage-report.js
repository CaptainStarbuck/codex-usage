import { TOKEN_FIELDS } from './constants.js';

const COLUMNS = ['timestamp', 'model', 'intelligence_level', ...TOKEN_FIELDS];

/**
 * Prints the full usage report.
 *
 * @param {{ rows: object[], totals: Record<string, number>, cutoff: Date, now: Date }} report Report data.
 * @returns {void}
 */
export function printUsageReport(report) {
    console.log(
        `Codex token usage from ${report.cutoff.toISOString()} to ${report.now.toISOString()}`
    );

    if (report.rows.length === 0) {
        console.log('\nNo token usage events found in the selected window.');
        printTotals(report.totals);
        return;
    }

    console.log('');
    console.log(formatTable(report.rows));
    printTotals(report.totals);
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
 * Prints token column totals and corrected derived totals.
 *
 * @param {Record<string, number>} totals Token totals.
 * @returns {void}
 */
function printTotals(totals) {
    console.log('\nTotals');
    for (const field of TOKEN_FIELDS) {
        console.log(`${field}: ${totals[field]}`);
    }
    console.log(`effective_input_tokens: ${totals.effective_input_tokens}`);
    console.log(`visible_output_tokens: ${totals.visible_output_tokens}`);
    console.log(`cache_hit_rate: ${totals.cache_hit_rate}`);
    console.log(`reasoning_output_rate: ${totals.reasoning_output_rate}`);
}
