/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.ComicPicker = new function() {
	this.xulTree;
	this.table;
	this.xulVarPrefix = "mozcomics-comic-";
	this.treeview = null;
	
	this.init = function() {
		this.xulTree = MozComics.Dom.comicPicker;
		this.refreshTree();
	}

	// change value and order of rows without creating a new treeview
	this.update = function(sortColumn) {
		this.treeview.update(sortColumn);
		MozComics.Strips.refresh();
	};

	// create a new treeview
	this.refreshTree = function() {
		this.table = MozComics.Comics.showing
		this.treeview = new MozComics_TreeView(this.xulTree, this.table, this.xulVarPrefix);
		MozComics.Strips.refresh();
	}

	this.onClick = function(e) {
		// Only care about primary button clicks on treechildren element
		if (!e || e.button != 0 || e.originalTarget.localName != 'treechildren') {
			return;
		}

		// make sure user is actually double clicking a row
		var row = {}, col = {}, obj = {};
		this.xulTree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, obj);
		if (!obj.value) {
			return;
		}

		var selectedComic = this.selectedComic;
		if(selectedComic) {
			selectedComic.toggleEnabledProperty();
		}

		this.update();
	}

	this.__defineGetter__("selectedComic", function() {
		if(this.xulTree.currentIndex < 0) {
			return false;
		}
		return this.table[this.xulTree.currentIndex];
	});
}
