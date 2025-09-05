import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import { initializeDatabase } from './services/database.js';
import { loadCommands, deployCommands } from './utils/commandLoader.js';
import { execute as handleReactionAdd } from './events/messageReactionAdd.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Load commands
const commands = await loadCommands();

client.once('ready', async () => {
  console.log(`Ready! Logged in as ${client.user?.tag}`);
  
  // Initialize database
  await initializeDatabase();
  
  // Deploy commands (guild-specific for development)
  if (process.env.CLIENT_ID && process.env.DISCORD_TOKEN && process.env.GUILD_ID) {
    await deployCommands(process.env.CLIENT_ID, process.env.DISCORD_TOKEN, process.env.GUILD_ID);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await (command as any).execute(interaction);
    } catch (error) {
      console.error('Error executing command:', error);
      
      const reply = { content: 'There was an error while executing this command!', ephemeral: true };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      if ((command as any).autocomplete) {
        await (command as any).autocomplete(interaction);
      }
    } catch (error) {
      console.error('Error in autocomplete:', error);
    }
  }
});

// Handle message reactions
client.on('messageReactionAdd', handleReactionAdd);

client.login(process.env.DISCORD_TOKEN);