const { Client, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, version: djsVersion } = require('discord.js');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('View detailed system diagnostics, statistics, and information about the bot'),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        await interaction.deferReply();

        const memoryUsedMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalMemoryMB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const uptimeTimestamp = Math.floor((Date.now() - client.uptime) / 1000);
        const createdTimestamp = Math.floor(client.user.createdTimestamp / 1000);

        const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

        const embed = new EmbedBuilder()
            .setColor(client.color || '#5865F2')
            .setAuthor({ name: `${client.user.username} Overview`, iconURL: client.user.displayAvatarURL() })
            .setTitle(`🤖 System Information & Analytics`)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(`Serving **${totalMembers.toLocaleString()}** users across **${client.guilds.cache.size.toLocaleString()}** servers with high-speed response times.`)
            .addFields(
                {
                    name: '📊 Bot Statistics',
                    value: [
                        `**Tag:** ${client.user.tag}`,
                        `**ID:** \`${client.user.id}\``,
                        `**Latency:** \`${client.ws.ping}ms\``,
                        `**Uptime:** <t:${uptimeTimestamp}:R>`,
                        `**Created:** <t:${createdTimestamp}:D>`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '⚙️ System & Host',
                    value: [
                        `**RAM Usage:** \`${memoryUsedMB} MB / ${totalMemoryMB} GB\``,
                        `**Node.js:** \`${process.version}\``,
                        `**Discord.js:** \`v${djsVersion}\``,
                        `**OS Platform:** \`${os.type()} (${os.arch()})\``,
                        `**CPU Model:** \`${os.cpus()[0]?.model.split(' ')[0] || 'Unknown'}\``
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '📈 Guild & Cache Count',
                    value: [
                        `**Servers:** \`${client.guilds.cache.size.toLocaleString()}\``,
                        `**Total Members:** \`${totalMembers.toLocaleString()}\``,
                        `**Cached Channels:** \`${client.channels.cache.size.toLocaleString()}\``,
                        `**Custom Emojis:** \`${client.emojis.cache.size.toLocaleString()}\``
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        const inviteButton = new ButtonBuilder()
            .setLabel('Invite Bot')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);

        const actionRow = new ActionRowBuilder().addComponents(inviteButton);

        return interaction.editReply({ embeds: [embed], components: [actionRow] });
    }
};