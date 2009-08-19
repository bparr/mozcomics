/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Comics = new function() {
	var self = this;

	this.init = init;
	this.updateComic = updateComic;
	this.deleteComic = deleteComic;

	this.all = null;
	this.guids = null;

	function init() { // TODO think this should stay synchronous
		this.all = {};
		this.guids = {};
		var statement = MozComics.DB.getAllComicsStatement;
		while(statement.executeStep()) {
			this.updateComic(new MozComics.Comic(statement.row));
		}
		statement.reset();
	}

	function updateComic(comic) {
		this.all[comic.comic] = comic;
		this.guids[comic.guid] = comic.guid;
	}

	function deleteComic(comic) {
		// delete from cache
		delete this.all[comic.comic];
		delete this.guids[comic.guid];

		// delete from database
		MozComics.DB.deleteStripsByComicStatement.params.comic = comic.comic;
		MozComics.DB.deleteStripsByComicStatement.execute();
		MozComics.DB.deleteComicStatement.params.comic = comic.comic;
		MozComics.DB.deleteComicStatement.execute();

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
