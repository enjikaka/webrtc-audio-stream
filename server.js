const sio = require('socket.io');
const uuid = require('node-uuid');
const open = require('open');
const express = require('express');
const path = require('path');
const app = express();
const http = require('http').Server(app);

app.use(express.static('src'))

// Create and configure socket.io
const io = sio.listen(http, { log: true });

const port = process.env.PORT || 8080;

http.listen(port, () => {
  console.log('Listening on port :' + port);
  open('http://localhost:' + port + '/station.html');
});

// keeping track of connections
const sockets = {};

io.sockets.on('connection', socket => {
  let id;

	// Get UUID

  do {
    id = uuid.v4();
  } while (sockets[id]);

	// we have a unique identifier that can be sent to the client

  sockets[id] = socket;
  socket.emit('your-id', id);

	// remove references to the disconnected socket
  socket.on('disconnect', () => {
    sockets[socket] = undefined;
    delete sockets[socket];
  });

  socket.on('set-room-name', data => {
    id = data.name;
    sockets[id] = socket;
    socket.emit('your-id', id);
  });

	// when a message is received forward it to the addressee
  socket.on('message', message => {
    if (sockets[message.to]) {
      sockets[message.to].emit('message', message);
    } else {
      socket.emit('disconnected', message.from);
    }
  });

	// when a listener logs on let the media streaming know about it
  socket.on('logon', message => {
    if (sockets[message.to]) {
      sockets[message.to].emit('logon', message);
    }
  });

  socket.on('logoff', message => {
    if (sockets[message.to]) {
      sockets[message.to].emit('logoff', message);
    } else {
      socket.emit('error', 'Does not exsist at server.');
    }
  });

  socket.on('image-data', message => {
    sockets[message.to].emit('image-data', message);
  });

  socket.on('chat', data => {
    sockets[data.station].broadcast.emit('chat', data);
  });
});
