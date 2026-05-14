const report = JSON.parse(document.getElementById('report-data').textContent);
const numberFields = new Set([
    'event_count',
    'input_tokens',
    'cached_input_tokens',
    'effective_input_tokens',
    'visible_output_tokens',
    'output_tokens',
    'reasoning_output_tokens',
    'raw_total_tokens',
    'observed_token_volume',
    'cache_hit_rate',
    'reasoning_output_rate',
    'turn_index',
    'seconds_since_previous',
    'max_single_event_observed_token_volume',
]);
/** @type {string[]} */
const tokenDisplayColumns = [
    'input_tokens',
    'cached_input_tokens',
    'effective_input_tokens',
    'cache_hit_rate',
    'output_tokens',
    'reasoning_output_tokens',
    'observed_token_volume',
];
/** @type {Record<string, string>} */
const tableColumnLabels = {
    observed_token_volume: 'Total Tokens',
};
/** @type {Record<string, string>} */
const sessionGroupColumnLabels = {
    ...tableColumnLabels,
    timestamp: 'Started',
    model: 'Models',
};
/** @type {Record<string, string>} */
const sessionGroupEventColumnLabels = {
    ...tableColumnLabels,
    session_id: 'Event',
};
const sessionGroupColumns = [
    'timestamp',
    'session_id',
    'model',
    ...tokenDisplayColumns,
];
const sessionGroupEventColumns = [
    'timestamp',
    'session_id',
    'seconds_since_previous',
    'model',
    ...tokenDisplayColumns,
];
const modelSessionGroupColumns = [
    'timestamp',
    'session_id',
    ...tokenDisplayColumns,
];
const modelSessionGroupEventColumns = [
    'timestamp',
    'session_id',
    'seconds_since_previous',
    ...tokenDisplayColumns,
];
const modelGroupColumns = ['model', 'event_count', ...tokenDisplayColumns];
const datetimeFormat = report.metadata?.datetime_format || 'MMM D, h:mm AP';
const refreshSeconds = Number(report.metadata?.refresh_seconds || 0);
const eventTableState = readEventTableState();
const modelGroupsTableState = readModelGroupsTableState();
let refreshTimer = undefined;
let refreshEnabled = false;

/**
 * @typedef {object} TimelineSegment
 * @property {string} field Bucket field to render as a stacked segment.
 * @property {string} color Segment fill color.
 * @property {string} legendColor Legend marker color.
 * @property {string} label Legend label.
 */

/**
 * @typedef {object} TimelineOptions
 * @property {string} elementId Timeline container element id.
 * @property {string} emptyMessage Message shown when no rows are available.
 * @property {string} invalidTimestampMessage Message shown when rows have no valid timestamps.
 * @property {string} ariaLabel SVG accessibility label.
 * @property {TimelineSegment[]} segments Ordered stacked token segments.
 * @property {string | undefined} scaleField Bucket field used for the vertical scale.
 */

function integer(value) {
    return Math.round(Number(value || 0)).toLocaleString('en-US');
}

function percent(value) {
    return (Number(value || 0) * 100).toFixed(1) + '%';
}

/**
 * Formats a timestamp-like value with the configured display mask.
 *
 * @param {string | number | Date | undefined} value Timestamp value.
 * @returns {string} Formatted display value.
 */
function datetime(value) {
    const date = value instanceof Date ? value : new Date(value ?? '');

    if (Number.isNaN(date.getTime())) {
        return String(value ?? '');
    }

    const monthShort = new Intl.DateTimeFormat(undefined, {
        month: 'short',
    }).format(date);
    const day = String(date.getDate());
    const hour24 = date.getHours();
    const hour12 = String(hour24 % 12 || 12);
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    const meridiem = hour24 < 12 ? 'AM' : 'PM';

    /** @type {Record<string, string>} */
    const tokens = {
        MMM: monthShort,
        DD: day.padStart(2, '0'),
        D: day,
        HH: String(hour24).padStart(2, '0'),
        H: String(hour24),
        hh: hour12.padStart(2, '0'),
        h: hour12,
        mm: minute,
        ss: second,
        AP: meridiem,
        A: meridiem,
        a: meridiem.toLowerCase(),
    };

    return datetimeFormat.replace(
        /MMM|DD|D|HH|H|hh|h|mm|ss|AP|A|a/gu,
        (token) => tokens[token] ?? token
    );
}

/**
 * Formats a report field value for visible HTML output.
 *
 * @param {string} field Report field key.
 * @param {unknown} value Raw field value.
 * @returns {string | number} Display-ready field value.
 */
function display(field, value) {
    if (field === 'timestamp' || field.endsWith('_timestamp')) {
        return datetime(value);
    }
    if (field === 'session_id') {
        return sessionReference(value);
    }
    if (field === 'sessions' && Array.isArray(value)) {
        return value.map(sessionReference).join(', ');
    }
    if (field === 'file') {
        return sessionFileReference(value);
    }
    if (field.endsWith('_rate')) {
        return percent(value);
    }
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    if (numberFields.has(field)) {
        return integer(value);
    }
    return String(value ?? '');
}

/**
 * Formats a report field value with row context for table cells.
 *
 * @param {object} row Report row.
 * @param {string} field Report field key.
 * @returns {string | number} Display-ready field value.
 */
function displayCell(row, field) {
    if (
        field === 'model' &&
        !Object.hasOwn(row, 'raw_model') &&
        Object.hasOwn(row, 'intelligence_level')
    ) {
        return (
            String(row.model ?? 'unknown') +
            '/' +
            String(row.intelligence_level ?? 'unknown')
        );
    }
    if (field === 'session_id' && Object.hasOwn(row, 'turn_index')) {
        return sessionTurnReference(row.session_id, row.turn_index);
    }

    return display(field, row[field]);
}

/**
 * Gets the compact session hash used in the HTML report display.
 *
 * @param {unknown} value Raw session id from a rollout filename.
 * @returns {string} Short session reference when available.
 */
function sessionReference(value) {
    const sessionId = String(value ?? '');
    const match = /^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-([^-]+)/u.exec(
        sessionId
    );

    return match?.[1] ?? sessionId;
}

/**
 * Gets the compact session and turn reference used in event tables.
 *
 * @param {unknown} sessionId Raw session id from a rollout filename.
 * @param {unknown} turnIndex Event turn index within the session.
 * @returns {string} Short session and turn reference.
 */
function sessionTurnReference(sessionId, turnIndex) {
    const turn = Number(turnIndex ?? 0);
    const turnSuffix = Number.isFinite(turn) && turn > 0 ? '/' + turn : '';

    return sessionReference(sessionId) + turnSuffix;
}

/**
 * Gets the compact session hash from a session file path.
 *
 * @param {unknown} value Raw source file path.
 * @returns {string} Short session file reference when available.
 */
function sessionFileReference(value) {
    const filePath = String(value ?? '');
    const fileName = filePath
        .split(/[\\/]/u)
        .pop()
        ?.replace(/\.jsonl$/u, '');

    return sessionReference(fileName || filePath);
}

function html(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character]
    );
}

/**
 * Renders the optional report control panel.
 *
 * @returns {void}
 */
function renderReportControls() {
    const node = document.getElementById('report-controls');

    if (!Number.isFinite(refreshSeconds) || refreshSeconds < 1) {
        return;
    }

    node.hidden = false;
    node.innerHTML =
        '<button class="control-button" type="button" id="refresh-toggle" aria-pressed="true">Stop Refresh</button>';
    refreshEnabled = true;
    document
        .getElementById('refresh-toggle')
        .addEventListener('click', toggleRefresh);
    scheduleRefresh();
}

/**
 * Toggles browser auto-refresh for force-refresh HTML reports.
 *
 * @returns {void}
 */
function toggleRefresh() {
    refreshEnabled = !refreshEnabled;
    updateRefreshControl();

    if (refreshEnabled) {
        scheduleRefresh();
        return;
    }

    clearRefreshTimer();
}

/**
 * Updates the refresh control label and pressed state.
 *
 * @returns {void}
 */
function updateRefreshControl() {
    const button = document.getElementById('refresh-toggle');

    button.setAttribute('aria-pressed', String(refreshEnabled));
    button.textContent = refreshEnabled ? 'Stop Refresh' : 'Start Refresh';
}

/**
 * Schedules the next browser reload while refresh mode is active.
 *
 * @returns {void}
 */
function scheduleRefresh() {
    clearRefreshTimer();

    if (!refreshEnabled) {
        return;
    }

    refreshTimer = window.setTimeout(() => {
        window.location.reload();
    }, refreshSeconds * 1000);
}

/**
 * Clears a pending browser reload timer.
 *
 * @returns {void}
 */
function clearRefreshTimer() {
    if (refreshTimer === undefined) {
        return;
    }

    window.clearTimeout(refreshTimer);
    refreshTimer = undefined;
}

/**
 * Renders summary cards using the same token order and titles as Sessions.
 *
 * @returns {void}
 */
function renderSummary() {
    const totals = report.totals || {};
    const cards = [
        ['input_tokens', integer(totals.input_tokens), 1],
        [
            'cached_input_tokens',
            integer(totals.cached_input_tokens),
            totals.cache_hit_rate,
        ],
        ['effective_input_tokens', integer(totals.effective_input_tokens), 1],
        [
            'cache_hit_rate',
            percent(totals.cache_hit_rate),
            totals.cache_hit_rate,
        ],
        ['output_tokens', integer(totals.output_tokens), 1],
        [
            'reasoning_output_tokens',
            integer(totals.reasoning_output_tokens),
            totals.reasoning_output_rate,
        ],
        ['observed_token_volume', integer(totals.observed_token_volume), 1],
        ['sessions', integer((report.sessions || []).length), 1],
        ['events', integer((report.rows || []).length), 1],
    ];
    document.getElementById('summary').innerHTML = cards
        .map(
            ([field, value, rate]) =>
                '<article class="card"><div class="label">' +
                html(displayLabel(String(field), tableColumnLabels)) +
                '</div><div class="value">' +
                html(value) +
                '</div><div class="bar"><span style="width:' +
                Math.max(0, Math.min(100, Number(rate || 0) * 100)) +
                '%"></span></div></article>' +
                summaryGroupBreak(String(field))
        )
        .join('');
}

/**
 * Inserts Summary row breaks after the Input and Output groups.
 *
 * @param {string} field Summary field key.
 * @returns {string} Summary group break markup or an empty string.
 */
function summaryGroupBreak(field) {
    if (field === 'cache_hit_rate' || field === 'reasoning_output_tokens') {
        return '<div class="summary-break" aria-hidden="true"></div>';
    }

    return '';
}

/**
 * Renders account quota cards.
 *
 * @returns {void}
 */
function renderQuota() {
    const node = document.getElementById('quota');
    const quota = report.quota || {};
    if (!quota.available) {
        const warnings = quota.warnings || [];
        node.innerHTML =
            '<h2>Quota</h2><div class="empty">' +
            html(warnings[0] || 'Quota unavailable.') +
            '</div>';
        return;
    }

    const limitCards = (quota.limits || []).map(
        (limit) =>
            '<article class="card"><div class="label">' +
            html(limit.name) +
            '</div><div class="value">' +
            Number(limit.remaining_percent || 0).toFixed(1) +
            '%</div><div class="detail">' +
            Number(limit.used_percent || 0).toFixed(1) +
            '% used' +
            (limit.resets_at
                ? ', resets ' + html(datetime(limit.resets_at * 1000))
                : '') +
            '</div><div class="bar"><span style="width:' +
            Math.max(0, Math.min(100, Number(limit.remaining_percent || 0))) +
            '%"></span></div></article>'
    );
    const credits = quota.credits || {};
    if (credits.has_credits) {
        const value = credits.unlimited
            ? 'unlimited'
            : credits.balance || 'available';
        limitCards.push(
            '<article class="card"><div class="label">Credits</div><div class="value">' +
                html(value) +
                '</div><div class="detail">' +
                html(quota.plan_type || '') +
                '</div></article>'
        );
    }

    node.innerHTML =
        '<h2>Quota</h2><section class="quota-cards">' +
        limitCards.join('') +
        '</section>';
}

function renderInsights() {
    const node = document.getElementById('insights');
    const insights = report.insights || [];
    if (insights.length === 0) {
        node.innerHTML =
            '<h2>Warnings And Insights</h2><div class="empty">No warnings or notices for this report window.</div>';
        return;
    }
    node.innerHTML =
        '<h2>Warnings And Insights</h2><div class="insights">' +
        insights
            .map(
                (insight) =>
                    '<div class="insight ' +
                    html(insight.severity) +
                    '"><strong>' +
                    html(insight.severity) +
                    '</strong>: ' +
                    html(insight.message) +
                    '</div>'
            )
            .join('') +
        '</div>';
}

/*
 * Top Sessions and Top Events are temporarily disabled.
 *
 * Restore these functions together with the matching dashboard markup in
 * base.html and render calls at the bottom of this file.
 */

/**
 * Renders the highest-volume sessions as compact dashboard cards.
 *
 * @returns {void}
 */
/* function renderTopSessions() {
    const node = document.getElementById('top-sessions');
    const sessions = [...(report.sessions || [])]
        .sort(
            (left, right) =>
                Number(right.observed_token_volume || 0) -
                Number(left.observed_token_volume || 0)
        )
        .slice(0, 8);
    if (sessions.length === 0) {
        node.innerHTML =
            '<div class="empty">No sessions found in this report window.</div>';
        return;
    }
    node.innerHTML = sessions
        .map(
            (session) =>
                '<article class="list-item"><header><strong>' +
                html(sessionReference(session.session_id)) +
                '</strong><span class="value">' +
                integer(session.observed_token_volume) +
                '</span></header><div class="stats"><span>Events<b>' +
                integer(session.event_count) +
                '</b></span><span>First<b>' +
                html(datetime(session.first_timestamp)) +
                '</b></span><span>Last<b>' +
                html(datetime(session.last_timestamp)) +
                '</b></span><span>Effective Input<b>' +
                integer(session.effective_input_tokens) +
                '</b></span><span>Cache Hit Rate<b>' +
                percent(session.cache_hit_rate) +
                '</b></span><span>Models<b>' +
                html((session.models || []).join(', ')) +
                '</b></span><span>Intelligence<b>' +
                html((session.intelligence_levels || []).join(', ')) +
                '</b></span></div></article>'
        )
        .join('');
} */

/**
 * Renders the highest-volume usage events as compact dashboard cards.
 *
 * @returns {void}
 */
/* function renderTopEvents() {
    const node = document.getElementById('top-events');
    const rows = [...(report.rows || [])]
        .sort(
            (left, right) =>
                Number(right.observed_token_volume || 0) -
                    Number(left.observed_token_volume || 0) ||
                Number(right.effective_input_tokens || 0) -
                    Number(left.effective_input_tokens || 0)
        )
        .slice(0, 8);
    if (rows.length === 0) {
        node.innerHTML =
            '<div class="empty">No events found in this report window.</div>';
        return;
    }
    node.innerHTML = rows
        .map(
            (row) =>
                '<article class="list-item"><header><strong>' +
                html(datetime(row.timestamp)) +
                '</strong><span class="value">' +
                integer(row.observed_token_volume) +
                '</span></header><div class="stats"><span class="stat-wide">Session<b>' +
                html(sessionReference(row.session_id)) +
                '</b></span><span>Model<b>' +
                html(row.model) +
                '</b></span><span>Intelligence<b>' +
                html(row.intelligence_level) +
                '</b></span><span>Effective Input<b>' +
                integer(row.effective_input_tokens) +
                '</b></span><span>Cached Input<b>' +
                integer(row.cached_input_tokens) +
                '</b></span><span>Cache Hit Rate<b>' +
                percent(row.cache_hit_rate) +
                '</b></span><span>Output<b>' +
                integer(row.output_tokens) +
                '</b></span><span>Reasoning Output<b>' +
                integer(row.reasoning_output_tokens) +
                '</b></span></div></article>'
        )
        .join('');
} */

/**
 * Renders the main token usage timeline with the original mixed token scale.
 *
 * @returns {void}
 */
function renderTimeline() {
    renderTokenTimeline({
        elementId: 'timeline',
        emptyMessage: 'No events found for the timeline.',
        invalidTimestampMessage: 'No valid timestamps found for the timeline.',
        ariaLabel: 'Token usage timeline',
        segments: [
            {
                field: 'cached_input_tokens',
                color: '#6ad1c9',
                legendColor: 'var(--cached)',
                label: 'Cached input',
            },
            {
                field: 'effective_input_tokens',
                color: '#87a8ff',
                legendColor: 'var(--effective)',
                label: 'Effective input',
            },
            {
                field: 'output_tokens',
                color: '#f3b563',
                legendColor: 'var(--output)',
                label: 'Output',
            },
            {
                field: 'reasoning_output_tokens',
                color: '#c58cff',
                legendColor: 'var(--reasoning)',
                label: 'Reasoning output',
            },
        ],
        scaleField: 'observed_token_volume',
    });
}

/**
 * Renders a focused output token timeline without input-token segments.
 *
 * @returns {void}
 */
function renderOutputTokenTimeline() {
    renderTokenTimeline({
        elementId: 'output-token-timeline',
        emptyMessage: 'No events found for the output token timeline.',
        invalidTimestampMessage:
            'No valid timestamps found for the output token timeline.',
        ariaLabel: 'Output token usage timeline',
        segments: [
            {
                field: 'output_tokens',
                color: '#f3b563',
                legendColor: 'var(--output)',
                label: 'Output Tokens',
            },
            {
                field: 'reasoning_output_tokens',
                color: '#c58cff',
                legendColor: 'var(--reasoning)',
                label: 'Reasoning Output Tokens',
            },
        ],
        scaleField: undefined,
    });
}

/**
 * Renders a stacked SVG token timeline for a selected set of token fields.
 *
 * @param {TimelineOptions} options Timeline rendering options.
 * @returns {void}
 */
function renderTokenTimeline(options) {
    const node = document.getElementById(options.elementId);
    const rows = report.rows || [];
    if (rows.length === 0) {
        node.innerHTML =
            '<div class="empty">' + options.emptyMessage + '</div>';
        return;
    }

    const buckets = buildTimelineBuckets(rows);
    if (buckets.length === 0) {
        node.innerHTML =
            '<div class="empty">' + options.invalidTimestampMessage + '</div>';
        return;
    }
    const maxVolume = Math.max(
        ...buckets.map((bucket) => scaleVolume(bucket, options)),
        1
    );
    const width = Math.max(920, buckets.length * 18 + 80);
    const height = 210;
    const chartTop = 18;
    const chartHeight = 150;
    const barGap = 3;
    const barWidth = Math.max(4, (width - 80) / buckets.length - barGap);
    const rects = buckets
        .map((bucket, index) => {
            const x = 50 + index * (barWidth + barGap);
            let y = chartTop + chartHeight;
            return options.segments
                .map((segment) => {
                    const segmentHeight = Math.max(
                        0,
                        (Number(bucket[segment.field] || 0) / maxVolume) *
                            chartHeight
                    );
                    y -= segmentHeight;
                    return (
                        '<rect x="' +
                        x.toFixed(2) +
                        '" y="' +
                        y.toFixed(2) +
                        '" width="' +
                        barWidth.toFixed(2) +
                        '" height="' +
                        segmentHeight.toFixed(2) +
                        '" fill="' +
                        segment.color +
                        '"><title>' +
                        html(timelineTitle(bucket)) +
                        '</title></rect>'
                    );
                })
                .join('');
        })
        .join('');

    node.innerHTML =
        '<svg viewBox="0 0 ' +
        width +
        ' ' +
        height +
        '" role="img" aria-label="' +
        html(options.ariaLabel) +
        '"><line x1="45" y1="' +
        (chartTop + chartHeight) +
        '" x2="' +
        (width - 20) +
        '" y2="' +
        (chartTop + chartHeight) +
        '" stroke="#2b3543"/>' +
        rects +
        '<text x="50" y="195" fill="#9ba8b8" font-size="12">' +
        html(buckets[0].label) +
        '</text><text x="' +
        (width - 190) +
        '" y="195" fill="#9ba8b8" font-size="12">' +
        html(buckets.at(-1).label) +
        '</text></svg><div class="legend">' +
        options.segments
            .map(
                (segment) =>
                    '<span style="--legend-color: ' +
                    segment.legendColor +
                    '">' +
                    html(segment.label) +
                    '</span>'
            )
            .join('') +
        '</div>';
}

/**
 * Reads the value used for a timeline bucket's vertical scale.
 *
 * @param {object} bucket Timeline bucket.
 * @param {TimelineOptions} options Timeline rendering options.
 * @returns {number} Bucket scale value.
 */
function scaleVolume(bucket, options) {
    if (options.scaleField) {
        return Number(bucket[options.scaleField] || 0);
    }

    return options.segments.reduce(
        (sum, segment) => sum + Number(bucket[segment.field] || 0),
        0
    );
}

/**
 * Groups usage rows into timeline buckets for the SVG chart.
 *
 * @param {object[]} rows Report event rows.
 * @returns {object[]} Timeline buckets.
 */
function buildTimelineBuckets(rows) {
    const timestamps = rows
        .map((row) => new Date(row.timestamp).getTime())
        .filter(Number.isFinite);
    if (timestamps.length === 0) {
        return [];
    }
    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);
    const spanMinutes = Math.max(0, (end - start) / 60000);
    const bucketMinutes =
        spanMinutes <= 90
            ? 1
            : spanMinutes <= 1440
              ? 15
              : spanMinutes <= 10080
                ? 60
                : 1440;
    const bucketMilliseconds = bucketMinutes * 60000;
    const buckets = new Map();

    for (const row of rows) {
        const timestamp = new Date(row.timestamp).getTime();
        if (!Number.isFinite(timestamp)) {
            continue;
        }
        const key =
            bucketMinutes === 1 && spanMinutes <= 90
                ? String(row.timestamp)
                : String(Math.floor((timestamp - start) / bucketMilliseconds));
        const bucketStart =
            bucketMinutes === 1 && spanMinutes <= 90
                ? timestamp
                : start + Number(key) * bucketMilliseconds;
        const bucket = buckets.get(key) || {
            label: datetime(bucketStart),
            timestamp: new Date(bucketStart).toISOString(),
            session_id: row.session_id,
            model: row.model,
            intelligence_level: row.intelligence_level,
            cached_input_tokens: 0,
            effective_input_tokens: 0,
            output_tokens: 0,
            reasoning_output_tokens: 0,
            observed_token_volume: 0,
            input_tokens: 0,
        };
        bucket.cached_input_tokens += Number(row.cached_input_tokens || 0);
        bucket.effective_input_tokens += Number(
            row.effective_input_tokens || 0
        );
        bucket.output_tokens += Number(row.output_tokens || 0);
        bucket.reasoning_output_tokens += Number(
            row.reasoning_output_tokens || 0
        );
        bucket.observed_token_volume += Number(row.observed_token_volume || 0);
        bucket.input_tokens += Number(row.input_tokens || 0);
        bucket.session_id =
            bucket.session_id === row.session_id
                ? bucket.session_id
                : 'multiple';
        bucket.model = bucket.model === row.model ? bucket.model : 'multiple';
        bucket.intelligence_level =
            bucket.intelligence_level === row.intelligence_level
                ? bucket.intelligence_level
                : 'multiple';
        buckets.set(key, bucket);
    }

    return [...buckets.values()].sort((left, right) =>
        left.timestamp.localeCompare(right.timestamp)
    );
}

/**
 * Builds the browser tooltip for a timeline bucket.
 *
 * @param {object} bucket Timeline bucket.
 * @returns {string} Tooltip text.
 */
function timelineTitle(bucket) {
    return [
        bucket.label,
        'session: ' + sessionReference(bucket.session_id),
        'model: ' + bucket.model,
        'intelligence: ' + bucket.intelligence_level,
        'observed: ' + integer(bucket.observed_token_volume),
        'effective input: ' + integer(bucket.effective_input_tokens),
        'cached input: ' + integer(bucket.cached_input_tokens),
        'output: ' + integer(bucket.output_tokens),
        'reasoning output: ' + integer(bucket.reasoning_output_tokens),
        'cache hit rate: ' +
            percent(
                bucket.input_tokens
                    ? bucket.cached_input_tokens / bucket.input_tokens
                    : 0
            ),
    ].join('\n');
}

/**
 * Reads persisted Sessions table state for the current report file.
 *
 * @returns {{ expanded: string[], sortColumn: string | undefined, sortDirection: number }} Table state.
 */
function readEventTableState() {
    try {
        const rawState = window.localStorage.getItem(eventTableStateKey());
        const state = JSON.parse(rawState || '{}');
        return {
            expanded: Array.isArray(state.expanded)
                ? state.expanded.filter((key) => typeof key === 'string')
                : [],
            sortColumn:
                typeof state.sortColumn === 'string'
                    ? state.sortColumn
                    : undefined,
            sortDirection: Number(state.sortDirection) === -1 ? -1 : 1,
        };
    } catch {
        return {
            expanded: [],
            sortColumn: undefined,
            sortDirection: 1,
        };
    }
}

/**
 * Persists Sessions table state when browser storage is available.
 *
 * @param {{ expanded: string[], sortColumn: string | undefined, sortDirection: number }} state Table state.
 * @returns {void}
 */
function writeEventTableState(state) {
    try {
        window.localStorage.setItem(
            eventTableStateKey(),
            JSON.stringify(state)
        );
    } catch {
        // Private browsing and file restrictions can disable storage.
    }
}

/**
 * Builds a storage key scoped to the report file and source window.
 *
 * @returns {string} Browser storage key.
 */
function eventTableStateKey() {
    return [
        'codex-usage',
        'sessions-table-state',
        window.location.pathname,
        report.metadata.codex_home || '',
        report.window.cutoff || '',
        report.window.now || '',
        report.metadata.range?.scope || '',
        report.metadata.range?.in_scope || '',
    ].join(':');
}

/**
 * Reads persisted Models expansion state for the current report file.
 *
 * @returns {{ expanded: string[], expandedSessions: string[] }} Table state.
 */
function readModelGroupsTableState() {
    try {
        const rawState = window.localStorage.getItem(
            modelGroupsTableStateKey()
        );
        const state = JSON.parse(rawState || '{}');
        return {
            expanded: Array.isArray(state.expanded)
                ? state.expanded.filter((key) => typeof key === 'string')
                : [],
            expandedSessions: Array.isArray(state.expandedSessions)
                ? state.expandedSessions.filter(
                      (key) => typeof key === 'string'
                  )
                : [],
        };
    } catch {
        return {
            expanded: [],
            expandedSessions: [],
        };
    }
}

/**
 * Persists Models expansion state when browser storage is available.
 *
 * @param {{ expanded: string[], expandedSessions?: string[] }} state Table state.
 * @returns {void}
 */
function writeModelGroupsTableState(state) {
    try {
        window.localStorage.setItem(
            modelGroupsTableStateKey(),
            JSON.stringify(state)
        );
    } catch {
        // Private browsing and file restrictions can disable storage.
    }
}

/**
 * Builds a storage key scoped to the report file and source window.
 *
 * @returns {string} Browser storage key.
 */
function modelGroupsTableStateKey() {
    return [
        'codex-usage',
        'model-groups-table-state',
        window.location.pathname,
        report.metadata.codex_home || '',
        report.window.cutoff || '',
        report.window.now || '',
        report.metadata.range?.scope || '',
        report.metadata.range?.in_scope || '',
    ].join(':');
}

/**
 * Builds a stable identity for a session group across generated page reloads.
 *
 * @param {object} row Session group row.
 * @returns {string} Session group identity.
 */
function sessionGroupRowKey(row) {
    return String(row.session_id ?? '');
}

/**
 * Builds a stable identity for a Models group across generated page reloads.
 *
 * @param {object} row Model group row.
 * @returns {string} Model group identity.
 */
function modelGroupRowKey(row) {
    return [row.raw_model, row.intelligence_level]
        .map((value) => String(value ?? 'unknown'))
        .join('|');
}

/**
 * Builds a stable identity for a model-filtered session row.
 *
 * @param {string} modelKey Parent model group identity.
 * @param {object} sessionGroup Session group row.
 * @returns {string} Model-filtered session identity.
 */
function modelSessionGroupRowKey(modelKey, sessionGroup) {
    return [modelKey, sessionGroupRowKey(sessionGroup)].join('|');
}

/**
 * Converts report field keys to user-facing table labels.
 *
 * @param {string} column Report field key.
 * @returns {string} Common-cased label using the same words as the field key.
 */
function columnLabel(column) {
    if (column === 'model') {
        return 'Model';
    }
    if (column === 'session_id') {
        return 'Session';
    }
    return column
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Gets a user-facing display label with optional field-specific overrides.
 *
 * @param {string} column Report field key.
 * @param {Record<string, string>} [labels] Label overrides by field key.
 * @returns {string} Display label.
 */
function displayLabel(column, labels = {}) {
    return labels[column] ?? columnLabel(column);
}

/**
 * Converts report field keys to safe label markup for table headers.
 *
 * @param {string} column Report field key.
 * @param {Record<string, string>} [labels] Label overrides by field key.
 * @returns {string} Escaped header label markup.
 */
function columnLabelHtml(column, labels = {}) {
    if (column === 'turn_index') {
        return 'Turn<br/>Index';
    }

    return html(displayLabel(column, labels)).replace(/ /gu, '<br/>');
}

/**
 * Builds CSS class names for a table column.
 *
 * @param {string} column Report field key.
 * @returns {string} Space-separated CSS classes.
 */
function columnClasses(column) {
    return [
        numberFields.has(column) ? 'number' : '',
        'field-' + column.replace(/_/gu, '-'),
    ]
        .filter(Boolean)
        .join(' ');
}

/**
 * Renders fixed table column sizing hints for visible columns.
 *
 * @param {string[]} columns Visible columns.
 * @param {boolean} [withToggle] Whether to include the expandable row control column.
 * @returns {string} Table column group markup.
 */
function renderColumnGroup(columns, withToggle = false) {
    const toggleColumn = withToggle ? '<col class="field-toggle-control">' : '';

    return (
        '<colgroup>' +
        toggleColumn +
        columns
            .map(
                (column) => '<col class="' + html(columnClasses(column)) + '">'
            )
            .join('') +
        '</colgroup>'
    );
}

/**
 * Renders sortable session groups and restores expanded event details.
 *
 * @param {string} id Table element id.
 * @param {object[]} rows Normalized event rows.
 * @returns {void}
 */
function renderSessionGroupsTable(id, rows) {
    const table = document.getElementById(id);
    const groups = buildSessionGroups(rows);

    if (groups.length === 0) {
        table.innerHTML = '<tbody><tr><td>No rows found.</td></tr></tbody>';
        return;
    }

    const expandedRows = new Set(eventTableState.expanded);
    let sortColumn = sessionGroupColumns.includes(eventTableState.sortColumn)
        ? eventTableState.sortColumn
        : sessionGroupColumns[0];
    let sortDirection = eventTableState.sortDirection;

    /**
     * Draws the current Sessions table view and wires interactive controls.
     *
     * @returns {void}
     */
    function draw() {
        const sortedGroups = [...groups].sort(
            (left, right) =>
                compareValues(left[sortColumn], right[sortColumn]) *
                sortDirection
        );
        const head =
            '<thead><tr><th></th>' +
            sessionGroupColumns
                .map(
                    (column) =>
                        '<th class="' +
                        html(columnClasses(column)) +
                        '" data-column="' +
                        html(column) +
                        '">' +
                        columnLabelHtml(column, sessionGroupColumnLabels) +
                        '</th>'
                )
                .join('') +
            '</tr></thead>';
        const body =
            '<tbody>' +
            sortedGroups
                .map((group, index) =>
                    renderSessionGroupRow(
                        group,
                        index,
                        sessionGroupColumns,
                        sessionGroupEventColumns,
                        'session-group-',
                        sessionGroupRowKey(group),
                        expandedRows.has(sessionGroupRowKey(group))
                    )
                )
                .join('') +
            '</tbody>';
        table.innerHTML =
            renderColumnGroup(sessionGroupColumns, true) + head + body;
        table.querySelectorAll('th[data-column]').forEach((header) => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                if (sortColumn === column) {
                    sortDirection *= -1;
                } else {
                    sortColumn = column;
                    sortDirection = 1;
                }
                eventTableState.sortColumn = sortColumn;
                eventTableState.sortDirection = sortDirection;
                writeEventTableState(eventTableState);
                draw();
            });
        });
        table.querySelectorAll('.session-group-toggle').forEach((button) => {
            button.addEventListener('click', () => {
                const detailRow = table.querySelector(
                    '[data-detail-row="' + button.dataset.detail + '"]'
                );
                const expanded =
                    button.getAttribute('aria-expanded') === 'true';
                const groupKey = button.dataset.groupKey || '';
                button.setAttribute('aria-expanded', String(!expanded));
                button.textContent = expanded ? '+' : '-';
                detailRow.hidden = expanded;
                if (expanded) {
                    expandedRows.delete(groupKey);
                } else {
                    expandedRows.add(groupKey);
                }
                eventTableState.expanded = [...expandedRows];
                writeEventTableState(eventTableState);
            });
        });
    }

    draw();
}

/**
 * Builds sorted summary rows for each session.
 *
 * @param {object[]} rows Normalized event rows.
 * @returns {object[]} Session group summary rows.
 */
function buildSessionGroups(rows) {
    /** @type {Map<string, object[]>} */
    const groupedRows = new Map();

    for (const row of rows) {
        const sessionId = String(row.session_id ?? 'unknown');
        const sessionRows = groupedRows.get(sessionId) ?? [];
        sessionRows.push(row);
        groupedRows.set(sessionId, sessionRows);
    }

    return [...groupedRows.values()]
        .map(summarizeSessionGroup)
        .sort((left, right) =>
            String(left.timestamp ?? '').localeCompare(
                String(right.timestamp ?? '')
            )
        );
}

/**
 * Summarizes all events for one session.
 *
 * @param {object[]} rows Rows for one session.
 * @returns {object} Session group summary row.
 */
function summarizeSessionGroup(rows) {
    const sortedRows = [...rows].sort((first, second) =>
        first.timestamp.localeCompare(second.timestamp)
    );
    const firstRow = sortedRows[0] ?? {};
    const totals = sumRows(sortedRows);

    return {
        timestamp: String(firstRow.timestamp ?? ''),
        session_id: String(firstRow.session_id ?? 'unknown'),
        model: summarizeModelDisplay(sortedRows),
        events: sortedRows,
        ...totals,
    };
}

/**
 * Summarizes model and intelligence pairs used by a group of event rows.
 *
 * @param {object[]} rows Rows to inspect.
 * @returns {string} Comma-separated model display values.
 */
function summarizeModelDisplay(rows) {
    const modelPairs = rows.map(
        (row) =>
            String(row.model ?? 'unknown') +
            '/' +
            String(row.intelligence_level ?? 'unknown')
    );

    return [...new Set(modelPairs)].sort().join(', ');
}

/**
 * Renders one expandable session summary row.
 *
 * @param {object} group Session group summary row.
 * @param {number} index Row index.
 * @param {string[]} columns Visible session summary columns.
 * @param {string[]} eventColumns Visible event detail columns.
 * @param {string} detailPrefix Prefix for detail row ids.
 * @param {string} groupKey Stable row identity for persistence.
 * @param {boolean} expanded Whether the row should render expanded.
 * @returns {string} Table row markup.
 */
function renderSessionGroupRow(
    group,
    index,
    columns,
    eventColumns,
    detailPrefix,
    groupKey,
    expanded = false
) {
    const detailId = detailPrefix + index;
    const cells = columns
        .map(
            (column) =>
                '<td class="' +
                html(columnClasses(column)) +
                '">' +
                html(displayCell(group, column)) +
                '</td>'
        )
        .join('');

    return (
        '<tr><td><button class="event-toggle session-group-toggle" type="button" aria-expanded="' +
        String(expanded) +
        '" data-detail="' +
        detailId +
        '" data-group-key="' +
        html(groupKey) +
        '">' +
        (expanded ? '-' : '+') +
        '</button></td>' +
        cells +
        '</tr><tr class="event-detail-row" data-detail-row="' +
        detailId +
        '"' +
        (expanded ? '' : ' hidden') +
        '><td colspan="' +
        (columns.length + 1) +
        '">' +
        renderSessionGroupEventsTable(group.events || [], eventColumns) +
        '</td></tr>'
    );
}

/**
 * Renders the event detail rows nested under a session.
 *
 * @param {object[]} rows Event rows for one session.
 * @param {string[]} columns Visible event detail columns.
 * @returns {string} Nested event table markup.
 */
function renderSessionGroupEventsTable(rows, columns) {
    const head =
        '<thead><tr>' +
        columns
            .map(
                (column) =>
                    '<th class="' +
                    html(columnClasses(column)) +
                    '">' +
                    columnLabelHtml(column, sessionGroupEventColumnLabels) +
                    '</th>'
            )
            .join('') +
        '</tr></thead>';
    const body =
        '<tbody>' +
        rows
            .map(
                (row) =>
                    '<tr>' +
                    columns
                        .map(
                            (column) =>
                                '<td class="' +
                                html(columnClasses(column)) +
                                '">' +
                                html(displaySessionEventCell(row, column)) +
                                '</td>'
                        )
                        .join('') +
                    '</tr>'
            )
            .join('') +
        '</tbody>';

    return (
        '<table class="nested-events-table">' +
        renderColumnGroup(columns) +
        head +
        body +
        '</table>'
    );
}

/**
 * Formats a nested session event cell.
 *
 * @param {object} row Event row.
 * @param {string} column Report field key.
 * @returns {string | number} Display-ready field value.
 */
function displaySessionEventCell(row, column) {
    if (column === 'session_id') {
        return display('turn_index', row.turn_index);
    }

    return displayCell(row, column);
}

/**
 * Renders model and intelligence groups with event rows nested under each group.
 *
 * @param {string} id Table element id.
 * @param {object[]} rows Normalized event rows.
 * @returns {void}
 */
function renderModelGroupsTable(id, rows) {
    const table = document.getElementById(id);
    const groups = buildModelGroups(rows);

    if (groups.length === 0) {
        table.innerHTML = '<tbody><tr><td>No rows found.</td></tr></tbody>';
        return;
    }

    const expandedRows = new Set(modelGroupsTableState.expanded);
    const expandedSessionRows = new Set(modelGroupsTableState.expandedSessions);
    const head =
        '<thead><tr><th></th>' +
        modelGroupColumns
            .map(
                (column) =>
                    '<th class="' +
                    html(columnClasses(column)) +
                    '">' +
                    columnLabelHtml(column, tableColumnLabels) +
                    '</th>'
            )
            .join('') +
        '</tr></thead>';
    const body =
        '<tbody>' +
        groups
            .map((group, index) =>
                renderModelGroupRow(
                    group,
                    index,
                    expandedSessionRows,
                    expandedRows.has(modelGroupRowKey(group))
                )
            )
            .join('') +
        '</tbody>';

    table.innerHTML = renderColumnGroup(modelGroupColumns, true) + head + body;
    table.querySelectorAll('.model-group-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const detailRow = table.querySelector(
                '[data-detail-row="' + button.dataset.detail + '"]'
            );
            const expanded = button.getAttribute('aria-expanded') === 'true';
            const groupKey = button.dataset.groupKey || '';

            button.setAttribute('aria-expanded', String(!expanded));
            button.textContent = expanded ? '+' : '-';
            detailRow.hidden = expanded;
            if (expanded) {
                expandedRows.delete(groupKey);
            } else {
                expandedRows.add(groupKey);
            }
            modelGroupsTableState.expanded = [...expandedRows];
            writeModelGroupsTableState(modelGroupsTableState);
        });
    });
    table.querySelectorAll('.model-session-group-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const detailRow = table.querySelector(
                '[data-detail-row="' + button.dataset.detail + '"]'
            );
            const expanded = button.getAttribute('aria-expanded') === 'true';
            const groupKey = button.dataset.groupKey || '';

            button.setAttribute('aria-expanded', String(!expanded));
            button.textContent = expanded ? '+' : '-';
            detailRow.hidden = expanded;
            if (expanded) {
                expandedSessionRows.delete(groupKey);
            } else {
                expandedSessionRows.add(groupKey);
            }
            modelGroupsTableState.expandedSessions = [...expandedSessionRows];
            writeModelGroupsTableState(modelGroupsTableState);
        });
    });
}

/**
 * Builds sorted summary rows for each model and intelligence level.
 *
 * @param {object[]} rows Normalized event rows.
 * @returns {object[]} Model group summary rows.
 */
function buildModelGroups(rows) {
    /** @type {Map<string, object[]>} */
    const groupedRows = new Map();

    for (const row of rows) {
        const model = String(row.model ?? 'unknown');
        const level = String(row.intelligence_level ?? 'unknown');
        const key = [model, level].join('|');
        const groupRows = groupedRows.get(key) ?? [];
        groupRows.push(row);
        groupedRows.set(key, groupRows);
    }

    return [...groupedRows.values()]
        .map(summarizeModelGroup)
        .sort(compareModelGroups);
}

/**
 * Summarizes all events for one model and intelligence level.
 *
 * @param {object[]} rows Rows for one model and intelligence level.
 * @returns {object} Model group summary row.
 */
function summarizeModelGroup(rows) {
    const sortedRows = [...rows].sort((first, second) =>
        first.timestamp.localeCompare(second.timestamp)
    );
    const firstRow = sortedRows[0] ?? {};
    const totals = sumRows(sortedRows);

    return {
        raw_model: String(firstRow.model ?? 'unknown'),
        intelligence_level: String(firstRow.intelligence_level ?? 'unknown'),
        model:
            String(firstRow.model ?? 'unknown') +
            '/' +
            String(firstRow.intelligence_level ?? 'unknown'),
        event_count: sortedRows.length,
        sessions: uniqueStrings(sortedRows, 'session_id'),
        events: sortedRows,
        ...totals,
    };
}

/**
 * Sums token and derived token fields for a group of rows.
 *
 * @param {object[]} rows Rows to summarize.
 * @returns {Record<string, number>} Summed model group totals.
 */
function sumRows(rows) {
    /** @type {Record<string, number>} */
    const totals = {
        input_tokens: 0,
        cached_input_tokens: 0,
        output_tokens: 0,
        reasoning_output_tokens: 0,
        raw_total_tokens: 0,
        observed_token_volume: 0,
        effective_input_tokens: 0,
        visible_output_tokens: 0,
    };

    for (const row of rows) {
        for (const field of Object.keys(totals)) {
            totals[field] += Number(row[field] ?? 0);
        }
    }

    totals.cache_hit_rate = totals.input_tokens
        ? totals.cached_input_tokens / totals.input_tokens
        : 0;
    totals.reasoning_output_rate = totals.output_tokens
        ? totals.reasoning_output_tokens / totals.output_tokens
        : 0;

    return totals;
}

/**
 * Reads unique string values for a row field.
 *
 * @param {object[]} rows Rows to inspect.
 * @param {string} field Field name.
 * @returns {string[]} Unique values in sorted order.
 */
function uniqueStrings(rows, field) {
    return [
        ...new Set(rows.map((row) => String(row[field] ?? 'unknown'))),
    ].sort();
}

/**
 * Sorts model groups by model name and then known intelligence level order.
 *
 * @param {object} left First model group.
 * @param {object} right Second model group.
 * @returns {number} Sort order.
 */
function compareModelGroups(left, right) {
    return (
        String(left.raw_model ?? '').localeCompare(
            String(right.raw_model ?? '')
        ) ||
        intelligenceLevelOrder(left.intelligence_level) -
            intelligenceLevelOrder(right.intelligence_level) ||
        String(left.intelligence_level ?? '').localeCompare(
            String(right.intelligence_level ?? '')
        )
    );
}

/**
 * Gets the requested sort order for known intelligence levels.
 *
 * @param {unknown} level Intelligence level value.
 * @returns {number} Sort order index.
 */
function intelligenceLevelOrder(level) {
    const levels = ['low', 'medium', 'high', 'xhigh'];
    const index = levels.indexOf(String(level ?? ''));

    return index === -1 ? levels.length : index;
}

/**
 * Renders one expandable model group summary row.
 *
 * @param {object} group Model group summary row.
 * @param {number} index Row index.
 * @param {Set<string>} expandedSessionRows Expanded nested session identities.
 * @param {boolean} expanded Whether the row should render expanded.
 * @returns {string} Table row markup.
 */
function renderModelGroupRow(
    group,
    index,
    expandedSessionRows,
    expanded = false
) {
    const detailId = 'model-group-' + index;
    const cells = modelGroupColumns
        .map(
            (column) =>
                '<td class="' +
                html(columnClasses(column)) +
                '">' +
                html(displayCell(group, column)) +
                '</td>'
        )
        .join('');

    return (
        '<tr><td><button class="event-toggle model-group-toggle" type="button" aria-expanded="' +
        String(expanded) +
        '" data-detail="' +
        detailId +
        '" data-group-key="' +
        html(modelGroupRowKey(group)) +
        '">' +
        (expanded ? '-' : '+') +
        '</button></td>' +
        cells +
        '</tr><tr class="event-detail-row" data-detail-row="' +
        detailId +
        '"' +
        (expanded ? '' : ' hidden') +
        '><td colspan="' +
        (modelGroupColumns.length + 1) +
        '">' +
        renderModelGroupSessionsTable(
            group.events || [],
            index,
            modelGroupRowKey(group),
            expandedSessionRows
        ) +
        '</td></tr>'
    );
}

/**
 * Renders model-filtered sessions nested under a model group.
 *
 * @param {object[]} rows Event rows for one model and intelligence level.
 * @param {number} modelIndex Parent model row index.
 * @param {string} modelKey Parent model group identity.
 * @param {Set<string>} expandedSessionRows Expanded nested session identities.
 * @returns {string} Nested session table markup.
 */
function renderModelGroupSessionsTable(
    rows,
    modelIndex,
    modelKey,
    expandedSessionRows
) {
    const groups = buildSessionGroups(rows);
    const head =
        '<thead><tr>' +
        '<th></th>' +
        modelSessionGroupColumns
            .map(
                (column) =>
                    '<th class="' +
                    html(columnClasses(column)) +
                    '">' +
                    columnLabelHtml(column, sessionGroupColumnLabels) +
                    '</th>'
            )
            .join('') +
        '</tr></thead>';
    const body =
        '<tbody>' +
        groups
            .map((group, sessionIndex) =>
                renderModelSessionGroupRow(
                    group,
                    modelIndex,
                    sessionIndex,
                    modelKey,
                    expandedSessionRows
                )
            )
            .join('') +
        '</tbody>';

    return (
        '<table class="nested-events-table">' +
        renderColumnGroup(modelSessionGroupColumns, true) +
        head +
        body +
        '</table>'
    );
}

/**
 * Renders one model-filtered session summary row.
 *
 * @param {object} group Session group summary row.
 * @param {number} modelIndex Parent model row index.
 * @param {number} sessionIndex Session row index within the parent model.
 * @param {string} modelKey Parent model group identity.
 * @param {Set<string>} expandedSessionRows Expanded nested session identities.
 * @returns {string} Table row markup.
 */
function renderModelSessionGroupRow(
    group,
    modelIndex,
    sessionIndex,
    modelKey,
    expandedSessionRows
) {
    const groupKey = modelSessionGroupRowKey(modelKey, group);
    const rowMarkup = renderSessionGroupRow(
        group,
        sessionIndex,
        modelSessionGroupColumns,
        modelSessionGroupEventColumns,
        'model-' + modelIndex + '-session-group-',
        groupKey,
        expandedSessionRows.has(groupKey)
    );

    return rowMarkup.replace(
        'session-group-toggle',
        'session-group-toggle model-session-group-toggle'
    );
}

function compareValues(left, right) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber;
    }
    return String(left ?? '').localeCompare(String(right ?? ''));
}

/**
 * Renders the source session paths used by the current report.
 *
 * @returns {void}
 */
function renderSessionPaths() {
    const node = document.getElementById('session-paths');
    const paths = uniqueSessionPaths();

    if (paths.length === 0) {
        node.innerHTML =
            '<div class="empty">No session paths found in this report window.</div>';
        return;
    }

    node.innerHTML =
        '<div class="session-path-list">' +
        paths
            .map(
                (path) =>
                    '<div><strong>' +
                    html(sessionFileReference(path)) +
                    '</strong><code>' +
                    html(path) +
                    '</code></div>'
            )
            .join('') +
        '</div>';
}

/**
 * Gets sorted unique session source file paths from sessions and rows.
 *
 * @returns {string[]} Unique session file paths.
 */
function uniqueSessionPaths() {
    const paths = new Set();

    for (const session of report.sessions || []) {
        if (session.source_file) {
            paths.add(String(session.source_file));
        }
    }
    for (const row of report.rows || []) {
        if (row.file) {
            paths.add(String(row.file));
        }
    }

    return [...paths].sort();
}

document.getElementById('window').textContent =
    datetime(report.window.cutoff) +
    ' to ' +
    datetime(report.window.now) +
    ' (' +
    report.window.minutes +
    ' minutes)';
document.getElementById('generated').textContent =
    'Generated ' + datetime(report.metadata.generated_at);
renderReportControls();
renderQuota();
renderSummary();
renderTimeline();
renderOutputTokenTimeline();
renderInsights();
// Top Sessions and Top Events are temporarily disabled.
// renderTopSessions();
// renderTopEvents();
renderModelGroupsTable('models-table', report.rows || []);
renderSessionGroupsTable('events-table', report.rows || []);
renderSessionPaths();
