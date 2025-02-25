"use strict";
/*!
 * contentstack-sync-asset-store-filesystem
 * copyright (c) Contentstack LLC
 * MIT Licensed
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};


Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("debug");
const fs_1 = require("fs");
const lodash_1 = require("lodash");
const mkdirp_1 = __importDefault(require("mkdirp"));
const path_1 = require("path");
const request_1 = __importDefault(require("request"));
const rimraf_1 = __importDefault(require("rimraf"));
const index_1 = require("./index");
const utils_1 = require("./utils");
const debug = debug_1.debug('asset-store-filesystem');
let assetSdkS3;
const pathUploadToS3Module = "../../../../assetSdkS3.js";
const EVENTS = {
    DELETED: "DELETED",
    DOWNLOADED: "DOWNLOADED"
};

if (fs_1.existsSync(path_1.join(__dirname, pathUploadToS3Module))) {
    assetSdkS3 = require(pathUploadToS3Module);
}

console.log({assetSdkS3});

/**
 * @class
 * @private
 * @summary Class that downloads and deletes assets from FS DB
 * @example
 * const assetStore = new FSAssetStore(config)
 * return assetStore.download(asset)
 *  .then()
 *  .catch()
 * @returns {FSAssetStore}
 */
class FSAssetStore {
    constructor(config) {
        this.config = config.assetStore;
    }
    /**
     * @public
     * @method download
     * @description Downloads the asset object onto local fs
     * @param  {object} asset Asset object details
     * @returns {Promise} returns the asset object, if successful.
     */
    download(asset) {
        debug('Asset download invoked ' + JSON.stringify(asset));
        return new Promise((resolve, reject) => {
            try {
                utils_1.validatePublishAsset(asset);
                return request_1.default.get({
                    url: encodeURI(asset.url),
                })
                    .on('response', (resp) => {
                    if (resp.statusCode === 200) {
                        if (asset.hasOwnProperty('download_id')) {
                            const attachment = resp.headers['content-disposition'];
                            asset.filename = decodeURIComponent(attachment.split('=')[1]);
                        }
                        asset._internal_url = index_1.getAssetLocation(asset, this.config);
                        const filePathArray = index_1.getFileLocation(asset, this.config);
                        const folderPathArray = lodash_1.cloneDeep(filePathArray);
                        folderPathArray.splice(folderPathArray.length - 1);
                        const folderPath = path_1.resolve(path_1.join.apply(this, folderPathArray));
                        const filePath = path_1.resolve(path_1.join.apply(this, filePathArray));
                        if (!fs_1.existsSync(folderPath)) {
                            mkdirp_1.default.sync(folderPath, '0755');
                        }
                        const localStream = fs_1.createWriteStream(filePath);
                        resp.pipe(localStream);
                        localStream.on('close', () => {
                            if(assetSdkS3){
                                assetSdkS3({
                                    type: EVENTS.DOWNLOADED,
                                    filePath: filePath,
                                    asset
                                })
                            }
                            return resolve(asset);
                        });
                    }
                    else {
                        return reject(`Failed to download asset ${JSON.stringify(asset)}`);
                    }
                })
                    .on('error', reject)
                    .end();
            }
            catch (error) {
                debug(`${asset.uid} asset download failed`);
                return reject(error);
            }
        });
    }
    /**
     * @private
     * @method delete
     * @description Delete the asset from fs db
     * @param {array} assets Assets to be deleted
     * @returns {Promise} returns the asset object, if successful.
     */
    delete(assets) {
        debug('Asset deletion called for', JSON.stringify(assets));
        const asset = assets[0];
        return new Promise((resolve, reject) => {
            try {
                utils_1.validateUnPublishAsset(asset);
                const folderPathArray = index_1.getFileLocation(asset, this.config);
                folderPathArray.splice(folderPathArray.length - 1, 1);
                const folderPath = path_1.resolve(path_1.join.apply(this, folderPathArray));
                if (fs_1.existsSync(folderPath)) {
                    return rimraf_1.default(folderPath, (error) => {
                        if (error) {
                            debug(`Error while removing ${folderPath} asset file`);
                            return reject(error);
                        }
                        if(assetSdkS3){
                            assetSdkS3({
                                type: EVENTS.DELETED,
                                folderPath,
                                asset
                            });
                        }
                        return resolve(asset);
                    });
                }
                else {
                    debug(`${folderPath} did not exist!`);
                    return resolve(asset);
                }
            }
            catch (error) {
                return reject(error);
            }
        });
    }
    /**
     * @private
     * @method unpublish
     * @description Unpublish the asset from filesystem
     * @param  {object} asset Asset to be unpublished
     * @returns {Promise} returns the asset object, if successful.
     */
    unpublish(asset) {
        debug(`Asset unpublish called ${JSON.stringify(asset)}`);
        return new Promise((resolve, reject) => {
            try {
                utils_1.validateUnPublishAsset(asset);
                const filePathArray = index_1.getFileLocation(asset, this.config);
                const filePath = path_1.resolve(path_1.join.apply(this, filePathArray));
                if (fs_1.existsSync(filePath)) {
                    return rimraf_1.default(filePath, (error) => {
                        if (error) {
                            debug(`Error while removing ${filePath} asset file`);
                            return reject(error);
                        }
                        return resolve(asset);
                    });
                }
                debug(`${filePath} did not exist!`);
                return resolve(asset);
            }
            catch (error) {
                return reject(error);
            }
        });
    }
}
exports.FSAssetStore = FSAssetStore;
exports.EVENTS = EVENTS;
