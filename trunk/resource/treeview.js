/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php


Based on https://developer.mozilla.org/en/Sorting_and_filtering_a_custom_tree_view
*/

var EXPORTED_SYMBOLS = ["TreeView"];

/*
 * Object implementing the nsITreeView interface, that includes 
 * simple row sorting capabilities.
 */
var TreeView = function(xulTree, table, xulVarPrefix, getText) {
	this.xulTree = xulTree;
	this.table = table;
	this.rowCount = this.table.length;
	this.xulVarPrefix = xulVarPrefix;

	// getText is a function used by getCellText which takes two parameters:
	// the object in an individual row, and a variable of the object
	this.getText = getText;

	this.update();
}

TreeView.prototype.getCellText = function(row, col) {
	return this.getText(this.table[row], col.id.replace(this.xulVarPrefix, ""));
};
TreeView.prototype.getCellValue = function(row, col) { return this.getCellText(row, col); };
TreeView.prototype.setTree = function(treebox){ this.treebox = treebox; };
TreeView.prototype.isContainer = function(row){ return false; };
TreeView.prototype.isEditable = function(row, col) { return false; };
TreeView.prototype.isSeparator = function(row){ return false; }
TreeView.prototype.isSorted = function(){ return false; };
TreeView.prototype.canDrop = function(index, orientation, dataTransfer){ return false; };
TreeView.prototype.drop = function(index, orientation, dataTransfer){};
TreeView.prototype.getLevel = function(row){ return 0; };
TreeView.prototype.getImageSrc = function(row,col){ return null; };
TreeView.prototype.getParentIndex = function(row) { return -1; };
TreeView.prototype.getRowProperties = function(row,props) {};
TreeView.prototype.getCellProperties = function(row,col,props) {};
TreeView.prototype.getColumnProperties = function(colid,col,props){};
TreeView.prototype.cycleHeader = function(col, elem) {};


// Converts value to lowercase if a string
TreeView.prototype.prepareForComparison = function(val) {
	if (typeof val == "string") {
		return val.toLowerCase();
	}
	return val;
}


// update tree with a specific sort
TreeView.prototype.update = function(sortColumn) {
	var firstRow = this.xulTree.treeBoxObject.getFirstVisibleRow()

	var sortColumnId;
	var sortOrder = (this.xulTree.getAttribute("sortDirection") == "ascending") ? 1 : -1;

	// if the column is passed and it's already sorted by that column, reverse sort
	if(sortColumn) {
		sortColumnId = sortColumn.id;
		if (this.xulTree.getAttribute("sortResource") == sortColumnId) {
			sortOrder *= -1;
		}
	}
	else {
		sortColumnId = this.xulTree.getAttribute("sortResource");
	}

	var sortObjId = sortColumnId.replace(this.xulVarPrefix, "");
	var self = this;
	function columnSortFunction(a, b) {
		var val1 = self.prepareForComparison(self.getText(a, sortObjId));
		var val2 = self.prepareForComparison(self.getText(b, sortObjId));

		if(val1 > val2) return sortOrder;
		if(val1 < val2) return -1 * sortOrder;

		// tiebreaker
		val1 = self.prepareForComparison(self.getText(a, "name"));
		val2 = self.prepareForComparison(self.getText(b, "name"));
		if(val1 > val2) return 1;
		if(val1 < val2) return -1;

		return 0;
	}

	this.table.sort(columnSortFunction);
	//setting these will make the sort option persist
	this.xulTree.setAttribute("sortDirection", sortOrder == 1 ? "ascending" : "descending");
	this.xulTree.setAttribute("sortResource", sortColumnId);
	this.xulTree.view = this;

	//set the appropriate attributes to show to indicator
	var cols = this.xulTree.getElementsByTagName("treecol");
	for (var i = 0; i < cols.length; i++) {
		cols[i].removeAttribute("sortDirection");
	}
	this.xulTree.ownerDocument.getElementById(sortColumnId)
		.setAttribute("sortDirection", sortOrder == 1 ? "ascending" : "descending");

	if(firstRow) {
		this.xulTree.treeBoxObject.scrollToRow(firstRow);
	}
}

