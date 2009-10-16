/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["Utils"];

/*
 * Useful general purpose functions/objects
 */
var Utils = new function() {
	this.URLS = {
		FIRST_RUN: "http://www.mozcomics.com/",
		COMIC_LIST: "http://www.mozcomics.com/browse/",
		UPDATE: "http://www.mozcomics.com/update?"
	};

	this.alert = alert;
	this.getString = getString;
	this.unescapeHtml = unescapeHtml;
	this.sqlToDate = sqlToDate;

	var stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
		.getService(Components.interfaces.nsIStringBundleService)
		.createBundle("chrome://mozcomics/locale/mozcomics.properties");

	// Generates standard alert box. Useful for code inside resource module
	// where the alert shortcut is not available.
	function alert(msg) {
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		promptService.alert(null, '', msg);
	}

	// Get localised message. Based off of
	// https://developer.mozilla.org/En/Code_snippets/Miscellaneous#Using_string_bundles_from_JavaScript
	function getString(msg, args) {
		if (args){
			args = Array.prototype.slice.call(arguments, 1);
			return stringBundle.formatStringFromName(msg, args, args.length);
		}
		else {
			return stringBundle.GetStringFromName(msg);
		}
	}

	function unescapeHtml(html) {
		var nsISUHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"]
				.getService(Components.interfaces.nsIScriptableUnescapeHTML);
		return nsISUHTML.unescape(html);
	}

	// sqlTime is number of seconds since midnight of January 1, 1970
	// according to universal time. Convert to javascript date.
	function sqlToDate(sqlTime) {
		var d = new Date();
		d.setTime(sqlTime * 1000);
		
		var d2 = new Date();
		d2.setFullYear(d.getUTCFullYear());
		d2.setMonth(d.getUTCMonth());
		d2.setDate(d.getUTCDate());
		d2.setHours(d.getUTCHours());
		d2.setMinutes(d.getUTCMinutes());
		d2.setSeconds(d.getUTCSeconds());
		d2.setMilliseconds(d.getUTCMilliseconds());

		return d2;
	}
}

