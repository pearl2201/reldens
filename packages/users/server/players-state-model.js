/**
 *
 * Reldens - PlayerStateModel
 *
 * Players state storage model, this class will load, add, edit, delete the values in the storage.
 *
 */

const { ModelClass } = require('@reldens/storage');

class PlayersStateModel extends ModelClass
{

    static get tableName()
    {
        return 'players_state';
    }

    static get relationMappings()
    {
        const { PlayersModel } = require('./players-model');
        return {
            parent_player: {
                relation: ModelClass.BelongsToOneRelation,
                modelClass: PlayersModel,
                join: {
                    from: 'players_state.player_id',
                    to: 'players.id'
                }
            }
        }
    }

}

module.exports.PlayersStateModel = PlayersStateModel;
