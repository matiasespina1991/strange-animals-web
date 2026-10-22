let initialized = false;
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'myspace-release' || initialized) return;
  const songs = event.data.songs;
  if (!Array.isArray(songs) || !songs.length) return;
  initialized = true;
  const status = document.getElementById('status');
  const list = document.getElementById('tracks');
  songs.forEach((song, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = `${index + 1}. ${song.artist} — ${song.name}`;
    button.addEventListener('click', () => Amplitude.playSongAtIndex(index));
    item.append(button);
    list.append(item);
  });
  const update = () => {
    [...list.querySelectorAll('button')].forEach((button, index) => button.setAttribute('aria-current', String(index === Amplitude.getActiveIndex())));
  };
  try {
    Amplitude.init({ songs, callbacks: { song_change: update, initialized: update } });
    Amplitude.getAudio().addEventListener('error', () => {
      console.error('[MySpacePlayer] Audio failed', Amplitude.getAudio().error);
      status.textContent = 'Could not play this track. Try another track.';
    });
    status.textContent = '';
    update();
  } catch (error) {
    console.error('[MySpacePlayer] Initialization failed', error);
    status.textContent = 'Could not initialize the player.';
  }
});
