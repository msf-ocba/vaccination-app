/** @format */

module.exports = {
    extends: [
        'react-app',
        'prettier',
        "plugin:cypress/recommended"
    ],
    rules: {
        'no-console': 'off',
        'no-unused-vars': ["error", { "argsIgnorePattern": "^_" }],
    },
    plugins: [
        "cypress"
    ],
    env: {'cypress/globals': true},
    settings: {
        "react": {
            "pragma": "React",
            "version": "16.6.0"
        },
    },
};
