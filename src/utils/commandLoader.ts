import { Collection, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadCommands() {
  const commands = new Collection();
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // Use pathToFileURL for proper cross-platform ESM compatibility
    const fileUrl = pathToFileURL(filePath).href;
    
    try {
      const command = await import(fileUrl);
      
      if (command && typeof command === 'object' && 'data' in command && 'execute' in command) {
        commands.set((command as any).data.name, command);
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    } catch (error) {
      console.error(`[ERROR] Failed to import command ${file}:`, error);
    }
  }

  return commands;
}

export async function deployCommands(clientId: string, token: string, guildId?: string) {
  const commands = await loadCommands();
  const commandData = commands.map(command => (command as any).data.toJSON());

  const rest = new REST().setToken(token);

  try {
    console.log(`Started refreshing ${commandData.length} application (/) commands.`);

    let data;
    if (guildId) {
      // Guild-specific commands (faster for development)
      data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandData }
      );
    } else {
      // Global commands
      data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commandData }
      );
    }

    console.log(`Successfully reloaded ${(data as any).length} application (/) commands.`);
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
}