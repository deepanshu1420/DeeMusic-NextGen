import React, { useContext } from "react";
import { MusicContext } from "../Context";
import PinnedMusic from "./PinnedMusic";
import LikedMusic from "./LikedMusic";

const Navbar = ({
  keyword,
  handleKeyPress,
  setKeyword,
  fetchMusicData,
  setTracks,
  /** new props */
  onLogin,
  onLogout,
  isLoggedIn,
  displayName,
}) => {
  const musicContext = useContext(MusicContext);
  const likedMusic = musicContext.likedMusic;
  const pinnedMusic = musicContext.pinnedMusic;
  const setResultOffset = musicContext.setResultOffset;

  return (
    <>
      <nav className="navbar navbar-dark navbar-expand-lg bg-dark ">
        <div className="container-fluid">
          {/* Brand */}
          <span className="navbar-brand">
            <i className="bi bi-music-note-list mx-3"></i> DeeMusic
          </span>

          {/* Back Button */}
          <button
            className="btn btn-outline-light btn-sm mx-2"
            onClick={() => {
              setKeyword("");
              setResultOffset(0);
              setTracks([]);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <i className="bi bi-arrow-left"></i> Back
          </button>

          {/* ✅ Split into pin-like-group (left) and auth-group (right) */}
          <div className="d-flex align-items-center ms-auto">
            {/* Left group: pinned + liked */}
            <div className="pin-like-group">
              <button
                type="button"
                data-bs-toggle="modal"
                data-bs-target="#exampleModal"
                className="btn btn-secondary btn-sm mx-1"
                title="Pinned"
              >
                <i className="bi bi-pin-angle-fill"></i> {pinnedMusic.length}
              </button>
              <button
                type="button"
                data-bs-toggle="modal"
                data-bs-target="#likedMusicModal"
                className="btn btn-secondary btn-sm mx-1"
                title="Liked"
              >
                <i className="bi bi-heart-fill"></i> {likedMusic.length}
              </button>
            </div>

            {/* Right group: login/logout */}
            <div className="auth-group ms-2">
              {!isLoggedIn ? (
                <button
                  className="btn btn-success btn-sm"
                  onClick={onLogin}
                  title="Login with Spotify"
                >
                  <i className="bi bi-spotify me-1"></i> Login
                </button>
              ) : (
                <>
                  <span className="text-light small me-2">
                    <i className="bi bi-spotify me-1"></i>
                    {displayName ? `Hi, ${displayName}` : "Connected"}
                  </span>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={onLogout}
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search Box */}
          <div
            className="collapse navbar-collapse d-flex justify-content-center"
            id="navbarSupportedContent"
          >
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={handleKeyPress}
              className="form-control me-2 w-75"
              type="search"
              placeholder="Search"
              aria-label="Search"
            />
            <button
              onClick={() => {
                setResultOffset(0);
                fetchMusicData();
              }}
              className="btn btn-outline-success"
            >
              Search
            </button>
          </div>
        </div>
      </nav>

      {/* Pinned Music Modal */}
      <div
        className="modal fade modal-xl"
        id="exampleModal"
        tabIndex={1}
        aria-labelledby="exampleModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id="exampleModalLabel">
                Pinned Music
              </h1>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <PinnedMusic />
            </div>
          </div>
        </div>
      </div>

      {/* Liked Music Modal */}
      <div
        className="modal fade modal-xl"
        id="likedMusicModal"
        tabIndex={1}
        aria-labelledby="likedMusicModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id="likedMusicModalLabel">
                Liked Music
              </h1>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <LikedMusic />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
