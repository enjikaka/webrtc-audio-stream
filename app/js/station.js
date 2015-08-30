var Station = (function(stationName, callback) {
	// Configuraton for peer
	var config = {
		"iceServers": [
			{
				"url": "stun:stun.l.google.com:19302"
			}
		]
	},
	optionals = {
		optional: [
			{
				RtpDataChannels: true
			} 
		]
	};

	// Configuration for audio
	var context = new AudioContext(),
		gainNode = context.createGain(),
		currentStream,
		mediaSource, 
		mediaBuffer, 
		remoteDestination, 
		mediaDescription,
		peers = {};

	var audioState = {
		stopTime: undefined,
		startTime: undefined,
		muted: false
	}

	gainNode.connect(context.destination);

	// Websocket
	var socket = io.connect();

	function Station(stationName, callback) {
		socket.on('your-id', function(id) {
			if (!stationName) {
				stationName = id;
			}

			socket.emit('set-room-name', {
				name: stationName
			});
		});

		socket.on('disconnected', function(from) {
			peers[from] = undefined;
		});

		socket.on('logon', function(message) {
			var peer = new RTCPeerConnection(config, optionals),
				from = message.from;
			
			peer.addEventListener('icecandidate', function(event) {
				var message = {
					from: stationName, 
					to: from, 
					data: {
						type: 'candidate', 
						candidate: event.candidate 
					}
				};
				socket.emit('message', message);
			});

			peers[from] = {
				peerconnection: peer, 
				stream: undefined
			};

			startPlayingIfPossible(from);

			console.log(from + ' logged on.');
			console.log('Now broadcasting to ' + Object.keys(peers).length + ' listeners.');
		});

		socket.on('logoff', function(message) {
			console.log(message.from + ' logged out.');
			
			delete peers[message.from];

			console.log('Now broadcasting to ' + Object.keys(peers).length + ' listeners.');
		});

		// when a message is received from a listener we'll update the rtc session accordingly
		socket.on('message', function(message) {
			//console.log('Received message: ' + JSON.stringify(message.data));

			if (message.data.type === 'candidate') {
				if (message.data.candidate) {
					peers[message.from].peerconnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
				}
			} else if (message.data.type === 'sdp') {
				peers[message.from].peerconnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
			}
		});

		callback({
			name: stationName,
			listenURL: window.location.protocol + '//' + window.location.host + '/receiver.html?id=' + stationName
		});
	}

	Station.prototype.playAudioFile = function(file) {
		var reader = new FileReader();

		reader.onload = (function(readEvent) {
			context.decodeAudioData(readEvent.target.result, function(buffer) {
				if (mediaSource) {
					mediaSource.stop(0);
				}

				mediaBuffer = buffer;
				playStream();
				start = Date.now();
			});
		});

		reader.readAsArrayBuffer(file);
	};

	Station.prototype.stop = function() {
		var offset = audioState.stopTime - audioState.startTime;
		stopStream(offset);
		audioState.playing = false;
	};

	Station.prototype.play = function() {
		var offset = audioState.stopTime - audioState.startTime;
		playStream(offset);
		start = Date.now() - offset;
		audioState.playing = true;
	};

	return Station;

	// is called when SDP is received from a connected listener
	function gotDescription(from, desc) {
		peers[from].peerconnection.setLocalDescription(desc);
		socket.emit('message', { from: stationName, to: from, data: { type: 'sdp', sdp: desc } });
	}

	// checks if media is present and starts streaming media to a connected listener if possible
	function startPlayingIfPossible(from) {
		// add the stream to the peerconnection for this connection
		if (mediaSource && remoteDestination) {
			var constraints = { mandatory: {}, optional: [] };
			// constraints.optional[0] = { 'bandwidth' : 100 }; // does not seem to influence quality
			peers[from].peerconnection.addStream(remoteDestination.stream, constraints);
			peers[from].stream = remoteDestination.stream;
			peers[from].peerconnection.createOffer(function(desc) {
				gotDescription(from, desc);
			}, failed);

			sendMediaDescription(peers[from].dataChannel);
		}
	}

	// Sends media meta information over a rtc data channel to a connected listener
	function sendMediaDescription(channel) {
		if (mediaDescription && channel.readyState === 'open') {
			var data = mediaDescription;
			channel.send(data);
		}
	}

	function onDataChannelOpen() {
		sendMediaDescription(this);
	}

	function failed(code) {
		log("Failure callback: " + code);
	}

	function playStream(offset) {
		offset = offset ? offset : 0;
		mediaSource = context.createBufferSource();
		mediaSource.buffer = mediaBuffer;
		mediaSource.start(0, offset / 1000);
		//mediaSource.connect(gainNode);

		// setup remote stream
		remoteDestination = context.createMediaStreamDestination();
		mediaSource.connect(remoteDestination);

		for (var peer in peers) {
			startPlayingIfPossible(peer);
		}
	}

	// stops playing the stream and removes the stream from peer connections
	function stopStream() {
		for (var peer in peers) {
			if (peers[peer].stream) {
				peers[peer].stream.stop();
				//peers[peer].peerconnection.removeStream(peers[peer].stream);
				//peers[peer].stream = undefined;
			}
		}

		if (mediaSource) mediaSource.stop(0);
	}

	// sets the volume
	function changeVolume(element) {
		var volume = element.value;
		var fraction = parseInt(element.value, 10) / parseInt(element.max, 10);
		gainNode.gain.value = fraction * fraction;
	}

	// mutes the volume
	function toggleMute() {
		if (muted) {
			gainNode.gain.value = muted;
			muted = undefined;
		} else {
			muted = gainNode.gain.value;
			gainNode.gain.value = 0;
		}
	}
})();