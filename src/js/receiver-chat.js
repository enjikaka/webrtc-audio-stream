/* globals io */

export class ReceiverChat {
  constructor (station, id) {
    const socket = io.connect();

    Object.assign(this, {
      id,
      station,
      socket
    });
  }

  sendMessage (message) {
    const { socket, station, id } = this;

    socket.emit('chat', {
      station,
      from: id,
      message
    });
  }

  onMessage (messageCallback) {
    const { socket } = this;

    socket.on('chat', data => {
      messageCallback(data);
    });
  }
}
