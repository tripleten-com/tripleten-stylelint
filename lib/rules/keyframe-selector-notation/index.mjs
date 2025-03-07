import { assertString } from '../../utils/validateTypes.mjs';
import report from '../../utils/report.mjs';
import ruleMessages from '../../utils/ruleMessages.mjs';
import transformSelector from '../../utils/transformSelector.mjs';
import validateOptions from '../../utils/validateOptions.mjs';

const ruleName = 'keyframe-selector-notation';

const messages = ruleMessages(ruleName, {
	expected: (selector, fixedSelector) => `Expected "${selector}" to be "${fixedSelector}"`,
});

const meta = {
	url: 'https://stylelint.io/user-guide/rules/keyframe-selector-notation',
	fixable: true,
};

const PERCENTAGE_SELECTORS = new Set(['0%', '100%']);
const KEYWORD_SELECTORS = new Set(['from', 'to']);
const NAMED_TIMELINE_RANGE_SELECTORS = new Set(['cover', 'contain', 'entry', 'enter', 'exit']);
const PERCENTAGE_TO_KEYWORD = new Map([
	['0%', 'from'],
	['100%', 'to'],
]);
const KEYWORD_TO_PERCENTAGE = new Map([
	['from', '0%'],
	['to', '100%'],
]);

/** @type {import('tripleten-stylelint').Rule<'keyword' | 'percentage' | 'percentage-unless-within-keyword-only-block'>} */
const rule = (primary, _, context) => {
	return (root, result) => {
		const validOptions = validateOptions(result, ruleName, {
			actual: primary,
			possible: ['keyword', 'percentage', 'percentage-unless-within-keyword-only-block'],
		});

		if (!validOptions) return;

		/**
		 * @typedef {{
		 *   expFunc: (selector: string, selectorsInBlock: string[]) => boolean,
		 *   fixFunc: (selector: string) => string,
		 * }} OptionFuncs
		 *
		 * @type {Record<primary, OptionFuncs>}
		 */
		const optionFuncs = Object.freeze({
			keyword: {
				expFunc: (selector) => KEYWORD_SELECTORS.has(selector),
				fixFunc: (selector) => getFromMap(PERCENTAGE_TO_KEYWORD, selector),
			},
			percentage: {
				expFunc: (selector) => PERCENTAGE_SELECTORS.has(selector),
				fixFunc: (selector) => getFromMap(KEYWORD_TO_PERCENTAGE, selector),
			},
			'percentage-unless-within-keyword-only-block': {
				expFunc: (selector, selectorsInBlock) => {
					if (selectorsInBlock.every((s) => KEYWORD_SELECTORS.has(s))) return true;

					return PERCENTAGE_SELECTORS.has(selector);
				},
				fixFunc: (selector) => getFromMap(KEYWORD_TO_PERCENTAGE, selector),
			},
		});

		root.walkAtRules(/^(-(moz|webkit)-)?keyframes$/i, (atRuleKeyframes) => {
			const selectorsInBlock =
				primary === 'percentage-unless-within-keyword-only-block'
					? getSelectorsInBlock(atRuleKeyframes)
					: [];

			atRuleKeyframes.walkRules((keyframeRule) => {
				transformSelector(result, keyframeRule, (selectors) => {
					let first = true;

					selectors.walkTags((selectorTag) => {
						if (first && NAMED_TIMELINE_RANGE_SELECTORS.has(selectorTag.value)) {
							return false;
						}

						first = false;

						checkSelector(
							selectorTag.value,
							optionFuncs[primary],
							(fixedSelector) => (selectorTag.value = fixedSelector),
						);
					});
				});

				/**
				 * @param {string} selector
				 * @param {OptionFuncs} funcs
				 * @param {(fixedSelector: string) => void} fixer
				 */
				function checkSelector(selector, { expFunc, fixFunc }, fixer) {
					const normalizedSelector = selector.toLowerCase();

					if (
						!KEYWORD_SELECTORS.has(normalizedSelector) &&
						!PERCENTAGE_SELECTORS.has(normalizedSelector)
					) {
						return;
					}

					if (expFunc(selector, selectorsInBlock)) return;

					const fixedSelector = fixFunc(selector);

					if (context.fix) {
						fixer(fixedSelector);

						return;
					}

					report({
						message: messages.expected,
						messageArgs: [selector, fixedSelector],
						node: keyframeRule,
						result,
						ruleName,
						word: selector,
					});
				}
			});
		});
	};
};

/**
 * @param {Map<string, string>} map
 * @param {string} key
 * @returns {string}
 */
function getFromMap(map, key) {
	const value = map.get(key);

	assertString(value);

	return value;
}

/**
 * @param {import('postcss').AtRule} atRule
 * @returns {string[]}
 */
function getSelectorsInBlock(atRule) {
	/** @type {string[]} */
	const selectors = [];

	atRule.walkRules((r) => {
		selectors.push(...r.selectors);
	});

	return selectors;
}

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;
export default rule;
