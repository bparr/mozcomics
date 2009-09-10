/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Comics = new function() {
	var self = this;

	Components.utils.import("resource://mozcomics/comics.js");

	this.init = init;
	this.unload = unload;
	this.addComic = addComic;
	this.deleteComic = deleteComic;
	this.findReadStrips = findReadStrips;
	this.refreshCache = refreshCache;

	this.getComic = getComic;
	this.getComicByGuid = getComicByGuid;
	this.getState = getState;
	this.getComicProp = getComicProp;
	this.setComicProp = setComicProp;

	this.enableAll = enableAll;
	this.disableAll = disableAll;

	this.id = null;
	this.showing = [];
	this.enabled = [];

	function init() {
		this.id = ComicsResource.addCallback(this.refreshCache);
		this.refreshCache();
	}

	function unload() {
		ComicsResource.saveStatesToDB(this.id);
		ComicsResource.removeCallback(this.id);
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

	function refreshCache(callUpdate) {
		// refresh comic arrays
		self.showing = [];
		self.enabled = [];

		for(var comic in ComicsResource.all) {
			if(self.getComicProp(comic, "showing")) {
				self.showing.push(self.getComic(comic));

				if(self.getComicProp(comic, "enabled")) {
					self.enabled.push(self.getComic(comic));
				}
			}
		}

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

	function getState(comic) {
		return this.getComic(comic).getState(this.id);
	}

	function getComicProp(comic, prop) {
		return self.getComic(comic).get(prop, self.id);
	}

	function setComicProp(comic, prop, val, ignoreUpdatingCache) {
		this.getComic(comic).set(prop, val, this.id);

		if(!ignoreUpdatingCache) {// make more efficient
			this.refreshCache(true);
		}
	}

	function enableAll() {
		for(var comic in ComicsResource.all) {
			this.setComicProp(comic, "enabled", true, true);
		}

		this.refreshCache(true);
	}

	function disableAll() {
		for(var comic in ComicsResource.all) {
			this.setComicProp(comic, "enabled", false, true);
		}

		this.refreshCache(true);
	}
}

