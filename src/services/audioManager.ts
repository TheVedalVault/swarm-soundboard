import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
} from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
import { prisma } from './database.js';
import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

export class AudioManager {
  private connections: Map<string, VoiceConnection> = new Map();
  private players: Map<string, AudioPlayer> = new Map();
  private queues: Map<string, QueuedSound[]> = new Map();

  async joinChannel(channel: VoiceChannel): Promise<VoiceConnection> {
    const guildId = channel.guild.id;
    
    // Check if already connected
    const existingConnection = this.connections.get(guildId);
    if (existingConnection && existingConnection.state.status !== VoiceConnectionStatus.Destroyed) {
      return existingConnection;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    // Create audio player for this guild
    const player = createAudioPlayer();
    connection.subscribe(player);

    // Handle connection events
    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log('Voice connection is ready!');
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log('Voice connection disconnected, cleaning up...');
      this.connections.delete(guildId);
      this.players.delete(guildId);
      this.clearQueue(guildId);
    });

    // Handle player events
    player.on(AudioPlayerStatus.Idle, () => {
      this.playNext(guildId);
    });

    player.on(AudioPlayerStatus.Playing, () => {
      console.log('Audio player is now playing!');
    });

    player.on('error', (error) => {
      console.error(`Audio player error in guild ${guildId}:`, error);
      this.playNext(guildId);
    });

    // Add more detailed player event logging
    player.on(AudioPlayerStatus.Buffering, () => {
      console.log('Audio player is buffering...');
    });

    player.on(AudioPlayerStatus.AutoPaused, () => {
      console.log('Audio player auto-paused');
    });

    this.connections.set(guildId, connection);
    this.players.set(guildId, player);

    return connection;
  }

  async playSound(guildId: string, soundName: string, requestedBy: string, isReaction: boolean = false): Promise<boolean> {
    try {
      // First try exact match
      let sound = await prisma.sound.findFirst({
        where: { name: { equals: soundName } }
      });

      // If no exact match, try fuzzy search
      if (!sound) {
        const allSounds = await prisma.sound.findMany();
        const fuse = new Fuse(allSounds, {
          keys: ['name'],
          threshold: 0.2, // Stricter for sound selection
          includeScore: true
        });
        
        const fuzzyResults = fuse.search(soundName);
        if (fuzzyResults.length > 0) {
          sound = fuzzyResults[0].item;
          console.log(`🔍 Fuzzy match: "${soundName}" → "${sound.name}"`);
        }
      }

      if (!sound) {
        return false;
      }

      // Check if sound file exists
      const soundPath = path.join(process.cwd(), 'sounds', sound.filename);
      if (!fs.existsSync(soundPath)) {
        console.error(`Sound file not found: ${soundPath}`);
        return false;
      }

      if (isReaction) {
        // For reactions, add to front of queue (high priority)
        this.addToQueuePriority(guildId, {
          sound,
          requestedBy,
          requestedAt: new Date(),
        });
        console.log(`🎭 Reaction sound added to priority queue: ${sound.name}`);
      } else {
        // Check queue limits for regular commands
        const currentQueue = this.getQueue(guildId);
        const serverConfig = await prisma.serverConfig.findUnique({
          where: { guildId }
        });
        const maxQueueSize = serverConfig?.maxQueueSize || 10;

        if (currentQueue.length >= maxQueueSize) {
          console.log(`Queue full for guild ${guildId} (${currentQueue.length}/${maxQueueSize})`);
          return false; // Queue is full
        }

        // Add to back of queue (normal priority)
        this.addToQueue(guildId, {
          sound,
          requestedBy,
          requestedAt: new Date(),
        });
      }

      // Update play count
      await prisma.sound.update({
        where: { id: sound.id },
        data: { playCount: { increment: 1 } }
      });

      // Add to play history
      await prisma.playHistory.create({
        data: {
          soundId: sound.id,
          guildId,
          userId: requestedBy,
        }
      });

      // Start playing if not already playing, or skip current sound if reaction
      const player = this.players.get(guildId);
      if (player?.state.status === AudioPlayerStatus.Idle) {
        this.playNext(guildId);
      } else if (isReaction && player) {
        // For reactions, interrupt current sound to play immediately
        console.log('🎭 Interrupting current sound for reaction');
        this.playNext(guildId);
      }

      return true;
    } catch (error) {
      console.error('Error playing sound:', error);
      return false;
    }
  }

  private addToQueue(guildId: string, item: QueuedSound) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, []);
    }
    this.queues.get(guildId)!.push(item);
  }

  private addToQueuePriority(guildId: string, item: QueuedSound) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, []);
    }
    // Add to front of queue for high priority
    this.queues.get(guildId)!.unshift(item);
  }

  private async playNext(guildId: string) {
    const queue = this.queues.get(guildId);
    const player = this.players.get(guildId);

    if (!queue || queue.length === 0 || !player) {
      return;
    }

    const nextItem = queue.shift()!;
    const soundPath = path.join(process.cwd(), 'sounds', nextItem.sound.filename);

    try {
      // Get server volume setting (default 1.0 for testing)
      const serverConfig = await prisma.serverConfig.findUnique({
        where: { guildId }
      });
      const volume = serverConfig?.volume || 1.0;

      // Check if file exists and get info
      console.log(`Attempting to play: ${soundPath}`);
      console.log(`File exists: ${fs.existsSync(soundPath)}`);
      if (fs.existsSync(soundPath)) {
        const stats = fs.statSync(soundPath);
        console.log(`File size: ${stats.size} bytes`);
      }

      const resource = createAudioResource(soundPath, {
        inlineVolume: true,
        inputType: StreamType.Arbitrary,
      });
      
      if (resource.volume) {
        resource.volume.setVolume(volume);
        console.log(`Volume set to: ${volume} (${Math.round(volume * 100)}%)`);
      }
      
      console.log(`Playing: ${nextItem.sound.name}`);
      player.play(resource);
    } catch (error) {
      console.error('Error playing next sound:', error);
      // Try to play the next one
      this.playNext(guildId);
    }
  }

  getQueue(guildId: string): QueuedSound[] {
    return this.queues.get(guildId) || [];
  }

  clearQueue(guildId: string) {
    this.queues.set(guildId, []);
  }

  removeFromQueue(guildId: string, index: number): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || index < 0 || index >= queue.length) {
      return false;
    }
    
    queue.splice(index, 1);
    return true;
  }

  moveInQueue(guildId: string, fromIndex: number, toIndex: number): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || fromIndex < 0 || fromIndex >= queue.length || 
        toIndex < 0 || toIndex >= queue.length) {
      return false;
    }
    
    const [item] = queue.splice(fromIndex, 1);
    queue.splice(toIndex, 0, item);
    return true;
  }

  shuffleQueue(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || queue.length <= 1) {
      return false;
    }
    
    // Fisher-Yates shuffle algorithm
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return true;
  }

  stopPlaying(guildId: string) {
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
    }
    this.clearQueue(guildId);
  }

  leaveChannel(guildId: string) {
    const connection = this.connections.get(guildId);
    if (connection) {
      connection.destroy();
      this.connections.delete(guildId);
    }
    
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
      this.players.delete(guildId);
    }
    
    this.clearQueue(guildId);
  }
}

interface QueuedSound {
  sound: {
    id: string;
    name: string;
    filename: string;
    category: string;
    person: string;
    duration: number;
  };
  requestedBy: string;
  requestedAt: Date;
}

export const audioManager = new AudioManager();