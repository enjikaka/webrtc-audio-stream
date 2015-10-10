var $ = function(q) {
	return document.querySelector(q);
};

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

var receiver, duration;

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
	$('#station-name').innerHTML = getStation();
}

function timeUpdate() {
  (function animloop(){
    requestAnimFrame(animloop);
    //var currentTime = (Math.abs(receiver.getMediaDescription().startTime - Date.now()) / 1000);
    var currentTime = (Math.abs(receiver.getMediaDescription().startTime - Date.now()) / 1000) - $('audio').currentTime;
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
  } else {
    alert('No station entered');
  }
}