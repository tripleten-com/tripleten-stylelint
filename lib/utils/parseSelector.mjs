import selectorParser from 'postcss-selector-parser';

/**
 * @param {string} selector
 * @param {import('tripleten-stylelint').PostcssResult} result
 * @param {import('postcss').Node} node
 * @param {(root: import('postcss-selector-parser').Root) => void} callback
 * @returns {string | undefined}
 */
export default function parseSelector(selector, result, node, callback) {
	try {
		return selectorParser(callback).processSync(selector);
	} catch (err) {
		result.warn(`Cannot parse selector (${err})`, { node, stylelintType: 'parseError' });

		return undefined;
	}
}
