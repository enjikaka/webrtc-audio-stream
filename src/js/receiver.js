/* eslint-env browser */
/* globals io */

export class Receiver {
  registerSocketEvents () {
    const { socket } = this;

    socket.on('your-id', id => {
      this.client = id;

      // Send logon message to the host
      socket.emit('logon', {
        from: this.client,
        to: this.station
      });
    });

    socket.on('image-data', data => {
      this.mediaDescription.waveform = data.waveform;
      this.mediaDescription.cover = data.cover;
    });

    socket.on('message', message => {
      const { peer } = this;

      // console.debug(message.data.type);
      if (message.data.type === 'candidate') {
        if (message.data.candidate) {
          peer.addIceCandidate(new RTCIceCandidate(message.data.candidate));
        }
      } else if (message.data.type === 'sdp') {
        // console.log('Received message: ' + JSON.stringify(message.data));
        peer.setRemoteDescription(new RTCSessionDescription(message.data.sdp), () => {
          peer.createAnswer(desc => {
            peer.setLocalDescription(desc);

            const { client, station } = this;

            const descMessage = {
              from: client,
              to: station,
              data: {
                type: 'sdp',
                sdp: desc
              }
            };

            socket.emit('message', descMessage);
          }, error => {
            console.error('Failure callback from createAnswer:');
            console.error(JSON.stringify(error));
          });
        }, error => {
          console.error('Failure callback from setRemoteDescription:');
          console.error(JSON.stringify(error));
        });
      }
    });
  }

  getRtcConfigAndOptions () {
    // Configuraton for peer
    const rtcConfig = {
      'iceServers': [
        {
          'url': 'stun:stun.l.google.com:19302'
        }
      ]
    };

    const rtcOptionals = {
      optional: [
        {
          RtpDataChannels: true
        }
      ]
    };

    return { rtcConfig, rtcOptionals };
  }

  createPeer () {
    const { rtcConfig, rtcOptionals } = this.getRtcConfigAndOptions();
    const { socket } = this;

    this.peer = new RTCPeerConnection(rtcConfig, rtcOptionals);

    this.peer.addEventListener('icecandidate', event => {
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
    });

    this.peer.addEventListener('addstream', event => {
      this.callback({
        streamUrl: event.stream
      });
    });

    const mediaDescriptionChannel = this.peer.createDataChannel('mediaDescription');

    mediaDescriptionChannel.onmessage = function (event) {
      Object.assign(this.mediaDescription, JSON.parse(event.data));
    };
  }

  constructor (station, callback) {
    const socket = io.connect();
    const mediaDescription = {};

    window.addEventListener('beforeunload', () => {
      const { client } = this;

      socket.emit('logoff', { to: station, from: client });
    });

    Object.assign(this, {
      station,
      callback,
      socket,
      mediaDescription
    });

    this.registerSocketEvents();
    this.createPeer();
  }

  getMediaDescription () {
    return this.mediaDescription;
  }
}
