import valueParser from 'postcss-value-parser';

import declarationValueIndex from '../../utils/declarationValueIndex.mjs';
import getDeclarationValue from '../../utils/getDeclarationValue.mjs';
import isHexColor from '../../utils/isHexColor.mjs';
import isIgnoredFunction from '../../utils/isIgnoredFunction.mjs';
import report from '../../utils/report.mjs';
import ruleMessages from '../../utils/ruleMessages.mjs';
import setDeclarationValue from '../../utils/setDeclarationValue.mjs';
import validateOptions from '../../utils/validateOptions.mjs';

const ruleName = 'color-hex-length';

const messages = ruleMessages(ruleName, {
	expected: (actual, expected) => `Expected "${actual}" to be "${expected}"`,
});

const meta = {
	url: 'https://stylelint.io/user-guide/rules/color-hex-length',
	fixable: true,
};

const CONTAINS_HEX = /#[\da-z]+/i;

/** @type {import('tripleten-stylelint').Rule} */
const rule = (primary, _secondaryOptions, context) => {
	return (root, result) => {
		const validOptions = validateOptions(result, ruleName, {
			actual: primary,
			possible: ['short', 'long'],
		});

		if (!validOptions) {
			return;
		}

		root.walkDecls((decl) => {
			if (!CONTAINS_HEX.test(decl.value)) return;

			const parsedValue = valueParser(getDeclarationValue(decl));
			let needsFix = false;

			parsedValue.walk((node) => {
				const { value: hexValue } = node;

				if (isIgnoredFunction(node)) return false;

				if (!isHexColor(node)) return;

				if (primary === 'long' && hexValue.length !== 4 && hexValue.length !== 5) {
					return;
				}

				if (primary === 'short' && (hexValue.length < 6 || !canShrink(hexValue))) {
					return;
				}

				const variant = primary === 'long' ? longer : shorter;
				const expectedHex = variant(hexValue);

				if (context.fix) {
					node.value = expectedHex;
					needsFix = true;

					return;
				}

				const index = declarationValueIndex(decl) + node.sourceIndex;
				const endIndex = index + node.value.length;

				report({
					message: messages.expected,
					messageArgs: [hexValue, expectedHex],
					node: decl,
					index,
					endIndex,
					result,
					ruleName,
				});
			});

			if (needsFix) {
				setDeclarationValue(decl, parsedValue.toString());
			}
		});
	};
};

/**
 * @param {string} hex
 */
function canShrink(hex) {
	hex = hex.toLowerCase();

	return (
		hex[1] === hex[2] &&
		hex[3] === hex[4] &&
		hex[5] === hex[6] &&
		(hex.length === 7 || (hex.length === 9 && hex[7] === hex[8]))
	);
}

/**
 * @param {string} hex
 */
function shorter(hex) {
	let hexVariant = '#';

	for (let i = 1; i < hex.length; i += 2) {
		hexVariant += hex[i];
	}

	return hexVariant;
}

/**
 * @param {string} hex
 */
function longer(hex) {
	let hexVariant = '#';

	for (let i = 1; i < hex.length; i++) {
		hexVariant += hex.charAt(i).repeat(2);
	}

	return hexVariant;
}

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;
export default rule;
