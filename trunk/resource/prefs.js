/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["Prefs"];

/*
 * Expose a generic get and set functions for MozComic preferences
 */
var Prefs = new function() {
	var userSetBranch = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService)
			.getBranch("extensions.mozcomics.");

	var defaultBranch = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService)
			.getDefaultBranch("extensions.mozcomics.");

	this.get = function(prefName) {
		return _getFromBranch(prefName, userSetBranch);
	}

	this.getDefault = function(prefName) {
		return _getFromBranch(prefName, defaultBranch);
	}

	this.set = function(prefName, value){
		var prefType = userSetBranch.getPrefType(prefName);
		if(prefType == userSetBranch.PREF_BOOL) {
			return userSetBranch.setBoolPref(prefName, value);
		}
		else if(prefType == userSetBranch.PREF_STRING) {
			return userSetBranch.setCharPref(prefName, value);
		}
		return userSetBranch.setIntPref(prefName, value);
	}

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
}


