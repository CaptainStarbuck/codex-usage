#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = join(SOURCE_DIR, 'aggregate.md');
const PRIORITY_FILE_NAMES = ['codex-usage.js', 'constants.js'];

/**
 * Builds a markdown document that contains every JavaScript source file.
 *
 * @returns {Promise<void>} Resolves after the aggregate document is written.
 */
async function main() {
    const fileNames = await listSourceFileNames(SOURCE_DIR);
    const sections = await Promise.all(fileNames.map(buildFileSection));
    const content = `${sections.join('\n\n')}\n`;

    await writeFile(OUTPUT_FILE, content, 'utf8');
    console.log(
        `Wrote ${basename(OUTPUT_FILE)} with ${fileNames.length} source files.`
    );
}

/**
 * Lists JavaScript source file names in the requested aggregate order.
 *
 * @param {string} sourceDir Directory that contains source files.
 * @returns {Promise<string[]>} Sorted JavaScript file names.
 */
async function listSourceFileNames(sourceDir) {
    const entries = await readdir(sourceDir, { withFileTypes: true });

    /** @type {string[]} */
    const fileNames = entries
        .filter(
            (entry) =>
                entry.isFile() &&
                entry.name.endsWith('.js') &&
                entry.name !== 'aggregate.js'
        )
        .map((entry) => entry.name);

    return fileNames.sort(compareSourceFileNames);
}

/**
 * Compares source file names with the project entry points first.
 *
 * @param {string} left First file name.
 * @param {string} right Second file name.
 * @returns {number} Sort comparison value.
 */
function compareSourceFileNames(left, right) {
    const leftPriority = getPriorityIndex(left);
    const rightPriority = getPriorityIndex(right);

    if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
    }

    return left.localeCompare(right);
}

/**
 * Resolves the priority bucket for a source file name.
 *
 * @param {string} fileName Source file name.
 * @returns {number} Priority index, with non-priority files sorted after the explicit list.
 */
function getPriorityIndex(fileName) {
    const index = PRIORITY_FILE_NAMES.indexOf(fileName);

    if (index === -1) {
        return PRIORITY_FILE_NAMES.length;
    }

    return index;
}

/**
 * Builds a markdown section for one JavaScript source file.
 *
 * @param {string} fileName Source file name.
 * @returns {Promise<string>} Markdown section containing the file description and code block.
 */
async function buildFileSection(fileName) {
    const path = join(SOURCE_DIR, fileName);
    const code = await readFile(path, 'utf8');
    const description = describeSourceFile(fileName);

    return `# ${fileName}\n${description}\n\`\`\`javascript\n${code.trimEnd()}\n\`\`\``;
}

/**
 * Creates the prose description used below each source file heading.
 *
 * @param {string} fileName Source file name.
 * @returns {string} File description.
 */
function describeSourceFile(fileName) {
    return `Source file: \`src/${fileName}\`.`;
}

main().catch((error) => {
    console.error(`aggregate: ${error.message}`);
    process.exitCode = 1;
});
