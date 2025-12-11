const cooldowns = new Map();

/**
 * @param {String} userId 
 * @param {String} commandName 
 * @param {Number} cooldownTime Seconds
 */
function checkCooldown(userId, commandName, cooldownTime) {
    const key = `${userId}-${commandName}`;

    const now = Date.now();
    const existing = cooldowns.get(key);

    if (existing && now < existing) {
        const remaining = Math.ceil((existing - now) / 1000);
        return remaining; // user still on cooldown
    }

    cooldowns.set(key, now + cooldownTime * 1000);
    return 0; // no cooldown
}

module.exports = { checkCooldown };
