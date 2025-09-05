import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { audioManager } from '../services/audioManager.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current sound queue')
  .addSubcommand(subcommand =>
    subcommand
      .setName('show')
      .setDescription('Display the current queue')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('clear')
      .setDescription('Clear the current queue')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'show') {
    const queue = audioManager.getQueue(interaction.guild.id);

    if (queue.length === 0) {
      await interaction.reply('🎵 The queue is currently empty.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎵 Sound Queue')
      .setColor(0x00AE86)
      .setDescription(
        queue.map((item, index) => 
          `${index + 1}. **${item.sound.name}** (${item.sound.person}) - <@${item.requestedBy}>`
        ).join('\n')
      )
      .setFooter({ text: `${queue.length} sound(s) in queue` });

    await interaction.reply({ embeds: [embed] });
  } else if (subcommand === 'clear') {
    audioManager.clearQueue(interaction.guild.id);
    await interaction.reply('🗑️ Queue cleared!');
  }
}