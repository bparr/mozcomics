/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/


MozComics.Comic = function(row) {
	for(var j = 0, len = MozComics.DB.comicColumns.length; j < len; j++) {
		var column = MozComics.DB.comicColumns[j];
		this[column] = row[column];
	}
}

// define which bits represent which state properties
MozComics.Comic.prototype.SHOWING = 0;
MozComics.Comic.prototype.ENABLED = 1;

// functions to get and change individual states
MozComics.Comic.prototype.__defineGetter__("showing", function() { return this._getProperty(this.SHOWING); } );
MozComics.Comic.prototype.__defineSetter__("showing", function(set) { this._setProperty(this.SHOWING, set); } );
MozComics.Comic.prototype.toggleShowingProperty = function(set) { this._toggleProperty(this.SHOWING, set); }

MozComics.Comic.prototype.__defineGetter__("enabled", function() { return this._getProperty(this.ENABLED); } );
MozComics.Comic.prototype.__defineSetter__("enabled", function(set) { this._setProperty(this.ENABLED, set); } );
MozComics.Comic.prototype.toggleEnabledProperty = function() { this._toggleProperty(this.ENABLED); }



MozComics.Comic.prototype._getProperty = function(bit) {
	var mask = 1 << bit;
	return (this.state & mask) > 0;
}

MozComics.Comic.prototype._setProperty = function(bit, set) {
	var mask = 1 << bit;
	if(set) {
		this.state = this.state | mask;
	}
	else {
		this.state = this.state & (~mask);
	}
}

MozComics.Comic.prototype._toggleProperty = function(bit) {
	this._setProperty(bit, !this._getProperty(bit));
}
