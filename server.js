var sio = require('socket.io'),
	uuid = require('node-uuid'),
	open = require('open'),
	express = require('express'),
	app = express(),
	http = require('http').Server(app);

// Create a node-static server instance to serve the './public' folder

app.use("/", express.static(__dirname + '/app'));


// Create and configure socket.io 
//
var io = sio.listen(http, {log: true});

var port = process.env.PORT || 8080;

http.listen(port, function() { 
	console.log('Listening on port :' + port);
	open('http://localhost:' + port + '/station.html');
});

// keeping track of connections
var sockets = {};

io.sockets.on('connection', function(socket) {
	var id;

	// Get UUID

	do {
		id = uuid.v4();
	} while (sockets[id]);

	// we have a unique identifier that can be sent to the client

	sockets[id] = socket;
	socket.emit('your-id', id);

	// remove references to the disconnected socket
	socket.on('disconnect', function() {
		sockets[socket] = undefined;
		delete sockets[socket];
	});

	socket.on('set-room-name', function(data) {
		id = data.name;
		sockets[id] = socket;
		socket.emit('your-id', id);
	});

	// when a message is received forward it to the addressee
	socket.on('message', function(message) {
		if (sockets[message.to]) {
			sockets[message.to].emit('message', message);
		} else {
			socket.emit('disconnected', message.from);
		}
	});

	// when a listener logs on let the media streaming know about it
	socket.on('logon', function(message) {
		if (sockets[message.to]) {
			sockets[message.to].emit('logon', message);
		}
	});

	socket.on('logoff', function(message) {
		if (sockets[message.to]) {
			sockets[message.to].emit('logoff', message);
		} else {
			socket.emit('error', 'Does not exsist at server.');
		}
	});

	socket.on('song-meta', function(data) {
		socket.emit('song-meta', data.media);
	});
});


