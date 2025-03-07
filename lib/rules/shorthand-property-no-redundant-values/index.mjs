import valueParser from 'postcss-value-parser';

import isStandardSyntaxDeclaration from '../../utils/isStandardSyntaxDeclaration.mjs';
import isStandardSyntaxProperty from '../../utils/isStandardSyntaxProperty.mjs';
import report from '../../utils/report.mjs';
import ruleMessages from '../../utils/ruleMessages.mjs';
import validateOptions from '../../utils/validateOptions.mjs';
import vendor from '../../utils/vendor.mjs';

const ruleName = 'shorthand-property-no-redundant-values';

const messages = ruleMessages(ruleName, {
	rejected: (unexpected, expected) => `Expected "${unexpected}" to be "${expected}"`,
});

const meta = {
	url: 'https://stylelint.io/user-guide/rules/shorthand-property-no-redundant-values',
	fixable: true,
};

const propertiesWithShorthandNotation = new Set([
	'margin',
	'padding',
	'border-color',
	'border-radius',
	'border-style',
	'border-width',
	'grid-gap',
	'inset',
]);

const ignoredCharacters = ['+', '*', '/', '(', ')', '$', '@', '--', 'var('];

/**
 * @param {string} value
 * @returns {boolean}
 */
function hasIgnoredCharacters(value) {
	return ignoredCharacters.some((char) => value.includes(char));
}

/**
 * @param {string} property
 * @returns {boolean}
 */
function isShorthandProperty(property) {
	return propertiesWithShorthandNotation.has(property);
}

/**
 * @param {string} top
 * @param {string} right
 * @param {string} bottom
 * @param {string} left
 * @returns {string[]}
 */
function canCondense(top, right, bottom, left) {
	const lowerTop = top.toLowerCase();
	const lowerRight = right.toLowerCase();
	const lowerBottom = bottom && bottom.toLowerCase();
	const lowerLeft = left && left.toLowerCase();

	if (canCondenseToOneValue(lowerTop, lowerRight, lowerBottom, lowerLeft)) {
		return [top];
	}

	if (canCondenseToTwoValues(lowerTop, lowerRight, lowerBottom, lowerLeft)) {
		return [top, right];
	}

	if (canCondenseToThreeValues(lowerTop, lowerRight, lowerBottom, lowerLeft)) {
		return [top, right, bottom];
	}

	return [top, right, bottom, left];
}

/**
 * @param {string} top
 * @param {string} right
 * @param {string} bottom
 * @param {string} left
 * @returns {boolean}
 */
function canCondenseToOneValue(top, right, bottom, left) {
	if (top !== right) {
		return false;
	}

	return (top === bottom && (bottom === left || !left)) || (!bottom && !left);
}

/**
 * @param {string} top
 * @param {string} right
 * @param {string} bottom
 * @param {string} left
 * @returns {boolean}
 */
function canCondenseToTwoValues(top, right, bottom, left) {
	return (top === bottom && right === left) || (top === bottom && !left && top !== right);
}

/**
 * @param {string} _top
 * @param {string} right
 * @param {string} _bottom
 * @param {string} left
 * @returns {boolean}
 */
function canCondenseToThreeValues(_top, right, _bottom, left) {
	return right === left;
}

/** @type {import('tripleten-stylelint').Rule} */
const rule = (primary, _secondaryOptions, context) => {
	return (root, result) => {
		const validOptions = validateOptions(result, ruleName, { actual: primary });

		if (!validOptions) {
			return;
		}

		root.walkDecls((decl) => {
			if (!isStandardSyntaxDeclaration(decl) || !isStandardSyntaxProperty(decl.prop)) {
				return;
			}

			const prop = decl.prop;
			const value = decl.value;

			const normalizedProp = vendor.unprefixed(prop.toLowerCase());

			if (hasIgnoredCharacters(value) || !isShorthandProperty(normalizedProp)) {
				return;
			}

			/** @type {string[]} */
			const valuesToShorthand = [];

			valueParser(value).walk((valueNode) => {
				if (valueNode.type !== 'word') {
					return;
				}

				valuesToShorthand.push(valueParser.stringify(valueNode));
			});

			if (valuesToShorthand.length <= 1 || valuesToShorthand.length > 4) {
				return;
			}

			const shortestForm = canCondense(
				valuesToShorthand[0] || '',
				valuesToShorthand[1] || '',
				valuesToShorthand[2] || '',
				valuesToShorthand[3] || '',
			);
			const shortestFormString = shortestForm.filter(Boolean).join(' ');
			const valuesFormString = valuesToShorthand.join(' ');

			if (shortestFormString.toLowerCase() === valuesFormString.toLowerCase()) {
				return;
			}

			if (context.fix) {
				decl.value = decl.value.replace(value, shortestFormString);
			} else {
				report({
					message: messages.rejected,
					messageArgs: [value, shortestFormString],
					node: decl,
					result,
					ruleName,
				});
			}
		});
	};
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;
export default rule;
