/**
 * Prettier config file
 * Alternative to .prettierrc
 * .js/.cjs allows comments
 */

/*
babel-ts might support JavaScript features (proposals) not yet supported by TypeScript,
but it's less permissive when it comes to invalid code and less battle-tested than the
typescript parser.
*/

/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
export default {
    semi: true,
    singleQuote: true,
    tabWidth: 4,
    printWidth: 80,
    trailingComma: 'es5',
    arrowParens: 'always',
    overrides: [
        {
            files: ['*tsconfig*.json'],
            // parser: 'json' | 'jsonc',
            options: {
                trailingComma: 'none', // don't force a trailing comma to the end of objects for tsconfig files
            },
        },
        {
            files: ['*.js', '*.cjs'],
            options: {
                parser: 'babel',
            },
        },
        {
            files: ['*.ts', '*.mts'],
            options: {
                parser: 'babel-ts',
            },
        },
        {
            files: '*.md',
            options: {
                printWidth: 100,
                proseWrap: 'preserve',
            },
        },
    ],
};
