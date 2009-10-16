/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["Callback"];

var Callback = new function() {
	this.addResource = addResource;
	this.add = add;
	this.remove = remove;
	this.getIds = getIds;
	this.callType = callType;

	var resourceCallbacks = [];
	var callbacks = {};
	var nextCallbackId = 1;

	function addResource(callback) {
		resourceCallbacks.push(callback);
	}

	function add(callback) {
		var id = nextCallbackId++;
		callbacks[id] = callback;

		for(var i = 0, len = resourceCallbacks.length; i < len; i++) {
			resourceCallbacks[i].onAdd(id);
		}

		return id;
	}

	function remove(id) {
		for(var i = 0, len = resourceCallbacks.length; i < len; i++) {
			resourceCallbacks[i].onRemove(id);
		}

		delete callbacks[id];
	}

	function getIds() {
		var ids = [];
		for(var id in callbacks) {
			ids.push(id);
		}
		return ids;
	}

	function callType(type) {
		for(var i = 0, len = resourceCallbacks.length; i < len; i++) {
			resourceCallbacks[i].onCallType(type);
		}

		for(var id in callbacks) {
			callbacks[id][type]();
		}
	}
}
