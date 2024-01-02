// NOTICE: This file is generated by Rollup. To modify it,
// please instead edit the ESM counterpart and rebuild with Rollup (npm run build).
'use strict';

/**
 * @type {import('stylelint').Utils['ruleMessages']}
 */
function ruleMessages(ruleName, messages) {
	/** @type {import('stylelint').RuleMessages} */
	const newMessages = {};

	for (let [messageId, messageText] of Object.entries(messages)) {
		let id = `${ruleName}.${messageId}`;

		if (typeof messageText === 'string') {
			newMessages[messageId] = JSON.stringify({
				id,
				message: messageText.trim(),
				values: {},
			});
		} else {
			newMessages[messageId] = (/** @type {any[]} */ ...args) => {
				return JSON.stringify({
					id,
					message: messageText(...args).trim(),
					values: args.reduce((acc, curr, index) => {
						acc[`arg${index}`] = curr;

						return acc;
					}, {}),
				});
			};
		}
	}
	// @ts-expect-error -- TS2322: Type 'RuleMessages' is not assignable to type 'R'.
	return newMessages;
}

module.exports = ruleMessages;
