/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php


Based on Zotero's zotero-protocol-handler.js by CHNM:
http://www.zotero.org/

-and-

Based on nsChromeExtensionHandler.js by Ed Anuff:
http://kb.mozillazine.org/Dev_:_Extending_the_Chrome_Protocol
*/

const MOZCOMICS_SCHEME = "mozcomics";
const MOZCOMICS_PROTOCOL_CID = Components.ID("{bf590229-584a-4f43-b563-bc96214f66e6}");
const MOZCOMICS_PROTOCOL_CONTRACTID = "@mozilla.org/network/protocol;1?name=" + MOZCOMICS_SCHEME;
const MOZCOMICS_PROTOCOL_NAME = "MozComics Protocol";

// Dummy chrome URL used to obtain a valid chrome channel
// This one was chosen at random and should be able to be substituted
// for any other well known chrome URL in the browser installation
const DUMMY_CHROME_URL = "chrome://mozapps/content/xpinstall/xpinstallConfirm.xul";


// The ChromeExtension Handler (implements nsIProtocolHandler)
function ChromeExtensionHandler() {
	this.wrappedJSObject = this;
	this._systemPrincipal = null;
	this._extensions = {};
	
	/*
	 * Allows users to add a comic to thier MozComics database.
	 *
	 * mozcomics://addcomic/?{queryStrings}
	 *
	 * queryStrings:
	 * - guid (required)
	 * - name (required)
	 * - update_site
	 */
	var AddComicExtension = new function() {
		this.newChannel = newChannel;
		
		function newChannel(uri) {
			var window = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow(null);
			var MozComics = window.MozComics;

			var pathParts = uri.path.substr(1).split('?');
			if(pathParts.length != 2) {
				window.alert(MozComics.Utils.getString("addComic.urlError"));
				return;
			}

			// process the query string
			var queryParts = pathParts[1].split('&');
			var comic = {};
			for(var i = 0, len = queryParts.length; i < len; i++) {
				var [key, val] = queryParts[i].split('=');
				if(val) {
					switch (key) {
						case 'guid':
						case 'name':
						case 'update_site':
							comic[key] = unescape(val);
							break;
					}
				}
			}
			
			// ensure a guid was found
			if(!comic.guid) {
				window.alert(MozComics.Utils.getString("addComic.noGuid"));
				return;
			}

			// ensure a name was found
			if(!comic.name) {
				window.alert(MozComics.Utils.getString("addComic.noName"));
				return;
			}

			// ensure the comic is not already in MozComics
			if(MozComics.Comics.isInstalled(comic.guid)) {
				window.alert(MozComics.Utils.getString("addComic.alreadyInstalled", comic.name));
				return;
			}
			
      var prompt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Components.interfaces.nsIPromptService);

			// ensure user wants to add this comic
			var result = prompt.confirm(null, "", MozComics.Utils.getString("addComic.youSure", comic.name));
			if (result) {
				MozComics.Update.addComic(comic);
			}
		}
	};


	/*
	 * Set MozComics to stand-alone window mode
	 *
	 * mozcomics://windowmode
	 */
	var WindowModeExtension = new function() {
		this.newChannel = newChannel;

		function newChannel(uri) {
			var window = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow(null);
			window.location = "chrome://mozcomics/content/window.xul";
		}
	};
	
	var AddComicExtensionSpec = MOZCOMICS_SCHEME + "://addcomic"
	this._extensions[AddComicExtensionSpec] = AddComicExtension;
	var WindowModeExtensionSpec = MOZCOMICS_SCHEME + "://window"
	this._extensions[WindowModeExtensionSpec] = WindowModeExtension;
}


// nsIProtocolHandler implementation
ChromeExtensionHandler.prototype = {
	scheme: MOZCOMICS_SCHEME,
	defaultPort : -1,
	protocolFlags : Components.interfaces.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,
		
	allowPort : function(port, scheme) {
		return false;
	},
	
	newURI : function(spec, charset, baseURI) {
		var newURL = Components.classes["@mozilla.org/network/standard-url;1"]
			.createInstance(Components.interfaces.nsIStandardURL);
		newURL.init(1, -1, spec, charset, baseURI);
		return newURL.QueryInterface(Components.interfaces.nsIURI);
	},
	
	newChannel : function(uri) {
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		
		var chromeService = Components.classes["@mozilla.org/network/protocol;1?name=chrome"]
			.getService(Components.interfaces.nsIProtocolHandler);
		
		var newChannel = null;
		
		try {
			var uriString = uri.spec.toLowerCase();
			
			for (var extSpec in this._extensions) {
				var ext = this._extensions[extSpec];
				
				if (uriString.indexOf(extSpec) == 0) {
					var extChannel = ext.newChannel(uri);
					// Extension returned null, so cancel request
					if (!extChannel) {
						var chromeURI = chromeService.newURI(DUMMY_CHROME_URL, null, null);
						var extChannel = chromeService.newChannel(chromeURI);
						var chromeRequest = extChannel.QueryInterface(Components.interfaces.nsIRequest);
						chromeRequest.cancel(0x804b0002); // BINDING_ABORTED
					}
					
					// Apply cached system principal to extension channel
					if (ext.loadAsChrome) {
						extChannel.owner = this._systemPrincipal;
					}
					
					extChannel.originalURI = uri;
					
					return extChannel;
				}
			}
			
			// pass request through to ChromeProtocolHandler::newChannel
			if (uriString.indexOf("chrome") != 0) {
				uriString = uri.spec;
				uriString = "chrome" + uriString.substring(uriString.indexOf(":"));
				uri = chromeService.newURI(uriString, null, null);
			}
			
			newChannel = chromeService.newChannel(uri);
		}
		catch (e) {
			throw Components.results.NS_ERROR_FAILURE;
		}
		
		return newChannel;
	},
	
	QueryInterface : function(iid) {
		if (!iid.equals(Components.interfaces.nsIProtocolHandler) &&
				!iid.equals(Components.interfaces.nsISupports)) {
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		return this;
	}
};


// XPCOM component registration
var ChromeExtensionModule = {
	cid: MOZCOMICS_PROTOCOL_CID,
	
	contractId: MOZCOMICS_PROTOCOL_CONTRACTID,
	
	registerSelf : function(compMgr, fileSpec, location, type) {
		compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		compMgr.registerFactoryLocation(
			MOZCOMICS_PROTOCOL_CID, 
			MOZCOMICS_PROTOCOL_NAME, 
			MOZCOMICS_PROTOCOL_CONTRACTID, 
			fileSpec, 
			location,
			type
		);
	},
	
	getClassObject : function(compMgr, cid, iid) {
		if (!cid.equals(MOZCOMICS_PROTOCOL_CID)) {
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		if (!iid.equals(Components.interfaces.nsIFactory)) {
			throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
		}
		return this.myFactory;
	},
	
	canUnload : function(compMgr) {
		return true;
	},
	
	myFactory : {
		createInstance : function(outer, iid) {
			if (outer != null) {
				throw Components.results.NS_ERROR_NO_AGGREGATION;
			}
			
			return new ChromeExtensionHandler().QueryInterface(iid);
		}
	}
};

function NSGetModule(compMgr, fileSpec) {
	return ChromeExtensionModule;
}

