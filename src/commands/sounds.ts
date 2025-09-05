import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { prisma } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('sounds')
  .setDescription('Browse and explore available sounds')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all sounds with pagination')
      .addIntegerOption(option =>
        option.setName('page')
          .setDescription('Page number (default: 1)')
          .setMinValue(1)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('by-person')
      .setDescription('List sounds by person')
      .addStringOption(option =>
        option.setName('person')
          .setDescription('Person to filter by')
          .setRequired(true)
          .addChoices(
            { name: 'Vedal', value: 'vedal' },
            { name: 'Neuro', value: 'neuro' },
            { name: 'Evil', value: 'evil' },
            { name: 'Camila', value: 'camila' },
            { name: 'Cerber', value: 'cerber' },
            { name: 'Mini', value: 'mini' },
            { name: 'Miscellaneous', value: 'misc' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('by-category')
      .setDescription('List sounds by category')
      .addStringOption(option =>
        option.setName('category')
          .setDescription('Category to filter by')
          .setRequired(true)
          .addChoices(
            { name: 'Cursed Sounds', value: 'cursed' },
            { name: 'Reactions', value: 'reactions' },
            { name: 'Screams', value: 'screams' },
            { name: 'Miscellaneous', value: 'misc' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('Show sound library statistics')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('popular')
      .setDescription('Show most played sounds')
      .addIntegerOption(option =>
        option.setName('limit')
          .setDescription('Number of sounds to show (default: 10)')
          .setMinValue(1)
          .setMaxValue(25)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('Search for sounds by name')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('Search term')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'list':
        await handleList(interaction);
        break;
      case 'by-person':
        await handleByPerson(interaction);
        break;
      case 'by-category':
        await handleByCategory(interaction);
        break;
      case 'stats':
        await handleStats(interaction);
        break;
      case 'popular':
        await handlePopular(interaction);
        break;
      case 'search':
        await handleSearch(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
  } catch (error) {
    console.error('Error in sounds command:', error);
    await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const page = interaction.options.getInteger('page') || 1;
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const [sounds, totalCount] = await Promise.all([
    prisma.sound.findMany({
      orderBy: { name: 'asc' },
      skip: offset,
      take: pageSize
    }),
    prisma.sound.count()
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  if (sounds.length === 0) {
    await interaction.reply('📄 No sounds found on this page!');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎵 Sound Library')
    .setColor(0x00AE86)
    .setDescription(
      sounds.map(sound => 
        `**${sound.name}** (${sound.person}) [${sound.category}] - Played ${sound.playCount}x`
      ).join('\n')
    )
    .setFooter({ 
      text: `Page ${page} of ${totalPages} • ${totalCount} total sounds` 
    });

  await interaction.reply({ embeds: [embed] });
}

async function handleByPerson(interaction: ChatInputCommandInteraction) {
  const person = interaction.options.getString('person', true);
  
  const sounds = await prisma.sound.findMany({
    where: { person },
    orderBy: { name: 'asc' }
  });

  if (sounds.length === 0) {
    await interaction.reply(`📄 No sounds found for **${person}**!`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎵 ${person.charAt(0).toUpperCase() + person.slice(1)} Sounds`)
    .setColor(0x00AE86)
    .setDescription(
      sounds.map(sound => 
        `**${sound.name}** [${sound.category}] - Played ${sound.playCount}x`
      ).join('\n')
    )
    .setFooter({ text: `${sounds.length} sound(s) found` });

  await interaction.reply({ embeds: [embed] });
}

async function handleByCategory(interaction: ChatInputCommandInteraction) {
  const category = interaction.options.getString('category', true);
  
  const sounds = await prisma.sound.findMany({
    where: { category },
    orderBy: { name: 'asc' }
  });

  if (sounds.length === 0) {
    await interaction.reply(`📄 No sounds found in **${category}** category!`);
    return;
  }

  const categoryNames: Record<string, string> = {
    cursed: 'Cursed Sounds',
    reactions: 'Reactions',
    screams: 'Screams',
    misc: 'Miscellaneous'
  };

  const embed = new EmbedBuilder()
    .setTitle(`🎵 ${categoryNames[category] || category} Sounds`)
    .setColor(0x00AE86)
    .setDescription(
      sounds.map(sound => 
        `**${sound.name}** (${sound.person}) - Played ${sound.playCount}x`
      ).join('\n')
    )
    .setFooter({ text: `${sounds.length} sound(s) found` });

  await interaction.reply({ embeds: [embed] });
}

async function handleStats(interaction: ChatInputCommandInteraction) {
  const [
    totalSounds,
    totalPlays,
    personStats,
    categoryStats
  ] = await Promise.all([
    prisma.sound.count(),
    prisma.sound.aggregate({ _sum: { playCount: true } }),
    prisma.sound.groupBy({
      by: ['person'],
      _count: { person: true },
      orderBy: { _count: { person: 'desc' } }
    }),
    prisma.sound.groupBy({
      by: ['category'],
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } }
    })
  ]);

  const personList = personStats.map(p => `**${p.person}**: ${p._count.person}`).join('\n');
  const categoryList = categoryStats.map(c => `**${c.category}**: ${c._count.category}`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📊 Sound Library Statistics')
    .setColor(0x00AE86)
    .addFields(
      { name: '🎵 Total Sounds', value: totalSounds.toString(), inline: true },
      { name: '▶️ Total Plays', value: (totalPlays._sum.playCount || 0).toString(), inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '👥 By Person', value: personList || 'None', inline: true },
      { name: '📂 By Category', value: categoryList || 'None', inline: true }
    );

  await interaction.reply({ embeds: [embed] });
}

async function handlePopular(interaction: ChatInputCommandInteraction) {
  const limit = interaction.options.getInteger('limit') || 10;
  
  const sounds = await prisma.sound.findMany({
    orderBy: { playCount: 'desc' },
    take: limit
  });

  if (sounds.length === 0) {
    await interaction.reply('📄 No sounds found!');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🔥 Most Popular Sounds')
    .setColor(0x00AE86)
    .setDescription(
      sounds.map((sound, index) => 
        `${index + 1}. **${sound.name}** (${sound.person}) [${sound.category}] - **${sound.playCount}** plays`
      ).join('\n')
    )
    .setFooter({ text: `Top ${sounds.length} sounds` });

  await interaction.reply({ embeds: [embed] });
}

async function handleSearch(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true);
  
  const sounds = await prisma.sound.findMany({
    where: {
      name: {
        contains: query
      }
    },
    orderBy: { playCount: 'desc' },
    take: 25
  });

  if (sounds.length === 0) {
    await interaction.reply(`🔍 No sounds found matching "**${query}**"!`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Search Results for "${query}"`)
    .setColor(0x00AE86)
    .setDescription(
      sounds.map(sound => 
        `**${sound.name}** (${sound.person}) [${sound.category}] - Played ${sound.playCount}x`
      ).join('\n')
    )
    .setFooter({ text: `${sounds.length} sound(s) found` });

  await interaction.reply({ embeds: [embed] });
}