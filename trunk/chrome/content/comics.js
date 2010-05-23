/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Comics = new function() {
	var self = this;

	Components.utils.import("resource://mozcomics/comics.js");

	this.init = init;
	this.unload = unload;
	this.saveStatesToDB = saveStatesToDB;
	this.updateStatusBarPanel = updateStatusBarPanel;
	this.addComic = addComic;
	this.deleteComic = deleteComic;
	this.findReadStrips = findReadStrips;
	this.markAllStripsRead = markAllStripsRead;
	this.refreshCache = refreshCache;

	this.getComic = getComic;
	this.isInstalled = isInstalled;
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
		this.refreshCache(true);
	}

	/*
	 * When Firefox window is closed, only save comic states if MozComics was
	 * showing so that a hidden MozComics to doesn't seemingly make the
	 * comic states in the database randomly change.
	 */
	function unload() {
		if(!MozComics.Dom.pane.hidden) {
			this.saveStatesToDB();
		}
	}

	/*
	 * Save the current states of the comics, such as enabled states, so that
	 * they persist to the next instance of MozComics.
	 */
	function saveStatesToDB() {
		ComicsResource.saveStatesToDB(MozComics.callbackId);
	}

	/*
	 * Update number of unread strips shown next to status bar icon.
	 */
	function updateStatusBarPanel() {
		// statusbar is not showing stand-alone window, so do nothing
		if(MozComics.isWindow) {
			return;
		}

		var label = (MozComics.Prefs.user.showUnreadCount) ? ComicsResource.totalUnread : "";
		MozComics.Dom.statusBarPanel.label = label;
	}

	/*
	 * Load the COMIC_LIST webpage so user can find and add a comic.
	 */
	function addComic() {
		MozComics.showWebpage(MozComics.Utils.URLS.COMIC_LIST);
	}

	/*
	 * Entirely delete a comic.
	 * Confirm with user before doing this unrecoverable action.
	 */
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

	/*
	 * Find all unread strips of currently selected comic that have
	 * urls that have been visited in the browser, and mark them as read.
	 */
	function findReadStrips() {
		ComicsResource.findReadStrips(MozComics.ComicPicker.selectedComic);
	}

	/*
	 * Find all unread strips of currently selected comic and mark them as read.
	 */
	function markAllStripsRead() {
		ComicsResource.markAllStripsRead(MozComics.ComicPicker.selectedComic);
	}

	/*
	 * Populate the showing and enabled cache arrays, and refresh the comic picker.
	 */
	function refreshCache(refreshTree) {
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
		if(refreshTree) {
			MozComics.ComicPicker.refreshTree();
		}
		else {
			MozComics.ComicPicker.update();
		}
	}


	/*
	 * Get and set functions so other parts of MozComics can interact
	 * with the installed comics.
	 */
	function getComic(comic) {
		return (comic.comic) ? comic: ComicsResource.all[comic];
	}

	function isInstalled(guid) {
		return (ComicsResource.guids.hasOwnProperty(guid));
	}

	function getComicByGuid(guid) {
		return ComicsResource.guids[guid];
	}

	function getComicProp(comic, prop) {
		return self.getComic(comic).get(prop, MozComics.callbackId);
	}

	function setComicProp(comic, prop, val, skipRefreshCache) {
		this.getComic(comic).set(prop, val, MozComics.callbackId);

		if(!skipRefreshCache) {
			this.refreshCache();
		}
	}


	/*
	 * Enable all comics
	 * Don't call refreshCache if the skipRefreshCache flag is true
	 * Otherwise, only call refreshCache once at the end
	 */
	function enableAll(skipRefreshCache) {
		for(var comic in ComicsResource.all) {
			this.setComicProp(comic, "enabled", true, true);
		}

		if(!skipRefreshCache) {
			this.refreshCache();
		}
	}

	/*
	 * Disable all comics
	 * Don't call refreshCache if the skipRefreshCache flag is true
	 * Otherwise, only call refreshCache once at the end
	 */
	function disableAll(skipRefreshCache) {
		for(var comic in ComicsResource.all) {
			this.setComicProp(comic, "enabled", false, true);
		}

		if(!skipRefreshCache) {
			this.refreshCache();
		}
	}

	/*
	 * Default to selected comic if no argument was passed
	 */
	function onlyEnable(comic) {
		var undefined;
		if(comic == undefined || comic == null) {
			comic = MozComics.ComicPicker.selectedComic;
			if(comic === false) {
				return;
			}
		}

		this.disableAll(true);
		this.setComicProp(comic, "enabled", true);
	}
}

