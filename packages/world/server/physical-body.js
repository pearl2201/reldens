/**
 *
 * Reldens - PlayerBody
 *
 * Extended the physics P2js Body to easily update the player state schema and get all bodies position updated
 * automatically.
 *
 */

const { Body, vec2 } = require('p2');
const { GameConst } = require('../../game/constants');

class PhysicalBody extends Body
{

    constructor(options)
    {
        super(options);
        this.bodyState = {};
        this.animationBasedOnPress = options.animationBasedOnPress;
        this.diagonalHorizontal = options.diagonalHorizontal;
        this.autoMoving = false;
        this.pathFinder = false;
        // default or initial direction:
        this.pressedDirection = GameConst.DOWN;
        this.currentCol = false;
        this.currentRow = false;
        this.originalCol = false;
        this.originalRow = false;
    }

    integrate(dt)
    {
        let minv = this.invMass,
            f = this.force,
            pos = this.position,
            velo = this.velocity;
        // save old position
        vec2.copy(this.previousPosition, this.position);
        this.previousAngle = this.angle;
        // velocity update
        if(!this.fixedRotation){
            this.angularVelocity += this.angularForce * this.invInertia * dt;
        }
        let integrate_fhMinv = vec2.create();
        vec2.scale(integrate_fhMinv, f, dt * minv);
        vec2.multiply(integrate_fhMinv, this.massMultiplier, integrate_fhMinv);
        vec2.add(velo, integrate_fhMinv, velo);
        // CCD
        if(!this.integrateToTimeOfImpact(dt)){
            let integrate_velodt = vec2.create();
            // regular position update
            vec2.scale(integrate_velodt, velo, dt);
            vec2.add(pos, pos, integrate_velodt);
            if(!this.fixedRotation){
                this.angle += this.angularVelocity * dt;
            }
        }
        if(this.autoMoving.length){
            this.speedToNext(pos);
        }
        if(this.bodyState){
            this.updateBodyState();
        }
        this.aabbNeedsUpdate = true;
    }

    speedToNext()
    {
        // @TODO: this can be improved but for now we can use the cols and rows to follow the path since it doesn't
        //   needs to be an exact method (it is not the user is choosing each point of the path to follow). In order to
        //   make it more accurate we need to use the position, but with the current configuration it will be also an
        //   approximation since there it has issues between the world step and the objects speed, where the position
        //   is passed in between steps.
        //   Additionally we still need to include the position fix for the cases where the moving object is bigger
        //   than a single tile.
        if(this.currentCol === this.autoMoving[0][0] && this.currentRow === this.autoMoving[0][1]){
            // if the point was reach then remove it to process the next one:
            this.autoMoving.shift();
            if(!this.autoMoving.length){
                // if there are no more points to process then stop the body and reset the path:
                this.velocity = [0, 0];
                this.resetAuto();
            }
        } else {
            if(this.currentCol === this.autoMoving[0][0] && this.velocity[0] !== 0){
                this.velocity[0] = 0;
            }
            if(this.currentCol > this.autoMoving[0][0]){
                this.initMove(GameConst.LEFT, true);
            }
            if(this.currentCol < this.autoMoving[0][0]){
                this.initMove(GameConst.RIGHT, true);
            }
            if(this.currentRow === this.autoMoving[0][1] && this.velocity[1] !== 0){
                this.velocity[1] = 0;
            }
            if(this.currentRow > this.autoMoving[0][1]){
                this.initMove(GameConst.UP, true);
            }
            if(this.currentRow < this.autoMoving[0][1]){
                this.initMove(GameConst.DOWN, true);
            }
            this.updateCurrentPoints();
        }
    }

    updateBodyState()
    {
        // update position:
        this.bodyState.x = this.position[0];
        this.bodyState.y = this.position[1];
        // start or stop animation:
        this.bodyState.mov = (this.velocity[0] !== 0 || this.velocity[1] !== 0);
    }

    resetAuto()
    {
        this.autoMoving = [];
    }

    initMove(direction, isAuto = false)
    {
        if(!isAuto){
            // if user moves the player then reset the auto move.
            this.resetAuto();
        }
        let speed = this.world.worldSpeed;
        if(this.world.allowSimultaneous){
            if(direction === GameConst.RIGHT){
                this.validateAndSetDirection(direction, this.diagonalHorizontal, this.velocity[1]);
                this.velocity[0] = speed;
            }
            if(direction === GameConst.LEFT){
                this.validateAndSetDirection(direction, this.diagonalHorizontal, this.velocity[1]);
                this.velocity[0] = -speed;
            }
            if(direction === GameConst.UP){
                this.validateAndSetDirection(direction, !this.diagonalHorizontal, this.velocity[0]);
                this.velocity[1] = -speed;
            }
            if(direction === GameConst.DOWN){
                this.validateAndSetDirection(direction, !this.diagonalHorizontal, this.velocity[0]);
                this.velocity[1] = speed;
            }
        } else {
            // if body is moving then avoid multiple key press at the same time:
            if(direction === GameConst.RIGHT && this.velocity[1] === 0){
                this.velocity[0] = speed;
            }
            if(direction === GameConst.LEFT && this.velocity[1] === 0){
                this.velocity[0] = -speed;
            }
            if(direction === GameConst.UP && this.velocity[0] === 0){
                this.velocity[1] = -speed;
            }
            if(direction === GameConst.DOWN && this.velocity[0] === 0){
                this.velocity[1] = speed;
            }
        }
    }

    validateAndSetDirection(direction, diagonal, velocity)
    {
        if(this.animationBasedOnPress){
            if(diagonal || velocity === 0){
                this.bodyState.dir = direction;
            }
        }
    }

    stopMove()
    {
        // stop by setting speed to zero:
        this.velocity = [0, 0];
    }

    moveToPoint(toPoint)
    {
        this.resetAuto();
        this.updateCurrentPoints();
        let fromPoints = [this.currentCol, this.currentRow];
        let toPoints = [toPoint.column, toPoint.row];
        this.autoMoving = this.getPathFinder().findPath(fromPoints, toPoints);
        return this.autoMoving;
    }

    updateCurrentPoints()
    {
        // if the player disconnects and it's the only one on the room the world would be destroyed at this point:
        if(!this.world){
            return;
        }
        let currentCol = Math.round(this.position[0] / this.worldWidth);
        currentCol = currentCol >= 0 ? currentCol : 0;
        let currentRow = Math.round(this.position[1] / this.worldHeight);
        currentRow = currentRow >= 0 ? currentRow : 0;
        if(!this.currentCol){
            this.originalCol = currentCol;
        }
        if(!this.currentRow){
            this.originalRow = currentRow;
        }
        this.currentCol = currentCol;
        this.currentRow = currentRow;
    }

    moveToOriginalPoint()
    {
        this.moveToPoint({column: this.originalCol, row: this.originalRow});
    }

    getPathFinder()
    {
        return (this.pathFinder ? this.pathFinder : this.world.pathFinder);
    }

    get worldWidth()
    {
        return this.world.mapJson.tilewidth;
    }

    get worldHeight()
    {
        return this.world.mapJson.tileheight;
    }

}

module.exports.PhysicalBody = PhysicalBody;