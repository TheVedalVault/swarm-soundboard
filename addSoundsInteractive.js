import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import ffprobe from 'node-ffprobe';
import readline from 'readline';

dotenv.config();

const prisma = new PrismaClient();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Supported audio file extensions
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];

// Predefined options for quick selection
const CATEGORIES = ['cursed', 'reactions', 'screams', 'misc'];
const PEOPLE = ['vedal', 'neuro', 'evil', 'camila', 'cerber', 'mini', 'misc'];

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function formatFileSize(bytes) {
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)}KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)}MB`;
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function getAudioMetadata(filePath) {
  try {
    const probeData = await ffprobe(filePath);
    
    if (probeData.streams && probeData.streams.length > 0) {
      const audioStream = probeData.streams.find(stream => stream.codec_type === 'audio');
      if (audioStream) {
        return {
          duration: parseFloat(audioStream.duration) || 0,
          codec: audioStream.codec_name,
          bitrate: audioStream.bit_rate,
          sampleRate: audioStream.sample_rate,
          channels: audioStream.channels
        };
      }
    }
  } catch (error) {
    console.log(`⚠️ Could not extract metadata: ${error.message}`);
  }
  return { duration: 0, codec: 'unknown', bitrate: 'unknown', sampleRate: 'unknown', channels: 'unknown' };
}

async function promptWithOptions(prompt, options, allowCustom = true) {
  console.log(`\n${prompt}`);
  options.forEach((option, index) => {
    console.log(`${index + 1}. ${option}`);
  });
  if (allowCustom) {
    console.log(`${options.length + 1}. [Enter custom value]`);
  }
  
  const answer = await question('\nYour choice (number or text): ');
  
  // Check if it's a number selection
  const choiceNum = parseInt(answer);
  if (choiceNum >= 1 && choiceNum <= options.length) {
    return options[choiceNum - 1];
  }
  
  // If it's the custom option number
  if (allowCustom && choiceNum === options.length + 1) {
    return await question('Enter custom value: ');
  }
  
  // If it's direct text input
  if (answer.trim()) {
    return answer.trim();
  }
  
  // Default to first option if no valid input
  console.log(`Using default: ${options[0]}`);
  return options[0];
}

async function addSoundInteractive(filename, filePath, fileSize, metadata) {
  console.log('\n' + '='.repeat(60));
  console.log(`🎵 Found new audio file: ${filename}`);
  console.log('='.repeat(60));
  console.log(`📁 File size: ${formatFileSize(fileSize)}`);
  console.log(`⏱️ Duration: ${formatDuration(metadata.duration)}`);
  console.log(`🎧 Format: ${metadata.codec} • ${metadata.bitrate} bps • ${metadata.sampleRate} Hz • ${metadata.channels} channels`);
  console.log();

  // Get sound name
  let name = await question(`💭 Enter sound name (or press Enter to use "${path.parse(filename).name}"): `);
  if (!name.trim()) {
    name = path.parse(filename).name;
  }

  // Check if name already exists
  const existingSound = await prisma.sound.findFirst({
    where: { name: name }
  });

  if (existingSound) {
    console.log(`⚠️ Warning: A sound with name "${name}" already exists!`);
    const overwrite = await question('Do you want to use a different name? (y/N): ');
    if (overwrite.toLowerCase() === 'y' || overwrite.toLowerCase() === 'yes') {
      name = await question('Enter new name: ');
    }
  }

  // Get category
  const category = await promptWithOptions('📂 Select category:', CATEGORIES);

  // Get person
  const person = await promptWithOptions('👤 Select person:', PEOPLE);

  // Confirm addition
  console.log('\n📋 Summary:');
  console.log(`   Name: ${name}`);
  console.log(`   File: ${filename}`);
  console.log(`   Category: ${category}`);
  console.log(`   Person: ${person}`);
  console.log(`   Duration: ${formatDuration(metadata.duration)}`);
  
  const confirm = await question('\n✅ Add this sound? (Y/n): ');
  
  if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
    console.log('❌ Skipped');
    return false;
  }

  try {
    const sound = await prisma.sound.create({
      data: {
        name,
        filename,
        category,
        person,
        duration: metadata.duration,
        fileSize,
      }
    });

    console.log(`✅ Added sound: ${name}`);
    return true;
  } catch (error) {
    console.error('❌ Error adding sound:', error.message);
    return false;
  }
}

async function interactiveSoundAdder() {
  console.log('🎵 Interactive Sound Adder');
  console.log('==========================');
  console.log('This script will scan for new audio files and help you add them to the database.\n');

  const soundsDir = path.join(process.cwd(), 'sounds');
  
  // Check if sounds directory exists
  if (!fs.existsSync(soundsDir)) {
    console.log('❌ Sounds directory not found. Creating it...');
    fs.mkdirSync(soundsDir, { recursive: true });
    console.log('📁 Created sounds directory. Please add some audio files and run this script again.');
    return;
  }

  // Get all audio files in the sounds directory
  const files = fs.readdirSync(soundsDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return AUDIO_EXTENSIONS.includes(ext);
  });

  if (files.length === 0) {
    console.log('🔍 No audio files found in the sounds directory.');
    console.log(`📁 Supported formats: ${AUDIO_EXTENSIONS.join(', ')}`);
    console.log('Please add some audio files and run this script again.');
    return;
  }

  console.log(`🔍 Found ${files.length} audio file(s) in the sounds directory.`);

  // Get existing sounds from database
  const existingSounds = await prisma.sound.findMany({
    select: { filename: true }
  });
  const existingFilenames = new Set(existingSounds.map(s => s.filename));

  // Filter out files that are already in the database
  const newFiles = files.filter(file => !existingFilenames.has(file));

  if (newFiles.length === 0) {
    console.log('✅ All audio files are already in the database!');
    return;
  }

  console.log(`🆕 Found ${newFiles.length} new audio file(s) to add:`);
  newFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });

  const proceed = await question('\n🚀 Start adding sounds? (Y/n): ');
  if (proceed.toLowerCase() === 'n' || proceed.toLowerCase() === 'no') {
    console.log('👋 Goodbye!');
    return;
  }

  let added = 0;
  let skipped = 0;

  for (let i = 0; i < newFiles.length; i++) {
    const filename = newFiles[i];
    const filePath = path.join(soundsDir, filename);
    const fileStats = fs.statSync(filePath);
    
    console.log(`\n📊 Processing ${i + 1}/${newFiles.length}...`);
    
    // Get audio metadata
    const metadata = await getAudioMetadata(filePath);
    
    // Interactive addition
    const wasAdded = await addSoundInteractive(filename, filePath, fileStats.size, metadata);
    
    if (wasAdded) {
      added++;
    } else {
      skipped++;
    }

    // Ask if user wants to continue (except for the last file)
    if (i < newFiles.length - 1) {
      const continueAdding = await question('\n➡️ Continue to next file? (Y/n): ');
      if (continueAdding.toLowerCase() === 'n' || continueAdding.toLowerCase() === 'no') {
        console.log('🛑 Stopping...');
        break;
      }
    }
  }

  console.log('\n' + '='.repeat(40));
  console.log('🎉 Session Complete!');
  console.log('='.repeat(40));
  console.log(`✅ Added: ${added} sound(s)`);
  console.log(`⏭️ Skipped: ${skipped} sound(s)`);
  
  if (added > 0) {
    console.log('\n💡 You can now use these sounds with:');
    console.log('   • /play <sound name>');
    console.log('   • /random');
    console.log('   • /favorites add <sound name>');
  }
}

// Run the interactive adder
interactiveSoundAdder()
  .then(() => {
    console.log('\n👋 Thanks for using the Interactive Sound Adder!');
  })
  .catch((error) => {
    console.error('💥 An error occurred:', error);
  })
  .finally(() => {
    rl.close();
    prisma.$disconnect();
    process.exit(0);
  });
