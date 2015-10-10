var Receiver = (function(station, callback){
	var socket;
	var client;
	var peer;
	var mediaDescription = {};

	// Configuraton for peer
	var config = {
		'iceServers': [
			{
				'url': 'stun:stun.l.google.com:19302'
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

	// Constructor
	function Receiver(station, callback) {
		socket = io.connect();
		client;
		peer = new RTCPeerConnection(config, optionals);

		socket.on('your-id', function(id) {
			client = id;
			
		  	// Send logon message to the host
		  	socket.emit('logon', {
		    	from: client,
		    	to: station
		  	});
		});

		socket.on('image-data', function(data) {
			mediaDescription.waveform = data.waveform;
			mediaDescription.cover = data.cover;
		});

		peer.addEventListener('icecandidate', function(event) {
		  var data = {
		    from: client,
		    to: station,
		    data: {
		      type: 'candidate',
		      candidate: event.candidate
		  }};

		  socket.emit('message', data);
		});

		peer.addEventListener('addstream', function(event) {
			callback(event.stream);
		});

		socket.on('message', function(message) {
			//console.debug(message.data.type);
		  if (message.data.type === 'candidate') {
		    if (message.data.candidate) {
		      peer.addIceCandidate(new RTCIceCandidate(message.data.candidate));
		    }
		  } else if (message.data.type === 'sdp') {
		  	//console.log('Received message: ' + JSON.stringify(message.data));
		    peer.setRemoteDescription(new RTCSessionDescription(message.data.sdp), function() {
		      peer.createAnswer(function(desc) {
		        peer.setLocalDescription(desc);

		        //console.debug(desc);

		        var message = {
		          from: client,
		          to: station,
		          data: {
		            type: 'sdp',
		            sdp: desc
		          }
		        };
		        
		        socket.emit('message', message);
		      }, function(error) {
		        console.error('Failure callback from createAnswer:');
		        console.error(JSON.stringify(error));
		      });
		    }, function(error) {
		      console.error('Failure callback from setRemoteDescription:');
		      console.error(JSON.stringify(error));
		    });
		  }
		});

		window.addEventListener('beforeunload', function() {
			socket.emit('logoff', {to: station, from: client});
		});

		mediaDescriptionChannel = peer.createDataChannel('mediaDescription');
		mediaDescriptionChannel.onmessage = function(event) {
			Object.assign(mediaDescription, JSON.parse(event.data));
		};
	}

	Receiver.prototype.getMediaDescription = function() {
		return mediaDescription;
	};

	return Receiver;
})();