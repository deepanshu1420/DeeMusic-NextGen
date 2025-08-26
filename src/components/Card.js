import React, { useContext, useEffect, useState } from "react";
import { MusicContext } from "../Context";

function Card({ element, canUseSpotify, onTogglePlay, activeUri, isPaused, playerRef }) {
  const musicContext = useContext(MusicContext);
  const likedMusic = musicContext.likedMusic || [];
  const setlikedMusic = musicContext.setLikedMusic;
  const pinnedMusic = musicContext.pinnedMusic || [];
  const setpinnedMusic = musicContext.setPinnedMusic;

  const [volume, setVolume] = useState(0.5); // Default volume

  const handlePin = () => {
    const storedPinned = JSON.parse(localStorage.getItem("pinnedMusic")) || [];
    let updatedPinned = [];

    if (storedPinned.some((item) => item.id === element.id)) {
      updatedPinned = storedPinned.filter((item) => item.id !== element.id);
    } else {
      if (storedPinned.length >= 4) return;
      updatedPinned = [...storedPinned, element];
    }

    setpinnedMusic(updatedPinned);
    localStorage.setItem("pinnedMusic", JSON.stringify(updatedPinned));
  };

  const handleLike = () => {
    const storedLiked = JSON.parse(localStorage.getItem("likedMusic")) || [];
    let updatedLiked = [];

    if (storedLiked.some((item) => item.id === element.id)) {
      updatedLiked = storedLiked.filter((item) => item.id !== element.id);
    } else {
      updatedLiked = [...storedLiked, element];
    }

    setlikedMusic(updatedLiked);
    localStorage.setItem("likedMusic", JSON.stringify(updatedLiked));
  };

  useEffect(() => {
    const localLiked = JSON.parse(localStorage.getItem("likedMusic")) || [];
    setlikedMusic(localLiked);
  }, [setlikedMusic]);

  const isCurrent = activeUri === element.uri;

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (playerRef?.current) {
      playerRef.current.setVolume(vol);
    } else {
      const audio = document.querySelector(`#audio-${element.id}`);
      if (audio) audio.volume = vol;
    }
  };

  return (
    <div key={element.id} className="col-lg-3 col-md-6 py-2">
      <div
        className={`card music-card shadow-sm ${
          isCurrent ? "border-3 border-primary shadow-lg p-2 bg-light bg-opacity-10" : ""
        }`}
      >
        <div className="ratio ratio-1x1 bg-secondary bg-opacity-25">
          <img src={element.album.images[0]?.url} className="card-img-top" alt={element.name} />
        </div>

        <div className="card-body">
          <h5 className="card-title d-flex justify-content-between">
            {element.name}
            <div className="add-options d-flex align-items-start">
              {pinnedMusic.some((item) => item.id === element.id) ? (
                <button onClick={handlePin} className="btn btn-outline-dark mx-1">
                  <i className="bi bi-pin-angle-fill"></i>
                </button>
              ) : (
                <button onClick={handlePin} className="btn btn-outline-dark mx-1">
                  <i className="bi bi-pin-angle"></i>
                </button>
              )}

              {likedMusic.some((item) => item.id === element.id) ? (
                <button onClick={handleLike} className="btn btn-outline-dark">
                  <i className="bi bi-heart-fill text-danger"></i>
                </button>
              ) : (
                <button onClick={handleLike} className="btn btn-outline-dark">
                  <i className="bi bi-heart"></i>
                </button>
              )}
            </div>
          </h5>

          <p className="card-text">Artist: {element.album.artists[0]?.name}</p>
          <p className="card-text">Release date: {element.album.release_date}</p>

          {/* Playback Area */}
          {canUseSpotify ? (
            <div className="d-flex flex-column">
              <button
                className="btn btn-dark rounded-pill mb-2"
                onClick={() => onTogglePlay(element.uri)}
                title={isCurrent && !isPaused ? "Pause" : "Play"}
              >
                {isCurrent && !isPaused ? (
                  <>
                    <i className="bi bi-pause-circle me-2"></i> Pause on DeeMusic
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-circle me-2"></i> Play on DeeMusic
                  </>
                )}
              </button>

              {/* Volume slider (only on currently playing card) */}
              {isCurrent && (
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="form-range"
                  title="Volume"
                />
              )}
            </div>
          ) : (
            <audio id={`audio-${element.id}`} src={element.preview_url} controls className="w-100" />
          )}
        </div>
      </div>
    </div>
  );
}

export default Card;
