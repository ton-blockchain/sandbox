const base = require('@ton/toolchain');
const globals = require('globals');

module.exports = [
    ...base,
    {
        ignores: [
            'src/executor/emulator-emscripten*',
            'src/config/config.tlb-gen.ts',
            'src/config/defaultConfig.ts',
            'src/config/slimConfig.ts',
        ],
    },
    {
        files: ['src/jest/**/*.ts', 'src/jest/**/*.tsx'],
        languageOptions: {
            globals: {
                ...globals.jest,
                ...globals.node,
            },
        },
    },
];
