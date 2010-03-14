/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["Prefs"];

Components.utils.import("resource://mozcomics/callback.js");

/*
 * Cache MozComics preferences (user and default)
 */
var Prefs = new function() {
	this.user = null;
	this.default = null;
	this.recache = recache;
	this.set = set;

	var userSetBranch = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService)
			.getBranch("extensions.mozcomics.");

	var defaultBranch = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService)
			.getDefaultBranch("extensions.mozcomics.");

	/*
	 * Update the user and default cached preferences
	 */
	function recache() {
		this.user = {};
		this.default = {};
		var prefNames = defaultBranch.getChildList('', {});
		for(var i = 0, len = prefNames.length; i < len; i++) {
			try {
				var prefName = prefNames[i];
				this.user[prefName] = _getFromBranch(prefName, userSetBranch);
				this.default[prefName] = _getFromBranch(prefName, defaultBranch);
			}
			catch(e) {};
		}

		Callback.callType("prefsChanged");
	}

	/*
	 * Change actual preference, and the cached value
	 */
	function set(prefName, value) {
		this.user[prefName] = value;

		var prefType = userSetBranch.getPrefType(prefName);
		if(prefType == userSetBranch.PREF_BOOL) {
			userSetBranch.setBoolPref(prefName, value);
		}
		else if(prefType == userSetBranch.PREF_STRING) {
			userSetBranch.setCharPref(prefName, value);
		}
		else {
			userSetBranch.setIntPref(prefName, value);
		}

		Callback.callType("prefsChanged");
	}

	/*
	 * Get the value of a preference from a branch
	 */
	function _getFromBranch(prefName, branch) {
		var prefType = branch.getPrefType(prefName);
		if(prefType == branch.PREF_BOOL) {
			return branch.getBoolPref(prefName);
		}
		else if(prefType == branch.PREF_STRING) {
			return branch.getCharPref(prefName);
		}
		return branch.getIntPref(prefName);
	}


	// initially cache preferences
	this.recache();
}

