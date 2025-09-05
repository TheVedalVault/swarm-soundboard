export interface SoundFile {
  name: string;
  filename: string;
  category: string;
  person: string;
  duration: number;
  fileSize: number;
  addedAt: Date;
  playCount: number;
}

export interface QueueItem {
  sound: SoundFile;
  requestedBy: string;
  requestedAt: Date;
}

export interface ServerConfig {
  guildId: string;
  enabledCategories: string[];
  enabledPeople: string[];
  disabledSounds: string[];
  volume: number;
}

export type SoundCategory = 'cursed' | 'reactions' | 'screams' | 'misc';
export type SoundPerson = 'vedal' | 'neuro' | 'evil' | 'camila' | 'cerber' | 'mini' | 'misc';