import "./App.css";
import { useContext, useEffect, useRef, useState } from "react";
import Card from "./components/Card";
import CreatePlaylist from "./components/CreatePlaylist";
import { initializePlaylist } from "./initialize";
import Navbar from "./components/Navbar";
import { MusicContext } from "./Context";

/** ---------- Spotify Auth (PKCE) helpers ---------- */
const SPOTIFY_CLIENT_ID = "c9a45ab1f5a449c1818b4c25c119068f";
const SPOTIFY_REDIRECT_URI = "http://127.0.0.1:3000/callback"; // must match in your dashboard
const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest("SHA-256", data);
}

function generateRandomString(len = 64) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let out = "";
  const randoms = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += charset[randoms[i] % charset.length];
  return out;
}

async function exchangeCodeForToken(code, codeVerifier) {
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_verifier: codeVerifier,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Failed to exchange code for token.");
  return res.json();
}

async function refreshToken(refresh_token) {
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Failed to refresh token.");
  return res.json();
}

function App() {
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");
  const [tracks, setTracks] = useState([]);

  /** Token states */
  const [token, setToken] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [refreshTok, setRefreshTok] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [profile, setProfile] = useState(null);

  /** Web Playback SDK */
  const [deviceId, setDeviceId] = useState(null);
  const playerRef = useRef(null);
  const [activeUri, setActiveUri] = useState(null);
  const [isPaused, setIsPaused] = useState(true);

  /** Modal state */
  const [isModalOpen, setIsModalOpen] = useState(false);

  const musicContext = useContext(MusicContext);
  const isLoading = musicContext.isLoading;
  const setIsLoading = musicContext.setIsLoading;
  const setLikedMusic = musicContext.setLikedMusic;
  const setpinnedMusic = musicContext.setResultOffset; // oops fix below
  const resultOffset = musicContext.resultOffset;
  const setResultOffset = musicContext.setResultOffset;

  const authOnce = useRef(false);

  const fetchMusicData = async (searchKeyword = keyword) => {
    setTracks([]);
    window.scrollTo(0, 0);
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(
          searchKeyword
        )}&type=track&offset=${resultOffset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch music data");
      const jsonData = await response.json();
      setTracks(jsonData.tracks.items);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      setResultOffset(0);
      fetchMusicData();
    }
  };

  const loginWithSpotify = async () => {
    try {
      setMessage("");
      const verifier = generateRandomString(64);
      const challenge = base64UrlEncode(await sha256(verifier));
      localStorage.setItem("sp_code_verifier", verifier);

      const url = new URL("https://accounts.spotify.com/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
      url.searchParams.set("scope", SPOTIFY_SCOPES);
      url.searchParams.set("redirect_uri", SPOTIFY_REDIRECT_URI);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("code_challenge", challenge);
      window.location.href = url.toString();
    } catch (e) {
      setMessage(`Login failed: ${e.message}`);
    }
  };

  const logoutSpotify = () => {
    setUserToken(null);
    setRefreshTok(null);
    setTokenExpiry(null);
    setProfile(null);
    setDeviceId(null);
    setActiveUri(null);
    setIsPaused(true);
    playerRef.current?.disconnect();
    playerRef.current = null;
    localStorage.removeItem("sp_access_token");
    localStorage.removeItem("sp_refresh_token");
    localStorage.removeItem("sp_access_token_expiry");
    setToken(null);
  };

  useEffect(() => {
    if (authOnce.current) return;
    authOnce.current = true;
    (async () => {
      try {
        const isCallback = window.location.pathname.startsWith("/callback");
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (isCallback && code) {
          setMessage("");
          const verifier = localStorage.getItem("sp_code_verifier");
          const data = await exchangeCodeForToken(code, verifier);
          const now = Date.now();
          const expiresAt = now + (data.expires_in - 30) * 1000;

          localStorage.setItem("sp_access_token", data.access_token);
          localStorage.setItem("sp_refresh_token", data.refresh_token || "");
          localStorage.setItem("sp_access_token_expiry", String(expiresAt));

          setUserToken(data.access_token);
          setRefreshTok(data.refresh_token || "");
          setTokenExpiry(expiresAt);
          setToken(data.access_token);
          window.history.replaceState({}, document.title, "/");
          return;
        } else {
          const at = localStorage.getItem("sp_access_token");
          const rt = localStorage.getItem("sp_refresh_token");
          const exp = Number(localStorage.getItem("sp_access_token_expiry"));
          if (at && exp && Date.now() < exp) {
            setUserToken(at);
            setRefreshTok(rt || "");
            setTokenExpiry(exp);
            setToken(at);
          }
        }
      } catch (e) {
        setMessage(`Auth error: ${e.message}`);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userToken || !refreshTok || !tokenExpiry) return;
    const msLeft = tokenExpiry - Date.now();
    if (msLeft <= 0) return;
    const t = setTimeout(async () => {
      try {
        const data = await refreshToken(refreshTok);
        const now = Date.now();
        const expiresAt = now + (data.expires_in - 30) * 1000;
        const newAccess = data.access_token;
        setUserToken(newAccess);
        setToken(newAccess);
        setTokenExpiry(expiresAt);
        localStorage.setItem("sp_access_token", newAccess);
        localStorage.setItem("sp_access_token_expiry", String(expiresAt));
      } catch (e) {
        setMessage(`Refresh failed: ${e.message}`);
        logoutSpotify();
      }
    }, Math.max(5000, msLeft - 30000));
    return () => clearTimeout(t);
  }, [userToken, refreshTok, tokenExpiry]);

  useEffect(() => {
    if (userToken) return;
    setIsLoading(true);
    const fetchClientToken = async () => {
      try {
        const response = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body:
            "grant_type=client_credentials&client_id=a77073181b7d48eb90003e3bb94ff88a&client_secret=68790982a0554d1a83427e061e371507",
        });
        if (!response.ok) throw new Error("Failed to fetch token");
        const jsonData = await response.json();
        setToken(jsonData.access_token);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClientToken();
  }, [userToken, setIsLoading]);

  useEffect(() => {
    if (!userToken) return;
    (async () => {
      try {
        const res = await fetch("https://api.spotify.com/v1/me", {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        if (res.ok) setProfile(await res.json());
      } catch {}
    })();
  }, [userToken]);

  useEffect(() => {
    if (!userToken) return;
    if (playerRef.current) return;
    if (!document.getElementById("spotify-player")) {
      const script = document.createElement("script");
      script.id = "spotify-player";
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "DeeMusic Web Player",
        getOAuthToken: (cb) => cb(userToken),
        volume: 0.6,
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        }).catch(() => {});
      });

      player.addListener("not_ready", () => {});
      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        setIsPaused(state.paused);
        const current = state.track_window?.current_track?.uri || null;
        if (current) setActiveUri(current);
      });

      player.connect();
    };
  }, [userToken]);

  const playTrackByUri = async (uri, resume = false) => {
    if (!userToken || !deviceId) {
      setMessage("Please log in with Spotify to play.");
      return;
    }
    try {
      await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ device_ids: [deviceId], play: true }),
      });

      if (resume) {
        await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(
            deviceId
          )}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${userToken}`,
            },
          }
        );
      } else {
        await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(
            deviceId
          )}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${userToken}`,
            },
            body: JSON.stringify({ uris: [uri] }),
          }
        );
      }

      setActiveUri(uri);
      setIsPaused(false);
    } catch (e) {
      setMessage(`Unable to play: ${e.message}`);
    }
  };

  const pausePlayback = async () => {
    if (!userToken || !deviceId) return;
    try {
      await fetch(
        `https://api.spotify.com/v1/me/player/pause?device_id=${encodeURIComponent(
          deviceId
        )}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${userToken}` },
        }
      );
      setIsPaused(true);
    } catch (e) {
      setMessage(`Pause failed: ${e.message}`);
    }
  };

  const togglePlayFromCard = async (uri) => {
    if (activeUri !== uri) {
      await playTrackByUri(uri, false);
      return;
    }
    if (isPaused) {
      await playTrackByUri(uri, true);
    } else {
      await pausePlayback();
    }
  };

  useEffect(() => {
    initializePlaylist();
    setLikedMusic(JSON.parse(localStorage.getItem("likedMusic")));
    setpinnedMusic(JSON.parse(localStorage.getItem("pinnedMusic")));
  }, [setLikedMusic, setpinnedMusic]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <>
      <Navbar
        keyword={keyword}
        setKeyword={setKeyword}
        handleKeyPress={handleKeyPress}
        fetchMusicData={fetchMusicData}
        setTracks={setTracks}
        onLogin={loginWithSpotify}
        onLogout={logoutSpotify}
        isLoggedIn={!!userToken}
        displayName={profile?.display_name}
        openModal={() => setIsModalOpen(true)} // pass modal toggle
      />

      <div className="container mt-3">
        {/* Loader */}
        <div className={`row ${isLoading ? "" : "d-none"}`}>
          <div className="col-12 py-5 text-center">
            <div
              className="spinner-border"
              style={{ width: "3rem", height: "3rem" }}
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>

        {/* Song Results */}
        <div className="row">
          {tracks.map((element) => (
            <Card
              key={element.id}
              element={element}
              canUseSpotify={!!userToken}
              onTogglePlay={togglePlayFromCard}
              activeUri={activeUri}
              isPaused={isPaused}
              playerRef={playerRef}  // <-- Add this
            />
          ))}
        </div>

        {/* Pagination */}
        <div className="row mt-4 mb-3" hidden={tracks.length === 0}>
          <div className="col d-flex justify-content-center gap-3">
            <button
              onClick={() => {
                setResultOffset((prev) => prev - 20);
                fetchMusicData();
              }}
              className="btn glass-btn rounded-pill px-4 fw-bold"
              disabled={resultOffset === 0}
            >
              ⬅️ Previous (Page {resultOffset / 20})
            </button>
            <button
              onClick={() => {
                setResultOffset((prev) => prev + 20);
                fetchMusicData();
              }}
              className="btn glass-btn rounded-pill px-4 fw-bold"
            >
              Next (Page {resultOffset / 20 + 2}) ➡️
            </button>
          </div>
        </div>

        {!userToken && message && (
          <div className="row">
            <div className="col">
              <h4 className="text-center text-danger py-2">{message}</h4>
            </div>
          </div>
        )}

        {tracks.length === 0 && !isLoading && (
          <div className="row">
            <div className="col-12 text-center py-5 home-hero ">
              <h1 className="display-3 fw-bold text-white mb-3">
                <i className="bi bi-music-note-beamed me-2"></i> DeeMusic
              </h1>
              <p className="lead text-light mb-4">
                Your music journey starts here 🎧 Search any song or explore moods!
              </p>

              <div className="song-button-box mb-4">
                <div className="d-flex justify-content-center gap-3 flex-wrap">
                  {[
                    "One Thousand Miles🎶",
                    "Jhol🔥",
                    "One Bottle Down🍾",
                    "Pal Pal❤️",
                  ].map((song) => (
                    <button
                      key={song}
                      className="btn btn-light bg-white bg-opacity-25 text-white rounded-pill px-4"
                      onClick={() => {
                        setKeyword(song);
                        setResultOffset(0);
                        fetchMusicData(song);
                      }}
                    >
                      {song}
                    </button>
                  ))}
                </div>
              </div>

              <div className="equalizer my-4">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>

              <a
                target="_blank"
                rel="noreferrer"
                className="btn btn-dark mt-3"
                href="https://github.com/Vishesh-Pandey/v-music"
              >
                <i className="bi bi-github me-2"></i> View on GitHub
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Modal with backdrop */}
      {isModalOpen && (
        <>
          <div
            className="modal-backdrop-blur"
            onClick={() => setIsModalOpen(false)}
          ></div>
          <div className="modal show d-block position-fixed top-50 start-50 translate-middle">
            <div className="modal-dialog">
              <div className="modal-content">
                <CreatePlaylist />
              </div>
            </div>
          </div>
        </>
      )}

      {tracks.length === 0 && !isLoading && (
        <footer className="app-footer text-center py-3">
          🎵 DeeMusic by Deepanshu Sharma • © 2025 All Rights Reserved
        </footer>
      )}
    </>
  );
}

export default App;
