/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Comics = new function() {
	var self = this;

	Components.utils.import("resource://mozcomics/comics.js");

	this.init = init;
	this.unload = unload;
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
	this.onlyEnable = onlyEnable;

	this.showing = [];
	this.enabled = [];

	function init() {
		this.updateStatusBarPanel();
		this.refreshCache();
	}

	function unload() {
		ComicsResource.saveStatesToDB(MozComics.callbackId);
	}

	function updateStatusBarPanel() {
		if(MozComics.isWindow) {
			return;
		}

		var label = (MozComics.Prefs.user.showUnreadCount) ? ComicsResource.totalUnread : "";
		MozComics.Dom.statusBarPanel.label = label;
	}

	function addComic() {
		MozComics.showWebpage(MozComics.Utils.URLS.COMIC_LIST);
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
		return self.getComic(comic).get(prop, MozComics.callbackId);
	}

	// ignoreUpdatingCache is a flag used when setComicProp is called
	// multiple times in a function so that refreshCache is not called
	// every time a property is changed
	function setComicProp(comic, prop, val, ignoreUpdatingCache) {
		this.getComic(comic).set(prop, val, MozComics.callbackId);

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

	// default to selected comic if no argument was passed
	function onlyEnable(comic) {
		if(comic == undefined || comic == null) {
			comic = MozComics.ComicPicker.selectedComic;
		}

		this.disableAll(true);
		this.setComicProp(comic, "enabled", true);
	}
}

