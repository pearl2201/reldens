/**
 *
 * Reldens - ScenePreloader
 *
 * This class extends Phaser Scene to preload all the required assets, generate the UI and assign the actions.
 *
 */

const { Scene, Geom } = require('phaser');
const { Logger, sc } = require('@reldens/utils');
const { GameConst } = require('../constants');
const { EventsManagerSingleton } = require('@reldens/utils');

class ScenePreloader extends Scene
{

    constructor(props)
    {
        super({key: props.name});
        this.holdTimer = null;
        this.progressBar = null;
        this.progressCompleteRect = null;
        this.progressRect = null;
        this.objectsUi = {};
        this.userInterfaces = {};
        this.preloaderName = props.name;
        this.preloadMapKey = props.map;
        this.preloadImages = props.images;
        this.uiScene = props.uiScene;
        this.elementsUi = {};
        this.gameManager = props.gameManager;
        this.preloadAssets = props.preloadAssets;
        let currentScene = this.gameManager.activeRoomEvents.getActiveScene();
        currentScene.objectsAnimationsData = props.objectsAnimationsData;
    }

    preload()
    {
        // @NOTE: this event run once for each scene.
        let eventUiScene = this.uiScene ? this : this.gameManager.gameEngine.uiScene;
        EventsManagerSingleton.emit('reldens.beforePreload', this, eventUiScene);
        if(this.uiScene){
            // @NOTE: the events here run only once over all the game progress.
            EventsManagerSingleton.emit('reldens.beforePreloadUiScene', this);
            // ui elements:
            if(this.gameManager.config.get('client/ui/playerName/enabled')){
                this.load.html('uiPlayer', 'assets/html/ui-player.html');
            }
            if(this.gameManager.config.get('client/ui/controls/enabled')){
                this.load.html('uiControls', 'assets/html/ui-controls.html');
            }
            if(this.gameManager.config.get('client/ui/sceneLabel/enabled')){
                this.load.html('sceneLabel', 'assets/html/ui-scene-label.html');
            }
            // @TODO - BETA.17: move everything related to player stats into the users pack or create a new pack.
            if(this.gameManager.config.get('client/ui/playerStats/enabled')){
                this.load.html('uiPlayerStats', 'assets/html/ui-player-stats.html');
                this.load.html('playerStat', 'assets/html/player-stat.html');
            }
            this.load.html('uiTarget', 'assets/html/ui-target.html');
            this.load.html('uiOptionButton', 'assets/html/ui-option-button.html');
            this.load.html('uiOptionIcon', 'assets/html/ui-option-icon.html');
            this.load.html('uiOptionsContainer', 'assets/html/ui-options-container.html');
            EventsManagerSingleton.emit('reldens.preloadUiScene', this);
        }
        // maps:
        if(this.preloadMapKey){
            this.load.tilemapTiledJSON(this.preloadMapKey, `assets/maps/${this.preloadMapKey}.json`);
        }
        // @TODO - BETA.17 - TEST: test a multiple tiles images case.
        // map tiles images:
        if(this.preloadImages){
            // @NOTE: we need the preloadImages and tile data here because the JSON map file is not loaded yet.
            let tileData = {
                frameWidth: this.gameManager.config.get('client/general/tileData/width') || 16,
                frameHeight: this.gameManager.config.get('client/general/tileData/height') || 16,
                margin: this.gameManager.config.get('client/general/tileData/margin') || 1,
                spacing: this.gameManager.config.get('client/general/tileData/spacing') || 2
            };
            let files = this.preloadImages.split(',');
            for(let imageFile of files){
                let filePath = `assets/maps/${imageFile}.png`;
                this.load.spritesheet(imageFile, filePath, tileData);
            }
        }
        // preload objects assets:
        if(this.preloadAssets){
            for(let asset of this.preloadAssets){
                if(asset.asset_type === 'spritesheet'){
                    let assetFilePath = `assets/custom/sprites/${asset.file_1}.png`;
                    let assetParams = asset.extra_params ? JSON.parse(asset.extra_params) : false;
                    if(assetParams){
                        this.load.spritesheet(asset.asset_key, assetFilePath, assetParams);
                    } else {
                        Logger.error(['Missing spritesheet params:', asset]);
                    }
                }
            }
        }
        let playerSpriteSize = {
            frameWidth: this.gameManager.config.get('client/players/size/width') || 52,
            frameHeight: this.gameManager.config.get('client/players/size/height') || 71
        };
        // @TODO - BETA.17: implement player custom avatar.
        // this.load.spritesheet(this.username, 'assets/sprites/'+this.username+'.png', playerSpriteSize);
        this.load.spritesheet(GameConst.IMAGE_PLAYER, 'assets/sprites/player-1.png', playerSpriteSize);
        // @TODO - BETA.16 - R16-1b: replace these by skills related if available otherwise these will be configurable
        //   from the storage.
        this.load.spritesheet(GameConst.ATTACK, 'assets/sprites/weapons-1.png', {frameWidth: 64, frameHeight: 64});
        this.load.spritesheet(GameConst.HIT, 'assets/sprites/impact-1.png', {frameWidth: 64, frameHeight: 64});
        this.load.spritesheet(GameConst.DEATH, 'assets/sprites/object-1.png', {frameWidth: 64, frameHeight: 64});
        this.load.spritesheet(GameConst.BULLET, 'assets/sprites/earth-1.png', {frameWidth: 64, frameHeight: 64});
        if(this.gameManager.config.get('client/ui/pointer/show')){
            let pointerData = {frameWidth: 32, frameHeight: 32};
            this.load.spritesheet(GameConst.ARROW_DOWN, 'assets/sprites/arrow-w-down.png', pointerData);
        }
        // interface assets:
        this.load.image(GameConst.ICON_STATS, 'assets/icons/book.png');
        this.load.on('fileprogress', this.onFileProgress, this);
        this.load.on('progress', this.onLoadProgress, this);
        this.load.on('complete', this.onLoadComplete, this);
        this.configuredFrameRate = this.gameManager.config.get('client/general/animations/frameRate') || 10;
        this.createProgressBar();
    }

    create()
    {
        // @NOTE: this event run once for each scene.
        let eventUiScene = this.uiScene ? this : this.gameManager.gameEngine.uiScene;
        EventsManagerSingleton.emit('reldens.createPreload', this, eventUiScene);
        if(this.uiScene){
            // @NOTE: the events here run only once over all the game progress.
            EventsManagerSingleton.emit('reldens.beforeCreateUiScene', this);
            // create uiPlayer:
            let playerUi = this.getUiConfig('playerName');
            if(playerUi.enabled){
                this.uiPlayer = this.add.dom(playerUi.uiX, playerUi.uiY).createFromCache('uiPlayer');
                // logout:
                let logoutButton = this.uiPlayer.getChildByProperty('id', 'logout');
                logoutButton.addEventListener('click', () => {
                    if(this.gameManager.firebase.isActive){
                        this.gameManager.firebase.app.auth().signOut();
                    }
                    window.location.reload();
                });
                // @TODO: TEMPORAL, replace references by this.
                this.elementsUi['playerName'] = this.uiPlayer;
            }
            // create uiTarget:
            let targetUi = this.getUiConfig('uiTarget');
            if(targetUi.enabled){
                this.uiTarget = this.add.dom(targetUi.uiX, targetUi.uiY).createFromCache('uiTarget');
                let closeButton = this.uiTarget.getChildByProperty('className', 'close-target');
                closeButton.addEventListener('click', () => {
                    this.gameManager.gameEngine.clearTarget();
                });
            }
            // create ui sceneLabel:
            let sceneLabelUi = this.getUiConfig('sceneLabel');
            if(sceneLabelUi.enabled){
                this.elementsUi['sceneLabel'] = this.add.dom(sceneLabelUi.uiX, sceneLabelUi.uiY)
                    .createFromCache('sceneLabel');
            }
            // create uiControls:
            let controlsUi = this.getUiConfig('controls');
            if(controlsUi.enabled){
                this.uiControls = this.add.dom(controlsUi.uiX, controlsUi.uiY).createFromCache('uiControls');
                this.registerControllers(this.uiControls);
                // @TODO: TEMPORAL, replace references by this.
                this.elementsUi['controls'] = this.uiControls;
            }
            // create uiPlayerStats:
            let statsUi = this.getUiConfig('playerStats');
            if(statsUi.enabled){
                this.uiPlayerStats = this.add.dom(statsUi.uiX, statsUi.uiY).createFromCache('uiPlayerStats');
                let closeButton = this.uiPlayerStats.getChildByProperty('id', 'player-stats-close');
                let openButton = this.uiPlayerStats.getChildByProperty('id', 'player-stats-open');
                if(closeButton && openButton){
                    closeButton.addEventListener('click', () => {
                        let box = this.uiPlayerStats.getChildByProperty('id', 'player-stats-ui');
                        box.style.display = 'none';
                        openButton.style.display = 'block';
                        this.uiPlayerStats.setDepth(1);
                    });
                    openButton.addEventListener('click', () => {
                        let box = this.uiPlayerStats.getChildByProperty('id', 'player-stats-ui');
                        box.style.display = 'block';
                        openButton.style.display = 'none';
                        this.uiPlayerStats.setDepth(4);
                    });
                }
                // @TODO: TEMPORAL, replace references by this.
                this.elementsUi['playerStats'] = this.uiPlayerStats;
            }
            // end event:
            EventsManagerSingleton.emit('reldens.createUiScene', this);
        }
        // player animations:
        this.createPlayerAnimations();
    }

    getUiConfig(uiName, newWidth, newHeight)
    {
        let {uiX, uiY} = this.getUiPosition(uiName, newWidth, newHeight);
        return {
            enabled: this.gameManager.config.get('client/ui/'+uiName+'/enabled'),
            uiX: uiX,
            uiY: uiY
        }
    }

    getUiPosition(uiName, newWidth, newHeight)
    {
        let uiX = this.gameManager.config.get('client/ui/'+uiName+'/x');
        let uiY = this.gameManager.config.get('client/ui/'+uiName+'/y');
        if(this.gameManager.config.get('client/ui/screen/responsive')){
            let rX = this.gameManager.config.get('client/ui/'+uiName+'/responsiveX');
            let rY = this.gameManager.config.get('client/ui/'+uiName+'/responsiveY');
            if(!newWidth){
                newWidth = this.gameManager.gameDom.getElement('.game-container').width();
            }
            if(!newHeight){
                newHeight = this.gameManager.gameDom.getElement('.game-container').height();
            }
            uiX = rX ? rX * newWidth / 100 : 0;
            uiY = rY ? rY * newHeight / 100 : 0;
        }
        return {uiX, uiY};
    }

    createPlayerAnimations()
    {
        // @TODO:
        //   - All the animations will be part of the configuration in the database.
        //   - Implement player custom avatar.
        let availableAnimations = [
            {k: GameConst.LEFT, img: GameConst.IMAGE_PLAYER, start: 3, end: 5, repeat: -1, hide: false},
            {k: GameConst.RIGHT, img: GameConst.IMAGE_PLAYER, start: 6, end: 8, repeat: -1, hide: false},
            {k: GameConst.UP, img: GameConst.IMAGE_PLAYER, start: 9, end: 11, repeat: -1, hide: false},
            {k: GameConst.DOWN, img: GameConst.IMAGE_PLAYER, start: 0, end: 2, repeat: -1, hide: false},
            {k: GameConst.ATTACK, img: GameConst.ATTACK, start: 25, end: 29, repeat: 0},
            {k: GameConst.HIT, img: GameConst.HIT, start:17, end: 19, repeat: 0},
            {k: GameConst.DEATH, img: GameConst.DEATH, start: 10, end: 11, repeat: 0, rate: 1},
            {k: GameConst.BULLET, img: GameConst.BULLET, start: 1, end: 2, repeat: -1, rate: 1}
        ];
        if(this.gameManager.config.get('client/ui/pointer/show')){
            let arrowAnim = {k: GameConst.ARROW_DOWN, img: GameConst.ARROW_DOWN, start: 1, end: 4, repeat: 3, rate: 6};
            availableAnimations.push(arrowAnim);
        }
        for(let anim of availableAnimations){
            this.anims.create({
                key: anim.k,
                frames: this.anims.generateFrameNumbers(anim.img, {start: anim.start, end: anim.end}),
                frameRate: {}.hasOwnProperty.call(anim, 'rate') ? anim.rate : this.configuredFrameRate,
                repeat: anim.repeat,
                hideOnComplete: {}.hasOwnProperty.call(anim, 'hide') ? anim.hide : true,
            });
        }
    }

    registerControllers(controllersBox)
    {
        // @TODO: controllers will be part of the configuration in the database.
        this.setupDirButtonInBox(GameConst.UP, controllersBox);
        this.setupDirButtonInBox(GameConst.DOWN, controllersBox);
        this.setupDirButtonInBox(GameConst.LEFT, controllersBox);
        this.setupDirButtonInBox(GameConst.RIGHT, controllersBox);
        this.setupActionButtonInBox(GameConst.ACTION, controllersBox);
        this.setupActionButtonInBox(GameConst.BULLET, controllersBox);
    }

    setupDirButtonInBox(dir, box)
    {
        let btn = box.getChildByProperty('id', dir);
        if(btn){
            this.hold(btn, {dir: dir});
        }
    }

    setupActionButtonInBox(action, box)
    {
        let btnBullet = box.getChildByProperty('id', action);
        if(btnBullet){
            if(this.gameManager.config.get('client/general/controls/action_button_hold')){
                this.hold(btnBullet, action);
            } else {
                btnBullet.addEventListener('click', () => {
                    let currentScene = this.gameManager.activeRoomEvents.getActiveScene();
                    let dataSend = {
                        act: GameConst.ACTION,
                        target: currentScene.player.currentTarget,
                        type: action
                    };
                    this.gameManager.activeRoomEvents.room.send(dataSend);
                });
            }
        }
    }

    hold(button, action)
    {
        button.addEventListener('mousedown', (event) => {
            this.startHold(event, button, action);
        });
        button.addEventListener('mouseup', (event) => {
            this.endHold(event, button);
        });
        button.addEventListener('mouseout', (event) => {
            this.endHold(event, button);
        });
        button.addEventListener('touchstart', (event) => {
            this.startHold(event, button, action);
        });
        button.addEventListener('touchend', (event) => {
            this.endHold(event, button);
        });
    }

    startHold(event, button, action)
    {
        event.preventDefault();
        button.style.opacity = '1';
        let currentScene = this.gameManager.activeRoomEvents.getActiveScene();
        let dataSend = action;
        // @TODO: temporal until we make buttons fully configurable.
        if(!{}.hasOwnProperty.call(action, 'dir')){
            dataSend = {
                act: action,
                target: currentScene.player.currentTarget,
                type: GameConst.ACTION
            };
        }
        this.repeatHold(dataSend);
    }

    endHold(event, button)
    {
        event.preventDefault();
        // @TODO: remove, make configurable.
        button.style.opacity = '0.8';
        clearTimeout(this.holdTimer);
        this.gameManager.activeRoomEvents.room.send({act: GameConst.STOP});
    }

    repeatHold(sendData)
    {
        this.gameManager.activeRoomEvents.room.send(sendData);
        this.holdTimer = setTimeout(() => { this.repeatHold(sendData); }, (this.timeout || 0));
    }

    createProgressBar()
    {
        let Rectangle = Geom.Rectangle;
        let main = Rectangle.Clone(this.cameras.main);
        this.progressRect = new Rectangle(0, 0, main.width / 2, 50);
        Rectangle.CenterOn(this.progressRect, main.centerX, main.centerY);
        this.progressCompleteRect = Geom.Rectangle.Clone(this.progressRect);
        this.progressBar = this.add.graphics();
        let width = this.cameras.main.width;
        let height = this.cameras.main.height;
        // @TODO: fonts and messages has to be part of the configuration in the database.
        let loadingFont = this.gameManager.config.get('client/ui/loading/font');
        let loadingFontSize = this.gameManager.config.get('client/ui/loading/fontSize');
        let loadingAssetsSize = this.gameManager.config.get('client/ui/loading/assetsSize');
        this.loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            fontFamily: loadingFont,
            fontSize: loadingFontSize
        });
        this.loadingText.setOrigin(0.5, 0.5);
        this.loadingText.setFill(this.gameManager.config.get('client/ui/loading/loadingColor'));
        this.percentText = this.add.text(width / 2, height / 2 - 5, '0%', {
            fontFamily: loadingFont,
            fontSize: loadingAssetsSize
        });
        this.percentText.setOrigin(0.5, 0.5);
        this.percentText.setFill(this.gameManager.config.get('client/ui/loading/percentColor'));
        this.assetText = this.add.text(width / 2, height / 2 + 50, '', {
            fontFamily: loadingFont,
            fontSize: loadingAssetsSize
        });
        this.assetText.setFill(this.gameManager.config.get('client/ui/loading/assetsColor'));
        this.assetText.setOrigin(0.5, 0.5);
    }

    onLoadComplete()
    {
        for(let child of this.children.list){
            child.destroy();
        }
        this.loadingText.destroy();
        this.assetText.destroy();
        this.percentText.destroy();
        this.scene.shutdown();
    }

    onFileProgress(file)
    {
        if(this.gameManager.config.get('client/ui/loading/showAssets')){
            this.assetText.setText('Loading asset: '+file.key);
        }
    }

    onLoadProgress(progress)
    {
        let progressText = parseInt(progress * 100) + '%';
        this.percentText.setText(progressText);
        let color = (0xffffff);
        let fillColor = (0x222222);
        this.progressRect.width = progress * this.progressCompleteRect.width;
        this.progressBar
            .clear()
            .fillStyle(fillColor)
            .fillRectShape(this.progressCompleteRect)
            .fillStyle(color)
            .fillRectShape(this.progressRect);
    }

    getUiElement(uiName)
    {
        if(!sc.hasOwn(this.elementsUi, uiName)){
            Logger.error(['UI not found:', uiName]);
            return false;
        }
        return this.elementsUi[uiName];
    }


}

module.exports.ScenePreloader = ScenePreloader;
