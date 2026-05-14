import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HTML_SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'html');
const BASE_TEMPLATE_PATH = join(HTML_SOURCE_DIR, 'base.html');
const COMMON_STYLES_PATH = join(HTML_SOURCE_DIR, 'styles-common.css');
const REPORT_SCRIPT_PATH = join(HTML_SOURCE_DIR, 'report.js');

/**
 * @typedef {object} HtmlRenderOptions
 * @property {string} datetimeFormat HTML report datetime display format.
 * @property {number | undefined} refreshSeconds Optional page refresh delay in seconds.
 * @property {string} stylesPath HTML report stylesheet path.
 */

/**
 * Renders a standalone static HTML usage dashboard.
 *
 * @param {object} report Structured usage report.
 * @param {HtmlRenderOptions} options HTML rendering options.
 * @returns {string} HTML document.
 */
export function renderHtmlReport(report, options) {
    const htmlReport = applyHtmlMetadata(report, options);
    const replacements = new Map([
        ['styles.css', readHtmlStyles(options.stylesPath)],
        ['report.json', escapeScriptJson(htmlReport)],
        ['report.js', readHtmlSourceFile(REPORT_SCRIPT_PATH)],
    ]);

    return replaceTemplateStubLines(
        readHtmlSourceFile(BASE_TEMPLATE_PATH),
        replacements
    );
}

/**
 * Reads the selected theme CSS followed by common report CSS.
 *
 * @param {string} stylesPath Selected HTML report theme stylesheet path.
 * @returns {string} Combined stylesheet contents.
 */
function readHtmlStyles(stylesPath) {
    return [
        readHtmlSourceFile(stylesPath),
        readHtmlSourceFile(COMMON_STYLES_PATH),
    ].join('\n\n');
}

/**
 * Adds HTML-only display settings without mutating the structured report.
 *
 * @param {object} report Structured usage report.
 * @param {HtmlRenderOptions} options HTML rendering options.
 * @returns {object} Report copy with HTML display metadata.
 */
function applyHtmlMetadata(report, options) {
    return {
        ...report,
        metadata: {
            ...report.metadata,
            datetime_format: options.datetimeFormat,
            refresh_seconds:
                Number.isFinite(options.refreshSeconds) &&
                options.refreshSeconds >= 1
                    ? Math.round(options.refreshSeconds)
                    : undefined,
        },
    };
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
 * Escapes JSON so it can be embedded safely in a script data block.
 *
 * @param {object} report Structured usage report.
 * @returns {string} Escaped JSON.
 */
function escapeScriptJson(report) {
    return JSON.stringify(report).replace(/</gu, '\\u003c');
}
