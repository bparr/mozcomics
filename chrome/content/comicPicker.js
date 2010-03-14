/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.ComicPicker = new function() {
	Components.utils.import("resource://mozcomics/treeview.js");

	this.init = init;
	this.update = update;
	this.refreshTree = refreshTree;
	this.onClick = onClick;
	this.rowClicked = rowClicked;

	this.xulTree = null;
	this.table = null;
	this.xulVarPrefix = "mozcomics-comic-";
	this.treeview = null;
	
	function init() {
		this.xulTree = MozComics.Dom.comicPicker;
	}

	/*
	 * Update value and order of rows in tree without creating a new treeview.
	 */
	function update(sortColumn) {
		this.treeview.update(sortColumn);
		MozComics.Strips.refresh();
	};

	/*
	 * Create a new treeview.
	 * Used when the comics themselves change (i.e. comic added or deleted).
	 */
	function refreshTree() {
		this.table = MozComics.Comics.showing;
		this.treeview = new TreeView(this.xulTree, this.table, this.xulVarPrefix,
			MozComics.Comics.getComicProp);
		MozComics.Strips.refresh();
	}

	/*
	 * Change enabled states depending on which comic was clicked.
	 */
	function onClick(e) {
		// Only care about primary button clicks on treechildren element
		if (!e || e.button != 0 || e.originalTarget.localName != 'treechildren') {
			return;
		}

		// make sure user is actually double clicking a row
		if(!this.rowClicked(e)) {
			return;
		}

		var selectedComic = this.selectedComic;
		if(selectedComic) {
			if(MozComics.Prefs.user.multipleEnabledComics) {
				// toggle enabled property of selected comic
				var nowEnabled = !MozComics.Comics.getComicProp(selectedComic, "enabled");
				MozComics.Comics.setComicProp(selectedComic, "enabled", nowEnabled);
			}
			else {
				// if the user only wants one selected comic at a time, then 
				// make sure only the clicked comic is enabled
				MozComics.Comics.onlyEnable(selectedComic);
			}
		}
	}

	/*
	 * Determines if a row, instead of just empty space in the tree, was clicked.
	 */
	function rowClicked(e) {
		var row = {}, col = {}, obj = {};
		this.xulTree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, obj);
		return !!obj.value;
	}

	this.__defineGetter__("selectedComic", function() {
		var index = this.xulTree.currentIndex;
		if(index < 0) {
			return false;
		}
		return this.table[index];
	});
}

