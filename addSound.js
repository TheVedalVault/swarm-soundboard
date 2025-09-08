import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import ffprobe from 'node-ffprobe';

dotenv.config();

const prisma = new PrismaClient();

async function addSound(name, filename, category, person) {
  // Check if file exists
  const soundPath = path.join(process.cwd(), 'sounds', filename);
  if (!fs.existsSync(soundPath)) {
    throw new Error(`Sound file not found: ${soundPath}`);
  }

  // Get file stats
  const stats = fs.statSync(soundPath);
  
  // Extract audio metadata using ffprobe
  let duration = 0;
  let metadata = {};
  
  try {
    console.log(`📊 Analyzing audio file: ${filename}`);
    const probeData = await ffprobe(soundPath);
    
    if (probeData.streams && probeData.streams.length > 0) {
      const audioStream = probeData.streams.find(stream => stream.codec_type === 'audio');
      if (audioStream) {
        duration = parseFloat(audioStream.duration) || 0;
        metadata = {
          codec: audioStream.codec_name,
          bitrate: audioStream.bit_rate,
          sampleRate: audioStream.sample_rate,
          channels: audioStream.channels
        };
        
        console.log(`✅ Duration: ${duration.toFixed(2)}s, Codec: ${metadata.codec}, Bitrate: ${metadata.bitrate}`);
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not extract metadata from ${filename}: ${error.message}`);
    console.warn('📝 Proceeding with duration = 0');
  }

  try {
    const sound = await prisma.sound.create({
      data: {
        name,
        filename,
        category,
        person,
        duration,
        fileSize: stats.size,
      }
    });

    console.log(`✅ Added sound: ${name} (${filename})`);
    console.log(`📈 Details: ${duration.toFixed(2)}s, ${(stats.size / 1024).toFixed(1)}KB`);
    return sound;
  } catch (error) {
    console.error('❌ Error adding sound:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const [name, filename, category, person] = process.argv.slice(2);

if (!name || !filename || !category || !person) {
  console.log('Usage: node addSound.js <name> <filename> <category> <person>');
  console.log('Example: node addSound.js "test sound" "test.mp3" "misc" "vedal"');
  process.exit(1);
}

addSound(name, filename, category, person)
  .then(() => {
    console.log('Sound added successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to add sound:', error);
    process.exit(1);
  });