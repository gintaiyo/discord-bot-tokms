const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel to prevent members from sending messages')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to lock (defaults to current channel)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for locking the channel')
                .setRequired(false)
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: 'You do not have permission to manage channels.', flags: MessageFlags.Ephemeral });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: 'I do not have permission to manage channel permissions.', flags: MessageFlags.Ephemeral });
        }

        const everyoneRole = interaction.guild.roles.everyone;
        const currentOverwrites = targetChannel.permissionOverwrites.cache.get(everyoneRole.id);

        if (currentOverwrites && currentOverwrites.deny.has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({ content: `<#${targetChannel.id}> is already locked.`, flags: MessageFlags.Ephemeral });
        }

        try {
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: false
            }, { reason: `${reason} | Locked by ${interaction.user.tag}` });

            const lockEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: `Channel Locked`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`🔒 Channel Access Restricted`)
                .setDescription(`This channel has been locked by a moderator. Members cannot send messages until it is unlocked.`)
                .addFields(
                    { name: '📍 Channel', value: `<#${targetChannel.id}>`, inline: true },
                    { name: '🛠️ Moderator', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📝 Reason', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false }
                )
                .setTimestamp();

            await targetChannel.send({ embeds: [lockEmbed] });

            if (targetChannel.id === interaction.channel.id) {
                return interaction.reply({ content: '🔒 Channel successfully locked.', flags: MessageFlags.Ephemeral });
            } else {
                return interaction.reply({ content: `🔒 Successfully locked <#${targetChannel.id}>.`, flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            console.error('Lock error:', error);
            return interaction.reply({ content: 'Failed to lock the channel. Please check my role hierarchy and permissions.', flags: MessageFlags.Ephemeral });
        }
    }
};