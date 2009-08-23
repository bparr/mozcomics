/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["alert", "getString", "unescapeHtml"];


var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
	.getService(Components.interfaces.nsIPromptService);

function alert(msg) {
	promptService.alert(null, '', msg);
}



var stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
	.getService(Components.interfaces.nsIStringBundleService)
	.createBundle("chrome://mozcomics/locale/mozcomics.properties");


// http://developer.mozilla.org/en/docs/Code_snippets:Miscellaneous#Using_string_bundles_from_JavaScript
function getString(msg, args){ //get localised message
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

