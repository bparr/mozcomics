/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Prefs = new function() {
	this.branch = null;

	this.init = function(){
		this.branch = Components.classes["@mozilla.org/preferences-service;1"]
						.getService(Components.interfaces.nsIPrefService)
						.getBranch("extensions.mozcomics.");
	}

	this.get = function(prefName){
		var prefType = this.branch.getPrefType(prefName);
		if(prefType == this.branch.PREF_BOOL) {
			return this.branch.getBoolPref(prefName);
		}
		else if(prefType == this.branch.PREF_STRING) {
			return this.branch.getCharPref(prefName);
		}
		return this.branch.getIntPref(prefName);
	}

	this.set = function(prefName, value){
		var prefType = this.branch.getPrefType(prefName);
		if(prefType == this.branch.PREF_BOOL) {
			return this.branch.setBoolPref(prefName, value);
		}
		else if(prefType == this.branch.PREF_STRING) {
			return this.branch.setCharPref(prefName, value);
		}
		return this.branch.setIntPref(prefName, value);
	}
}
