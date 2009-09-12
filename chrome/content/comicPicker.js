/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.ComicPicker = new function() {
	Components.utils.import("resource://mozcomics/treeview.js");

	this.init = init;
	this.update = update;
	this.refreshTree = refreshTree;
	this.onClick = onClick;

	this.xulTree;
	this.table;
	this.xulVarPrefix = "mozcomics-comic-";
	this.treeview = null;
	
	function init() {
		this.xulTree = MozComics.Dom.comicPickerTree;
	}

	// update value and order of rows in tree without creating a new treeview
	function update(sortColumn) {
		this.treeview.update(sortColumn);
		MozComics.Strips.refresh();
	};

	// create a new treeview
	function refreshTree() {
		this.table = MozComics.Comics.showing;
		this.treeview = new TreeView(this.xulTree, this.table, this.xulVarPrefix,
			MozComics.Comics.getComicProp);
		MozComics.Strips.refresh();
	}

	function onClick(e) {
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
			// toggle enabled property of selected comic
			var nowEnabled = !MozComics.Comics.getComicProp(selectedComic, "enabled");
			MozComics.Comics.setComicProp(selectedComic, "enabled", nowEnabled);
		}
	}

	this.__defineGetter__("selectedComic", function() {
		if(this.xulTree.currentIndex < 0) {
			return false;
		}
		return this.table[this.xulTree.currentIndex];
	});
}

