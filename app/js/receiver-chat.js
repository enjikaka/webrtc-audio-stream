var ReceiverChat = (function(stationName, name) {
	var socket = io.connect();
	var station;
	var id;

	function ReceiverChat(stationName, name) {
		id = name;
		station = stationName;
	}

	ReceiverChat.prototype.sendMessage = function(message) {
		console.debug(station, id, message);
		socket.emit('chat', {
			station: station,
			from: id,
			message: message
		});
	};

	ReceiverChat.prototype.onMessage = function(messageCallback) {
		socket.on('chat', function(data) {
			messageCallback(data);
		});
	};

	return ReceiverChat;
})();