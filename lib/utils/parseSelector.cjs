// NOTICE: This file is generated by Rollup. To modify it,
// please instead edit the ESM counterpart and rebuild with Rollup (npm run build).
'use strict';

const selectorParser = require('postcss-selector-parser');

/**
 * @param {string} selector
 * @param {import('tripleten-stylelint').PostcssResult} result
 * @param {import('postcss').Node} node
 * @param {(root: import('postcss-selector-parser').Root) => void} callback
 * @returns {string | undefined}
 */
function parseSelector(selector, result, node, callback) {
	try {
		return selectorParser(callback).processSync(selector);
	} catch (err) {
		result.warn(`Cannot parse selector (${err})`, { node, stylelintType: 'parseError' });

		return undefined;
	}
}

module.exports = parseSelector;
