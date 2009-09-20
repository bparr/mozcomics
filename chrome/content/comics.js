/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Comics = new function() {
	var self = this;

	Components.utils.import("resource://mozcomics/comics.js");

	this.init = init;
	this.unload = unload;
	this.comicsResourceCallback = comicsResourceCallback;
	this.updateStatusBarPanel = updateStatusBarPanel;
	this.addComic = addComic;
	this.deleteComic = deleteComic;
	this.findReadStrips = findReadStrips;
	this.markAllStripsRead = markAllStripsRead;
	this.refreshCache = refreshCache;

	this.getComic = getComic;
	this.getComicByGuid = getComicByGuid;
	this.getComicProp = getComicProp;
	this.setComicProp = setComicProp;

	this.enableAll = enableAll;
	this.disableAll = disableAll;

	this.id = null; // id for this instance of the MozComics object
	this.showing = [];
	this.enabled = [];

	function init() {
		this.id = ComicsResource.addCallback(this.comicsResourceCallback);
		this.updateStatusBarPanel();
		this.refreshCache();
	}

	function unload() {
		ComicsResource.saveStatesToDB(this.id);
		ComicsResource.removeCallback(this.id);
	}

	function comicsResourceCallback(totalUnread, fullRefresh) {
		self.updateStatusBarPanel();

		if(fullRefresh) {
			self.refreshCache();
		}
		else {
			MozComics.ComicPicker.treeview.update();
		}
	}

	function updateStatusBarPanel() {
		var label = (MozComics.Prefs.get('showUnreadCount')) ? ComicsResource.totalUnread : "";
		MozComics.Dom.statusBarPanel.label = label;
	}

	function addComic() {
		window.loadURI(MozComics.Utils.URLS.COMIC_LIST);
	}

	function deleteComic() {
		var selectedComic = MozComics.ComicPicker.selectedComic;
		if(!selectedComic) {
			return;
		}

		var prompt = Components.classes["@mozilla.org/network/default-prompt;1"]
			.getService(Components.interfaces.nsIPrompt);
	
		var result = prompt.confirm("", MozComics.Utils.getString("deleteComic.youSure", selectedComic.name));
		if (result) {
			ComicsResource.deleteComic(selectedComic);
		}
	}

	function findReadStrips() {
		ComicsResource.findReadStrips(MozComics.ComicPicker.selectedComic);
	}

	function markAllStripsRead() {
		ComicsResource.markAllStripsRead(MozComics.ComicPicker.selectedComic);
	}

	function refreshCache(callUpdate) {
		// refresh comic arrays
		this.showing = [];
		this.enabled = [];

		for(var comic in ComicsResource.all) {
			if(this.getComicProp(comic, "showing")) {
				this.showing.push(this.getComic(comic));

				if(this.getComicProp(comic, "enabled")) {
					this.enabled.push(this.getComic(comic));
				}
			}
		}

		// refresh ComicPicker
		if(callUpdate) {
			MozComics.ComicPicker.update();
		}
		else {
			MozComics.ComicPicker.refreshTree();
		}
	}

	function getComic(comic) {
		return (comic.comic) ? comic: ComicsResource.all[comic];
	}

	function getComicByGuid(guid) {
		return ComicsResource.guids[guid];
	}

	function getComicProp(comic, prop) {
		return self.getComic(comic).get(prop, self.id);
	}

	// ignoreUpdatingCache is a flag used when setComicProp is called
	// multiple times in a function so that refreshCache is not called
	// every time a property is changed
	function setComicProp(comic, prop, val, ignoreUpdatingCache) {
		this.getComic(comic).set(prop, val, this.id);

		if(!ignoreUpdatingCache) {
			this.refreshCache(true);
		}
	}

	function enableAll(ignoreUpdatingCache) {
		for(var comic in ComicsResource.all) {
			this.setComicProp(comic, "enabled", true, true);
		}

		if(!ignoreUpdatingCache) {
			this.refreshCache(true);
		}
	}

	function disableAll(ignoreUpdatingCache) {
		for(var comic in ComicsResource.all) {
			this.setComicProp(comic, "enabled", false, true);
		}

		if(!ignoreUpdatingCache) {
			this.refreshCache(true);
		}
	}
}

