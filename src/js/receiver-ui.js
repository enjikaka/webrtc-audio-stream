var receiver, duration, chat, currentTime;

function getStation() {
  var hash = document.location.hash;
  var station = hash.split('#!/')[1];
  return station || null;
}

function renderMetadata(metadata) {
  duration = metadata.duration;
  currentTime = metadata.currentTime;
	$('#title').innerHTML = metadata.title;
	$('#artist').innerHTML = metadata.artist;
  $('#waveform').src = metadata.waveform;
  $('#cover').src = metadata.cover;
  var backgrounds = $$('.background');
  for (var i = 0; i < backgrounds.length; i++) {
    var bg = backgrounds[i];
    bg.style.backgroundImage = 'url("'+metadata.cover+'")';
  }
	//$('#station-name').innerHTML = 'Station: ' + getStation();
}

function registerChatHandler() {
  $('#send-message').addEventListener('click', function() {
    chat.sendMessage($('#message').value);
  });
}

function timeUpdate() {
  (function animloop(){
    requestAnimationFrame(animloop);
    //var currentTime = (Math.abs(receiver.getMediaDescription().startTime - Date.now()) / 1000);
    currentTime = (Math.abs(receiver.getMediaDescription().startTime - Date.now()) / 1000) - $('audio').currentTime;
    $('#playbar').style.transform = 'translateX(' + (currentTime / duration) * 100 + '%)';
  })();
}

window.onload = function() {
  var station = getStation();
  if (station) {
    receiver = new Receiver(station, function(stream) {
      document.querySelector('audio').src = URL.createObjectURL(stream);
      renderMetadata(receiver.getMediaDescription());
      timeUpdate();
    });

    console.debug('Creating chat instance for station ' + station);
    chat = new ReceiverChat(station, 'Jeremy');
    registerChatHandler();
    chat.onMessage(function(data) {
      var message = document.createElement('div');
      message.classList.add('message');
        var from = document.createElement('span');
            from.innerHTML = data.from;
            from.classList.add('from');
        message.appendChild(from);
        var paragraph = document.createElement('p');
            paragraph.innerHTML = data.message;
        message.appendChild(paragraph);
      $('#messages').appendChild(message);
      console.log(data);
    });
  } else {
    alert('No station entered');
  }
}
