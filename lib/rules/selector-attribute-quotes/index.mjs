import getRuleSelector from '../../utils/getRuleSelector.mjs';
import isStandardSyntaxRule from '../../utils/isStandardSyntaxRule.mjs';
import isValidIdentifier from '../../utils/isValidIdentifier.mjs';
import parseSelector from '../../utils/parseSelector.mjs';
import report from '../../utils/report.mjs';
import ruleMessages from '../../utils/ruleMessages.mjs';
import validateOptions from '../../utils/validateOptions.mjs';

const ruleName = 'selector-attribute-quotes';

const messages = ruleMessages(ruleName, {
	expected: (value) => `Expected quotes around "${value}"`,
	rejected: (value) => `Unexpected quotes around "${value}"`,
});

const meta = {
	url: 'https://stylelint.io/user-guide/rules/selector-attribute-quotes',
	fixable: true,
};

const acceptedQuoteMark = '"';

/** @type {import('tripleten-stylelint').Rule<'always' | 'never'>} */
const rule = (primary, _secondaryOptions, context) => {
	return (root, result) => {
		const validOptions = validateOptions(result, ruleName, {
			actual: primary,
			possible: ['always', 'never'],
		});

		if (!validOptions) {
			return;
		}

		root.walkRules((ruleNode) => {
			if (!isStandardSyntaxRule(ruleNode)) {
				return;
			}

			const { selector } = ruleNode;

			if (!selector.includes('[') || !selector.includes('=')) {
				return;
			}

			parseSelector(getRuleSelector(ruleNode), result, ruleNode, (selectorTree) => {
				let selectorFixed = false;

				selectorTree.walkAttributes((attributeNode) => {
					const { operator, value, quoted } = attributeNode;

					if (!operator || !value) {
						return;
					}

					if (!quoted && primary === 'always') {
						if (context.fix) {
							selectorFixed = true;
							attributeNode.quoteMark = acceptedQuoteMark;
						} else {
							complain(messages.expected(value), attributeNode);
						}
					}

					if (quoted && primary === 'never') {
						// some selectors require quotes to be valid;
						// we pass in the raw string value, which contains the escape characters
						// necessary to check if escaped characters are valid
						// see: https://github.com/stylelint/stylelint/issues/4300
						if (
							!attributeNode.raws.value ||
							!isValidIdentifier(attributeNode.raws.value.slice(1, -1))
						) {
							return;
						}

						if (context.fix) {
							selectorFixed = true;
							attributeNode.quoteMark = null;
						} else {
							complain(messages.rejected(value), attributeNode);
						}
					}
				});

				if (selectorFixed) {
					ruleNode.selector = selectorTree.toString();
				}
			});

			/**
			 * @param {string} message
			 * @param {import('postcss-selector-parser').Attribute} attrNode
			 */
			function complain(message, attrNode) {
				const index = attrNode.sourceIndex + attrNode.offsetOf('value');
				const value = attrNode.raws.value || attrNode.value || '';
				const endIndex = index + value.length;

				report({
					message,
					index,
					endIndex,
					result,
					ruleName,
					node: ruleNode,
				});
			}
		});
	};
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;
export default rule;
