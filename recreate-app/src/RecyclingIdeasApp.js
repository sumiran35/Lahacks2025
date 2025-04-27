import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, User, LogIn, LogOut, Recycle, Loader, Check, X, Lightbulb, Award, ChevronRight, Star, Trash2 } from 'lucide-react';

// Backend API URL
const API_URL = 'http://localhost:3001';

export default function RecyclingIdeasApp() {
  const [activeView, setActiveView] = useState('login');
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImage, setOriginalImage] = useState(null);
  const [recyclingIdeas, setRecyclingIdeas] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [notification, setNotification] = useState(null);
  const [detectedBrands, setDetectedBrands] = useState([]);
  const [points, setPoints] = useState(0);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [completedProjects, setCompletedProjects] = useState(0);
  const [backendImageUrl, setBackendImageUrl] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Load user stats from backend if logged in
  useEffect(() => {
    if (loggedIn && username) {
      fetchUserStats();
    }
  }, [loggedIn, username]);

  // Fetch user stats from backend
  const fetchUserStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/user-stats/${username}`);
      const data = await response.json();
      
      if (data.success) {
        setPoints(data.stats.points);
        setCompletedProjects(data.stats.completedProjects);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  // Handle login through the backend API
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLoggedIn(true);
        setActiveView('upload');
        setPoints(data.user.points);
        setCompletedProjects(data.user.completedProjects);
        showNotification('success', 'Successfully logged in!');
      } else {
        showNotification('error', data.message || 'Invalid credentials. Use Test/Test');
      }
    } catch (error) {
      console.error('Login error:', error);
      showNotification('error', 'Server error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    setLoggedIn(false);
    setActiveView('login');
    setOriginalImage(null);
    setBackendImageUrl(null);
    setRecyclingIdeas([]);
    setCameraActive(false);
    setUsername('');
    setPassword('');
    setSelectedIdea(null);
    showNotification('info', 'You have been logged out');
  };

  // Toggle camera
  const toggleCamera = async () => {
    if (cameraActive) {
      const stream = videoRef.current.srcObject;
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
      setCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      } catch (err) {
        showNotification('error', 'Camera access denied or not available');
      }
    }
  };

  // Capture image from camera and upload to backend
  const captureImage = async () => {
    if (!videoRef.current) return;
    
    // Create a canvas element if it doesn't exist
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    
    // Set canvas dimensions to match video
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    
    // Draw video frame to canvas
    canvasRef.current.getContext('2d').drawImage(videoRef.current, 0, 0);
    
    // Get image data URL
    const imageDataUrl = canvasRef.current.toDataURL('image/jpeg');
    setOriginalImage(imageDataUrl);
    
    // Convert data URL to blob for upload
    const blob = await (await fetch(imageDataUrl)).blob(); 
    
    // Turn off camera
    toggleCamera();
    
    // Upload to backend
    uploadImageToBackend(blob);
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Read file as data URL for preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setOriginalImage(event.target.result);
      };
      reader.readAsDataURL(file);
      
      // Upload file to backend
      uploadImageToBackend(file);
    }
  };

  // Upload image to backend
  const uploadImageToBackend = async (imageFile) => {
    setIsProcessing(true);
    setActiveView('analyze');
    
    try {
      // Create FormData object
      const formData = new FormData();
      formData.append('image', imageFile);
      
      // Upload image
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBackendImageUrl(data.imageUrl);
        setDetectedBrands(data.detectedBrands || []);
        
        // Now get recycling ideas based on the image
        await getRecyclingIdeas(data.imageUrl);
      } else {
        showNotification('error', data.message || 'Error uploading image');
        setActiveView('upload');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification('error', 'Server error while uploading image');
      setActiveView('upload');
      setIsProcessing(false);
    }
  };

  // Get recycling ideas from backend
  const getRecyclingIdeas = async (imageUrl) => {
    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRecyclingIdeas(data.recyclingIdeas);
        showNotification('success', `Found ${data.recyclingIdeas.length} creative recycling ideas!`);
      } else {
        showNotification('error', data.message || 'Error generating ideas');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      showNotification('error', 'Server error while generating ideas');
    } finally {
      setIsProcessing(false);
    }
  };
  const [challengeDetails, setChallengeDetails] = useState(null);
  
  // Modify the selectIdea function to fetch challenge details on selection
  const selectIdea = async (idea) => {
    setSelectedIdea(idea);
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_URL}/api/challenge-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: idea.title, description: idea.description }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setChallengeDetails(data.steps);
        showNotification('success', `Challenge accepted: ${idea.title}!`);
      } else {
        showNotification('error', data.message || 'Error fetching challenge details');
      }
    } catch (error) {
      console.error('Error fetching challenge details:', error);
      showNotification('error', 'Error fetching challenge details');
    } finally {
      setIsProcessing(false);
    }
  };

  

  // Complete a project
  const completeProject = async () => {
    if (!selectedIdea) return;
    
    setIsProcessing(true);
    
    try {
      const response = await fetch(`${API_URL}/api/complete-project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          password, // In a real app, use JWT tokens instead
          ideaId: selectedIdea.id 
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPoints(data.points);
        setCompletedProjects(data.completedProjects);
        showNotification('success', `+${selectedIdea.points} points! Great recycling!`);
        setSelectedIdea(null);
      } else {
        showNotification('error', data.message || 'Error completing project');
      }
    } catch (error) {
      console.error('Error completing project:', error);
      showNotification('error', 'Server error while completing project');
    } finally {
      setIsProcessing(false);
    }
  };

  // Show notification
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-teal-500 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center">
            <Recycle className="mr-2" size={24} />
            ReCreate
          </h1>
          
          {loggedIn && (
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-white bg-opacity-20 px-3 py-1 rounded-full">
                <Star size={16} className="mr-1 text-yellow-300" /> 
                <span className="font-bold">{points}</span>
              </div>
              <button 
                onClick={handleLogout} 
                className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded-full text-sm font-medium transition-all"
              >
                <LogOut size={16} className="mr-1" /> Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow container mx-auto p-6 flex flex-col max-w-lg">
        {/* Login View */}
        {activeView === 'login' && !loggedIn && (
          <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-green-500">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Welcome to ReCreate</h2>
            <p className="text-gray-600 mb-6 text-center">Upload items, get recycling ideas, and earn points!</p>
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-medium mb-2">Username</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    placeholder="Enter 'Test' as username"
                    required
                  />
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  placeholder="Enter 'Test' as password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-green-600 to-teal-500 text-white py-2 rounded-lg font-medium hover:opacity-90 transition-all flex justify-center items-center"
              >
                {isProcessing ? <Loader className="animate-spin" size={20} /> : (
                  <>
                    <LogIn size={18} className="mr-2" /> Login
                  </>
                )}
              </button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-green-600 text-sm">
                Use username: "Test" and password: "Test" to login
              </p>
            </div>
          </div>
        )}

        {/* Upload Image View */}
        {(activeView === 'upload' && loggedIn) && (
          <div className="flex flex-col gap-4">
            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Snap or Upload Items</h2>
              <p className="text-gray-600 mb-6">Take a photo of items you'd like to recycle and earn points!</p>
              
              <div className="flex flex-col gap-4">
                <button
                  onClick={toggleCamera}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-teal-500 text-white py-3 px-4 rounded-lg font-medium hover:opacity-90 transition-all"
                >
                  <Camera size={20} />
                  {cameraActive ? 'Turn Off Camera' : 'Take a Photo'}
                </button>
                
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current.click()}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-all"
                  >
                    <Upload size={20} />
                    Upload from Device
                  </button>
                </div>
              </div>
            </div>
            
            {/* Status Card */}
            {points > 0 && (
              <div className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-yellow-500">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-gray-800">Your Recycling Impact</h3>
                    <p className="text-sm text-gray-600">Projects completed: {completedProjects}</p>
                  </div>
                  <div className="bg-yellow-100 p-2 rounded-full">
                    <Award size={24} className="text-yellow-600" />
                  </div>
                </div>
              </div>
            )}
            
            {/* Camera View */}
            {cameraActive && (
              <div className="bg-white p-4 rounded-xl shadow-lg">
                <div className="relative">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    className="w-full h-64 object-cover rounded-lg bg-black"
                  />
                  <button
                    onClick={captureImage}
                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-gray-800 rounded-full p-3 shadow-lg"
                  >
                    <Camera size={24} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analyze View */}
        {activeView === 'analyze' && loggedIn && (
          <div className="flex flex-col gap-4">
            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Your Recyclable Items</h2>
              
              <div className="mb-6">
                <div className="relative">
                  <img 
                    src={originalImage} 
                    alt="Original" 
                    className="w-full h-64 object-contain rounded-lg border border-gray-200"
                  />
                  
                  {/* Brand Labels Overlay */}
                  {detectedBrands.length > 0 && (
                    <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                      <p className="font-bold mb-1">Detected Brands:</p>
                      <ul>
                        {detectedBrands.map((brand, index) => (
                          <li key={index} className="flex items-center">
                            <ChevronRight size={10} />
                            <span>{brand}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                      <div className="text-white flex flex-col items-center">
                        <Loader className="animate-spin mb-2" size={30} />
                        <p>Analyzing image...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {!isProcessing && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setActiveView('upload')}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all"
                  >
                    Take New Photo
                  </button>
                </div>
              )}
            </div>
            
            {/* Display Recycling Ideas with Images */}
            {recyclingIdeas.length > 0 && !isProcessing && (
              <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Recycling Challenges</h3>
                <p className="text-sm text-gray-600 mb-4">Select a challenge to earn points!</p>
                
                <div className="grid grid-cols-1 gap-4">
                  {recyclingIdeas.map((idea, index) => (
                    <div 
                      key={index} 
                      className={`bg-gray-50 p-4 rounded-lg border-l-2 ${selectedIdea === idea ? 'border-yellow-500 ring-2 ring-yellow-300' : 'border-green-400'} transition-all`}
                    >
                      <div className="flex flex-col md:flex-row gap-4">
                        <img 
                          src={idea.imageUrl} 
                          alt={idea.title} 
                          className="rounded-lg w-full md:w-32 h-24 object-cover"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-gray-800">{idea.title}</h4>
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                              +{idea.points} pts
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mt-1">{idea.description}</p>
                          <div className="mt-3 flex justify-between items-center">
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                              idea.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                              idea.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {idea.difficulty}
                            </span>
                            
                            {selectedIdea === idea ? (
                              <button 
                                onClick={completeProject}
                                disabled={isProcessing}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-sm font-medium transition-all flex items-center"
                              >
                                {isProcessing ? 
                                  <Loader size={16} className="animate-spin mr-1" /> : 
                                  <Check size={16} className="mr-1" />
                                }
                                Complete Challenge
                              </button>
                            ) : (
                              <button 
                                onClick={() => selectIdea(idea)}
                                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-medium transition-all"
                              >
                                Select Challenge
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedIdea && challengeDetails && (
  <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500 mt-4">
    <h3 className="text-lg font-bold text-gray-800 mb-2">
      Detailed Instructions for {selectedIdea.title}
    </h3>
    <pre className="text-left bg-gray-100 p-4 rounded-lg overflow-auto whitespace-pre-wrap text-sm">
      {challengeDetails}
    </pre>
  </div>
)}
          </div>
        )}
      </main>

      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-white transition-all ${
          notification.type === 'success' ? 'bg-green-500' : 
          notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`}>
          {notification.type === 'success' ? <Check size={18} /> :
           notification.type === 'error' ? <X size={18} /> : 
           <Recycle size={18} />}
          {notification.message}
        </div>
      )}
    </div>
  );
}