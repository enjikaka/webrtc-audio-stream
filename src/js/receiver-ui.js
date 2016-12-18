/* eslint-env browser */
/* globals $, $$, Receiver, ReceiverChat */

let receiver;
let duration;
let chat;
let currentTime;

function getStation () {
  const hash = document.location.hash;
  const station = hash.split('#!/')[1];

  return station || null;
}

function renderMetadata (metadata) {
  duration = metadata.duration;
  currentTime = metadata.currentTime;

  $('#title').innerHTML = metadata.title;
  $('#artist').innerHTML = metadata.artist;
  $('#waveform').src = metadata.waveform;
  $('#cover').src = metadata.cover;

  const backgrounds = $$('.background');

  for (let i = 0; i < backgrounds.length; i++) {
    const bg = backgrounds[i];

    bg.style.backgroundImage = 'url("' + metadata.cover + '")';
  }
	// $('#station-name').innerHTML = 'Station: ' + getStation();
}

function registerChatHandler () {
  $('#send-message').addEventListener('click', () => {
    chat.sendMessage($('#message').value);
  });
}

function timeUpdate () {
  (function animloop () {
    requestAnimationFrame(animloop);
    // var currentTime = (Math.abs(receiver.getMediaDescription().startTime - Date.now()) / 1000);
    currentTime = (Math.abs(receiver.getMediaDescription().startTime - Date.now()) / 1000) - $('audio').currentTime;
    $('#playbar').style.transform = 'translateX(' + (currentTime / duration) * 100 + '%)';
  })();
}

window.onload = function () {
  const station = getStation();

  if (station) {
    receiver = new Receiver(station, data => {
      const { streamUrl } = data;

      document.querySelector('audio').src = URL.createObjectURL(streamUrl);

      renderMetadata(receiver.getMediaDescription());
      timeUpdate();
    });

    console.debug('Creating chat instance for station ' + station);

    chat = new ReceiverChat(station, 'Jeremy');

    registerChatHandler();

    chat.onMessage(data => {
      const message = document.createElement('div');

      message.classList.add('message');
      const fromSpan = document.createElement('span');

      fromSpan.innerHTML = data.from;
      fromSpan.classList.add('from');

      message.appendChild(fromSpan);

      const paragraph = document.createElement('p');

      paragraph.innerHTML = data.message;
      message.appendChild(paragraph);
      $('#messages').appendChild(message);

      console.log(data);
    });
  } else {
    console.error('No station entered');
  }
};
