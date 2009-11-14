/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["DB"];

Components.utils.import("resource://mozcomics/utils.js");
Components.utils.import("resource://mozcomics/callback.js");
Components.utils.import("resource://mozcomics/prefs.js");

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
	this.updateReadTimes = updateReadTimes;

	// list of columns in the comic table
	this.comicColumns = ["comic", "type", "name", "url", "description", "extra",
			"rating", "popularity", "guid", "state", "updated", "update_site"];
	this.comicParams = _createParamsArray(this.comicColumns);

	// list of columns in the strips table
	this.stripColumns = ["comic", "strip", "title", "url", "image", "bookmark",
		"extra", "read", "user_rating", "server_rating", "updated"];
	this.stripParams = _createParamsArray(this.stripColumns);

	// create tables
	var statement = this.dbConn.createStatement("CREATE TABLE IF NOT EXISTS comic (" +
		"comic INTEGER PRIMARY KEY AUTOINCREMENT," + // local id of comic
		"type INTEGER NOT NULL DEFAULT 0," + // webcomic vs. manga (default = webcomic)
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
		"bookmark INTEGER NOT NULL DEFAULT 0," + // used to mark chapter starts in mangas
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

	statement = this.dbConn.createStatement("CREATE INDEX IF NOT EXISTS comic_read_index " +
		"ON strip (comic, read);");
	statement.execute();

	var updateStripReadTimeStatement = this.dbConn.createStatement(
		"UPDATE strip SET read = :read WHERE comic = :comic AND strip = :strip;"
	);


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


	var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
		.getService(Components.interfaces.nsIGlobalHistory2);
	var ioService = Components.classes["@mozilla.org/network/io-service;1"]
		.getService(Components.interfaces.nsIIOService);

	/*
	 * Update the read times of the strips.
	 * Return the read time.
 	 */
	function updateReadTimes(comic, strips, d) {
		// use current time is none was passed
		d = (d) ? d : new Date();
		var read = d.getTime();

		var updateStatements = [];
		for(var i = 0, len = strips.length; i < len; i++) {
			var strip = strips[i];
			var updateStripReadTime = updateStripReadTimeStatement.clone();
			updateStripReadTime.params.comic = comic;
			updateStripReadTime.params.strip = strip.strip;

			// add i to read in order to make read times different
			updateStripReadTime.params.read = read + i;

			updateStatements.push(updateStripReadTime);

			if(Prefs.user.addReadToBrowserHistory) {
				// add url of strip to browser history
				var uri = ioService.newURI(strip.url, null, null);
				historyService.addURI(uri, false, true, null);
			}
		}

		DB.dbConn.executeAsync(updateStatements, updateStatements.length, {
			handleResult: function(response) {},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				Callback.callType("stripRead");
				if(reason != DB.REASON_FINISHED) {
					Utils.alert(Utils.getString("updateReadTime.sqlError"));
				}
			}
		});

		return read;
	}

	function _createParamsArray(columnArray) {
		var paramsArray = new Array();
		for(var i = 0, len = columnArray.length; i < len; i++) {
			paramsArray.push(":" + columnArray[i]);
		}
		return paramsArray;
	}
}

