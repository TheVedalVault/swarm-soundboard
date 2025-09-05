import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

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
  
  // For now, we'll estimate duration as 0
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