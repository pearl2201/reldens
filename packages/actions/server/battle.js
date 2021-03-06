/**
 *
 * Reldens - Battle
 *
 * Battle logic handler.
 *
 */

const { Logger } = require('@reldens/utils');
const { ActionsConst } = require('../constants');
const { GameConst } = require('../../game/constants');

class Battle
{

    constructor(props)
    {
        // the same player can be in battle with multiple bodies:
        this.inBattleWith = {};
        // @NOTE: set the battleTimeOff = false will disable the battle mode timer. Battle mode can be use to implement
        // specific behaviors.
        this.battleTimeOff = props.battleTimeOff || false;
        this.battleTimer = false;
        this.timerType = props.timerType || ActionsConst.BATTLE_TYPE_PER_TARGET;
        this.lastAttack = false;
        this.lastAttackKey = false;
    }

    // eslint-disable-next-line no-unused-vars
    async runBattle(playerSchema, target, room)
    {
        // @NOTE: each attack will have different properties to validate like range, delay, etc.
        let currentAction = this.getCurrentAction(playerSchema);
        if(!currentAction){
            Logger.error(['Actions not defined for this player.', 'ID:', playerSchema.player_id]);
            return false;
        }
        currentAction.currentBattle = this;
        this.lastAttackKey = currentAction.key;
        let executeResult = await currentAction.execute(target);
        // include the target in the battle list:
        this.lastAttack = Date.now();
        this.inBattleWith[target.id] = {target: target, time: this.lastAttack, battleTimer: false};
        let useTimerObj = this; // ActionsConst.BATTLE_TYPE_GENERAL
        if(this.timerType === ActionsConst.BATTLE_TYPE_PER_TARGET){
            useTimerObj = this.inBattleWith[target.id];
        }
        this.setTimerOn(useTimerObj, target);
        playerSchema.currentAction = false; // reset action.
        return executeResult;
    }

    getCurrentAction(playerSchema)
    {
        return playerSchema.actions[playerSchema.currentAction] ?
            playerSchema.actions[playerSchema.currentAction] :
            playerSchema.skillsServer.classPath.currentSkills[playerSchema.currentAction];
    }

    setTimerOn(useTimerObj, target)
    {
        if(useTimerObj.battleTimer){
            clearTimeout(useTimerObj.battleTimer);
        }
        if(this.battleTimeOff){
            useTimerObj.battleTimer = setTimeout(() => {
                delete this.inBattleWith[target.id];
            }, this.battleTimeOff);
        }
    }

    async updateTargetClient(targetClient, targetSchema, attackerId, room)
    {
        let affectedProperty = room.config.get('client/actions/skills/affectedProperty');
        if(targetSchema.stats[affectedProperty] === 0){
            targetSchema.inState = GameConst.STATUS.DEATH;
            let actionData = {
                act: ActionsConst.BATTLE_ENDED,
                x: targetSchema.state.x,
                y: targetSchema.state.y,
                t: targetSchema.sessionId,
                k: this.lastAttackKey
            };
            room.broadcast(actionData);
            await room.savePlayerState(targetSchema.sessionId);
            room.send(targetClient, {act: GameConst.GAME_OVER});
            await room.savePlayerStats(targetSchema, targetClient);
            setTimeout(async () => {
                targetSchema.inState = GameConst.STATUS.ACTIVE;
                // player is dead! reinitialize the stats using it's base value:
                targetSchema.stats[affectedProperty] = targetSchema.statsBase[affectedProperty];
                await room.savePlayerStats(targetSchema, targetClient);
                room.send(targetClient, {act: GameConst.REVIVED});
            }, (room.config.get('server/players/gameOver/timeOut') || 1));
            return false;
        } else {
            await room.savePlayerStats(targetSchema, targetClient);
            return true;
        }
    }

}

module.exports.Battle = Battle;
