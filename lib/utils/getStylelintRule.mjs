import rules from '../rules/index.mjs';

/**
 * @param {string} ruleName
 * @param {import('tripleten-stylelint').Config | undefined} [config]
 * @returns {Promise<import('tripleten-stylelint').Rule | undefined>}
 */
export default function getStylelintRule(ruleName, config) {
	if (isBuiltInRule(ruleName)) {
		return rules[ruleName];
	}

	return Promise.resolve(config?.pluginFunctions?.[ruleName]);
}

/**
 * @param {string} ruleName
 * @returns {ruleName is keyof rules}
 */
function isBuiltInRule(ruleName) {
	return ruleName in rules;
}
