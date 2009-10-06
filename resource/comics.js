/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["ComicsResource"];

Components.utils.import("resource://mozcomics/utils.js");
Components.utils.import("resource://mozcomics/db.js");

/*
 * Object to contain an indiviual comic, and expose different states.
 * row can be a row from a db, or a pre-existing comic (clones it)
 */
var Comic = function(row) {
	for(var j = 0, len = DB.comicColumns.length; j < len; j++) {
		var column = DB.comicColumns[j];
		this[column] = row[column];
	}

	if(this.extra) {
			try {
				var extra = JSON.parse(this.extra);
				this.extra = extra;
			}
			catch(e) {}
	}

	// Each instance of the MozComics object has its own set of comic states.
	// Assign each instance of the MozComics object an id (callbackId) in
	// order to know which set of states we are dealing with.
	this.states = {};
}

// define which bits represent which state properties
Comic.prototype.BITS = {
	showing: 0,
	enabled: 1
};

Comic.prototype.get = function(key, callbackId) {
	switch(key) {
		case "state":
			if(callbackId && this.states[callbackId]) {
				return this.states[callbackId];
			}
			return this.state;

		case "showing":
		case "enabled":
			return this._getStateProperty(this.BITS[key], callbackId);
		case "unread":
			return ComicsResource.unreadCounts[this.comic];
		default:
			return this[key];
	}
}

Comic.prototype.set = function(key, value, callbackId) {
	switch(key) {
		case "state":
			if(callbackId) {
				this.states[callbackId] = value
			}
			else {
				this[key] = value;
			}
			break;

		case "showing":
		case "enabled":
			this._setStateProperty(this.BITS[key], value, callbackId);
			break;
		case "unread":
			ComicsResource.unreadCounts[this.comic] = value;
			break;
		default:
			this[key] = value;
	}
}

Comic.prototype._getStateProperty = function(bit, callbackId) {
	var state = this.get("state", callbackId);
	if(!state) {
		throw ("State not defined in Comic._getStateProperty");
	}

	var mask = 1 << bit;
	return (state & mask) > 0;
}

Comic.prototype._setStateProperty = function(bit, set, callbackId) {
	var state = this.get("state", callbackId);
	if(!state) {
		throw ("State not defined in Comic._setStateProperty");
	}

	var mask = 1 << bit;
	if(set) {
		this.set("state", state | mask, callbackId);
	}
	else {
		this.set("state", state & (~mask), callbackId);
	}
}


/*
 * Handle caching comics from the database, and other comic functions.
 */
var ComicsResource = new function() {
	var self = this;

	this.all = {}; // all comics indexed by comic column
	this.guids = {}; // all comics indexed by guid column
	this.unreadCounts = {}; // strip unread counts indexed by comic column
	this.totalUnread = 0;

	this.populateUnreadCounts = populateUnreadCounts;
	this.updateComic = updateComic;
	this.deleteComic = deleteComic;
	this.saveStatesToDB = saveStatesToDB;
	this.findReadStrips = findReadStrips;
	this.markAllStripsRead = markAllStripsRead;

	this.addCallback = addCallback;
	this.removeCallback = removeCallback;
	this.callCallbacks = callCallbacks;

	// create statements
	var getUnreadCountsStatement = DB.dbConn.createStatement(
		"SELECT comic, COUNT(*) as unreadCount FROM strip WHERE read ISNULL GROUP BY comic;"
	);

	var deleteStripsByComicStatement = DB.dbConn.createStatement(
		"DELETE FROM strip WHERE comic=:comic;"
	);
	var deleteComicFromDBStatement = DB.dbConn.createStatement(
		"DELETE FROM comic WHERE comic=:comic;"
	);

	var saveStateToDBStatement = DB.dbConn.createStatement(
		"UPDATE comic SET state=:state WHERE comic=:comic"
	);

	var getUnreadStripsStatement = DB.dbConn.createStatement(
		"SELECT strip, url FROM strip WHERE comic=:comic AND read ISNULL;"
	);
	var updateStripReadTimeStatement = DB.dbConn.createStatement(
		"UPDATE strip SET read = :read WHERE comic = :comic AND strip = :strip;"
	);


	// cache comics from database
	var statement = DB.dbConn.createStatement(
		"SELECT " + DB.comicColumns.join(", ") + " FROM comic;"
	);

	while(statement.step()) {
		updateComic(statement.row);
	}

	this.populateUnreadCounts();

	function populateUnreadCounts() {
		this.unreadCounts = {};
		for(var comic in this.all) {
			this.unreadCounts[comic] = 0;
		}

		this.totalUnread = 0;
		var statement = getUnreadCountsStatement.clone(); 
		while(statement.step()) {
			this.unreadCounts[statement.row.comic] = statement.row.unreadCount;
			this.totalUnread += statement.row.unreadCount;
		}
	}


	function updateComic(row) {
		var comic = new Comic(row);

		var oldComic = self.all[comic.comic];
		for(var id in callbacks) {
			// persist states from old comic
			if(oldComic && oldComic.states[id]) {
				comic.states[id] = oldComic.states[id];
			}
			else {
				comic.states[id] = comic.state;
			}
		}

		self.all[comic.comic] = comic;
		self.guids[comic.guid] = comic;
		return comic;
	}

	function deleteComic(comic) {
		// delete from cache
		delete self.all[comic.comic];
		delete self.guids[comic.guid];

		// delete from database
		var deleteStripsByComic = deleteStripsByComicStatement.clone();
		deleteStripsByComic.params.comic = comic.comic;
		var deleteComicFromDB = deleteComicFromDBStatement.clone();
		deleteComicFromDB.params.comic = comic.comic;

		DB.dbConn.executeAsync([deleteStripsByComic, deleteComicFromDB], 2, {
			handleResult: function(response) {},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				if(reason == DB.REASON_FINISHED) {
					self.callCallbacks(true);
				}
				else {
					Utils.alert(Utils.getString("deleteComic.sqlError"));
				}
			}
		});
	}

	// Save the set of states for the instance of the MozComics object
	// (identified by callbackId) to the database
	function saveStatesToDB(callbackId) {
		var statements = [];
		for(var comic in self.all) {
			var state = self.all[comic].get("state", callbackId);
			self.all[comic].set("state", state);
			var saveStateToDB = saveStateToDBStatement.clone();
			saveStateToDB.params.comic = comic;
			saveStateToDB.params.state = state;
			statements.push(saveStateToDB);
		}

		if(statements.length > 0) {
			DB.dbConn.executeAsync(statements, statements.length);
		}
	}


	function findReadStrips(selectedComic) {
		var getUnreadStrips = getUnreadStripsStatement.clone();
		getUnreadStrips.params.comic = selectedComic.comic;
		getUnreadStrips.executeAsync({
			selectedComic: selectedComic,
			rows: [],

			handleResult: function(response) {
				for(var row = response.getNextRow(); row; row = response.getNextRow()) {
					this.rows.push(row);
				}
			},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				if(reason == DB.REASON_FINISHED) {
					var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
						.getService(Components.interfaces.nsIGlobalHistory2);
					var ioService = Components.classes["@mozilla.org/network/io-service;1"]
						.getService(Components.interfaces.nsIIOService);

					var readStrips = [];
					for(var i = 0, len = this.rows.length; i < len; i++) {
						var row = this.rows[i];
						var uri = ioService.newURI(row.getResultByName("url"), null, null);
						if(historyService.isVisited(uri)) {
							readStrips.push(row.getResultByName("strip"));
						}
					}
					_processReadStrips(readStrips, this.selectedComic);
				}
				else {
					Utils.alert(Utils.getString("findReadStrips.sqlError"));
				}
			}
		});
	}

	function markAllStripsRead(selectedComic) {
		var getUnreadStrips = getUnreadStripsStatement.clone();
		getUnreadStrips.params.comic = selectedComic.comic;
		getUnreadStrips.executeAsync({
			selectedComic: selectedComic,
			rows: [],

			handleResult: function(response) {
				for(var row = response.getNextRow(); row; row = response.getNextRow()) {
					this.rows.push(row);
				}
			},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				if(reason == DB.REASON_FINISHED) {
					var readStrips = [];
					for(var i = 0, len = this.rows.length; i < len; i++) {
						readStrips.push(this.rows[i].getResultByName("strip"));
					}
					_processReadStrips(readStrips, this.selectedComic);
				}
				else {
					Utils.alert(Utils.getString("markAllStripsRead.sqlError"));
				}
			}
		});
	}

	function _processReadStrips(readStrips, selectedComic) {
		if(readStrips.length > 0) {
			var prompt = Components.classes["@mozilla.org/network/default-prompt;1"]
				.getService(Components.interfaces.nsIPrompt);

			var result = prompt.confirm("", Utils.getString("processReadStrips.youSure", readStrips.length));
			if(result) {
				var d = new Date();
				var read = d.getTime();

				var updateStatements = [];
				for(var i = 0, len = readStrips.length; i < len; i++) {
					var updateStripReadTime = updateStripReadTimeStatement.clone();
					updateStripReadTime.params.comic = selectedComic.comic;
					updateStripReadTime.params.strip = readStrips[i];

					// add i to read in order to make read times different
					updateStripReadTime.params.read = read + i;

					updateStatements.push(updateStripReadTime);
				}

				DB.dbConn.executeAsync(updateStatements, updateStatements.length, {
					handleResult: function(response) {},
					handleError: function(error) {},
					handleCompletion: function(reason) {
						self.callCallbacks();
						if(reason != DB.REASON_FINISHED) {
							Utils.alert(Utils.getString("processReadStrips.sqlError"));
						}
					}
				});
			}
		}
		else {
			Utils.alert(Utils.getString("processReadStrips.noneFound"));
		}
	}


	var callbacks = {};
	var nextCallbackId = 1;
	function addCallback(callback) {
		var id = nextCallbackId++;
		callbacks[id] = callback;

		// add set of states for this id
		for(var comicId in this.all) {
			var comic = this.all[comicId];
			comic.states[id] = comic.state;
		}

		return id;
	}

	function removeCallback(id) {
		// delete set of states for this id
		for(var comicId in this.all) {
			delete this.all[comicId].states[id];
		}

		delete callbacks[id];
	}


	function callCallbacks(arg) {
		this.populateUnreadCounts();

		for(var id in callbacks) {
			callbacks[id](arg);
		}
	}
}

