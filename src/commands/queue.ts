import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { audioManager } from '../services/audioManager.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Manage the current sound queue')
  .addSubcommand(subcommand =>
    subcommand
      .setName('show')
      .setDescription('Display the current queue')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('clear')
      .setDescription('Clear the current queue')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a specific item from the queue')
      .addIntegerOption(option =>
        option.setName('position')
          .setDescription('Position in queue to remove (1 = next)')
          .setMinValue(1)
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('move')
      .setDescription('Move an item to a different position in the queue')
      .addIntegerOption(option =>
        option.setName('from')
          .setDescription('Current position')
          .setMinValue(1)
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('to')
          .setDescription('New position')
          .setMinValue(1)
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('shuffle')
      .setDescription('Randomly shuffle the queue order')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'show':
        await handleShow(interaction);
        break;
      case 'clear':
        await handleClear(interaction);
        break;
      case 'remove':
        await handleRemove(interaction);
        break;
      case 'move':
        await handleMove(interaction);
        break;
      case 'shuffle':
        await handleShuffle(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
  } catch (error) {
    console.error('Error in queue command:', error);
    await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
  }
}

async function handleShow(interaction: ChatInputCommandInteraction) {
  const queue = audioManager.getQueue(interaction.guild!.id);

  if (queue.length === 0) {
    await interaction.reply('🎵 The queue is currently empty.');
    return;
  }

  // Calculate total duration
  const totalDuration = queue.reduce((sum, item) => sum + (item.sound.duration || 0), 0);
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const embed = new EmbedBuilder()
    .setTitle('🎵 Sound Queue')
    .setColor(0x00AE86)
    .setDescription(
      queue.map((item, index) => {
        const duration = item.sound.duration > 0 ? ` (${formatDuration(item.sound.duration)})` : '';
        return `${index + 1}. **${item.sound.name}**${duration} (${item.sound.person}) - <@${item.requestedBy}>`;
      }).join('\n')
    )
    .setFooter({ 
      text: `${queue.length} sound(s) in queue • Total duration: ${formatDuration(totalDuration)}` 
    });

  await interaction.reply({ embeds: [embed] });
}

async function handleClear(interaction: ChatInputCommandInteraction) {
  audioManager.clearQueue(interaction.guild!.id);
  await interaction.reply('🗑️ Queue cleared!');
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
  const position = interaction.options.getInteger('position', true);
  const success = audioManager.removeFromQueue(interaction.guild!.id, position - 1);
  
  if (success) {
    await interaction.reply(`✅ Removed item at position ${position} from queue!`);
  } else {
    await interaction.reply({ content: `❌ Invalid position ${position}. Queue has fewer items.`, ephemeral: true });
  }
}

async function handleMove(interaction: ChatInputCommandInteraction) {
  const from = interaction.options.getInteger('from', true) - 1;
  const to = interaction.options.getInteger('to', true) - 1;
  
  const success = audioManager.moveInQueue(interaction.guild!.id, from, to);
  
  if (success) {
    await interaction.reply(`✅ Moved item from position ${from + 1} to position ${to + 1}!`);
  } else {
    await interaction.reply({ content: `❌ Invalid positions. Check your queue size.`, ephemeral: true });
  }
}

async function handleShuffle(interaction: ChatInputCommandInteraction) {
  const shuffled = audioManager.shuffleQueue(interaction.guild!.id);
  
  if (shuffled) {
    await interaction.reply('� Queue shuffled!');
  } else {
    await interaction.reply({ content: '❌ Queue is empty or has only one item.', ephemeral: true });
  }
}