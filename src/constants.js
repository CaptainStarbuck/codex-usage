import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_DATA_PATH = '/tmp/codex-usage';
export const DATA_PATH_WINDOWS_DEFAULT = 'C:\\Temp\\codex-usage';
export const DEFAULT_CODEX_HOME = join(homedir(), '.codex');
export const DEFAULT_HISTORY_FILE_NAME = 'history.jsonl';
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
