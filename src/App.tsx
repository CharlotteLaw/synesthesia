import { useState } from "react";
import Camera from "./components/Camera";
import "./App.css";

function App() {
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraDeclined, setCameraDeclined] = useState(false);

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="Synesthesia home">
          <span className="wordmark-mark" aria-hidden="true">𝄞</span>
          <span>synesthesia</span>
        </a>
      </header>

      {cameraEnabled ? (
        <section className="instrument-panel" aria-labelledby="instrument-title">
          <div className="instrument-heading">
            <div>
              <h1 id="instrument-title">Let's make music!</h1>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => setCameraEnabled(false)}
            >
              Turn camera off
            </button>
          </div>
          <Camera />
        </section>
      ) : (
        <section className="welcome-panel" aria-labelledby="welcome-title">
          <h1 id="welcome-title">Bring music to life<br />with your hands</h1>
          <div className="choice-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setCameraDeclined(false);
                setCameraEnabled(true);
              }}
            >
              Turn camera on
              <span aria-hidden="true">↗</span>
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setCameraDeclined(true)}
            >
              Not now
            </button>
          </div>
          <p className="choice-note" role="status">
            {cameraDeclined
              ? "No problem. Your camera is off until you choose to turn it on."
              : "Your camera won’t start until you choose to turn it on."}
          </p>
        </section>
      )}

    </main>
  );
}

export default App;