var start;
var muted;

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
		mediaDescription = {
			title: null,
			artist: null,
			cover: null,
			album: null
		},
		peers = {},
		currentWaveform,
		currentCover;

	var audioState = {
		stopTime: undefined,
		startTime: undefined,
		muted: false
	}

	gainNode.connect(context.destination);

	// Websocket
	var socket = io.connect();

	function Station(stationName, callback) {
		socket.on('your-id', function(stationId) {
			if (!stationName) {
				stationName = stationId;
			}

			socket.emit('set-room-name', {
				name: stationName
			});
		});

		socket.on('disconnected', function(receiverId) {
			peers[receiverId] = undefined;
		});

		socket.on('logon', function(message) {

			var peer = new RTCPeerConnection(config, optionals);
			var receiverId = message.from;

			peer.addEventListener('icecandidate', function(event) {
				var message = {
					from: stationName,
					to: receiverId,
					data: {
						type: 'candidate',
						candidate: event.candidate
					}
				};

				socket.emit('message', message);
			});

			// Add Receiver to object of connected peers
			var receiver = {
				id: receiverId,
				peerConnection: peer,
				stream: undefined,
				mediaDescriptionChannel: peer.createDataChannel('mediaDescription', { reliable: true })
			};

			receiver.mediaDescriptionChannel.onopen = function() {
				startPlayingIfPossible(receiverId);
			};

			peers[receiverId] = receiver;

			receiverOffer(receiverId);

			//console.log(receiverId + ' logged on.');
			//console.log('Now broadcasting to ' + Object.keys(peers).length + ' listeners.');
		});

		socket.on('logoff', function(message) {
			//console.log(message.from + ' logged out.');

			delete peers[message.from];

			//console.log('Now broadcasting to ' + Object.keys(peers).length + ' listeners.');
		});

		// when a message is received from a listener we'll update the rtc session accordingly
		socket.on('message', function(message) {
			//console.log('Received message: ' + JSON.stringify(message.data));
			var receiver = peers[message.from];
			if (message.data.type === 'candidate') {
				if (message.data.candidate) {
					receiver.peerConnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
				}
			} else if (message.data.type === 'sdp') {
				receiver.peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
			}
		});

		callback({
			name: stationName,
			listenURL: window.location.protocol + '//' + window.location.host + '/receiver.html?id=' + stationName
		});
	}

	Station.prototype.playAudioFile = function(file) {
		var songMeta = getInfoFromFileName(file.name);
		window.durationHolder = document.createElement('audio');

		mediaDescription = {
			title: songMeta.title,
			artist: songMeta.artist,
			waveform: null,
			cover: null,
			duration: null,
			startTime: null
		};

		window.durationHolder.src = URL.createObjectURL(file);
		window.durationHolder.oncanplaythrough = function(e) {
			mediaDescription.duration = e.target.duration;
		};

		var reader = new FileReader();
		reader.onload = (function(readEvent) {
			new WaveformGenerator(readEvent.target.result, {drawMode: 'svg', waveformColor: '#ff6d00'}).then(function(dataUrl) {
				currentWaveform = dataUrl;
			}).then(function() {
				/*ID3.loadTags(file.name, function() {
				    var tags = ID3.getAllTags(file.name);

				    if (tags.artist !== undefined) {
				    	mediaDescription.artist = tags.artist;
				    }
				    if (tags.artist !== undefined) {
				    	mediaDescription.title = tags.title;
				    }

			    	var image = tags.picture;
			    	if (image !== undefined) {
				    	var base64String = "";
						for (var i = 0; i < image.data.length; i++) {
						    base64String += String.fromCharCode(image.data[i]);
						}
						currentCover = "data:" + image.format + ";base64," + btoa(base64String);
			    	}
				}, {
					tags: ["artist", "title", "album", "year", "picture"],
					dataReader: new FileReader(file)
      });*/
        jsmediatags.read(file, {
          onSuccess: function (response) {
            const tags = response.tags;

            if (tags.artist !== undefined) {
				    	mediaDescription.artist = tags.artist;
				    }
				    if (tags.artist !== undefined) {
				    	mediaDescription.title = tags.title;
				    }

            var image = tags.picture;

			    	if (image !== undefined) {
				    	var base64String = '';

              for (var i = 0; i < image.data.length; i++) {
                  base64String += String.fromCharCode(image.data[i]);
              }

						  currentCover = "data:" + image.format + ";base64," + btoa(base64String);
			    	}
          },
          onError: function(error) {
            console.log(':(', error.type, error.info);
          }
        });
			}).then(function() {
				context.decodeAudioData(readEvent.target.result, function(buffer) {
					if (mediaSource) {
						mediaSource.stop(0);
					}

					mediaBuffer = buffer;
					playStream();
					start = Date.now();
				});
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

	Station.prototype.getMediaDescription = function() {
		return mediaDescription;
	};

	return Station;


	function getInfoFromFileName(name) {
	    name = name === null ? 'Unkown' : name;
	    name = name.replace(/_/g, ' ');
	    var artist = artist === null ? 'Unkown' : artist;
	    if (name.indexOf(' - ') !== -1) {
	        name = name.split(' - ');
	        artist = name[0];
	        name = name[1];
	    }
	    name = name.split('.')[0];
	    return {
	        artist: artist,
	        title: name
	    };
	}

	function receiverOffer(receiverId) {
		var receiver = peers[receiverId];
		receiver.peerConnection.createOffer(function(desc) {
			receiver.peerConnection.setLocalDescription(desc);

			socket.emit('message', {
				from: stationName,
				to: receiver.id,
				data: {
					type: 'sdp',
					sdp: desc
				}
			});
		}, function(e) {
			console.error(e);
		});
	}

	// checks if media is present and starts streaming media to a connected listener if possible
	function startPlayingIfPossible(receiverId) {
		var receiver = peers[receiverId];
		if (mediaSource && remoteDestination) {
			receiver.peerConnection.addStream(remoteDestination.stream);
			receiver.stream = remoteDestination.stream;
			receiverOffer(receiver.id);
			sendMediaDescription(receiver);
			sendWaveform();
		}
	}

	// Sends media meta information over a rtc data channel to a connected listener
	function sendMediaDescription(receiver) {
		var channel = receiver.mediaDescriptionChannel;

		mediaDescription.startTime = start;

		if (mediaDescription && channel.readyState === 'open') {
			var data = JSON.stringify(mediaDescription);
			channel.send(data);
		}
	}

	function sendWaveform() {
		for (var peer in peers) {
			socket.emit('image-data', {
				to: peer,
				waveform: currentWaveform,
				cover: currentCover
			});
		}
	}

	function playStream() {
		mediaSource = context.createBufferSource();
		mediaSource.buffer = mediaBuffer;
		mediaSource.start(0);
		start = Date.now();
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
				//peers[peer].peerConnection.removeStream(peers[peer].stream);
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
