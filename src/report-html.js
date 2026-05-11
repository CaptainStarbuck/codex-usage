import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HTML_SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'html');
const BASE_TEMPLATE_PATH = join(HTML_SOURCE_DIR, 'base.html');
const REPORT_SCRIPT_PATH = join(HTML_SOURCE_DIR, 'report.js');
const STYLES_PATH = join(HTML_SOURCE_DIR, 'styles.css');

/**
 * @typedef {object} HtmlRenderOptions
 * @property {number | undefined} refreshSeconds Optional page refresh delay in seconds.
 */

/**
 * Renders a standalone static HTML usage dashboard.
 *
 * @param {object} report Structured usage report.
 * @param {HtmlRenderOptions} [options] HTML rendering options.
 * @returns {string} HTML document.
 */
export function renderHtmlReport(report, options = {}) {
    const replacements = new Map([
        ['refresh.script', renderRefreshScript(options.refreshSeconds)],
        ['styles.css', readHtmlSourceFile(STYLES_PATH)],
        ['report.json', escapeScriptJson(report)],
        ['report.js', readHtmlSourceFile(REPORT_SCRIPT_PATH)],
    ]);

    return replaceTemplateStubLines(
        readHtmlSourceFile(BASE_TEMPLATE_PATH),
        replacements
    );
}

/**
 * Reads one HTML template source file as UTF-8 text.
 *
 * @param {string} filePath Template source file path.
 * @returns {string} File contents.
 */
function readHtmlSourceFile(filePath) {
    return readFileSync(filePath, 'utf8').trimEnd();
}

/**
 * Replaces full template lines that contain known stub labels.
 *
 * @param {string} template Template source containing stub comment lines.
 * @param {Map<string, string>} replacements Replacement text keyed by stub label.
 * @returns {string} Template with each matching line replaced.
 */
function replaceTemplateStubLines(template, replacements) {
    return template
        .split(/\r?\n/u)
        .map((line) => replaceTemplateStubLine(line, replacements))
        .join('\n');
}

/**
 * Replaces a single template line when it contains one of the configured stubs.
 *
 * @param {string} line Template line.
 * @param {Map<string, string>} replacements Replacement text keyed by stub label.
 * @returns {string} Original or replacement line.
 */
function replaceTemplateStubLine(line, replacements) {
    for (const [stub, replacement] of replacements) {
        if (line.includes(stub)) {
            return replacement;
        }
    }

    return line;
}

/**
 * Renders a browser refresh script when interval HTML output requests it.
 *
 * @param {number | undefined} refreshSeconds Page refresh delay in seconds.
 * @returns {string} Script markup or an empty string.
 */
function renderRefreshScript(refreshSeconds) {
    if (!Number.isFinite(refreshSeconds) || refreshSeconds < 1) {
        return '';
    }

    return `<script>
    window.setTimeout(() => {
      window.location.reload();
    }, ${Math.round(refreshSeconds)} * 1000);
  </script>`;
}

/**
 * Escapes JSON so it can be embedded safely in a script data block.
 *
 * @param {object} report Structured usage report.
 * @returns {string} Escaped JSON.
 */
function escapeScriptJson(report) {
    return JSON.stringify(report).replace(/</gu, '\\u003c');
}
