# SignLearn Live 🤟

SignLearn Live is a real-time web application that translates spoken English in YouTube videos into American Sign Language (ASL) fingerspelling.

It extracts subtitles directly from any YouTube video and mathematically synchronizes the fingerspelling speed to match the video's playback rate, ensuring perfectly accurate live translation without lag. 

## Features
- **Real-Time ASL Translation:** Paste a YouTube URL and watch the ASL translation happen instantly as the video plays.
- **TV Broadcast Mode (PiP):** A sleek, unobtrusive picture-in-picture view for an authentic broadcast-style experience.
- **Dynamic Speed Synchronization:** The fingerspelling naturally keeps up with the speaker and automatically scales when you slow down the video for easier learning.
- **Fluid Motion Blending:** Smooth transitions between signs simulating natural hand movements.
- **Interactive Dictionary:** Every translated word is logged in a word cloud. Click any word to replay the signs at your preferred speed.

## How to Run Locally

Since this application fetches transcripts dynamically, it uses a lightweight Express.js backend. 

### Prerequisites
- Node.js installed on your computer.

### Installation
1. Clone or download this repository (extract the ZIP file).
2. Open a terminal in the project folder and install dependencies:
   ```bash
   npm install
   ```
3. Start the local server:
   ```bash
   node server.js
   ```
4. Open your browser and go to `http://localhost:3000`.

## Credits & Dataset
The American Sign Language images used in this project are sourced from the **Mendeley Data - HandSign Dataset**.

*Source Citation:*
> [HandSign Dataset - Mendeley Data (j4y5w2c8w9)](https://data.mendeley.com/datasets/j4y5w2c8w9/1)

*This project was built for educational purposes to demonstrate advanced accessibility integration in modern web applications.*

## Copyright
&copy; 2026 Doruk Doğular. All rights reserved.
