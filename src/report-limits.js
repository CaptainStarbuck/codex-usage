/**
 * Throws when generated report tables would exceed configured detail limits.
 *
 * @param {object} report Structured usage report.
 * @param {{ maxEvents: number, maxModels: number, maxSessions: number, maxTurns: number }} limits Detail limits.
 * @returns {void}
 */
export function enforceReportLimits(report, limits) {
    enforceEventLimits(report, limits.maxEvents);
    enforceTurnLimits(report, limits.maxTurns);
    enforceModelLimits(report, limits.maxModels);
    enforceSessionLimits(report, limits.maxSessions);
}

/**
 * Enforces event row limits for every generated event detail table.
 *
 * @param {object} report Structured usage report.
 * @param {number} maxEvents Maximum event rows, or 0 for unlimited.
 * @returns {void}
 */
function enforceEventLimits(report, maxEvents) {
    if (maxEvents === 0) {
        return;
    }

    const rows = Array.isArray(report.rows) ? report.rows : [];
    assertLimit(
        'Events table',
        rows.length,
        maxEvents,
        '--max-events',
        'MAX_EVENTS'
    );

    for (const [sessionId, sessionRows] of groupRows(rows, 'session_id')) {
        assertLimit(
            `Session ${sessionId} event detail table`,
            sessionRows.length,
            maxEvents,
            '--max-events',
            'MAX_EVENTS'
        );
    }

    for (const [modelKey, modelRows] of groupModelRows(rows)) {
        assertLimit(
            `Model ${modelKey} event detail table`,
            modelRows.length,
            maxEvents,
            '--max-events',
            'MAX_EVENTS'
        );
    }
}

/**
 * Enforces turn row limits for every generated event detail table.
 *
 * @param {object} report Structured usage report.
 * @param {number} maxTurns Maximum turn rows, or 0 for unlimited.
 * @returns {void}
 */
function enforceTurnLimits(report, maxTurns) {
    if (maxTurns === 0) {
        return;
    }

    const rows = Array.isArray(report.rows) ? report.rows : [];

    for (const [sessionId, sessionRows] of groupRows(rows, 'session_id')) {
        assertLimit(
            `Session ${sessionId} turn detail table`,
            uniqueTurnCount(sessionRows),
            maxTurns,
            '--max-turns',
            'MAX_TURNS'
        );
    }

    for (const [modelKey, modelRows] of groupModelRows(rows)) {
        assertLimit(
            `Model ${modelKey} turn detail table`,
            uniqueTurnCount(modelRows),
            maxTurns,
            '--max-turns',
            'MAX_TURNS'
        );
    }
}

/**
 * Enforces model group limits for generated grouped tables.
 *
 * @param {object} report Structured usage report.
 * @param {number} maxModels Maximum model groups, or 0 for unlimited.
 * @returns {void}
 */
function enforceModelLimits(report, maxModels) {
    if (maxModels === 0) {
        return;
    }

    const rows = Array.isArray(report.rows) ? report.rows : [];
    assertLimit(
        'Models table',
        groupModelRows(rows).size,
        maxModels,
        '--max-models',
        'MAX_MODELS'
    );
}

/**
 * Enforces session row limits for every generated session table.
 *
 * @param {object} report Structured usage report.
 * @param {number} maxSessions Maximum session rows, or 0 for unlimited.
 * @returns {void}
 */
function enforceSessionLimits(report, maxSessions) {
    if (maxSessions === 0) {
        return;
    }

    const rows = Array.isArray(report.rows) ? report.rows : [];
    const sessions = Array.isArray(report.sessions) ? report.sessions : [];
    assertLimit(
        'Sessions table',
        sessions.length,
        maxSessions,
        '--max-sessions',
        'MAX_SESSIONS'
    );

    for (const [modelKey, modelRows] of groupModelRows(rows)) {
        assertLimit(
            `Model ${modelKey} sessions table`,
            groupRows(modelRows, 'session_id').size,
            maxSessions,
            '--max-sessions',
            'MAX_SESSIONS'
        );
    }
}

/**
 * Throws when a table row count exceeds a configured maximum.
 *
 * @param {string} tableName User-facing table or section name.
 * @param {number} actual Actual row count.
 * @param {number} limit Configured row count limit.
 * @param {string} optionName CLI option that controls the limit.
 * @param {string} envName Environment setting that controls the limit.
 * @returns {void}
 */
function assertLimit(tableName, actual, limit, optionName, envName) {
    if (actual <= limit) {
        return;
    }

    throw new Error(
        `Report detail limit exceeded: ${tableName} would include ${actual} rows, above ${optionName}=${limit}. Increase ${optionName} or ${envName} to render this report.`
    );
}

/**
 * Groups rows by a string field.
 *
 * @param {object[]} rows Rows to group.
 * @param {string} field Field name.
 * @returns {Map<string, object[]>} Grouped rows.
 */
function groupRows(rows, field) {
    /** @type {Map<string, object[]>} */
    const groups = new Map();

    for (const row of rows) {
        const key = String(row[field] ?? 'unknown');
        const group = groups.get(key) ?? [];
        group.push(row);
        groups.set(key, group);
    }

    return groups;
}

/**
 * Groups rows by the HTML model and intelligence table identity.
 *
 * @param {object[]} rows Rows to group.
 * @returns {Map<string, object[]>} Grouped rows.
 */
function groupModelRows(rows) {
    /** @type {Map<string, object[]>} */
    const groups = new Map();

    for (const row of rows) {
        const key = [
            String(row.model ?? 'unknown'),
            String(row.intelligence_level ?? 'unknown'),
        ].join('/');
        const group = groups.get(key) ?? [];
        group.push(row);
        groups.set(key, group);
    }

    return groups;
}

/**
 * Counts unique session turn identities in a row set.
 *
 * @param {object[]} rows Rows to inspect.
 * @returns {number} Unique turn count.
 */
function uniqueTurnCount(rows) {
    return new Set(
        rows.map((row) =>
            [row.session_id ?? 'unknown', row.turn_index ?? 'unknown'].join('/')
        )
    ).size;
}
