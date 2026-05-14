import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const JSON_SPACES = 2;

/**
 * Prints command usage examples to standard error.
 *
 * @returns {void}
 */
function printUsage() {
    console.error('Usage:');
    console.error('  node jsonl2json.js path/to/file.jsonl');
    console.error('  node jsonl2json.js path/to/file.jsonl /another/path');
    console.error(
        '  node jsonl2json.js path/to/file.jsonl /another/path/otherfile.json'
    );
}

/**
 * Normalizes path separators to the current platform.
 *
 * @param {string} filePath File path to normalize.
 * @returns {string} Path using the current platform separator.
 */
function normalizePathSlashes(filePath) {
    const separator = os.platform() === 'win32' ? '\\' : '/';

    return filePath.replaceAll(separator === '\\' ? '/' : '\\', separator);
}

/**
 * Resolves the JSON output path from an input file and optional output argument.
 *
 * @param {string} inputPath Source JSONL file path.
 * @param {string | undefined} outputArg Optional output file or folder path.
 * @returns {string} Destination JSON file path.
 */
function getOutputPath(inputPath, outputArg) {
    const parsedInput = path.parse(inputPath);
    const defaultOutputName = `${parsedInput.name}.json`;

    if (!outputArg) {
        return path.join(parsedInput.dir, defaultOutputName);
    }

    const normalizedOutputArg = normalizePathSlashes(outputArg);
    const parsedOutput = path.parse(normalizedOutputArg);

    if (parsedOutput.ext.toLowerCase() === '.json') {
        return normalizedOutputArg;
    }

    return path.join(normalizedOutputArg, defaultOutputName);
}

/**
 * Parses newline-delimited JSON text into an array of JSON values.
 *
 * @param {string} inputText Raw JSONL text.
 * @param {string} inputPath Source path used in parse error messages.
 * @returns {unknown[]} Parsed JSONL items.
 * @throws {Error} When a non-empty line is not valid JSON.
 */
function parseJsonl(inputText, inputPath) {
    const items = [];

    inputText.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();

        if (trimmed === '') {
            return;
        }

        try {
            items.push(JSON.parse(trimmed));
        } catch (error) {
            const lineNumber = index + 1;
            const message =
                error instanceof Error ? error.message : String(error);

            throw new Error(
                `Invalid JSON in ${inputPath} on line ${lineNumber}: ${message}`,
                { cause: error }
            );
        }
    });

    return items;
}

/**
 * Creates the output directory for a JSON conversion result.
 *
 * @param {string} outputPath Destination JSON file path.
 * @returns {void}
 */
function ensureOutputDirectory(outputPath) {
    const outputDir = path.dirname(outputPath);

    fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Converts a JSONL file to a JSON file containing an `items` array.
 *
 * @param {string} inputPath Source JSONL file path.
 * @param {string | undefined} outputArg Optional output file or folder path.
 * @returns {{ inputPath: string, outputPath: string, itemCount: number }} Conversion result.
 * @throws {Error} When the input extension is not `.jsonl` or a line cannot be parsed.
 */
function convertJsonlToJson(inputPath, outputArg) {
    const normalizedInputPath = normalizePathSlashes(inputPath);
    const outputPath = getOutputPath(normalizedInputPath, outputArg);

    if (path.extname(normalizedInputPath).toLowerCase() !== '.jsonl') {
        throw new Error(
            `Input file must use the .jsonl extension: ${inputPath}`
        );
    }

    const inputText = fs.readFileSync(normalizedInputPath, 'utf8');
    const items = parseJsonl(inputText, normalizedInputPath);
    const outputText = `${JSON.stringify({ items }, null, JSON_SPACES)}\n`;

    ensureOutputDirectory(outputPath);
    fs.writeFileSync(outputPath, outputText, 'utf8');

    return {
        inputPath: normalizedInputPath,
        outputPath,
        itemCount: items.length,
    };
}

/**
 * Runs the command-line utility.
 *
 * @returns {void}
 */
function main() {
    const [, , inputPath, outputArg] = process.argv;

    if (!inputPath) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    try {
        const result = convertJsonlToJson(inputPath, outputArg);

        console.log(`Converted ${result.itemCount} JSONL items.`);
        console.log(`Input:  ${result.inputPath}`);
        console.log(`Output: ${result.outputPath}`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

main();
