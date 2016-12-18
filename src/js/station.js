/* globals jsmediatags, io, WaveformGenerator */
/* eslint-env browser */

let start;

export class Station {
  readID3 (file) {
    const mediaDescription = this.mediaDescription;

    return new Promise(resolve => {
      jsmediatags.read(file, {
        onSuccess (response) {
          const tags = response.tags;

          const { artist, title } = tags;

          Object.assign(mediaDescription, { artist, title });

          const image = tags.picture;

          if (image !== undefined) {
            const base64Data = [];

            for (let i = 0; i < image.data.length; i++) {
              base64Data.push(String.fromCharCode(image.data[i]));
            }

            const base64String = btoa(base64Data.join(''));
            const base64Url = `data:${image.format};base64,${base64String}`;

            mediaDescription.cover = base64Url;
          }

          resolve(mediaDescription);
        },
        onError (error) {
          console.log(':(', error.type, error.info);
        }
      });
    });
  }

  getPeers () {
    return Object.keys(this.peers).map(key => this.peers[key]);
  }

  registerSocketEvents () {
    const { socket } = this;

    socket.on('your-id', stationId => {
      if (!this.stationName) {
        this.stationName = stationId;
      }

      socket.emit('set-room-name', {
        name: this.stationName
      });
    });

    socket.on('disconnected', receiverId => {
      this.peers[receiverId] = undefined;
    });

    socket.on('logon', message => {
      const peer = new RTCPeerConnection(this.rtcConfig, this.rtcOptionals);
      const receiverId = message.from;

      peer.addEventListener('icecandidate', event => {
        const eventMessage = {
          from: this.stationName,
          to: receiverId,
          data: {
            type: 'candidate',
            candidate: event.candidate
          }
        };

        socket.emit('message', eventMessage);
      });

      const mediaDescriptionChannel = peer.createDataChannel('mediaDescription', { reliable: true });

      // Add Receiver to object of connected peers
      const receiver = {
        id: receiverId,
        peerConnection: peer,
        stream: undefined,
        mediaDescriptionChannel
      };

      mediaDescriptionChannel.onopen = () => {
        this.sendMediaDescription(receiver);
      };

      this.peers[receiverId] = receiver;

      this.receiverOffer(receiverId);

      // console.log(receiverId + ' logged on.');
      // console.log('Now broadcasting to ' + Object.keys(peers).length + ' listeners.');
    });

    socket.on('logoff', message => {
      // console.log(message.from + ' logged out.');

      delete this.peers[message.from];

      // console.log('Now broadcasting to ' + Object.keys(peers).length + ' listeners.');
    });

    // when a message is received from a listener we'll update the rtc session accordingly
    socket.on('message', message => {
      // console.log('Received message: ' + JSON.stringify(message.data));
      const receiver = this.peers[message.from];

      if (message.data.type === 'candidate') {
        if (message.data.candidate) {
          receiver.peerConnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
        }
      } else if (message.data.type === 'sdp') {
        receiver.peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
      }
    });
  }

  playAudioFile (file) {
    console.debug('[playAudioFile]', file);
    const songMeta = this.getInfoFromFileName(file.name);

    window.durationHolder = document.createElement('audio');

    this.mediaDescription = {
      title: songMeta.title,
      artist: songMeta.artist,
      waveform: null,
      cover: null,
      duration: null,
      startTime: null
    };

    window.durationHolder.src = URL.createObjectURL(file);
    window.durationHolder.oncanplaythrough = e => {
      this.mediaDescription.duration = e.target.duration;
    };

    const reader = new FileReader();

    reader.onload = readEvent => {
      console.debug('[fileReader:onload]');
      const waveformOptions = { drawMode: 'svg', waveformColor: '#ff6d00' };

      const generateWaveform = new WaveformGenerator(readEvent.target.result, waveformOptions).then(dataUrl => {
        this.mediaDescription.waveform = dataUrl;
      });

      const getID3Data = this.readID3(file).then(newMediaDesc => {
        console.debug(newMediaDesc, this.mediaDescription, Object.assign(this.mediaDescription, newMediaDesc));
        return Object.assign(this.mediaDescription, newMediaDesc);
      });

      Promise.all([generateWaveform, getID3Data]).then(() => {
        this.context.decodeAudioData(readEvent.target.result, buffer => {
          console.debug('[decodeAudioData]');
          if (this.mediaSource) {
            this.mediaSource.stop(0);
          }

          this.mediaBuffer = buffer;
          this.playStream();
          start = Date.now();
        });
      });
    };

    reader.readAsArrayBuffer(file);
  }

  stop () {
    const offset = this.audioState.stopTime - this.audioState.startTime;

    this.stopStream(offset);
    this.audioState.playing = false;
  }

  play () {
    const offset = this.audioState.stopTime - this.audioState.startTime;

    this.playStream(offset);
    start = Date.now() - offset;
    this.audioState.playing = true;
  }

  getMediaDescription () {
    return this.mediaDescription;
  }

  getInfoFromFileName (name) {
    name = name === null ? 'Unkown' : name;
    name = name.replace(/_/g, ' ');

    let artist = 'Unkown';

    if (name.indexOf(' - ') !== -1) {
      name = name.split(' - ');
      artist = name[0];
      name = name[1];
    }

    const title = name.split('.')[0];

    return { artist, title };
  }

  receiverOffer (receiverId) {
    const receiver = this.peers[receiverId];

    receiver.peerConnection.createOffer(desc => {
      receiver.peerConnection.setLocalDescription(desc);

      this.socket.emit('message', {
        from: this.stationName,
        to: receiver.id,
        data: {
          type: 'sdp',
          sdp: desc
        }
      });
    }, e => {
      console.error(e);
    });
  }

  // checks if media is present and starts streaming media to a connected listener if possible
  startPlayingIfPossible (receiver) {
    console.debug('[startPlayingIfPossible]', receiver);

    if (this.mediaSource && this.remoteDestination) {
      receiver.peerConnection.addStream(this.remoteDestination.stream);
      receiver.stream = this.remoteDestination.stream;
      this.receiverOffer(receiver.id);
      this.sendWaveform();
    }
  }

  // Sends media meta information over a rtc data channel to a connected listener
  sendMediaDescription (receiver) {
    const { mediaDescription } = this;
    const channel = receiver.mediaDescriptionChannel;

    console.debug('[sendMediaDescription]', mediaDescription);
    console.debug('channelReadystate open?,', channel.readyState);

    mediaDescription.startTime = start;

    if (mediaDescription) {
      const data = JSON.stringify(mediaDescription);

      channel.send({ data });
    }
  }

  sendWaveform () {
    this.getPeers().forEach(peer => {
      const { cover, waveform } = this.mediaDescription;
      const to = peer.id;

      this.socket.emit('image-data', { to, waveform, cover });
    });
  }

  playStream () {
    console.debug('[playStream]');

    this.mediaSource = this.context.createBufferSource();
    this.mediaSource.buffer = this.mediaBuffer;
    this.mediaSource.start(0);
    start = Date.now();
    // mediaSource.connect(gainNode);

    // setup remote stream
    this.remoteDestination = this.context.createMediaStreamDestination();
    this.mediaSource.connect(this.remoteDestination);

    console.debug('getPeers');

    this.getPeers().forEach(peer => {
      console.debug('getPeers', peer);
      this.startPlayingIfPossible(peer);
    });
  }

  // stops playing the stream and removes the stream from peer connections
  stopStream () {
    this.getPeers().forEach(peer => {
      if (peer.stream) {
        peer.stream.stop();
        // peer.peerConnection.removeStream(peer.stream);
        // peer.stream = undefined;
      }
    });

    if (this.mediaSource) {
      this.mediaSource.stop(0);
    }
  }

  /*
  // Sets the volume
  function changeVolume (element) {
    const fraction = parseInt(element.value, 10) / parseInt(element.max, 10);

    gainNode.gain.value = fraction * fraction;
  }

  // mutes the volume
  function toggleMute () {
    if (muted) {
      gainNode.gain.value = muted;
      muted = undefined;
    } else {
      muted = gainNode.gain.value;
      gainNode.gain.value = 0;
    }
  }
  */

  constructor (stationName, callback) {
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

    const mediaDescription = {
      title: null,
      artist: null,
      cover: null,
      album: null,
      waveform: null
    };

    const peers = {};

    const audioState = {
      stopTime: undefined,
      startTime: undefined,
      muted: false
    };

    let mediaSource;
    let mediaBuffer;
    let remoteDestination;

    // Configuration for audio
    const context = new AudioContext();
    const gainNode = context.createGain();
    gainNode.connect(context.destination);

    const socket = io.connect();

    Object.assign(this, {
      rtcConfig,
      rtcOptionals,
      stationName,
      mediaDescription,
      peers,
      audioState,
      mediaSource,
      mediaBuffer,
      remoteDestination,
      context,
      socket
    });

    this.registerSocketEvents();

    callback({
      name: stationName,
      listenURL: window.location.protocol + '//' + window.location.host + '/receiver.html?id=' + stationName
    });
  }
}
