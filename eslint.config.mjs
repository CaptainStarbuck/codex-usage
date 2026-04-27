/**
 * @ts-check
 */

// v251213
import js from '@eslint/js';
import json from '@eslint/json';
import importPlugin from 'eslint-plugin-import';
import jsonc from 'eslint-plugin-jsonc';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

/**
 * @typedef {import("eslint").Linter.Config} EslintConfig
 * @typedef {import("eslint").Linter.LanguageOptions} LanguageOptions
 * @//typedef {import("@typescript-eslint/parser").ParserOptions} TsParserOptions
 */

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const tsProjectFiles = [
    './tsconfig.json', // includes "references"
];
const commonIgnores = [
    '**/node_modules/**',
    '**/dist/**',
    '**/.local/**',
    '**/docs/**',
    '**/logs/**',
];
const thisIgnores = [...commonIgnores, '**/resources/**'];
const tsFilePatterns = ['**/*.{ts,tsx,mts,cts}'];
const jsFilePatterns = ['**/*.{js,jsx,mjs,cjs}'];
const allScriptFilePatterns = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'];
// eslint-disable-next-line no-unused-vars
const jsSimpleFilePatterns = ['**/*.js', '**/*.d.ts'];

// /** @type {TsParserOptions} */
// const tsParserOptions = {
//     project: [path.join(projectRoot, 'tsconfig.json')],
//     tsconfigRootDir: projectRoot,
// };

const projectGlobals = ['ExplorableLinksConfig'];
const thisGlobals = {
    ...globals.browser,
    ...globals.node, // <-- adds `global`, `process`, `Buffer`, etc.
    ...Object.fromEntries(projectGlobals.map((name) => [name, 'readonly'])),
};

const sharedLanguageOptions = /** @type {LanguageOptions} */ ({
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: thisGlobals,
});

const [tsBaseConfig, tsEslintAdjustments, tsRecommendedRules] =
    tseslint.configs.recommendedTypeChecked;

const typeAwareLanguageOptions = {
    ...sharedLanguageOptions,
    parser: tsBaseConfig.languageOptions?.parser,
    parserOptions: {
        ...tsBaseConfig.languageOptions?.parserOptions,
        projectService: true,
        // project: tsProjectFiles,
        tsconfigRootDir: projectRoot,
    },
};

const typeAwareConfigs = /** @type {EslintConfig[]} */ ([
    {
        files: tsFilePatterns,
        languageOptions: typeAwareLanguageOptions,
        ...tsEslintAdjustments,
        name: 'tsEslintAdjustments',
    },
    {
        files: tsFilePatterns,
        languageOptions: typeAwareLanguageOptions,
        ...tsRecommendedRules,
        name: 'tsRecommendedRules',
    },
    // stylistic set that is type-aware
    // (harmless, commonly paired,disable if it's not helping)
    ...tseslint.configs.stylisticTypeChecked.map((cfg) => ({
        ...cfg,
        files: tsFilePatterns,
    })),
]);

/** @type {NonNullable<EslintConfig['rules']>} */
const jsonStrictRules = {
    'json/no-duplicate-keys': 'error',
    'json/no-empty-keys': 'error',
    'json/no-unnormalized-keys': 'error',
    'json/no-unsafe-values': 'error',
};
const jsonPlugins = /** @type {EslintConfig} */ ({
    name: 'jsonPlugins',
    plugins: {
        json,
        jsonc,
    },
});

const jsoncPreferred = /** @type {EslintConfig[]} */ ([
    {
        name: 'jsoncPreferred',
        files: ['**/*.json', '**/*.jsonc'],
        language: 'json/jsonc', // allow JSONC features (comments, trailing commas, etc.)
        rules: {
            ...jsonStrictRules,
            // Consider jsonc-specific rules later...
            // 'jsonc/no-comments': 'off',
            // 'jsonc/no-trailing-commas': 'off',
        },
    },
]);

const projectJsonC = /** @type {EslintConfig} */ ({
    name: 'projectJsonC',
    files: [
        '**/package.json',
        //'**/tsconfig*.json',
        // other strictly-JSON files / paths
    ],
    language: 'json/json', // strict JSON
    rules: {
        ...jsonStrictRules,
        // Optionally tighten or tweak rules specifically for these files:
        // 'jsonc/some-jsonc-only-rule': 'off',
    },
});

const importRecommended = /** @type {EslintConfig} */ ({
    ...importPlugin.flatConfigs.recommended,
    name: 'importRecommended',
    files: allScriptFilePatterns,
    languageOptions: sharedLanguageOptions,
    settings: {
        ...importPlugin.flatConfigs.recommended.settings,
        'import/resolver': {
            ...(importPlugin.flatConfigs.recommended.settings?.[
                'import/resolver'
            ] ?? {}),
            typescript: {
                project: tsProjectFiles,
                alwaysTryTypes: true,
            },
        },
    },
    rules: {
        ...importPlugin.flatConfigs.recommended.rules,
        'import/no-extraneous-dependencies': [
            'error',
            {
                devDependencies: true,
                optionalDependencies: false,
                peerDependencies: false,
            },
        ],
    },
});

const importTypescriptAdjustments = /** @type {EslintConfig} */ ({
    ...importPlugin.flatConfigs.typescript,
    name: 'importTypescriptAdjustments',
    files: tsFilePatterns,
    languageOptions: sharedLanguageOptions,
    settings: {
        ...importPlugin.flatConfigs.typescript.settings,
        'import/resolver': {
            ...(importPlugin.flatConfigs.typescript.settings?.[
                'import/resolver'
            ] ?? {}),
            typescript: {
                project: tsProjectFiles,
                alwaysTryTypes: true,
            },
        },
    },
});

const commonJSTSRuleMods = /** @type {EslintConfig[]} */ ([
    {
        name: 'commonJSTSRuleMods/ts-and-js',
        files: allScriptFilePatterns,
        rules: {
            'no-console': 'off',
            // Important when using the TS parser:
            // TS handles undefined identifiers via type info from .d.ts.
            // ESLint core can't see ambient .d.ts and reports things like
            // _AddPersmissions() as undefined.
            'no-undef': 'error',

            // Basic issues, tune as preferred
            'array-callback-return': 'error',
            'no-await-in-loop': 'error',
            'no-constructor-return': 'error',
            'no-duplicate-imports': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-promise-executor-return': 'error',
            'no-self-compare': 'error',
            'no-template-curly-in-string': 'error',
            // "no-undef-init": "error",
            'require-atomic-updates': 'error',

            // Best practices
            'accessor-pairs': 'error',
            'block-scoped-var': 'error',
            'consistent-return': 'error',
            'default-param-last': 'error',
            'dot-notation': 'error',
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'grouped-accessor-pairs': 'error',
            'guard-for-in': 'error',
            'no-caller': 'error',
            'no-const-assign': 'error',
            'no-eval': 'error',
            'no-extend-native': 'error',
            'no-extra-bind': 'error',
            'no-iterator': 'error',
            'no-labels': 'error',
            'no-lone-blocks': 'error',
            'no-multi-str': 'error',
            'no-new-wrappers': 'error',
            'no-octal-escape': 'error',
            'no-proto': 'error',
            'no-return-assign': ['error', 'always'],
            'no-script-url': 'error',
            'no-sequences': 'error',
            'no-throw-literal': 'error',
            'no-useless-call': 'error',
            'no-useless-concat': 'error',
            'no-useless-return': 'error',
            'prefer-promise-reject-errors': 'error',
            radix: 'error',
            'require-await': 'error',
            'vars-on-top': 'error',
            yoda: ['error', 'never'],

            // Variables
            'no-delete-var': 'error',
            'no-shadow': 'error',
            //no-unused-vars is handled by TS
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'no-use-before-define': [
                'error',
                { functions: false, classes: true, variables: true },
            ],
        },
    },
    {
        name: 'commonJSTSRuleMods/ts-only',
        files: tsFilePatterns,
        rules: {
            '@typescript-eslint/no-misused-promises': [
                'error',
                {
                    checksVoidReturn: {
                        attributes: false,
                    },
                },
            ],
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/array-type': 'warn',
            '@typescript-eslint/no-confusing-void-expression': [
                'warn',
                { ignoreArrowShorthand: true },
            ],
            '@typescript-eslint/prefer-optional-chain': 'warn',
            // When we rely on the TS resolver, quiet the base rule:
            //'import/no-unresolved': 'off',
            // encourage disciplined ts-ignore usage when truly needed
            '@typescript-eslint/ban-ts-comment': [
                'warn',
                {
                    'ts-expect-error': 'allow-with-description',
                    'ts-ignore': 'allow-with-description',
                },
            ],
            // Disable JS rules that aren't prepared for TS
            'no-unused-vars': 'off',
            'no-undef': 'off',
            'no-redeclare': 'off',
            'no-shadow': 'off',
            'no-use-before-define': 'off',
            'no-empty-function': 'off',
            'no-unused-expressions': 'off',
            'dot-notation': 'off',
            'default-param-last': 'off',
            'prefer-promise-reject-errors': 'off',
            'no-implied-eval': 'off',
        },
    },
]);

const projectJSTSRuleMods = /** @type {EslintConfig[]} */ ([
    {
        // files: [],
        // rules: {},
    },
]);

const aggregateJSTSRuleMods = /** @type {EslintConfig[]} */ ([
    ...commonJSTSRuleMods,
    ...projectJSTSRuleMods,
]);

const configArray = /** @type {EslintConfig[]} */ ([
    {
        name: 'ignores',
        ignores: thisIgnores,
    },
    jsonPlugins,
    {
        files: jsFilePatterns,
        languageOptions: sharedLanguageOptions,
        ...js.configs.recommended,
        name: 'js.configs.recommended',
    },
    importRecommended,
    importTypescriptAdjustments,
    ...jsoncPreferred, // Prefer JSONC behavior for all JSON-ish files
    projectJsonC, // Then override for project-specific strict JSON files
    ...typeAwareConfigs,
    ...aggregateJSTSRuleMods,
]);

//console.dir(configArray, { depth: 3 });
export default defineConfig(configArray);
