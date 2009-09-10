/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["ComicsResource"];

Components.utils.import("resource://mozcomics/utils.js");
Components.utils.import("resource://mozcomics/db.js");

// object to contain an indiviual comic, and expose different states
// row can be a row from a db, or a pre-existing comic (clones it)
var Comic = function(row) {
	for(var j = 0, len = DB.comicColumns.length; j < len; j++) {
		var column = DB.comicColumns[j];
		this[column] = row[column];
	}

	this.states = {};
}

// define which bits represent which state properties
Comic.prototype.BITS = {
	showing: 0,
	enabled: 1
};

Comic.prototype.get = function(key, callbackId) {
	switch(key) {
		case "showing":
		case "enabled":
			return this._getProperty(this.BITS[key], callbackId);
			break;
		default:
			return this[key];
	}
}

Comic.prototype.set = function(key, value, callbackId) {
	switch(key) {
		case "showing":
		case "enabled":
			return this._setProperty(this.BITS[key], value, callbackId);
			break;
		default:
			return this[key];
	}
}

Comic.prototype.getState = function(callbackId) {
	return (this.states[callbackId]) ? this.states[callbackId] : this.state;
}

Comic.prototype.setState = function(callbackId, value) {
	this.states[callbackId] = value;
}

Comic.prototype._getProperty = function(bit, callbackId) {
	if(!this.getState(callbackId)) {
		throw ("State not defined in Comic._getProperty");
	}

	var mask = 1 << bit;
	return (this.getState(callbackId) & mask) > 0;
}

Comic.prototype._setProperty = function(bit, set, callbackId) {
	if(!this.getState(callbackId)) {
		throw ("State not defined in Comic._setProperty");
	}

	var mask = 1 << bit;
	if(set) {
		this.setState(callbackId, this.getState(callbackId) | mask);
	}
	else {
		this.setState(callbackId, this.getState(callbackId) & (~mask));
	}
}


var ComicsResource = new function() {
	var self = this;

	this.all = {};
	this.guids = {};

	this.updateComic = updateComic;
	this.deleteComic = deleteComic;
	this.saveStatesToDB = saveStatesToDB;
	this.findReadStrips = findReadStrips;
	this.addCallback = addCallback;
	this.removeCallback = removeCallback;
	this.callCallbacks = callCallbacks;


	var statement = DB.dbConn.createStatement(
		"SELECT " + DB.comicColumns.join(", ") + " FROM comic;"
	);

	while(statement.executeStep()) {
		updateComic(statement.row);
	}
	statement.reset();

	// create statements used by deleteComic
	var deleteStripsByComicStatement = DB.dbConn.createStatement(
		"DELETE FROM strip WHERE comic=:comic;"
	);
	var deleteComicFromDBStatement = DB.dbConn.createStatement(
		"DELETE FROM comic WHERE comic=:comic;"
	);

	// create statement used by saveStatesToDB
	var saveStateToDBStatement = DB.dbConn.createStatement(
		"UPDATE comic SET state=:state WHERE comic=:comic"
	);

	// create statements used by findReadStrips
	var getUnreadStripsStatement = DB.dbConn.createStatement(
		"SELECT strip, url FROM strip WHERE comic=:comic AND read ISNULL;"
	);
	var updateStripReadTimeStatement = DB.dbConn.createStatement(
		"UPDATE strip SET read = :read WHERE comic = :comic AND strip = :strip;"
	);


	function updateComic(row, getResultByName) {
		var comic = new Comic(row, getResultByName);
		var oldComic = self.all[comic.comic];
		for(var id in callbacks) {
			if(oldComic && oldComic.states[id]) {
				comic.states[id] = oldComic.states[id];
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
					callCallbacks();
				}
				else {
					Utils.alert(Utils.getString("deleteComic.sqlError"));
				}
			}
		});
	}

	function saveStatesToDB(callbackId) {
		var statements = [];
		for(var comic in self.all) {
			var saveStateToDB = saveStateToDBStatement.clone();
			saveStateToDB.params.comic = comic;
			saveStateToDB.params.state = self.all[comic].getState(callbackId);//TODO make better (caching problem)
			statements.push(saveStateToDB);
		}

		DB.dbConn.executeAsync(statements, statements.length);
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

	function _processReadStrips(readStrips, selectedComic) {
		if(readStrips.length > 0) {
			var prompt = Components.classes["@mozilla.org/network/default-prompt;1"]
				.getService(Components.interfaces.nsIPrompt);

			var result = prompt.confirm("", Utils.getString("findReadStrips.youSure", readStrips.length));
			if(result) {
				var d = new Date();
				var read = d.getTime();

				var updateStatements = [];
				for(var i = 0, len = readStrips.length; i < len; i++) {
					var updateStripReadTime = updateStripReadTimeStatement.clone();
					updateStripReadTime.params.comic = selectedComic.comic;
					updateStripReadTime.params.strip = readStrips[i];
					updateStripReadTime.params.read = read + i;
					updateStatements.push(updateStripReadTime);
				}

				DB.dbConn.executeAsync(updateStatements, updateStatements.length);
			}
		}
		else {
			Utils.alert(Utils.getString("findReadStrips.noneFound"));
		}
	}


	var callbacks = {};
	var nextCallbackId = 0;
	function addCallback(callback) {
		var id = nextCallbackId++;
		callbacks[id] = callback;
		return id;
	}

	function removeCallback(id) {
		delete callbacks[id];
	}


	function callCallbacks() {
		for(var id in callbacks) {
			callbacks[id]();
		}
	}
}

