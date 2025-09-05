import { prisma } from '../services/database.js';
import fs from 'fs';
import path from 'path';

export async function addSound(
  name: string,
  filename: string,
  category: string,
  person: string
) {
  // Check if file exists
  const soundPath = path.join(process.cwd(), 'sounds', filename);
  if (!fs.existsSync(soundPath)) {
    throw new Error(`Sound file not found: ${soundPath}`);
  }

  // Get file stats
  const stats = fs.statSync(soundPath);
  
  // For now, we'll estimate duration as 0 (you could use a library like node-ffprobe to get actual duration)
  const duration = 0;

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
    return sound;
  } catch (error) {
    console.error('❌ Error adding sound:', error);
    throw error;
  }
}

// CLI usage if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const [name, filename, category, person] = process.argv.slice(2);
  
  if (!name || !filename || !category || !person) {
    console.log('Usage: npm run add-sound <name> <filename> <category> <person>');
    console.log('Example: npm run add-sound "test sound" "test.mp3" "misc" "vedal"');
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
}