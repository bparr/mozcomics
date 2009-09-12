/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["Prefs"];

/*
 * Expose a generic get and set functions for MozComic preferences
 */
var Prefs = new function() {
	var branch = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService)
			.getBranch("extensions.mozcomics.");;

	this.get = function(prefName){
		var prefType = branch.getPrefType(prefName);
		if(prefType == branch.PREF_BOOL) {
			return branch.getBoolPref(prefName);
		}
		else if(prefType == branch.PREF_STRING) {
			return branch.getCharPref(prefName);
		}
		return branch.getIntPref(prefName);
	}

	this.set = function(prefName, value){
		var prefType = branch.getPrefType(prefName);
		if(prefType == branch.PREF_BOOL) {
			return branch.setBoolPref(prefName, value);
		}
		else if(prefType == branch.PREF_STRING) {
			return branch.setCharPref(prefName, value);
		}
		return branch.setIntPref(prefName, value);
	}
}


