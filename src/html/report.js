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
const eventColumns = [
    'timestamp',
    'session_id',
    'turn_index',
    'seconds_since_previous',
    'model',
    'intelligence_level',
    'observed_token_volume',
    'effective_input_tokens',
    'cached_input_tokens',
    'cache_hit_rate',
    'output_tokens',
    'reasoning_output_tokens',
];
const detailColumns = [
    'input_tokens',
    'visible_output_tokens',
    'reasoning_output_rate',
    'raw_total_tokens',
    'file',
];
const eventTableState = readEventTableState();

function integer(value) {
    return Math.round(Number(value || 0)).toLocaleString('en-US');
}

function percent(value) {
    return (Number(value || 0) * 100).toFixed(1) + '%';
}

function display(field, value) {
    if (field.endsWith('_rate')) {
        return percent(value);
    }
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    if (numberFields.has(field)) {
        return integer(value);
    }
    return value ?? '';
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

function renderSummary() {
    const totals = report.totals || {};
    const cards = [
        ['Observed Token Volume', integer(totals.observed_token_volume), 1],
        ['Effective Input', integer(totals.effective_input_tokens), 1],
        [
            'Cached Input',
            integer(totals.cached_input_tokens),
            totals.cache_hit_rate,
        ],
        [
            'Cache Hit Rate',
            percent(totals.cache_hit_rate),
            totals.cache_hit_rate,
        ],
        ['Output Tokens', integer(totals.output_tokens), 1],
        [
            'Reasoning Output',
            integer(totals.reasoning_output_tokens),
            totals.reasoning_output_rate,
        ],
        ['Sessions', integer((report.sessions || []).length), 1],
        ['Events', integer((report.rows || []).length), 1],
    ];
    document.getElementById('summary').innerHTML = cards
        .map(
            ([label, value, rate]) =>
                '<article class="card"><div class="label">' +
                html(label) +
                '</div><div class="value">' +
                html(value) +
                '</div><div class="bar"><span style="width:' +
                Math.max(0, Math.min(100, Number(rate || 0) * 100)) +
                '%"></span></div></article>'
        )
        .join('');
}

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
            (limit.resets_at_local
                ? ', resets ' + html(limit.resets_at_local)
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

function renderTopSessions() {
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
                html(session.session_id) +
                '</strong><span class="value">' +
                integer(session.observed_token_volume) +
                '</span></header><div class="stats"><span>Events<b>' +
                integer(session.event_count) +
                '</b></span><span>First<b>' +
                html(session.first_timestamp) +
                '</b></span><span>Last<b>' +
                html(session.last_timestamp) +
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
}

function renderTopEvents() {
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
                html(row.timestamp) +
                '</strong><span class="value">' +
                integer(row.observed_token_volume) +
                '</span></header><div class="stats"><span>Session<b>' +
                html(row.session_id) +
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
}

function renderTimeline() {
    const node = document.getElementById('timeline');
    const rows = report.rows || [];
    if (rows.length === 0) {
        node.innerHTML =
            '<div class="empty">No events found for the timeline.</div>';
        return;
    }

    const buckets = buildTimelineBuckets(rows);
    if (buckets.length === 0) {
        node.innerHTML =
            '<div class="empty">No valid timestamps found for the timeline.</div>';
        return;
    }
    const maxVolume = Math.max(
        ...buckets.map((bucket) => bucket.observed_token_volume),
        1
    );
    const width = Math.max(920, buckets.length * 18 + 80);
    const height = 210;
    const chartTop = 18;
    const chartHeight = 150;
    const barGap = 3;
    const barWidth = Math.max(4, (width - 80) / buckets.length - barGap);
    const colors = {
        cached_input_tokens: '#6ad1c9',
        effective_input_tokens: '#87a8ff',
        output_tokens: '#f3b563',
        reasoning_output_tokens: '#c58cff',
    };
    const rects = buckets
        .map((bucket, index) => {
            const x = 50 + index * (barWidth + barGap);
            let y = chartTop + chartHeight;
            const segments = [
                'cached_input_tokens',
                'effective_input_tokens',
                'output_tokens',
                'reasoning_output_tokens',
            ];
            return segments
                .map((field) => {
                    const segmentHeight = Math.max(
                        0,
                        (Number(bucket[field] || 0) / maxVolume) * chartHeight
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
                        colors[field] +
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
        '" role="img" aria-label="Token usage timeline"><line x1="45" y1="' +
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
        '</text></svg><div class="legend"><span style="--legend-color: var(--cached)">Cached input</span><span style="--legend-color: var(--effective)">Effective input</span><span style="--legend-color: var(--output)">Output</span><span style="--legend-color: var(--reasoning)">Reasoning output</span></div>';
}

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
            label: new Date(bucketStart).toISOString(),
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

function timelineTitle(bucket) {
    return [
        bucket.label,
        'session: ' + bucket.session_id,
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
    ].join('\\n');
}

/**
 * Reads persisted Events table state for the current report file.
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
 * Persists Events table state when browser storage is available.
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
        'events-table-state',
        window.location.pathname,
        report.metadata.codex_home || '',
        report.window.minutes || '',
    ].join(':');
}

/**
 * Builds a stable identity for an event row across generated page reloads.
 *
 * @param {object} row Report event row.
 * @returns {string} Event identity.
 */
function eventRowKey(row) {
    return [
        row.timestamp,
        row.session_id,
        row.turn_index,
        row.raw_total_tokens,
        row.observed_token_volume,
    ]
        .map((value) => String(value ?? ''))
        .join('|');
}

/**
 * Renders a sortable table and restores Events detail expansion state.
 *
 * @param {string} id Table element id.
 * @param {object[]} rows Table rows.
 * @param {string[]} columns Visible columns.
 * @param {{ details?: boolean }} [options] Rendering options.
 * @returns {void}
 */
function renderTable(id, rows, columns, options = {}) {
    const table = document.getElementById(id);
    if (rows.length === 0) {
        table.innerHTML = '<tbody><tr><td>No rows found.</td></tr></tbody>';
        return;
    }
    const expandedRows = new Set(
        options.details ? eventTableState.expanded : []
    );
    let sortColumn =
        options.details && columns.includes(eventTableState.sortColumn)
            ? eventTableState.sortColumn
            : columns[0];
    let sortDirection = options.details ? eventTableState.sortDirection : 1;

    /**
     * Draws the current table view and wires interactive controls.
     *
     * @returns {void}
     */
    function draw() {
        const sortedRows = [...rows].sort(
            (left, right) =>
                compareValues(left[sortColumn], right[sortColumn]) *
                sortDirection
        );
        const head =
            '<thead><tr>' +
            (options.details ? '<th></th>' : '') +
            columns
                .map(
                    (column) =>
                        '<th data-column="' +
                        html(column) +
                        '">' +
                        html(column) +
                        '</th>'
                )
                .join('') +
            '</tr></thead>';
        const body =
            '<tbody>' +
            sortedRows
                .map((row, index) =>
                    renderTableRow(
                        row,
                        columns,
                        index,
                        options,
                        expandedRows.has(eventRowKey(row))
                    )
                )
                .join('') +
            '</tbody>';
        table.innerHTML = head + body;
        table.querySelectorAll('th[data-column]').forEach((header) => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                if (sortColumn === column) {
                    sortDirection *= -1;
                } else {
                    sortColumn = column;
                    sortDirection = 1;
                }
                if (options.details) {
                    eventTableState.sortColumn = sortColumn;
                    eventTableState.sortDirection = sortDirection;
                    writeEventTableState(eventTableState);
                }
                draw();
            });
        });
        table.querySelectorAll('.event-toggle').forEach((button) => {
            button.addEventListener('click', () => {
                const detailRow = table.querySelector(
                    '[data-detail-row="' + button.dataset.detail + '"]'
                );
                const expanded =
                    button.getAttribute('aria-expanded') === 'true';
                const eventKey = button.dataset.eventKey || '';
                button.setAttribute('aria-expanded', String(!expanded));
                button.textContent = expanded ? '+' : '-';
                detailRow.hidden = expanded;
                if (expanded) {
                    expandedRows.delete(eventKey);
                } else {
                    expandedRows.add(eventKey);
                }
                eventTableState.expanded = [...expandedRows];
                writeEventTableState(eventTableState);
            });
        });
    }

    draw();
}

/**
 * Renders a table row and optional event detail row.
 *
 * @param {object} row Report row.
 * @param {string[]} columns Visible columns.
 * @param {number} index Row index in the current sorted view.
 * @param {{ details?: boolean }} options Rendering options.
 * @param {boolean} [expanded] Whether the detail row should render expanded.
 * @returns {string} Table row markup.
 */
function renderTableRow(row, columns, index, options, expanded = false) {
    const cells = columns
        .map(
            (column) =>
                '<td class="' +
                (numberFields.has(column) ? 'number' : '') +
                '">' +
                html(display(column, row[column])) +
                '</td>'
        )
        .join('');
    if (!options.details) {
        return '<tr>' + cells + '</tr>';
    }
    const detailId = 'event-' + index;
    const detail = detailColumns
        .map(
            (column) =>
                '<span>' +
                html(column) +
                '<b>' +
                html(display(column, row[column])) +
                '</b></span>'
        )
        .join('');
    return (
        '<tr><td><button class="event-toggle" type="button" aria-expanded="' +
        String(expanded) +
        '" data-detail="' +
        detailId +
        '" data-event-key="' +
        html(eventRowKey(row)) +
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
        '"><div class="event-detail">' +
        detail +
        '</div></td></tr>'
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

document.getElementById('window').textContent =
    report.window.cutoff +
    ' to ' +
    report.window.now +
    ' (' +
    report.window.minutes +
    ' minutes)';
document.getElementById('generated').textContent =
    'Generated ' + report.metadata.generated_at;
renderQuota();
renderSummary();
renderTimeline();
renderInsights();
renderTopSessions();
renderTopEvents();
renderTable('models-table', report.models || [], [
    'model',
    'event_count',
    'sessions',
    'intelligence_levels',
    'observed_token_volume',
    'effective_input_tokens',
    'cached_input_tokens',
    'cache_hit_rate',
    'output_tokens',
    'reasoning_output_tokens',
    'raw_total_tokens',
]);
renderTable('events-table', report.rows || [], eventColumns, {
    details: true,
});
