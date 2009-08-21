/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Comics = new function() {
	this.init = init;
	this.unload = unload;
	this.updateComic = updateComic;
	this.deleteComic = deleteComic;

	this.all = null;
	this.guids = null;

	this.deleteComicFromDB = null;
	this.deleteStripsByComic = null;

	function init() { // TODO think this should stay synchronous
		this.all = {};
		this.guids = {};
		var statement = MozComics.DB.dbConn.createStatement(
			"SELECT " + MozComics.DB.comicColumns.join(", ") + " FROM comic;"
		);

		while(statement.executeStep()) {
			this.updateComic(new MozComics.Comic(statement.row));
		}
		statement.reset();

		// create statements used by deleteComic
		this.deleteComicFromDB = MozComics.DB.dbConn.createStatement(
			"DELETE FROM comic WHERE comic=:comic;"
		);
		this.deleteStripsByComic = MozComics.DB.dbConn.createStatement(
			"DELETE FROM strip WHERE comic=:comic;"
		);
	}

	function unload() {
		// save the states of each comic to the database
		var statement = MozComics.DB.dbConn.createStatement(
			"UPDATE comic SET state=:state WHERE comic=:comic"
		);

		for(var comic in this.all) {
			statement.params.comic = this.all[comic].comic;
 			statement.params.state = this.all[comic].state;
			statement.execute();
		}
	}

	function updateComic(comic) {
		this.all[comic.comic] = comic;
		this.guids[comic.guid] = comic;
	}

	function deleteComic(comic) {
		// delete from cache
		delete this.all[comic.comic];
		delete this.guids[comic.guid];

		// delete from database
		this.deleteStripsByComic.params.comic = comic.comic;
		this.deleteStripsByComic.execute();
		this.deleteComicFromDB.params.comic = comic.comic;
		this.deleteComicFromDB.execute();

		MozComics.ComicPicker.refreshTree();
	}

	this.__defineGetter__("showing", function() { // TODO cache ?
		var showingComics = new Array();
		for(var comic in this.all) {
			if(this.all[comic].showing) {
				showingComics.push(this.all[comic]);
			}
		}
		return showingComics;
	});

	this.__defineGetter__("enabled", function() { // TODO cache ?
		var enabledComics = new Array();
		for(var comic in this.all) {
			if(this.all[comic].showing && this.all[comic].enabled) {
				enabledComics.push(this.all[comic]);
			}
		}
		return enabledComics;
	});

	this.enableAll = function() {
		for(var comic in this.all) {
				this.all[comic].enabled = true;
		}
		MozComics.ComicPicker.update();
		MozComics.Strips.refresh();
	}

	this.disableAll = function() {
		for(var comic in this.all) {
				this.all[comic].enabled = false;
		}
		MozComics.ComicPicker.update();
		MozComics.Strips.refresh();
	}
}
