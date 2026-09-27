# LG tracks

`lg_tracks.js` adds a «Дорожки LG» (LG tracks) button to the Lampa player panel on LG TVs.

```
https://cdn.jsdelivr.net/gh/mvinkarklins/lampa@latest/lg_tracks.js
```

Lampa gets the audio track list from the webOS media service, but only looks for the video during the first second after playback starts. Torrents start slower, the list never arrives, and the built-in tracks button stays hidden. The new button requests the list on press, while the movie is already playing (waiting up to 20 seconds), shows a picker and switches the track without restarting the video. It also hands the list to Lampa, so the built-in button appears too. On other devices the plugin does nothing.

[← All plugins](../README.md)
