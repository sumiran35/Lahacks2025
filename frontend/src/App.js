import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [scrapImage, setScrapImage] = useState(null);
  const [generatedIdeas, setGeneratedIdeas] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setScrapImage(URL.createObjectURL(file));
      processImage(file);
    }
  };

  const processImage = async (file) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result.split(',')[1];
      try {
        console.log('Sending image to OpenAI API...');
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer YOUR_OPENAI_API_KEY`
          },
          body: JSON.stringify({
            prompt: `Generate ideas for recycling this scrap: ${base64Image}`,
            n: 3,
            size: '256x256'
          })
        });

        const data = await response.json();
        console.log('API response:', data);
        if (data && data.data) {
          setGeneratedIdeas(data.data.map(item => item.url));
        } else {
          console.error('Unexpected API response:', data);
          setGeneratedIdeas([]);
        }
      } catch (error) {
        console.error('Error fetching from OpenAI API:', error);
        setGeneratedIdeas([]);
      }
    };
    reader.readAsDataURL(file);
  };

  const startCamera = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      })
      .catch(err => {
        console.error("Error accessing camera: ", err);
      });
  };

  const captureImage = () => {
    const context = canvasRef.current.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    canvasRef.current.toBlob(blob => {
      setScrapImage(URL.createObjectURL(blob));
      processImage(blob);
    }, 'image/jpeg');
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setScrapImage(null);
    setGeneratedIdeas([]);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Recycling Ideas Generator</h1>
        <nav>
          <ul>
            <li><a href="#upload">Upload Scrap</a></li>
            <li><a href="#ideas">Generated Ideas</a></li>
            <li>
              {isAuthenticated ? (
                <button onClick={handleLogout}>Logout</button>
              ) : (
                <button onClick={handleLogin}>Login</button>
              )}
            </li>
          </ul>
        </nav>
      </header>
      <main>
        {isAuthenticated ? (
          <>
            <section id="upload" className="upload-section">
              <h2>Upload Your Scrap</h2>
              <input type="file" accept="image/*" onChange={handleImageUpload} />
              <div>
                <button onClick={startCamera}>Start Camera</button>
                <video ref={videoRef} style={{ width: '300px', marginTop: '20px' }}></video>
                <button onClick={captureImage}>Capture Image</button>
                <canvas ref={canvasRef} style={{ display: 'none' }} width="300" height="200"></canvas>
              </div>
              {scrapImage && <img src={scrapImage} alt="Scrap" className="scrap-image" />}
            </section>
            <section id="ideas" className="ideas-section">
              <h2>Generated Ideas</h2>
              <ul>
                {generatedIdeas.map((idea, index) => (
                  <li key={index}><img src={idea} alt={`Idea ${index + 1}`} /></li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <p>Please log in to upload scrap and view generated ideas.</p>
        )}
      </main>
      <footer>
        <p>&copy; 2025 Recycling Ideas Generator</p>
      </footer>
    </div>
  );
}

export default App;
