/* eslint-env browser */
/* globals io */

export default class Receiver {
  constructor (station) {
    const socket = io.connect();

    window.addEventListener('beforeunload', () => {
      const { client } = this;

      socket.emit('logoff', { to: station, from: client });
    });

    this._mediaDescription = {};

    this.station = station;
    this.socket = socket;

    this.createPeer();
    this.registerSocketEvents();
  }

  set mediaDescription (data) {
    this._mediaDescription = data;
  }

  get stream () {
    return this.streams[0];
  }

  registerSocketEvents () {
    const { socket } = this;

    socket.on('your-id', id => {
      this.client = id;

      // Send logon message to the host
      socket.emit('logon', {
        from: this.client,
        to: this.station
      });

      socket.removeAllListeners('your-id');
    });

    socket.on('image-data', data => {
      this.mediaDescription = data;
    });

    socket.on('message', async (message) => {
      const { peer } = this;

      if (message.data.type === 'candidate') {
        if (message.data.candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(message.data.candidate));
        }
      } else if (message.data.type === 'sdp') {
        const { client, station } = this;

        await peer.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
        const desc = await peer.createAnswer();
        peer.setLocalDescription(desc);

        const descMessage = {
          from: client,
          to: station,
          data: {
            type: 'sdp',
            sdp: desc
          }
        };

        socket.emit('message', descMessage);
      }
    });
  }

  createPeer () {
    const { socket } = this;

    this.peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        }
      ]
    });

    this.peer.onicecandidate = event => {
      const { client, station } = this;

      const data = {
        from: client,
        to: station,
        data: {
          type: 'candidate',
          candidate: event.candidate
        }
      };

      socket.emit('message', data);
    };

    this.peer.addEventListener('track', event => {
      this.streams = event.streams;

      document.dispatchEvent(new CustomEvent('receiver:new-song'));
    });
  }

  get mediaDescription () {
    return this._mediaDescription;
  }
}
