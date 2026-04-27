import { homedir } from 'node:os';
import { join } from 'node:path';

export const ALLOWED_WORKSPACE_ROOTS = ['/opt/codex', '/tmp'];
export const DEFAULT_CODEX_HOME = join(homedir(), '.codex');
export const DEFAULT_HISTORY_PATH = '/opt/codex/data/codex-usage/history.jsonl';
export const DEFAULT_WINDOW_MINUTES = 15;
export const SESSION_DIR_NAMES = ['sessions', 'archived_sessions'];
export const TOKEN_FIELDS = [
    'input_tokens',
    'cached_input_tokens',
    'output_tokens',
    'reasoning_output_tokens',
    'raw_total_tokens',
];
export const DERIVED_TOKEN_FIELDS = [
    'observed_token_volume',
    'effective_input_tokens',
    'visible_output_tokens',
    'cache_hit_rate',
    'reasoning_output_rate',
];
export const LARGE_INPUT_TOKEN_THRESHOLD = 25000;
export const LARGE_EVENT_TOKEN_THRESHOLD = 100000;
