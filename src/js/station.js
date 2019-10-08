/* globals jsmediatags, io */
/* eslint-env browser */

function readAsArrayBuffer (file) {
  return new Promise(resolve => {
    const reader = new FileReader();

    reader.onload = event => {
      resolve(event.target.result);
    };

    reader.readAsArrayBuffer(file);
  });
}

function getMediaTags (file) {
  return new Promise(resolve => {
    // @ts-ignore
    jsmediatags.read(file, {
      onSuccess (response) {
        const tags = response.tags;
        const { artist, title } = tags;
        const image = tags.picture;
        let cover;

        if (image !== undefined) {
          const base64Data = [];

          for (let i = 0; i < image.data.length; i++) {
            base64Data.push(String.fromCharCode(image.data[i]));
          }

          const base64String = btoa(base64Data.join(''));

          cover = `data:${image.format};base64,${base64String}`;
        }

        resolve({
          title,
          artist,
          cover
        });
      },
      onError (error) {
        console.error(':(', error.type, error.info); // eslint-disable-line
        resolve();
      }
    });
  });
}

export default class Station {
  constructor (callback) {
    // Configuraton for peer
    const rtcConfig = {
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
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

    this.rtcConfig = rtcConfig;
    this.rtcOptionals = rtcOptionals;
    this.mediaDescription = mediaDescription;
    this._peers = peers;
    this.audioState = audioState;
    this.mediaSource = mediaSource;
    this.mediaBuffer = mediaBuffer;
    this.remoteDestination = remoteDestination;
    this.context = context;
    this.socket = socket;
    this.callback = callback;

    this.registerSocketEvents();
  }

  addPeer (id, peer) {
    this._peers[id] = peer;

    this.startPlayingIfPossible(peer);
  }

  removePeer (id) {
    if (this._peers[id]) {
      delete this._peers[id];
    }
  }

  get peers () {
    return Object.keys(this._peers).map(key => this._peers[key]);
  }

  registerSocketEvents () {
    const { socket } = this;

    socket.on('your-id', stationId => {
      this.stationName = stationId;

      this.callback({
        name: stationId,
        listenUrl: window.location.protocol + '//' + window.location.host + '/receiver.html?id=' + stationId
      });

      socket.emit('set-room-name', {
        name: stationId
      });

      socket.removeAllListeners('your-id');
    });

    socket.on('disconnected', receiverId => {
      this.removePeer(receiverId);
    });

    socket.on('logon', message => {
      const peer = new RTCPeerConnection(this.rtcConfig);
      const receiverId = message.from;

      peer.onicecandidate = event => {
        const eventMessage = {
          from: this.stationName,
          to: receiverId,
          data: {
            type: 'candidate',
            candidate: event.candidate
          }
        };

        socket.emit('message', eventMessage);
      };

      // Add Receiver to object of connected peers
      const receiver = {
        id: receiverId,
        peerConnection: peer,
        stream: undefined
      };

      this.addPeer(receiverId, receiver);
      this.receiverOffer(receiverId);

      // console.log(receiverId + ' logged on.');
      // console.log('Now broadcasting to ' + Object.keys(this._peers).length + ' listeners.');
    });

    socket.on('logoff', message => {
      delete this._peers[message.from];
    });

    // when a message is received from a listener we'll update the rtc session accordingly
    socket.on('message', message => {
      // console.log('Received message: ' + JSON.stringify(message.data));
      const receiver = this._peers[message.from];

      if (message.data.type === 'candidate') {
        if (message.data.candidate) {
          receiver.peerConnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
        }
      } else if (message.data.type === 'sdp') {
        receiver.peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
      }
    });
  }

  async playAudioFile (file) {
    const songMeta = this.getInfoFromFileName(file.name);
    const newMetadata = await getMediaTags(file);

    this.mediaDescription = {
      duration: null,
      startTime: null,
      title: newMetadata.title || songMeta.title,
      artist: newMetadata.artist || songMeta.artist,
      cover: newMetadata.cover || null
    };

    const arrayBuffer = await readAsArrayBuffer(file);

    this.context.decodeAudioData(arrayBuffer, audioBuffer => {
      // console.debug('[decodeAudioData]');
      if (this.mediaSource) {
        this.mediaSource.stop(0);
      }

      this.mediaBuffer = audioBuffer;
      this.playStream();
    });
  }

  stop () {
    this.stopStream();
    this.audioState.playing = false;
  }

  play () {
    this.playStream();
    this.audioState.playing = true;
  }

  set mediaDescription (data) {
    this._mediaDescription = data;
  }

  get mediaDescription () {
    return this._mediaDescription;
  }

  getInfoFromFileName (name) {
    name = name === null ? 'Unkown' : name;
    name = name.indexOf('_') !== -1 ? name.replace(/_/g, ' ') : name;

    let artist = 'Unkown';

    if (name.indexOf(' - ') !== -1) {
      name = name.split(' - ');
      artist = name[0];
      name = name[1];
    }

    const titleChunks = name.split('.');

    titleChunks.pop();
    const title = titleChunks.join('.');

    return { artist, title };
  }

  async receiverOffer (receiverId) {
    /** @type {RTCPeerConnection} */
    const peerConnection = this._peers[receiverId].peerConnection;

    const offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);

    this.socket.emit('message', {
      from: this.stationName,
      to: receiverId,
      data: {
        type: 'sdp',
        sdp: offer
      }
    });
  }

  // checks if media is present and starts streaming media to a connected listener if possible
  startPlayingIfPossible (receiver) {
    if (this.mediaSource && this.remoteDestination) {
      receiver.peerConnection.addStream(this.remoteDestination.stream);
      receiver.stream = this.remoteDestination.stream;
      this.receiverOffer(receiver.id);
      this.sendMediaDescription();
    }
  }

  sendMediaDescription () {
    this.peers
      .forEach(peer => this.socket.emit('image-data', {
        to: peer.id,
        ...this.mediaDescription
      }));
  }

  playStream () {
    this.mediaSource = this.context.createBufferSource();
    this.mediaSource.buffer = this.mediaBuffer;
    // this.mediaSource.playbackRate.value = 1.3;
    this.mediaSource.start(0);
    // mediaSource.connect(gainNode);

    // setup remote stream
    this.remoteDestination = this.context.createMediaStreamDestination();
    this.mediaSource.connect(this.remoteDestination);

    this.peers
      .forEach(peer => this.startPlayingIfPossible(peer));
  }

  // stops playing the stream and removes the stream from peer connections
  stopStream () {
    this.peers.forEach(peer => {
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
}
