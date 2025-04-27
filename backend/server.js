// server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/generated', express.static('generated'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${uuidv4()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Ensure upload directories exist
['uploads', 'generated'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

// In-memory user store (replace with a database in production)
const users = {
  'Test': {
    password: 'Test',
    points: 0,
    completedProjects: 0,
    projectHistory: []
  }
};

// Mock database for recycling ideas
let recyclingIdeasDB = [];

// Authentication middleware
const authenticate = (req, res, next) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }
  
  const user = users[username];
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  
  req.user = { username };
  next();
};

// POST /api/login - User login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }
  
  const user = users[username];
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  
  return res.json({ 
    success: true, 
    user: {
      username,
      points: user.points,
      completedProjects: user.completedProjects
    }
  });
});

// POST /api/upload - Upload image
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const imagePath = req.file.path;
    const imageUrl = `${req.protocol}://${req.get('host')}/${imagePath}`;

    // Generate recycling ideas with OpenAI based on the image
    const recyclingIdeas = await generateRecyclingIdeas(imageUrl);

    return res.json({
      success: true,
      imageUrl,
      recyclingIdeas
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, message: 'Error processing image upload' });
  }
});

// POST /api/analyze - Analyze image and get recycling ideas
app.post('/api/analyze', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Image URL is required' });
    }

    // Generate recycling ideas with OpenAI based on the image
    const recyclingIdeas = await generateRecyclingIdeas(imageUrl);
    
    // Store generated ideas with unique IDs
    const ideasWithIds = recyclingIdeas.map(idea => ({
      ...idea,
      id: uuidv4()
    }));
    
    // Add to our "database"
    recyclingIdeasDB = [...recyclingIdeasDB, ...ideasWithIds];
    
    return res.json({
      success: true,
      recyclingIdeas: ideasWithIds
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({ success: false, message: 'Error analyzing image' });
  }
});

// POST /api/complete-project - Complete a recycling project and earn points
app.post('/api/complete-project', authenticate, (req, res) => {
  try {
    const { username } = req.user;
    const { ideaId } = req.body;
    
    if (!ideaId) {
      return res.status(400).json({ success: false, message: 'Idea ID is required' });
    }
    
    // Find the idea in our "database"
    const idea = recyclingIdeasDB.find(i => i.id === ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, message: 'Recycling idea not found' });
    }
    
    // Update user points and completed projects
    const user = users[username];
    user.points += idea.points;
    user.completedProjects += 1;
    user.projectHistory.push({
      ideaId,
      title: idea.title,
      points: idea.points,
      completedAt: new Date()
    });
    
    return res.json({
      success: true,
      points: user.points,
      completedProjects: user.completedProjects
    });
  } catch (error) {
    console.error('Complete project error:', error);
    return res.status(500).json({ success: false, message: 'Error completing project' });
  }
});

// GET /api/user-stats - Get user stats
app.get('/api/user-stats/:username', (req, res) => {
  const { username } = req.params;
  
  const user = users[username];
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  
  return res.json({
    success: true,
    stats: {
      points: user.points,
      completedProjects: user.completedProjects,
      projectHistory: user.projectHistory
    }
  });
});

// Function to generate recycling ideas based on image analysis
async function generateRecyclingIdeas(imageUrl) {
    try {
        // Instead of sending image data, use the provided URL in your prompt.
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "user",
                    content: `Based on the recyclable items shown in the image at ${imageUrl}, generate 4 creative upcycling or recycling project ideas.
For each idea, provide a title, description, difficulty level (Easy, Medium, Hard), and point value (50-200 points).
Return the response as a JSON array of objects with the keys: title, description, difficulty, points.
Make sure the projects are specific to the materials visible in the image.`
                }
            ],
            max_tokens: 800
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI response does not contain content');
        }

        let ideas;
        try {
            ideas = JSON.parse(content);
        } catch (parseError) {
            console.error('Failed to parse JSON directly:', content);

            // Try to extract JSON from the response if it isn't valid JSON directly
            const jsonMatch = content.match(/\[.*\]/s);
            if (jsonMatch) {
                try {
                    ideas = JSON.parse(jsonMatch[0]);
                } catch (nestedParseError) {
                    console.error('Failed to parse extracted JSON:', jsonMatch[0]);
                    throw new Error('Failed to parse recycling ideas from OpenAI response');
                }
            } else {
                throw new Error('No valid JSON found in OpenAI response');
            }
        }

        // Generate images for each idea via DALL-E integration.
        const ideasWithImages = await Promise.all(ideas.map(async (idea) => {
            const ideaImageUrl = await generateImageForIdea(idea.title, idea.description);
            return {
                ...idea,
                imageUrl: ideaImageUrl
            };
        }));

        return ideasWithImages;
    } catch (error) {
        console.error('Error generating recycling ideas:', error);

        // Fallback ideas if the API call fails.
        return [
            {
                title: "Plastic Bottle Planter",
                description: "Transform plastic bottles into colorful hanging planters for herbs or succulents.",
                difficulty: "Easy",
                points: 50,
                imageUrl: "/api/placeholder/1"
            },
            {
                title: "Cardboard Organizer",
                description: "Create a desk organizer from cardboard boxes to store stationery and small items.",
                difficulty: "Medium",
                points: 75,
                imageUrl: "/api/placeholder/2"
            },
            {
                title: "Tin Can Lantern",
                description: "Create beautiful ambient lighting with upcycled cans and decorative hole patterns.",
                difficulty: "Easy",
                points: 60,
                imageUrl: "/api/placeholder/3"
            },
            {
                title: "Paper Mâché Art",
                description: "Turn old newspapers and magazines into creative sculptures or decorative pieces.",
                difficulty: "Medium",
                points: 100,
                imageUrl: "/api/placeholder/4"
            }
        ];
    }
}
async function generateImageForIdea(title, description) {
    try {
      // Generate a unique filename
      const filename = `${Date.now()}_${uuidv4()}.png`;
      const outputPath = path.join('generated', filename);
      
      // Create a prompt for DALL-E
      const prompt = `A creative DIY recycling project: ${title}. ${description}. Style: bright, clear instructional image with clean background, showing the finished project.`;
      
      // Generate image with DALL-E
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "b64_json"
      });

      if (!response || !response.data || !response.data[0] || !response.data[0].b64_json) {
        console.error('DALL-E API response is invalid:', response);
        throw new Error('Invalid response from DALL-E API');
      }

      // Save the image to disk
      try {
        const imageData = response.data[0].b64_json;
        fs.writeFileSync(outputPath, Buffer.from(imageData, 'base64'));
      } catch (writeError) {
        console.error('Error saving the generated image:', writeError);
        throw new Error('Failed to save the generated image');
      }
      
      // Return the URL to the image
      return `${process.env.HOST || 'http://localhost:3001'}/${outputPath}`;
    } catch (error) {
      console.error('Error generating image:', error);
      // Return a placeholder if image generation fails
      return `/api/placeholder/300/200`;
    }
  }

  app.post('/api/challenge-details', async (req, res) => {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }
  
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: `Provide detailed, step-by-step instructions on how to build a recycling project with the title "${title}" and description "${description}". List each step and the required materials.`
          }
        ],
        max_tokens: 600
      });
      const steps = response.choices[0].message.content;
      return res.json({ success: true, steps });
    } catch (error) {
      console.error('Error generating challenge details:', error);
      return res.status(500).json({ success: false, message: 'Error generating challenge details' });
    }
  });

// Route to serve placeholder images for fallback ideas
app.get('/api/placeholder/:id', (req, res) => {
  const { id } = req.params;
  const placeholderPath = path.join(__dirname, 'generated', `${id}.png`);

  if (fs.existsSync(placeholderPath)) {
    res.sendFile(placeholderPath);
  } else {
    res.status(404).json({ success: false, message: 'Placeholder image not found' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});