const { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a previously locked channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to unlock (defaults to current channel)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for unlocking the channel')
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

        if (!currentOverwrites || !currentOverwrites.deny.has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({ content: `<#${targetChannel.id}> is not currently locked.`, flags: MessageFlags.Ephemeral });
        }

        try {
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null
            }, { reason: `${reason} | Unlocked by ${interaction.user.tag}` });

            const unlockEmbed = new EmbedBuilder()
                .setColor('#00ff2a')
                .setAuthor({ name: `Channel Unlocked`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`🔓 Channel Access Restored`)
                .setDescription(`This channel has been unlocked. Members may resume chatting.`)
                .addFields(
                    { name: '📍 Channel', value: `<#${targetChannel.id}>`, inline: true },
                    { name: '🛠️ Moderator', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📝 Reason', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false }
                )
                .setTimestamp();

            await targetChannel.send({ embeds: [unlockEmbed] });

            if (targetChannel.id === interaction.channel.id) {
                return interaction.reply({ content: '🔓 Channel successfully unlocked.', flags: MessageFlags.Ephemeral });
            } else {
                return interaction.reply({ content: `🔓 Successfully unlocked <#${targetChannel.id}>.`, flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            console.error('Unlock error:', error);
            return interaction.reply({ content: 'Failed to unlock the channel. Please check my role hierarchy and permissions.', flags: MessageFlags.Ephemeral });
        }
    }
};