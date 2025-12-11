const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild || message.author.bot) return;

    const guildData = await client.AfkCollection.findOne({ _id: message.guild.id });
    if (!guildData) return;

    const afkMembers = guildData.members || {};
    const userId = message.author.id;

    // If author was AFK
    if (afkMembers.has(userId)) {
      const afkUser = afkMembers.get(userId);

      const embed = new EmbedBuilder()
        .setTitle('👋 Welcome back!')
        .setDescription(`${message.author} has returned from AFK.`)
        .setColor('Purple')
        .addFields(
          { name: '📝 Reason', value: afkUser.reason, inline: true },
          { name: '⏱ Since', value: `<t:${afkUser.timestamp}:R>`, inline: true }
        );

      if (afkUser.last_pings?.length) {
        let pingText = afkUser.last_pings
          .map((p, i) => `${i + 1}. **${p.ping_author}** at <t:${p.timestamp}:R>: [Jump to message](${p.message_link})`)
          .join('\n');
        embed.addFields({ name: '📌 Last pings while AFK', value: pingText });
      }

      await message.channel.send({ embeds: [embed] });

      // Remove AFK
      afkMembers.delete(userId);
      guildData.members = afkMembers;
      await guildData.save();

      return;
    }

    // Track mentions of AFK members
    for (const [id, user] of message.mentions.users) {
      if (!afkMembers.has(id)) continue;
      const afkUser = afkMembers.get(id);

      afkUser.last_pings = afkUser.last_pings || [];
      afkUser.last_pings.push({
        ping_author: message.author.username,
        message_content: message.content.slice(0, 80),
        message_link: message.url,
        timestamp: Math.floor(Date.now() / 1000)
      });
      afkUser.last_pings = afkUser.last_pings.slice(-3);

      guildData.members.set(id, afkUser);
      await guildData.save();

      const mentionEmbed = new EmbedBuilder()
        .setDescription(`⚠️ **${user.username}** is currently AFK.\n📝 Reason: **${afkUser.reason}**\n⏱ Since: <t:${afkUser.timestamp}:R>`)
        .setColor('Orange');

      await message.channel.send({ embeds: [mentionEmbed] });
    }
  }
};
