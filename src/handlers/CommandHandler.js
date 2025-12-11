const { Client } = require('discord.js')

/**
 * @param { Client } client
 */
function loadCommands(client) {
    const ascii = require('ascii-table')
    const fs = require('fs')
    const table = new ascii().setHeading("Commands", "Type", "Status")

    let commandsArray = [];
    let developerArray = [];

    const commandsFolder = fs.readdirSync("./src/types/commands");
    /* Loop through all folders in './src/types/commands' and get the javascript files */
    for(const folder of commandsFolder) {
        const commandFiles = fs.readdirSync(`./src/types/commands/${folder}/`)
        .filter((file) => file.endsWith('.js'));

        for(const file of commandFiles) {
            const commandFile = require(`../types/commands/${folder}/${file}`);

            client.commands.set(commandFile.data.name, commandFile);

            /* Add Command Data to the commandsArray */
            if(commandFile.developer) developerArray.push(commandFile.data.toJSON())
            else commandsArray.push(commandFile.data.toJSON());

            table.addRow(file, folder, '✅');
            continue;
        }
    }

    /* Set the commands in Discord */
    client.application.commands.set(commandsArray);

    

    return console.log(table.toString());
}

module.exports = { loadCommands }