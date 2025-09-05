import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { prisma } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View soundboard statistics and leaderboards')
  .addSubcommand(subcommand =>
    subcommand
      .setName('server')
      .setDescription('Show server-specific statistics')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('global')
      .setDescription('Show global statistics across all servers')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('user')
      .setDescription('Show your personal statistics')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('User to view stats for (default: yourself)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('leaderboard')
      .setDescription('Show server leaderboard')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Type of leaderboard')
          .setRequired(false)
          .addChoices(
            { name: 'Most Active Users', value: 'users' },
            { name: 'Most Popular Sounds', value: 'sounds' },
            { name: 'Most Used Categories', value: 'categories' },
            { name: 'Most Used People', value: 'people' }
          )
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'server':
        await handleServerStats(interaction);
        break;
      case 'global':
        await handleGlobalStats(interaction);
        break;
      case 'user':
        await handleUserStats(interaction);
        break;
      case 'leaderboard':
        await handleLeaderboard(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
  } catch (error) {
    console.error('Error in stats command:', error);
    await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
  }
}

async function handleServerStats(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const [
    totalPlays,
    uniqueUsers,
    topSounds,
    categoryStats,
    personStats,
    recentActivity
  ] = await Promise.all([
    // Total plays in this server
    prisma.playHistory.count({
      where: { guildId: interaction.guild.id }
    }),
    
    // Unique users who have played sounds
    prisma.playHistory.findMany({
      where: { guildId: interaction.guild.id },
      select: { userId: true },
      distinct: ['userId']
    }),
    
    // Top 5 sounds in this server
    prisma.playHistory.groupBy({
      by: ['soundId'],
      where: { guildId: interaction.guild.id },
      _count: { soundId: true },
      orderBy: { _count: { soundId: 'desc' } },
      take: 5
    }),
    
    // Category breakdown
    prisma.$queryRaw`
      SELECT s.category, COUNT(*) as plays
      FROM play_history ph
      JOIN sounds s ON ph.soundId = s.id
      WHERE ph.guildId = ${interaction.guild.id}
      GROUP BY s.category
      ORDER BY plays DESC
    `,
    
    // Person breakdown
    prisma.$queryRaw`
      SELECT s.person, COUNT(*) as plays
      FROM play_history ph
      JOIN sounds s ON ph.soundId = s.id
      WHERE ph.guildId = ${interaction.guild.id}
      GROUP BY s.person
      ORDER BY plays DESC
    `,
    
    // Recent activity (last 7 days)
    prisma.playHistory.count({
      where: {
        guildId: interaction.guild.id,
        playedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    })
  ]);

  // Get sound names for top sounds
  const soundIds = topSounds.map(s => s.soundId);
  const soundNames = await prisma.sound.findMany({
    where: { id: { in: soundIds } },
    select: { id: true, name: true, person: true }
  });

  const topSoundsText = topSounds.map(stat => {
    const sound = soundNames.find(s => s.id === stat.soundId);
    return `**${sound?.name || 'Unknown'}** (${sound?.person}) - ${stat._count.soundId} plays`;
  }).join('\n') || 'No plays yet';

  const categoryText = (categoryStats as any[]).map(stat => 
    `**${stat.category}**: ${stat.plays} plays`
  ).join('\n') || 'No plays yet';

  const personText = (personStats as any[]).map(stat => 
    `**${stat.person}**: ${stat.plays} plays`
  ).join('\n') || 'No plays yet';

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${interaction.guild.name} Statistics`)
    .setColor(0x00AE86)
    .addFields(
      { name: '🎵 Total Plays', value: totalPlays.toString(), inline: true },
      { name: '👥 Active Users', value: uniqueUsers.length.toString(), inline: true },
      { name: '📅 Last 7 Days', value: recentActivity.toString(), inline: true },
      { name: '🏆 Top Sounds', value: topSoundsText, inline: false },
      { name: '📂 Categories', value: categoryText, inline: true },
      { name: '👤 People', value: personText, inline: true }
    )
    .setFooter({ text: `Statistics for ${interaction.guild.name}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleGlobalStats(interaction: ChatInputCommandInteraction) {
  const [
    totalSounds,
    totalPlays,
    totalServers,
    topSounds,
    categoryStats,
    personStats
  ] = await Promise.all([
    prisma.sound.count(),
    prisma.playHistory.count(),
    
    prisma.playHistory.findMany({
      select: { guildId: true },
      distinct: ['guildId']
    }),
    
    // Global top sounds
    prisma.sound.findMany({
      orderBy: { playCount: 'desc' },
      take: 5,
      select: { name: true, person: true, playCount: true }
    }),
    
    // Global category stats
    prisma.sound.groupBy({
      by: ['category'],
      _sum: { playCount: true },
      orderBy: { _sum: { playCount: 'desc' } }
    }),
    
    // Global person stats
    prisma.sound.groupBy({
      by: ['person'],
      _sum: { playCount: true },
      orderBy: { _sum: { playCount: 'desc' } }
    })
  ]);

  const topSoundsText = topSounds.map(sound => 
    `**${sound.name}** (${sound.person}) - ${sound.playCount} plays`
  ).join('\n') || 'No plays yet';

  const categoryText = categoryStats.map(stat => 
    `**${stat.category}**: ${stat._sum.playCount || 0} plays`
  ).join('\n') || 'No plays yet';

  const personText = personStats.map(stat => 
    `**${stat.person}**: ${stat._sum.playCount || 0} plays`
  ).join('\n') || 'No plays yet';

  const embed = new EmbedBuilder()
    .setTitle('🌍 Global Statistics')
    .setColor(0x00AE86)
    .addFields(
      { name: '🎵 Total Sounds', value: totalSounds.toString(), inline: true },
      { name: '▶️ Total Plays', value: totalPlays.toString(), inline: true },
      { name: '🏠 Active Servers', value: totalServers.length.toString(), inline: true },
      { name: '🏆 Top Sounds Globally', value: topSoundsText, inline: false },
      { name: '📂 Category Usage', value: categoryText, inline: true },
      { name: '👤 Person Popularity', value: personText, inline: true }
    )
    .setFooter({ text: 'Global statistics across all servers' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleUserStats(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('target') || interaction.user;
  
  const [
    totalPlays,
    favoriteSounds,
    favoriteCategories,
    favoritePeople,
    recentPlays
  ] = await Promise.all([
    // Total plays by this user
    prisma.playHistory.count({
      where: { 
        userId: targetUser.id,
        guildId: interaction.guild.id 
      }
    }),
    
    // User's most played sounds
    prisma.playHistory.groupBy({
      by: ['soundId'],
      where: { 
        userId: targetUser.id,
        guildId: interaction.guild.id 
      },
      _count: { soundId: true },
      orderBy: { _count: { soundId: 'desc' } },
      take: 5
    }),
    
    // User's favorite categories
    prisma.$queryRaw`
      SELECT s.category, COUNT(*) as plays
      FROM play_history ph
      JOIN sounds s ON ph.soundId = s.id
      WHERE ph.userId = ${targetUser.id} AND ph.guildId = ${interaction.guild.id}
      GROUP BY s.category
      ORDER BY plays DESC
      LIMIT 3
    `,
    
    // User's favorite people
    prisma.$queryRaw`
      SELECT s.person, COUNT(*) as plays
      FROM play_history ph
      JOIN sounds s ON ph.soundId = s.id
      WHERE ph.userId = ${targetUser.id} AND ph.guildId = ${interaction.guild.id}
      GROUP BY s.person
      ORDER BY plays DESC
      LIMIT 3
    `,
    
    // Recent activity
    prisma.playHistory.count({
      where: {
        userId: targetUser.id,
        guildId: interaction.guild.id,
        playedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    })
  ]);

  // Get sound names for favorite sounds
  const soundIds = favoriteSounds.map(s => s.soundId);
  const soundNames = await prisma.sound.findMany({
    where: { id: { in: soundIds } },
    select: { id: true, name: true, person: true }
  });

  const favoriteSoundsText = favoriteSounds.map(stat => {
    const sound = soundNames.find(s => s.id === stat.soundId);
    return `**${sound?.name || 'Unknown'}** - ${stat._count.soundId} times`;
  }).join('\n') || 'No plays yet';

  const favoriteCategoriesText = (favoriteCategories as any[]).map(stat => 
    `**${stat.category}** - ${stat.plays} plays`
  ).join('\n') || 'No plays yet';

  const favoritePeopleText = (favoritePeople as any[]).map(stat => 
    `**${stat.person}** - ${stat.plays} plays`
  ).join('\n') || 'No plays yet';

  const isYourself = targetUser.id === interaction.user.id;
  const title = isYourself ? '📊 Your Statistics' : `📊 ${targetUser.displayName}'s Statistics`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0x00AE86)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: '🎵 Total Plays', value: totalPlays.toString(), inline: true },
      { name: '📅 Last 7 Days', value: recentPlays.toString(), inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '❤️ Favorite Sounds', value: favoriteSoundsText, inline: false },
      { name: '📂 Favorite Categories', value: favoriteCategoriesText, inline: true },
      { name: '👤 Favorite People', value: favoritePeopleText, inline: true }
    )
    .setFooter({ text: `Statistics for ${interaction.guild?.name}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const type = interaction.options.getString('type') || 'users';

  switch (type) {
    case 'users':
      await handleUserLeaderboard(interaction);
      break;
    case 'sounds':
      await handleSoundLeaderboard(interaction);
      break;
    case 'categories':
      await handleCategoryLeaderboard(interaction);
      break;
    case 'people':
      await handlePersonLeaderboard(interaction);
      break;
  }
}

async function handleUserLeaderboard(interaction: ChatInputCommandInteraction) {
  const userStats = await prisma.playHistory.groupBy({
    by: ['userId'],
    where: { guildId: interaction.guild!.id },
    _count: { userId: true },
    orderBy: { _count: { userId: 'desc' } },
    take: 10
  });

  if (userStats.length === 0) {
    await interaction.reply('📊 No user statistics available yet!');
    return;
  }

  let leaderboardText = '';
  for (let i = 0; i < userStats.length; i++) {
    const stat = userStats[i];
    try {
      const user = await interaction.client.users.fetch(stat.userId);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      leaderboardText += `${medal} **${user.displayName}** - ${stat._count.userId} plays\n`;
    } catch (error) {
      // User not found or left server
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      leaderboardText += `${medal} **Unknown User** - ${stat._count.userId} plays\n`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 Most Active Users')
    .setColor(0x00AE86)
    .setDescription(leaderboardText)
    .setFooter({ text: `Leaderboard for ${interaction.guild?.name}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleSoundLeaderboard(interaction: ChatInputCommandInteraction) {
  const soundStats = await prisma.$queryRaw`
    SELECT s.name, s.person, COUNT(*) as plays
    FROM play_history ph
    JOIN sounds s ON ph.soundId = s.id
    WHERE ph.guildId = ${interaction.guild!.id}
    GROUP BY s.id, s.name, s.person
    ORDER BY plays DESC
    LIMIT 10
  ` as any[];

  if (soundStats.length === 0) {
    await interaction.reply('📊 No sound statistics available yet!');
    return;
  }

  const leaderboardText = soundStats.map((stat, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    return `${medal} **${stat.name}** (${stat.person}) - ${stat.plays} plays`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🎵 Most Popular Sounds')
    .setColor(0x00AE86)
    .setDescription(leaderboardText)
    .setFooter({ text: `Leaderboard for ${interaction.guild?.name}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleCategoryLeaderboard(interaction: ChatInputCommandInteraction) {
  const categoryStats = await prisma.$queryRaw`
    SELECT s.category, COUNT(*) as plays
    FROM play_history ph
    JOIN sounds s ON ph.soundId = s.id
    WHERE ph.guildId = ${interaction.guild!.id}
    GROUP BY s.category
    ORDER BY plays DESC
  ` as any[];

  if (categoryStats.length === 0) {
    await interaction.reply('📊 No category statistics available yet!');
    return;
  }

  const leaderboardText = categoryStats.map((stat, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    return `${medal} **${stat.category}** - ${stat.plays} plays`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📂 Most Used Categories')
    .setColor(0x00AE86)
    .setDescription(leaderboardText)
    .setFooter({ text: `Leaderboard for ${interaction.guild?.name}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handlePersonLeaderboard(interaction: ChatInputCommandInteraction) {
  const personStats = await prisma.$queryRaw`
    SELECT s.person, COUNT(*) as plays
    FROM play_history ph
    JOIN sounds s ON ph.soundId = s.id
    WHERE ph.guildId = ${interaction.guild!.id}
    GROUP BY s.person
    ORDER BY plays DESC
  ` as any[];

  if (personStats.length === 0) {
    await interaction.reply('📊 No person statistics available yet!');
    return;
  }

  const leaderboardText = personStats.map((stat, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    return `${medal} **${stat.person}** - ${stat.plays} plays`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('👤 Most Popular People')
    .setColor(0x00AE86)
    .setDescription(leaderboardText)
    .setFooter({ text: `Leaderboard for ${interaction.guild?.name}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}