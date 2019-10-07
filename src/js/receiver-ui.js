/* eslint-env browser */

import Receiver from './receiver.js';
import ReceiverChat from './receiver-chat.js';
import { $, $$ } from './fake-jquery.js';

import 'https://unpkg.com/audio-visualiser?module';

let receiver;
let chat;

function getStation () {
  const params = new URLSearchParams(document.location.search);

  return params.get('id');
}

function renderMetadata (metadata) {
  $('#title').innerHTML = metadata.title;
  $('#artist').innerHTML = metadata.artist;

  if (metadata.cover) {
    $('#cover').src = metadata.cover;
  }

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

window.onload = function () {
  const station = getStation();

  const audioElement = $('audio');
  const audioVisualiser = $('audio-visualiser');

  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();

  analyser.fftSize = 1024;

  audioVisualiser.analyser = analyser;

  if (station) {
    receiver = new Receiver(station);

    document.addEventListener('receiver:new-song', event => {
      if (event instanceof CustomEvent) {
        const { stream, mediaDescription } = receiver;

        audioElement.srcObject = stream;

        const source = audioContext.createMediaStreamSource(stream);

        source.connect(analyser);

        const dest = audioContext.createMediaStreamDestination();

        analyser.connect(dest);

        renderMetadata(mediaDescription);

        audioVisualiser.start();
      }
    });

    audioElement.addEventListener('play', () => audioVisualiser.start());
    audioElement.addEventListener('pause', () => audioVisualiser.stop());

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
    });
  } else {
    console.error('No station entered');
  }
};
