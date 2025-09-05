import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const testSounds = [
  { name: "vedal laugh", filename: "butter dog.mp3", category: "reactions", person: "vedal" },
  { name: "neuro scream", filename: "butter dog.mp3", category: "screams", person: "neuro" },
  { name: "evil giggle", filename: "butter dog.mp3", category: "cursed", person: "evil" },
  { name: "vedal sigh", filename: "butter dog.mp3", category: "reactions", person: "vedal" },
  { name: "turtle noise", filename: "butter dog.mp3", category: "misc", person: "vedal" },
];

async function addTestSounds() {
  console.log('Adding test sounds...');
  
  for (const sound of testSounds) {
    try {
      await prisma.sound.create({
        data: {
          name: sound.name,
          filename: sound.filename,
          category: sound.category,
          person: sound.person,
          duration: 0,
          fileSize: 215804,
        }
      });
      console.log(`✅ Added: ${sound.name}`);
    } catch (error) {
      if (error.code === 'P2002') {
        console.log(`⚠️  Skipped (already exists): ${sound.name}`);
      } else {
        console.error(`❌ Error adding ${sound.name}:`, error);
      }
    }
  }
  
  await prisma.$disconnect();
  console.log('Done!');
}

addTestSounds();