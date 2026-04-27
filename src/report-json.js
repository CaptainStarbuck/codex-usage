/**
 * Renders the structured report as stable JSON text.
 *
 * @param {object} report Structured usage report.
 * @returns {string} JSON document.
 */
export function renderJsonReport(report) {
    return `${JSON.stringify(report, null, 2)}\n`;
}
