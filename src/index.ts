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
  
  // Deploy commands - use guild-specific registration if GUILD_ID is provided (for development)
  if (process.env.CLIENT_ID && process.env.TOKEN) {
    try {
      if (process.env.GUILD_ID) {
        console.log(`Deploying commands to guild ${process.env.GUILD_ID} (development mode)`);
        await deployCommands(process.env.CLIENT_ID, process.env.TOKEN, process.env.GUILD_ID);
      } else {
        console.log('Deploying commands globally (production mode)');
        await deployCommands(process.env.CLIENT_ID, process.env.TOKEN);
      }
    } catch (error) {
      console.error('⚠️ Failed to deploy commands automatically. You may need to deploy them manually.');
      console.error('Commands will still work if they were previously registered.');
      console.log('To deploy manually, run: npm run deploy-commands');
    }
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

client.login(process.env.TOKEN);