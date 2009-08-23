/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["addCallback", "removeCallback", "callCallbacks", "updateComic", "deleteComic", "all", "guids"];


var DB = {}; Components.utils.import("resource://mozcomics/db.js", DB);

var callbacks = {};
var nextCallbackId = 0;
var addCallback = function(callback) {
	var id = nextCallbackId++;
	callbacks[id] = callback;
	return id;
}

var removeCallback = function(id) {
	delete callbacks[id];
}


function callCallbacks() {
	for(var id in callbacks) {
		callbacks[id]();
	}
}

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



// Comics code
var all = {};
var guids = {};

var statement = DB.dbConn.createStatement(
	"SELECT " + DB.comicColumns.join(", ") + " FROM comic;"
);

while(statement.executeStep()) {
	updateComic(statement.row);
}
statement.reset();

// create statements used by deleteComic
var deleteComicFromDB = DB.dbConn.createStatement(
	"DELETE FROM comic WHERE comic=:comic;"
);
var deleteStripsByComic = DB.dbConn.createStatement(
	"DELETE FROM strip WHERE comic=:comic;"
);

function updateComic(row) {
	var comic = new Comic(row);
	var oldComic = all[comic.comic];
	for(var id in callbacks) {
		if(oldComic && oldComic.states[id]) {
			comic.states[id] = oldComic.states[id];
		}
	}

	all[comic.comic] = comic;
	guids[comic.guid] = comic;
	return comic;
}

function deleteComic(comic) {
	// delete from cache
	delete all[comic.comic];
	delete guids[comic.guid];

	// delete from database
	deleteStripsByComic.params.comic = comic.comic;
	deleteStripsByComic.execute();
	deleteComicFromDB.params.comic = comic.comic;
	deleteComicFromDB.execute();
}

