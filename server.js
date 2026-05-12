const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));
// Mount the asl_processed folder so images can be accessed directly
app.use('/asl_processed', express.static(path.join(__dirname, 'asl_processed')));

// Build an index of ASL images
const aslDir = path.join(__dirname, 'asl_processed', 'train');
const aslMap = {};

try {
  if (fs.existsSync(aslDir)) {
    const categories = fs.readdirSync(aslDir);
    for (const cat of categories) {
      const catPath = path.join(aslDir, cat);
      if (fs.statSync(catPath).isDirectory()) {
        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
        if (files.length > 0) {
          aslMap[cat.toUpperCase()] = files.map(f => `/asl_processed/train/${cat}/${f}`);
        }
      }
    }
    console.log(`ASL Index built. Found ${Object.keys(aslMap).length} categories.`);
  } else {
    console.warn(`ASL directory not found at ${aslDir}`);
  }
} catch (e) {
  console.error("Error building ASL index:", e);
}

app.get('/api/asl-index', (req, res) => {
  res.json(aslMap);
});

app.get('/api/transcript', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    res.json(transcript);
  } catch (error) {
    console.error("Error fetching transcript:", error);
    res.status(500).json({ error: 'Failed to fetch transcript. The video might not have captions enabled.' });
  }
});

app.listen(PORT, () => {
  console.log(`Live Sign Language Translator running on http://localhost:${PORT}`);
});
