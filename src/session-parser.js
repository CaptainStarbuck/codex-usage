import { readFile } from 'node:fs/promises';
import { TOKEN_FIELDS } from './constants.js';
import { basenameConfiguredPath } from './path-utils.js';
import { readConfigDefaults } from './settings.js';

/**
 * Parses a Codex session JSONL file into usage rows and quota snapshots.
 *
 * @param {string} file Session JSONL file path.
 * @param {Date} cutoff Earliest event timestamp to report.
 * @param {string} codexHome Codex home directory for config fallback values.
 * @returns {Promise<{ rows: object[], quotaSnapshots: object[], duplicateTokenCountEvents: number }>} Parsed session data.
 */
export async function parseSessionFile(file, cutoff, codexHome) {
    const defaults = await readConfigDefaults(codexHome);
    /** @type {{ model: string, intelligenceLevel: string }} */
    const context = {
        model: defaults.model,
        intelligenceLevel: defaults.intelligenceLevel,
    };
    /** @type {object[]} */
    const rows = [];
    /** @type {object[]} */
    const quotaSnapshots = [];
    /** @type {{ lastTotalUsage: object | undefined, duplicateTokenCountEvents: number }} */
    const usageState = {
        lastTotalUsage: undefined,
        duplicateTokenCountEvents: 0,
    };
    const text = await readFile(file, 'utf8');

    for (const line of text.split(/\r?\n/u)) {
        if (!line.trim()) {
            continue;
        }
        const event = parseJsonLine(line);
        if (!event) {
            continue;
        }
        updateContext(event, context);
        addQuotaSnapshot(event, file, quotaSnapshots);
        addUsageRow(event, context, cutoff, file, rows, usageState);
    }

    return {
        rows,
        quotaSnapshots,
        duplicateTokenCountEvents: usageState.duplicateTokenCountEvents,
    };
}

/**
 * Parses one JSONL line and ignores malformed partial writes.
 *
 * @param {string} line Raw JSONL line.
 * @returns {object | undefined} Parsed event.
 */
function parseJsonLine(line) {
    try {
        return JSON.parse(line);
    } catch {
        return undefined;
    }
}

/**
 * Updates model metadata when the session records it.
 *
 * @param {object} event Parsed session event.
 * @param {{ model: string, intelligenceLevel: string }} context Mutable metadata.
 * @returns {void}
 */
function updateContext(event, context) {
    if (event.type !== 'turn_context' || !event.payload) {
        return;
    }
    context.model = event.payload.model ?? context.model;
    context.intelligenceLevel =
        event.payload.effort ??
        event.payload.collaboration_mode?.settings?.reasoning_effort ??
        context.intelligenceLevel;
}

/**
 * Adds a token usage row when an event is inside the reporting window.
 *
 * @param {object} event Parsed session event.
 * @param {{ model: string, intelligenceLevel: string }} context Current metadata.
 * @param {Date} cutoff Earliest timestamp to report.
 * @param {string} file Source session file.
 * @param {object[]} rows Mutable rows list.
 * @param {{ lastTotalUsage: object | undefined }} usageState Mutable session usage state.
 * @returns {void}
 */
function addUsageRow(event, context, cutoff, file, rows, usageState) {
    const usage = event.payload?.info?.last_token_usage;
    const timestamp = new Date(event.timestamp ?? '');

    if (
        event.type !== 'event_msg' ||
        event.payload?.type !== 'token_count' ||
        !usage
    ) {
        return;
    }
    if (
        !hasAdvancedTotalUsage(
            event.payload.info?.total_token_usage,
            usageState
        )
    ) {
        return;
    }
    if (Number.isNaN(timestamp.getTime()) || timestamp < cutoff) {
        return;
    }

    rows.push({
        timestamp: timestamp.toISOString(),
        model: context.model,
        intelligence_level: context.intelligenceLevel,
        file,
        ...usage,
    });
}

/**
 * Adds a quota snapshot when a token_count event carries rate limits.
 *
 * @param {object} event Parsed session event.
 * @param {string} file Source session file.
 * @param {object[]} quotaSnapshots Mutable quota snapshot list.
 * @returns {void}
 */
function addQuotaSnapshot(event, file, quotaSnapshots) {
    const timestamp = new Date(event.timestamp ?? '');
    const rateLimits = event.payload?.rate_limits;

    if (
        event.type !== 'event_msg' ||
        event.payload?.type !== 'token_count' ||
        !rateLimits
    ) {
        return;
    }
    if (Number.isNaN(timestamp.getTime())) {
        return;
    }

    quotaSnapshots.push({
        timestamp: timestamp.toISOString(),
        file,
        session_id: readSessionId(file),
        rate_limits: rateLimits,
    });
}

/**
 * Checks whether cumulative token totals advanced since the previous event and counts unchanged duplicates.
 *
 * @param {object | undefined} totalUsage Cumulative session token usage.
 * @param {{ lastTotalUsage: object | undefined }} usageState Mutable session usage state.
 * @returns {boolean} True when the last usage row should count.
 */
function hasAdvancedTotalUsage(totalUsage, usageState) {
    if (!totalUsage) {
        return true;
    }

    const currentTotal = totalUsageValue(totalUsage);
    const previousTotal = usageState.lastTotalUsage
        ? totalUsageValue(usageState.lastTotalUsage)
        : undefined;
    usageState.lastTotalUsage = totalUsage;

    if (previousTotal !== undefined && currentTotal <= previousTotal) {
        usageState.duplicateTokenCountEvents += 1;
        return false;
    }

    return true;
}

/**
 * Reads the cumulative token total from a total_token_usage payload.
 *
 * @param {object} totalUsage Cumulative usage payload.
 * @returns {number} Total token count.
 */
function totalUsageValue(totalUsage) {
    const totalTokens = Number(totalUsage.total_tokens);

    if (Number.isFinite(totalTokens)) {
        return totalTokens;
    }

    return TOKEN_FIELDS.reduce(
        (total, field) => total + readNumber(totalUsage[field]),
        0
    );
}

/**
 * Reads a finite number from an unknown value.
 *
 * @param {unknown} value Value to normalize.
 * @returns {number} Finite number or zero.
 */
function readNumber(value) {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

/**
 * Extracts the initial session identity from the JSONL filename.
 *
 * @param {string} file Source file path.
 * @returns {string} Session id.
 */
function readSessionId(file) {
    const name = basenameConfiguredPath(String(file ?? ''));
    return name.endsWith('.jsonl')
        ? name.slice(0, -'.jsonl'.length)
        : name || 'unknown';
}
