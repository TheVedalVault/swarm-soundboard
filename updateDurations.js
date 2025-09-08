import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import ffprobe from 'node-ffprobe';

dotenv.config();

const prisma = new PrismaClient();

async function updateExistingSoundDurations() {
  console.log('🔄 Updating durations for existing sounds...');
  
  const sounds = await prisma.sound.findMany({
    where: {
      duration: 0 // Only update sounds with duration = 0
    }
  });

  console.log(`📊 Found ${sounds.length} sounds with missing durations`);

  let updated = 0;
  let errors = 0;

  for (const sound of sounds) {
    const soundPath = path.join(process.cwd(), 'sounds', sound.filename);
    
    if (!fs.existsSync(soundPath)) {
      console.log(`❌ File not found: ${sound.filename}`);
      errors++;
      continue;
    }

    try {
      const probeData = await ffprobe(soundPath);
      
      if (probeData.streams && probeData.streams.length > 0) {
        const audioStream = probeData.streams.find(stream => stream.codec_type === 'audio');
        if (audioStream) {
          const duration = parseFloat(audioStream.duration) || 0;
          
          await prisma.sound.update({
            where: { id: sound.id },
            data: { duration }
          });
          
          console.log(`✅ Updated ${sound.name}: ${duration.toFixed(2)}s`);
          updated++;
        }
      }
    } catch (error) {
      console.log(`⚠️ Error processing ${sound.filename}: ${error.message}`);
      errors++;
    }

    // Small delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n📈 Update complete!`);
  console.log(`✅ Updated: ${updated} sounds`);
  console.log(`❌ Errors: ${errors} sounds`);

  await prisma.$disconnect();
}

updateExistingSoundDurations()
  .then(() => {
    console.log('🎉 Duration update completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed to update durations:', error);
    process.exit(1);
  });
