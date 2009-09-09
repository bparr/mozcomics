/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Comics = new function() {
	var self = this;

	this._comicsData = {}; Components.utils.import("resource://mozcomics/comics.js", this._comicsData);

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
		this.id = this._comicsData.addCallback(this.refreshCache);
		this.refreshCache();
	}

	function unload() {
		this._comicsData.saveStatesToDB(this.id);
		this._comicsData.removeCallback(this.id);
	}

	function addComic() {
		window.loadURI("http://www.bparr.com/mozcomics/"); // TODO change
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
			this._comicsData.deleteComic(selectedComic);
		}
	}

	function findReadStrips() {
		this._comicsData.findReadStrips(MozComics.ComicPicker.selectedComic);
	}

	function refreshCache(callUpdate) {
		// refresh comic arrays
		self.showing = [];
		self.enabled = [];

		for(var comic in self._comicsData.all) {
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
		return (comic.comic) ? comic: this._comicsData.all[comic];
	}

	function getComicByGuid(guid) {
		return this._comicsData.guids[guid];
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
		for(var comic in this._comicsData.all) {
			this.setComicProp(comic, "enabled", true, true);
		}

		this.refreshCache(true);
	}

	function disableAll() {
		for(var comic in this._comicsData.all) {
			this.setComicProp(comic, "enabled", false, true);
		}

		this.refreshCache(true);
	}
}

