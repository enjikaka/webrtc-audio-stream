import Station from './station.js';

import { $ } from './fake-jquery.js';

const station = new Station(data => {
  console.log(data);

  $('#listenUrl').href = data.listenUrl;
});

$('#start-button').addEventListener('click', () => {
  const file = $('#file-input').files[0];

  station.playAudioFile(file);
});

