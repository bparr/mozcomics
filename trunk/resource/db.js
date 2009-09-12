/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["DB"];

/*
 * Establish database connection, and database schema. Also provide a few
 * database related objects/functions.
 */
var DB = new function() {
	var storageService = Components.classes["@mozilla.org/storage/service;1"]
		.getService(Components.interfaces.mozIStorageService);
	var file = Components.classes["@mozilla.org/file/directory_service;1"]
		.getService(Components.interfaces.nsIProperties)
		.get("ProfD", Components.interfaces.nsIFile);
	file.append("mozcomics.sqlite");


	this.dbConn = storageService.openDatabase(file); // database connection
	this.REASON_FINISHED = Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED;
	this.cloneRow = cloneRow;

	// list of columns in the comic table
	this.comicColumns = ["comic", "name", "url", "description", "extra",
			"rating", "popularity", "guid", "state", "updated", "update_site"];
	this.comicParams = _createParamsArray(this.comicColumns);

	// list of columns in the strips table
	this.stripColumns = ["comic", "strip", "title", "url", "image", "extra",
		"read", "user_rating", "server_rating", "updated"];
	this.stripParams = _createParamsArray(this.stripColumns);

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


	// row is from a statement run asynchronously. Return an object with
	// properties listed in the columns array.
	function cloneRow(row, columns) {
		var clone = {};
		for(var i = 0, len = columns.length; i < len; i++) {
			try {
				var column = columns[i];
				clone[column] = row.getResultByName(column);
			}
			catch(e) {}
		}
		return clone;
	}

	function _createParamsArray(columnArray) {
		var paramsArray = new Array();
		for(var i = 0, len = columnArray.length; i < len; i++) {
			paramsArray.push(":" + columnArray[i]);
		}
		return paramsArray;
	}
}

