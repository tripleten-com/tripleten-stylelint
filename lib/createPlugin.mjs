/**
 * @type {import('tripleten-stylelint').PublicApi['createPlugin']}
 */
export default function createPlugin(ruleName, rule) {
	return {
		ruleName,
		rule,
	};
}
