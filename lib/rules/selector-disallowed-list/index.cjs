// NOTICE: This file is generated by Rollup. To modify it,
// please instead edit the ESM counterpart and rebuild with Rollup (npm run build).
'use strict';

const validateTypes = require('../../utils/validateTypes.cjs');
const isKeyframeRule = require('../../utils/isKeyframeRule.cjs');
const isStandardSyntaxRule = require('../../utils/isStandardSyntaxRule.cjs');
const matchesStringOrRegExp = require('../../utils/matchesStringOrRegExp.cjs');
const optionsMatches = require('../../utils/optionsMatches.cjs');
const report = require('../../utils/report.cjs');
const ruleMessages = require('../../utils/ruleMessages.cjs');
const validateOptions = require('../../utils/validateOptions.cjs');

const ruleName = 'selector-disallowed-list';

const messages = ruleMessages(ruleName, {
	rejected: (selector) => `Unexpected selector "${selector}"`,
});

const meta = {
	url: 'https://stylelint.io/user-guide/rules/selector-disallowed-list',
};

/** @type {import('tripleten-stylelint').Rule<string | RegExp | Array<string | RegExp>, { splitList: boolean, ignore: string[] }>} */
const rule = (primary, secondaryOptions) => {
	return (root, result) => {
		const validOptions = validateOptions(
			result,
			ruleName,
			{
				actual: primary,
				possible: [validateTypes.isString, validateTypes.isRegExp],
			},
			{
				actual: secondaryOptions,
				possible: {
					ignore: ['inside-block', 'keyframe-selectors'],
					splitList: [validateTypes.isBoolean],
				},
				optional: true,
			},
		);

		if (!validOptions) {
			return;
		}

		const ignoreInsideBlock = optionsMatches(secondaryOptions, 'ignore', 'inside-block');
		const ignoreKeyframeSelectors = optionsMatches(
			secondaryOptions,
			'ignore',
			'keyframe-selectors',
		);

		const splitList = secondaryOptions && secondaryOptions.splitList;

		root.walkRules((ruleNode) => {
			if (!isStandardSyntaxRule(ruleNode)) {
				return;
			}

			if (ignoreKeyframeSelectors && isKeyframeRule(ruleNode)) {
				return;
			}

			if (ignoreInsideBlock) {
				const { parent } = ruleNode;
				const isInsideBlock = parent && parent.type !== 'root';

				if (isInsideBlock) {
					return;
				}
			}

			if (splitList) {
				ruleNode.selectors.forEach((selector) => {
					if (matchesStringOrRegExp(selector, primary)) {
						report({
							result,
							ruleName,
							message: messages.rejected,
							messageArgs: [selector],
							node: ruleNode,
							word: selector,
						});
					}
				});
			} else {
				const { selector, raws } = ruleNode;

				if (matchesStringOrRegExp(selector, primary)) {
					const word = (raws.selector && raws.selector.raw) || selector;

					report({
						result,
						ruleName,
						message: messages.rejected,
						messageArgs: [selector],
						node: ruleNode,
						word,
					});
				}
			}
		});
	};
};

rule.primaryOptionArray = true;

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

module.exports = rule;
