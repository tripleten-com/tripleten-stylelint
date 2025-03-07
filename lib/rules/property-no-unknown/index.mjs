import { all as properties } from 'known-css-properties';

import { isAtRule, isRule } from '../../utils/typeGuards.mjs';
import { isBoolean, isRegExp, isString } from '../../utils/validateTypes.mjs';
import isCustomProperty from '../../utils/isCustomProperty.mjs';
import isStandardSyntaxDeclaration from '../../utils/isStandardSyntaxDeclaration.mjs';
import isStandardSyntaxProperty from '../../utils/isStandardSyntaxProperty.mjs';
import optionsMatches from '../../utils/optionsMatches.mjs';
import report from '../../utils/report.mjs';
import ruleMessages from '../../utils/ruleMessages.mjs';
import validateOptions from '../../utils/validateOptions.mjs';
import vendor from '../../utils/vendor.mjs';

const ruleName = 'property-no-unknown';

const messages = ruleMessages(ruleName, {
	rejected: (property) => `Unexpected unknown property "${property}"`,
});

const meta = {
	url: 'https://stylelint.io/user-guide/rules/property-no-unknown',
};

/** @type {import('tripleten-stylelint').Rule} */
const rule = (primary, secondaryOptions) => {
	const allValidProperties = new Set(properties);

	return (root, result) => {
		const validOptions = validateOptions(
			result,
			ruleName,
			{ actual: primary },
			{
				actual: secondaryOptions,
				possible: {
					ignoreProperties: [isString, isRegExp],
					checkPrefixed: [isBoolean],
					ignoreSelectors: [isString, isRegExp],
					ignoreAtRules: [isString, isRegExp],
				},
				optional: true,
			},
		);

		if (!validOptions) {
			return;
		}

		const shouldCheckPrefixed = secondaryOptions && secondaryOptions.checkPrefixed;

		root.walkDecls(checkStatement);

		/**
		 * @param {import('postcss').Declaration} decl
		 */
		function checkStatement(decl) {
			const prop = decl.prop;

			if (!isStandardSyntaxProperty(prop)) {
				return;
			}

			if (!isStandardSyntaxDeclaration(decl)) {
				return;
			}

			if (isCustomProperty(prop)) {
				return;
			}

			if (!shouldCheckPrefixed && vendor.prefix(prop)) {
				return;
			}

			if (optionsMatches(secondaryOptions, 'ignoreProperties', prop)) {
				return;
			}

			const parent = decl.parent;

			if (
				parent &&
				isRule(parent) &&
				optionsMatches(secondaryOptions, 'ignoreSelectors', parent.selector)
			) {
				return;
			}

			/** @type {import('postcss').Node | undefined} */
			let node = parent;

			while (node && node.type !== 'root') {
				if (isAtRule(node) && optionsMatches(secondaryOptions, 'ignoreAtRules', node.name)) {
					return;
				}

				node = node.parent;
			}

			if (allValidProperties.has(prop.toLowerCase())) {
				return;
			}

			report({
				message: messages.rejected,
				messageArgs: [prop],
				node: decl,
				result,
				ruleName,
				word: prop,
			});
		}
	};
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;
export default rule;
