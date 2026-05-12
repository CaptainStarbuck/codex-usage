import { renderHtmlReport } from './report-html.js';
import { renderJsonReport } from './report-json.js';
import { renderTextReport } from './report-text.js';

/**
 * @typedef {object} RenderOptions
 * @property {boolean} forceRefresh Whether HTML output should include the calculated refresh timer.
 * @property {string} format Output format.
 * @property {number | undefined} interval Optional regeneration interval in seconds.
 * @property {string} stylesPath HTML report stylesheet path.
 */

/**
 * Renders a report in the requested output format.
 *
 * @param {object} report Structured usage report.
 * @param {RenderOptions} options Runtime options that control output rendering.
 * @returns {string} Rendered report.
 */
export function renderReport(report, options) {
    if (options.format === 'json') {
        return renderJsonReport(report);
    }
    if (options.format === 'html') {
        return renderHtmlReport(report, {
            refreshSeconds: options.forceRefresh
                ? (options.interval ?? 0) - 2
                : undefined,
            stylesPath: options.stylesPath,
        });
    }
    return renderTextReport(report);
}
