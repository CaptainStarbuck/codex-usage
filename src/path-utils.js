import { basename, dirname, join, resolve, sep, win32 } from 'node:path';

const WINDOWS_VOLUME_PATTERN = /^[A-Za-z]:/u;
const WINDOWS_UNC_PATTERN = /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/u;

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
 * Resolves a path using native semantics or Windows semantics for Windows-style input.
 *
 * @param {string} filePath Path to resolve.
 * @returns {string} Resolved path.
 */
export function resolveConfiguredPath(filePath) {
    return getPathApi(filePath).resolve(filePath);
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
