/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var MozComics = new function() {

	this.init = init;

	this.onChromeLoad = onChromeLoad;
	this.onUnload = onUnload;
	this.onPageChange = onPageChange;
	this.togglePane = togglePane;
	this.toggleComicPickerPane = toggleComicPickerPane;
	this.handleKeyPress = handleKeyPress;
	this.buildComicsContextMenu = buildComicsContextMenu;
	this.getString = getString;

	this.showPreferences = showPreferences;
	this.findReadStrips = findReadStrips;
	this.addComic = addComic;
	this.deleteComic = deleteComic;

	this.getUnreadStrips = null;
	this.updateStripReadTime= null;

	this._stringBundle = null;

	function init() {
		this._stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
			.getService(Components.interfaces.nsIStringBundleService)
			.createBundle("chrome://mozcomics/locale/mozcomics.properties");
		
		// load other javascript files
		var scriptFiles = [
			"comic",
			"comicPicker",
			"comics",
			"db",
			"dom",
			"prefs",
			"strips",
			"treeview",
			"update"
		];
		var scriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader);
		for(var i = 0, len = scriptFiles.length; i < len; i++) {
			scriptLoader.loadSubScript("chrome://mozcomics/content/" + scriptFiles[i] + ".js");
		}


		window.addEventListener("load", MozComics.onChromeLoad, false);
	}

	function onChromeLoad() {
		window.removeEventListener("load", MozComics.onChromeLoad, false);
		window.addEventListener("unload", MozComics.onUnload, false);

		MozComics.Prefs.init();
		MozComics.Dom.init();
		MozComics.DB.init();
		MozComics.Comics.init();
		MozComics.Strips.init();
		MozComics.ComicPicker.init();
		MozComics.Update.init();

		MozComics.getUnreadStrips = MozComics.DB.dbConn.createStatement(
			"SELECT strip, url FROM strip WHERE comic=:comic AND read ISNULL;"
		);
		MozComics.updateStripReadTime = MozComics.DB.dbConn.createStatement(
			"UPDATE strip SET read = :read WHERE comic = :comic AND strip = :strip;"
		);
	}

	function onUnload() {
		window.removeEventListener("unload", MozComics.onUnload, false);

		MozComics.Strips.unload();
		MozComics.Comics.unload();
	}

	function onPageChange(e) {
	}

	function togglePane() {
		var nowHidden = !MozComics.Dom.pane.hidden;
		MozComics.Dom.pane.hidden = nowHidden;
		MozComics.Dom.paneSplitter.hidden = nowHidden;
		(nowHidden) ? MozComics.Dom.pane.blur() : MozComics.Dom.pane.focus();
	}

	function toggleComicPickerPane() {
		MozComics.Dom.comicPickerPane.hidden = !MozComics.Dom.comicPickerPane.hidden;
		MozComics.Dom.comicPickerToolbarIcon.setAttribute("expand", MozComics.Dom.comicPickerPane.hidden);
	}

	function handleKeyPress(event, from) {
		var key = String.fromCharCode(event.which);
		if(from == "mozcomics-strip-pane" && !event.ctrlKey && !event.altKey && !event.metaKey) {
			if(event.shiftKey) {
				if(event.keyCode == event.DOM_VK_BACK_SPACE) {
					MozComics.Strips.setToForwardStrip();
				}
			}
			else {
				if(event.keyCode == event.DOM_VK_LEFT || key == 'p') {
					MozComics.Strips.setToPreviousStrip();
				}
				else if(event.keyCode == event.DOM_VK_RIGHT || key == 'n') {
					MozComics.Strips.setToNextStrip();
				}
				else if(event.keyCode == event.DOM_VK_BACK_SPACE) {
					MozComics.Strips.setToBackStrip();
				}
				else if(key == 'f') {
					MozComics.Strips.setToFirstStrip();
				}
				else if(key == 'l') {
					MozComics.Strips.setToLastStrip();
				}
				else if(key == 'r') {
					MozComics.Dom.updateRead.checked = !MozComics.Dom.updateRead.checked;
				}
				else if(key == 's') {
					MozComics.Dom.showRead.checked = !MozComics.Dom.showRead.checked;
				}
			}
		}
	}

	function buildComicsContextMenu() {
		var menu = MozComics.Dom.comicPicerMenu;
		var selectedComic = MozComics.ComicPicker.selectedComic;
		if(selectedComic) {
			for(var i = 0, len = menu.childNodes.length; i < len; i++) {
				menu.childNodes[i].setAttribute('hidden', false);
			}
		}
		else {
			for(var i = 0, len = menu.childNodes.length; i < len; i++) {
				menu.childNodes[i].setAttribute('hidden', true);
			}
		}
	}


	// http://developer.mozilla.org/en/docs/Code_snippets:Miscellaneous#Using_string_bundles_from_JavaScript
	function getString(msg, args){ //get localised message
		if (args){
			args = Array.prototype.slice.call(arguments, 1);
			return this._stringBundle.formatStringFromName(msg, args, args.length);
		}
		else {
			return this._stringBundle.GetStringFromName(msg);
		}
	}

	function showPreferences() { // TODO implement

	}

	function findReadStrips() {
		var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
			.getService(Components.interfaces.nsIGlobalHistory2);
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);

		var selectedComic = MozComics.ComicPicker.selectedComic;
		this.getUnreadStrips.params.comic = selectedComic.comic;
		var readStrips = [];
		while(this.getUnreadStrips.executeStep()) {
			var url = this.getUnreadStrips.row.url;
			var uri = ioService.newURI(url, null, null);
			if(historyService.isVisited(uri)) {
				readStrips.push(this.getUnreadStrips.row.strip);
			}
		}
		this.getUnreadStrips.reset();

		if(readStrips.length > 0) {
			var prompt = Components.classes["@mozilla.org/network/default-prompt;1"]
				.getService(Components.interfaces.nsIPrompt);
	
			var result = prompt.confirm("", MozComics.getString("findReadStrips.youSure", readStrips.length));
			if (result) {
				var d = new Date();
				var read = d.getTime();
				for(var i = 0, len = readStrips.length; i < len; i++) {
					this.updateStripReadTime.params.comic = selectedComic.comic;
					this.updateStripReadTime.params.strip = readStrips[i];
					this.updateStripReadTime.params.read = read + i;
					this.updateStripReadTime.execute();
				}
			}
		}
		else {
			alert(MozComics.getString("findReadStrips.noneFound"));
		}
	}

	function addComic() {
		window.loadURI("http://localhost/mozcomics/"); // TODO change
	}

	function deleteComic() {
		var selectedComic = MozComics.ComicPicker.selectedComic;
		if(!selectedComic) {
			return;
		}

		var prompt = Components.classes["@mozilla.org/network/default-prompt;1"]
			.getService(Components.interfaces.nsIPrompt);
	
		var result = prompt.confirm("", MozComics.getString("deleteComic.youSure", selectedComic.name));
		if (result) {
			MozComics.Comics.deleteComic(selectedComic);
		}
	}
}

MozComics.init();
