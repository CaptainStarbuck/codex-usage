import {
    LARGE_EVENT_TOKEN_THRESHOLD,
    LARGE_INPUT_TOKEN_THRESHOLD,
} from './constants.js';

/**
 * Builds report insights from normalized rows and grouped summaries.
 *
 * @param {object} report Structured report model.
 * @returns {object[]} Warning and notice records.
 */
export function buildInsights(report) {
    /** @type {object[]} */
    const insights = [];

    if (report.rows.length === 0) {
        insights.push(
            createInsight(
                'warning',
                'no_rows',
                'No token usage events were found in the selected window.'
            )
        );
    }

    addQuotaWarnings(report, insights);
    addDuplicateNotice(report, insights);
    addUnknownMetadataWarnings(report.rows, insights);
    addLargeEventWarnings(report.rows, insights);
    addSessionNotices(report.sessions, insights);

    return insights;
}

/**
 * Adds warnings for missing or stale quota data.
 *
 * @param {object} report Structured report model.
 * @param {object[]} insights Mutable insights list.
 * @returns {void}
 */
function addQuotaWarnings(report, insights) {
    if (!report.quota?.available) {
        insights.push(
            createInsight(
                'warning',
                'quota_unavailable',
                'Quota information is unavailable for this report.'
            )
        );
        return;
    }

    const capturedAt = new Date(String(report.quota.captured_at ?? ''));
    const reportEnd = new Date(String(report.window?.now ?? ''));
    const staleMilliseconds = 10 * 60 * 1000;

    if (
        !Number.isNaN(capturedAt.getTime()) &&
        !Number.isNaN(reportEnd.getTime()) &&
        reportEnd.getTime() - capturedAt.getTime() > staleMilliseconds
    ) {
        insights.push(
            createInsight(
                'warning',
                'stale_quota_snapshot',
                'The quota snapshot is more than 10 minutes older than the report end.',
                {
                    captured_at: report.quota.captured_at,
                    report_end: report.window.now,
                }
            )
        );
    }
}

/**
 * Adds a notice when duplicate token count events were ignored.
 *
 * @param {object} report Structured report model.
 * @param {object[]} insights Mutable insights list.
 * @returns {void}
 */
function addDuplicateNotice(report, insights) {
    const count = Number(
        report.metadata?.duplicate_token_count_events_ignored ?? 0
    );

    if (count > 0) {
        insights.push(
            createInsight(
                'notice',
                'duplicate_token_count_events_ignored',
                'Duplicate token_count events were ignored because total_token_usage was unchanged.',
                {
                    count,
                }
            )
        );
    }
}

/**
 * Adds warnings for unknown model or intelligence level values.
 *
 * @param {object[]} rows Normalized report rows.
 * @param {object[]} insights Mutable insights list.
 * @returns {void}
 */
function addUnknownMetadataWarnings(rows, insights) {
    if (rows.some((row) => row.model === 'unknown')) {
        insights.push(
            createInsight(
                'warning',
                'unknown_model',
                'At least one event has an unknown model.'
            )
        );
    }

    if (rows.some((row) => row.intelligence_level === 'unknown')) {
        insights.push(
            createInsight(
                'warning',
                'unknown_intelligence_level',
                'At least one event has an unknown intelligence level.'
            )
        );
    }
}

/**
 * Adds warnings for cache efficiency and unusually large events.
 *
 * @param {object[]} rows Normalized report rows.
 * @param {object[]} insights Mutable insights list.
 * @returns {void}
 */
function addLargeEventWarnings(rows, insights) {
    const lowCacheRows = rows.filter(
        (row) =>
            Number(row.input_tokens ?? 0) >= LARGE_INPUT_TOKEN_THRESHOLD &&
            Number(row.cache_hit_rate ?? 0) < 0.5
    );
    const largeRows = rows.filter(
        (row) =>
            Number(row.observed_token_volume ?? 0) > LARGE_EVENT_TOKEN_THRESHOLD
    );

    if (lowCacheRows.length > 0) {
        insights.push(
            createInsight(
                'warning',
                'low_cache_hit_rate',
                'A large input event has a cache hit rate below 50%.',
                {
                    count: lowCacheRows.length,
                    threshold_input_tokens: LARGE_INPUT_TOKEN_THRESHOLD,
                }
            )
        );
    }

    if (largeRows.length > 0) {
        insights.push(
            createInsight(
                'warning',
                'large_event_observed_token_volume',
                'At least one event exceeds 100k observed token volume.',
                {
                    count: largeRows.length,
                    threshold_observed_token_volume:
                        LARGE_EVENT_TOKEN_THRESHOLD,
                }
            )
        );
    }
}

/**
 * Adds notices for multi-session windows and changing metadata inside sessions.
 *
 * @param {object[]} sessions Session summaries.
 * @param {object[]} insights Mutable insights list.
 * @returns {void}
 */
function addSessionNotices(sessions, insights) {
    if (sessions.length > 1) {
        insights.push(
            createInsight(
                'notice',
                'multiple_sessions',
                'Multiple sessions appear in this report window.',
                {
                    count: sessions.length,
                }
            )
        );
    }

    for (const session of sessions) {
        if (session.models.length > 1) {
            insights.push(
                createInsight(
                    'notice',
                    'session_model_change',
                    'A session uses more than one model.',
                    {
                        session_id: session.session_id,
                        models: session.models,
                    }
                )
            );
        }

        if (session.intelligence_levels.length > 1) {
            insights.push(
                createInsight(
                    'notice',
                    'session_intelligence_level_change',
                    'A session uses more than one intelligence level.',
                    {
                        session_id: session.session_id,
                        intelligence_levels: session.intelligence_levels,
                    }
                )
            );
        }
    }
}

/**
 * Creates an insight record with stable key order.
 *
 * @param {string} severity Insight severity.
 * @param {string} code Stable insight code.
 * @param {string} message Human-readable message.
 * @param {object} [details] Optional detail object.
 * @returns {object} Insight record.
 */
function createInsight(severity, code, message, details = {}) {
    return { severity, code, message, details };
}
