var station = new Station('yolo', function(e) {
	console.log(e);
});

$('#file-input').addEventListener('change', function(event) {
	var file = event.target.files[0];
	station.playAudioFile(file);
});
