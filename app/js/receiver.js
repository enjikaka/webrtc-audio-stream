var Receiver = (function(station, callback){
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

	function Receiver(station, callback) {
		var socket = io.connect(), client;
		var peer = new RTCPeerConnection(config, optionals);

		socket.on('your-id', function(id) {
			client = id;
			
		  	// Send logon message to the host
		  	socket.emit('logon', {
		    	from: client,
		    	to: station
		  	});
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
		  if (message.data.type === 'candidate') {
		    if (message.data.candidate) {
		      peer.addIceCandidate(new RTCIceCandidate(message.data.candidate));
		    }
		  } else if (message.data.type === 'sdp') {
		    peer.setRemoteDescription(new RTCSessionDescription(message.data.sdp), function() {
		      peer.createAnswer(function(desc) {
		        peer.setLocalDescription(desc);

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

		socket.on('song-meta', function(data) {
		  console.log(data);
		});

		window.addEventListener('beforeunload', function() {
			socket.emit('logoff', {to: station, from: client});
		});
	}

	return Receiver;
})();