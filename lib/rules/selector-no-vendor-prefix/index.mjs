import { isRegExp, isString } from '../../utils/validateTypes.mjs';
import hasPrefix from '../../utils/hasPrefix.mjs';
import isAutoprefixable from '../../utils/isAutoprefixable.mjs';
import isStandardSyntaxRule from '../../utils/isStandardSyntaxRule.mjs';
import optionsMatches from '../../utils/optionsMatches.mjs';
import parseSelector from '../../utils/parseSelector.mjs';
import report from '../../utils/report.mjs';
import ruleMessages from '../../utils/ruleMessages.mjs';
import validateOptions from '../../utils/validateOptions.mjs';

const ruleName = 'selector-no-vendor-prefix';

const messages = ruleMessages(ruleName, {
	rejected: (selector) => `Unexpected vendor-prefix "${selector}"`,
});

const meta = {
	url: 'https://stylelint.io/user-guide/rules/selector-no-vendor-prefix',
	fixable: true,
};

/** @type {import('tripleten-stylelint').Rule} */
const rule = (primary, secondaryOptions, context) => {
	return (root, result) => {
		const validOptions = validateOptions(
			result,
			ruleName,
			{ actual: primary },
			{
				actual: secondaryOptions,
				possible: {
					ignoreSelectors: [isString, isRegExp],
				},
				optional: true,
			},
		);

		if (!validOptions) {
			return;
		}

		root.walkRules((ruleNode) => {
			if (!hasPrefix(ruleNode.selector)) return;

			if (!isStandardSyntaxRule(ruleNode)) {
				return;
			}

			const selector = ruleNode.selector;

			parseSelector(selector, result, ruleNode, (selectorTree) => {
				selectorTree.walkPseudos((pseudoNode) => {
					const { value } = pseudoNode;

					if (!isAutoprefixable.selector(value)) {
						return;
					}

					if (optionsMatches(secondaryOptions, 'ignoreSelectors', value)) {
						return;
					}

					if (context.fix) {
						ruleNode.selector = isAutoprefixable.unprefix(selector);

						return;
					}

					report({
						result,
						ruleName,
						message: messages.rejected,
						messageArgs: [value],
						node: ruleNode,
						word: value,
					});
				});
			});
		});
	};
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;
export default rule;
