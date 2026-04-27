/**
 * Builds the quota report section from parsed Codex rate limit snapshots.
 *
 * @param {{ snapshots: object[], cutoff: Date, now: Date }} input Quota inputs.
 * @returns {object} Normalized quota report.
 */
export function buildQuotaReport(input) {
    const snapshot = selectQuotaSnapshot(
        input.snapshots,
        input.cutoff,
        input.now
    );

    if (!snapshot) {
        return {
            available: false,
            source: 'codex-session-rate-limits',
            limits: [],
            warnings: [
                'No non-null rate_limits snapshot was found in the scanned Codex session files.',
            ],
        };
    }

    return {
        available: true,
        source: 'codex-session-rate-limits',
        captured_at: snapshot.timestamp,
        session_id: snapshot.session_id,
        file: snapshot.file,
        plan_type: stringOrEmpty(snapshot.rate_limits?.plan_type),
        limit_id: stringOrEmpty(snapshot.rate_limits?.limit_id),
        limit_name: stringOrEmpty(snapshot.rate_limits?.limit_name),
        rate_limit_reached_type: stringOrEmpty(
            snapshot.rate_limits?.rate_limit_reached_type
        ),
        limits: normalizeLimits(snapshot.rate_limits),
        credits: normalizeCredits(snapshot.rate_limits?.credits),
        warnings: [],
    };
}

/**
 * Chooses the latest snapshot inside the selected window, falling back to the
 * latest snapshot before the window when a scanned file contains one.
 *
 * @param {object[]} snapshots Parsed quota snapshots.
 * @param {Date} cutoff Earliest timestamp for the selected report window.
 * @param {Date} now Report generation timestamp.
 * @returns {object | undefined} Selected snapshot.
 */
function selectQuotaSnapshot(snapshots, cutoff, now) {
    const sortedSnapshots = snapshots
        .filter((snapshot) => isUsableSnapshot(snapshot, now))
        .sort((first, second) =>
            first.timestamp.localeCompare(second.timestamp)
        );
    const inWindowSnapshots = sortedSnapshots.filter(
        (snapshot) => new Date(snapshot.timestamp) >= cutoff
    );

    return inWindowSnapshots.at(-1) ?? sortedSnapshots.at(-1);
}

/**
 * Checks that a parsed snapshot has a valid timestamp and happened before the
 * report generation time.
 *
 * @param {object} snapshot Parsed quota snapshot.
 * @param {Date} now Report generation timestamp.
 * @returns {boolean} True when the snapshot can be displayed.
 */
function isUsableSnapshot(snapshot, now) {
    const timestamp = new Date(String(snapshot.timestamp ?? ''));

    return (
        !Number.isNaN(timestamp.getTime()) &&
        timestamp <= now &&
        Boolean(snapshot.rate_limits)
    );
}

/**
 * Normalizes primary and secondary rate limit windows.
 *
 * @param {object | undefined} rateLimits Raw RateLimitSnapshot payload.
 * @returns {object[]} Display-ready limit windows.
 */
function normalizeLimits(rateLimits) {
    /** @type {object[]} */
    const limits = [];

    addLimit(limits, rateLimits?.primary, 'primary');
    addLimit(limits, rateLimits?.secondary, 'secondary');
    return limits;
}

/**
 * Adds one display-ready limit window when it exists.
 *
 * @param {object[]} limits Mutable output list.
 * @param {object | undefined} window Raw RateLimitWindow payload.
 * @param {'primary' | 'secondary'} kind Limit window kind.
 * @returns {void}
 */
function addLimit(limits, window, kind) {
    if (!window) {
        return;
    }

    const usedPercent = clampPercent(readNumber(window.used_percent));
    const windowMinutes = readNumber(window.window_minutes);
    const resetsAt = readNumber(window.resets_at);

    limits.push({
        name: limitName(windowMinutes, kind),
        window_minutes: windowMinutes,
        used_percent: usedPercent,
        remaining_percent: clampPercent(100 - usedPercent),
        resets_at: Number.isFinite(resetsAt) && resetsAt > 0 ? resetsAt : null,
        resets_at_local: formatResetTime(resetsAt),
    });
}

/**
 * Builds a display label for a rate limit window.
 *
 * @param {number} windowMinutes Window size in minutes.
 * @param {'primary' | 'secondary'} kind Limit window kind.
 * @returns {string} Display label.
 */
function limitName(windowMinutes, kind) {
    if (windowMinutes === 300) {
        return '5h limit';
    }
    if (windowMinutes === 10080) {
        return '7d limit';
    }
    return kind === 'primary' ? 'Primary limit' : 'Secondary limit';
}

/**
 * Converts a Unix timestamp in seconds to a local display string.
 *
 * @param {number} resetsAt Unix timestamp in seconds.
 * @returns {string} Local display label.
 */
function formatResetTime(resetsAt) {
    if (!Number.isFinite(resetsAt) || resetsAt <= 0) {
        return '';
    }

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(resetsAt * 1000));
}

/**
 * Normalizes the credits portion of a rate limit snapshot.
 *
 * @param {object | undefined} credits Raw credits payload.
 * @returns {object | undefined} Display-ready credits object.
 */
function normalizeCredits(credits) {
    if (!credits) {
        return undefined;
    }

    /** @type {{ has_credits: boolean, unlimited: boolean, balance?: string }} */
    const normalizedCredits = {
        has_credits: Boolean(credits.has_credits),
        unlimited: Boolean(credits.unlimited),
    };

    if (
        credits.balance !== undefined &&
        credits.balance !== null &&
        String(credits.balance).trim() !== ''
    ) {
        normalizedCredits.balance = formatBalance(credits.balance);
    }

    return normalizedCredits;
}

/**
 * Formats a credit balance while preserving nonnumeric service text.
 *
 * @param {unknown} balance Raw credit balance.
 * @returns {string} Display balance.
 */
function formatBalance(balance) {
    const numberValue = Number(balance);

    if (Number.isFinite(numberValue)) {
        return String(Math.round(numberValue));
    }

    return String(balance);
}

/**
 * Clamps a percent value to the display range.
 *
 * @param {number} value Percent value.
 * @returns {number} Clamped percent.
 */
function clampPercent(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(100, value));
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
 * Converts an optional value to a string without surfacing nullish values.
 *
 * @param {unknown} value Value to normalize.
 * @returns {string} String value or empty string.
 */
function stringOrEmpty(value) {
    return value === undefined || value === null ? '' : String(value);
}
