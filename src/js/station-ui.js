/* globals Station, $ */

const station = new Station('yolo', data => {
  console.log(data);

  $('#listenUrl').href = data.listenUrl;
});

$('#file-input').addEventListener('change', event => {
  const file = event.target.files[0];

  station.playAudioFile(file);
});

