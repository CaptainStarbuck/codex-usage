import { platform } from 'node:os';
import { basename, dirname, join, resolve, sep, win32 } from 'node:path';

const WINDOWS_VOLUME_PATTERN = /^[A-Za-z]:/u;
const WINDOWS_OUTPUT_VOLUME_PATTERN = /^[A-Za-z]{1,5}:/u;
const WINDOWS_UNC_PATTERN = /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/u;
const WINDOWS_BACKSLASH_UNC_PATTERN = /^\\\\/u;

/**
 * @typedef {object} PathApi
 * @property {(path: string) => string} basename Gets the final path segment.
 * @property {(path: string) => string} dirname Gets the parent directory.
 * @property {(...paths: string[]) => string} join Joins path segments.
 * @property {(...paths: string[]) => string} resolve Resolves path segments.
 */

/** @type {PathApi} */
const nativePathApi = {
    basename,
    dirname,
    join,
    resolve,
};

/**
 * Gets the filename portion of a user-configured path.
 *
 * @param {string} filePath Path to inspect.
 * @returns {string} Final path segment.
 */
export function basenameConfiguredPath(filePath) {
    return getPathApi(filePath).basename(filePath);
}

/**
 * Gets the parent directory portion of a user-configured path.
 *
 * @param {string} filePath Path to inspect.
 * @returns {string} Parent directory path.
 */
export function dirnameConfiguredPath(filePath) {
    return getPathApi(filePath).dirname(filePath);
}

/**
 * Checks whether a configured path contains a specific folder segment.
 *
 * @param {string} filePath Path to inspect.
 * @param {string} segment Folder segment to find.
 * @returns {boolean} True when the segment exists in the path.
 */
export function hasConfiguredPathSegment(filePath, segment) {
    return filePath.split(/[\\/]+/u).includes(segment);
}

/**
 * Joins path segments using native separators or Windows separators for Windows-style input.
 *
 * @param {string} basePath Base path that determines path semantics.
 * @param {...string} segments Additional path segments.
 * @returns {string} Joined path.
 */
export function joinConfiguredPath(basePath, ...segments) {
    return getPathApi(basePath).join(basePath, ...segments);
}

/**
 * Resolves a configured file destination against a default folder when only
 * a filename is provided.
 *
 * @param {string} filePath File path or filename to inspect.
 * @param {string} defaultFolder Folder used when filePath is only a filename.
 * @returns {string} File destination path.
 */
export function resolveConfiguredFileDestination(filePath, defaultFolder) {
    if (isConfiguredFilenameOnly(filePath)) {
        return joinConfiguredPath(defaultFolder, filePath);
    }

    return filePath;
}

/**
 * Checks whether a configured path is only a filename with no folder path.
 *
 * @param {string} filePath Path to inspect.
 * @returns {boolean} True when the value contains no directory component.
 */
export function isConfiguredFilenameOnly(filePath) {
    return !/[\\/]/u.test(filePath) && !WINDOWS_VOLUME_PATTERN.test(filePath);
}

/**
 * Resolves a path using native semantics or Windows semantics for Windows-style input.
 *
 * @param {string} filePath Path to resolve.
 * @returns {string} Resolved path.
 */
export function resolveConfiguredPath(filePath) {
    return getPathApi(filePath).resolve(filePath);
}

/**
 * Validates and normalizes a file-system write destination for the current OS.
 *
 * @param {string} outputPath File or folder path that will be written.
 * @param {string} potentialOutputFolder Folder that would receive generated output.
 * @returns {string} Path normalized for the current OS.
 */
export function normalizeConfiguredOutputPath(
    outputPath,
    potentialOutputFolder
) {
    return normalizeConfiguredOutputPathForPlatform(
        outputPath,
        potentialOutputFolder,
        platform()
    );
}

/**
 * Validates and normalizes a file-system write destination for a platform.
 *
 * @param {string} outputPath File or folder path that will be written.
 * @param {string} potentialOutputFolder Folder that would receive generated output.
 * @param {NodeJS.Platform} platformName Runtime platform name.
 * @returns {string} Path normalized for the supplied OS.
 */
export function normalizeConfiguredOutputPathForPlatform(
    outputPath,
    potentialOutputFolder,
    platformName
) {
    if (platformName === 'win32') {
        return normalizeWindowsOutputPath(outputPath, potentialOutputFolder);
    }

    if (isWindowsOnlyOutputPath(outputPath)) {
        throw new Error(
            `Output will not be generated because the output folder is formatted for Windows: ${potentialOutputFolder}`
        );
    }

    return outputPath;
}

/**
 * Normalizes a Windows output path or rejects POSIX-style separators.
 *
 * @param {string} outputPath File or folder path that will be written.
 * @param {string} potentialOutputFolder Folder that would receive generated output.
 * @returns {string} Windows-compatible output path.
 */
function normalizeWindowsOutputPath(outputPath, potentialOutputFolder) {
    if (outputPath.includes('/')) {
        if (
            WINDOWS_OUTPUT_VOLUME_PATTERN.test(outputPath) ||
            WINDOWS_BACKSLASH_UNC_PATTERN.test(outputPath)
        ) {
            return outputPath.replace(/\//gu, '\\');
        }

        throw new Error(
            `Output will not be generated because the output folder is not formatted for Windows: ${potentialOutputFolder}`
        );
    }

    return outputPath;
}

/**
 * Checks whether a configured output path only belongs to Windows.
 *
 * @param {string} outputPath File or folder path that will be written.
 * @returns {boolean} True when the path should be rejected outside Windows.
 */
function isWindowsOnlyOutputPath(outputPath) {
    return (
        WINDOWS_OUTPUT_VOLUME_PATTERN.test(outputPath) ||
        WINDOWS_BACKSLASH_UNC_PATTERN.test(outputPath)
    );
}

/**
 * Selects path operations for native paths or Windows-style configured paths.
 *
 * @param {string} filePath Path to inspect.
 * @returns {PathApi} Matching path operations.
 */
function getPathApi(filePath) {
    if (isWindowsStylePath(filePath)) {
        return win32;
    }

    return nativePathApi;
}

/**
 * Checks whether a path string uses Windows volume, UNC, or separator syntax.
 *
 * @param {string} filePath Path to inspect.
 * @returns {boolean} True when Windows path semantics should be used.
 */
function isWindowsStylePath(filePath) {
    return (
        sep === '\\' ||
        WINDOWS_VOLUME_PATTERN.test(filePath) ||
        WINDOWS_UNC_PATTERN.test(filePath) ||
        filePath.includes('\\')
    );
}
