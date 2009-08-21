/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.DB = new function() {
	this.init = init;
	this._createParamsArray = _createParamsArray;

	this.dbConn = null;

	// list of columns in the comic table
	this.comicColumns = null;
	this.comicParams = null;

	function init() {
		var file = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
		file.append("mozcomics.sqlite");
		var storageService = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);
		this.dbConn = storageService.openDatabase(file);

		this.comicColumns = ["comic", "name", "url", "description", "extra", 
			"rating", "popularity", "guid", "state", "updated", "update_site"];
		this.comicParams = this._createParamsArray(this.comicColumns);

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
	}

	function _createParamsArray(columnArray) {
		var paramsArray = new Array();
		for(var i = 0, len = columnArray.length; i < len; i++) {
			paramsArray.push(":" + columnArray[i]);
		}
		return paramsArray;
	}
}
