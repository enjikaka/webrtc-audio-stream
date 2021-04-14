/* globals io */

export default class ReceiverChat {
  constructor (station, id) {
    const socket = io.connect();

    this.id = id;
    this.station = station;
    this.socket = socket;
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
      // TODO solve correctly...
      if (data.station === this.station) {
        messageCallback(data);
      }
    });
  }
}
