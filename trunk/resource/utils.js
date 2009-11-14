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
		FIRST_RUN: "http://www.mozcomics.com/firstRun",
		PREFERENCE_SUPPORT: "http://www.mozcomics.com/preferenceSupport",
		COMIC_LIST: "http://www.mozcomics.com/browse/",
		UPDATE: "http://www.mozcomics.com/update?"
	};

	this.alert = alert;
	this.getString = getString;
	this.unescapeHtml = unescapeHtml;
	this.sqlToDate = sqlToDate;
	this.relativeDate = relativeDate;

	var stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
		.getService(Components.interfaces.nsIStringBundleService)
		.createBundle("chrome://mozcomics/locale/mozcomics.properties");

	/*
	 * Generate standard alert box. Useful for code inside resource module
	 * where the alert shortcut is not available.
	 */
	function alert(msg) {
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		promptService.alert(null, '', msg);
	}

	/*
	 * Get localised message. Based off of
	 * https://developer.mozilla.org/En/Code_snippets/Miscellaneous#Using_string_bundles_from_JavaScript
	 */
	function getString(msg, args) {
		if (args){
			args = Array.prototype.slice.call(arguments, 1);
			return stringBundle.formatStringFromName(msg, args, args.length);
		}
		else {
			return stringBundle.GetStringFromName(msg);
		}
	}


	/*
	 * Unescape special HTML characters
	 */
	function unescapeHtml(html) {
		var nsISUHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"]
				.getService(Components.interfaces.nsIScriptableUnescapeHTML);
		return nsISUHTML.unescape(html);
	}

	/*
	 * sqlTime is number of seconds since midnight of January 1, 1970
	 * according to universal time. Convert to javascript date.
	 */
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

	/*
	 * Convert a unix time to a relative date (e.g., "5 minutes ago")
	 *
	 * Based off of Zotero's toRelativeDate function by CHNM: http://www.zotero.org/
	 * which was adapted from http://snipplr.com/view/10290/javascript-parse-relative-date/
	 */
	function relativeDate(time) {
		if(time == 0) {
			return this.getString("update.never");
		}

		var now = new Date();
		var inSeconds = (now.getTime() / 1000) - time;
		var inMinutes = inSeconds / 60;
		var inHours = inMinutes / 60;
		var inDays = inHours / 24;
		var inYears = inDays / 365;

		// in seconds
		inSeconds = Math.round(inSeconds);
		if(inSeconds == 1) {
			return this.getString("update.oneSecondAgo");
		}
		if(inMinutes < 1.01) {
			return this.getString("update.secondsAgo", inSeconds);
		}
		
		// in minutes
		inMinutes = Math.round(inMinutes);
		if(inMinutes == 1) {
			return this.getString("update.oneMinuteAgo");
		}
		if(inHours < 1.01) {
			return this.getString("update.minutesAgo", inMinutes);
		}
		
		// in hours
		inHours = Math.round(inHours);
		if(inHours == 1) {
			return this.getString("update.oneHourAgo");
		}
		if (inDays < 1.01) {
			return this.getString("update.hoursAgo", inHours);
		}
		
		// in days
		inDays = Math.round(inDays);
		if(inDays == 1) {
			return this.getString("update.oneDayAgo");
		}
		if(inYears < 1.01) {
			return this.getString("update.daysAgo", inDays);
		}
		
		// in years
		inYears = Math.round(inYears);
		if (inYears == 1) {
			return this.getString("update.oneYearAgo");
		}
		
		return this.getString("update.yearsAgo", inYears);
	}
}
