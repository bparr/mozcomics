/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.DB = new function() {
	var self = this;

	this.init = init;
	this.unload = unload;
	this._createParamsArray = _createParamsArray;

	this.dbConn = null;

	this.comicColumns = ["comic", "name", "url", "description", "extra", "rating", "popularity", "guid", "state", "updated"]; // TODO is this the best way to do this?
	this.comicParams = this._createParamsArray(this.comicColumns);

	// does not contain "read" or "user_rating" because those are set by the user
	this.updateStripColumns = ["comic", "strip", "title", "url", "image", "extra", "server_rating", "updated"];
	this.updateStripParams = this._createParamsArray(this.updateStripColumns);

	// statements used by MozComics.Comics
	this.getAllComicsStatement = null;

	// statements used by MozComics.Update
	this.getComicIdFromGuidStatement = null;
	this.getComicFromGuidStatement = null;
	this.updateComicStatement = null;
	this.updateStripStatement = null;

	function init() {
		var file = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
		file.append("mozcomics.sqlite");
		var storageService = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);
		this.dbConn = storageService.openDatabase(file);

		// create tables
		var statement = this.dbConn.createStatement("CREATE TABLE IF NOT EXISTS comic (" +
			"comic INTEGER PRIMARY KEY AUTOINCREMENT," + // local id of comic
			"name TEXT NOT NULL," + 
			"url TEXT NOT NULL DEFAULT ''," + // homepage url
			"description TEXT NOT NULL DEFAULT ''," +
			"extra TEXT NOT NULL DEFAULT ''," + // extra info in JSON formatted string
			"rating INTEGER NOT NULL DEFAULT -1," + // based on server results
			"popularity INTEGER NOT NULL DEFAULT -1," + // based on server results
			"guid TEXT NOT NULL UNIQUE," + // id for server transactions
			"state INTEGER NOT NULL DEFAULT 1," + // state of comic in extension (showing, not enabled)
			"updated INTEGER," + // last sync with server (null indicates never updated)
			"update_site TEXT);"); // site to check for updates (null defaults to MozComics site));
		statement.execute();

		statement = this.dbConn.createStatement("CREATE TABLE IF NOT EXISTS strip (" +
			"comic INTEGER NOT NULL," + // local id of comic strip is from
			"strip INTEGER NOT NULL," + // date strip was created (also used for id)
			"title TEXT NOT NULL DEFAULT ''," +
			"url TEXT NOT NULL DEFAULT ''," +
			"image TEXT NOT NULL DEFAULT ''," + // url of image
			"extra TEXT NOT NULL DEFAULT ''," + // extra info in JSON formatted string
			"read INTEGER," + // time of last read (null indicates unread)
			"user_rating INTEGER NOT NULL DEFAULT -1," + // rating set by user
			"server_rating INTEGER NOT NULL DEFAULT -1," + // rating based on server results
			"updated INTEGER," + // last sync with server (null indicates never updated)
			"PRIMARY KEY (comic, strip)," +
			"FOREIGN KEY (comic) REFERENCES comic(comic));");
		statement.execute();

		// create indexes
		statement = this.dbConn.createStatement("CREATE INDEX IF NOT EXISTS strip_comic_index " +
			"ON strip (strip, comic);");
		statement.execute();

		statement = this.dbConn.createStatement("CREATE INDEX IF NOT EXISTS read_index " +
			"ON strip (read);");
		statement.execute();

		// create statements used by MozComics
		this.getAllComicsStatement = this.dbConn.createStatement(
			"SELECT " + MozComics.DB.comicColumns.join(", ") + " FROM comic;");
		this.getComicIdFromGuidStatement = this.dbConn.createStatement(
			"SELECT comic FROM comic WHERE guid=:guid");
		this.getComicFromGuidStatement = this.dbConn.createStatement(
			"SELECT " + this.comicColumns.join(", ") + " FROM comic WHERE guid=:guid;");
		this.getUnreadStripsStatement = this.dbConn.createStatement(
			"SELECT strip, url FROM strip WHERE comic=:comic AND read ISNULL;");
		this.updateComicStatement = this.dbConn.createStatement(
			"REPLACE INTO comic(" + this.comicColumns.join(", ") + ") VALUES (" + this.comicParams.join(", ") + ");");
		this.updateStripStatement = this.dbConn.createStatement(
			"REPLACE INTO strip(" + this.updateStripColumns.join(", ") + ") VALUES (" + this.updateStripParams.join(", ") + ");");
		this.updateStripReadTimeStatement = this.dbConn.createStatement(
			"UPDATE strip SET read = :read WHERE comic = :comic AND strip = :strip;");
		this.updateStripStateStatement = this.dbConn.createStatement(
			"UPDATE comic SET state=:state WHERE comic=:comic");
		this.deleteComicStatement = this.dbConn.createStatement(
			"DELETE FROM comic WHERE comic=:comic;");
		this.deleteStripStatement = this.dbConn.createStatement(
			"DELETE FROM strip WHERE comic=:comic and strip=:strip;");
		this.deleteStripsByComicStatement = this.dbConn.createStatement(
			"DELETE FROM strip WHERE comic=:comic;");
	}


	function unload() {
		for(var comic in MozComics.Comics.all) {
			this.updateStripStateStatement.params.comic = MozComics.Comics.all[comic].comic;
 			this.updateStripStateStatement.params.state = MozComics.Comics.all[comic].state;
			this.updateStripStateStatement.execute();
		}
	}

	function _createParamsArray(columnArray) {
		var paramsArray = new Array();
		for(var i = 0, len = columnArray.length; i < len; i++) {
			paramsArray.push(":" + columnArray[i]);
		}
		return paramsArray;
	}
}
