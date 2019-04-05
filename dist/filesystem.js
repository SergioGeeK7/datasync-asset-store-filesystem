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
const mkdirp_1 = __importDefault(require("mkdirp"));
const path_1 = __importDefault(require("path"));
const request_1 = __importDefault(require("request"));
const rimraf_1 = __importDefault(require("rimraf"));
const lodash_1 = require("lodash");
const debug = debug_1.debug('asset-store-filesystem');
class FsManager {
    constructor(assetConfig) {
        assetConfig.assetStore.keys = this.patternInterpretation(assetConfig.assetStore);
        this.assetConfig = assetConfig;
    }
    /**
     * @description to download the acutal asset and store it in fileystem
     * @param  {object} assetData: asset data
     */
    download(assetData) {
        debug('Asset download called for', assetData);
        return new Promise((resolve, reject) => {
            try {
                const assetBasePath = this.assetConfig.assetStore.baseDir;
                const asset = assetData.data;
                request_1.default.get({ url: encodeURI(asset.url) }).on('response', (resp) => {
                    if (resp.statusCode === 200) {
                        if (asset.hasOwnProperty('download_id')) {
                            let attachment = resp.headers['content-disposition'];
                            asset.filename = decodeURIComponent(attachment.split('=')[1]);
                        }
                        const paths = this.extractFolderPaths(assetData);
                        const filePath = path_1.default.join(assetBasePath, assetData.locale, path_1.default.join.apply(null, paths));
                        asset._internal_url = path_1.default.join(assetData.locale, path_1.default.join.apply(null, paths));
                        const folderPath = filePath.replace(asset.filename, '');
                        if (!fs_1.existsSync(folderPath)) {
                            mkdirp_1.default.sync(folderPath, '0755');
                        }
                        if (!fs_1.existsSync(filePath)) {
                            const localStream = fs_1.createWriteStream(path_1.default.join(folderPath, asset.filename));
                            resp.pipe(localStream);
                            localStream.on('close', () => {
                                return resolve(assetData);
                            });
                        }
                        else {
                            debug(`Skipping asset download since it is already downloaded and it's present path is ${filePath} `);
                            return resolve(assetData);
                        }
                    }
                    else {
                        return reject(`${asset.uid} Asset download failed`);
                    }
                })
                    .on('error', reject)
                    .end();
            }
            catch (error) {
                debug(`${assetData.data.uid} Asset download failed`);
                reject(error);
            }
        });
    }
    /**
     * @description to delete the asset from the filesystem
     * @param  {object} asset: asset data
     */
    delete(asset) {
        debug('Asset deletion called for', asset);
        return new Promise((resolve, reject) => {
            try {
                const assetBasePath = this.assetConfig.assetStore.baseDir;
                let pathArray = asset.data._internal_url.split(path_1.default.sep);
                pathArray.splice(pathArray.length - 1, 1);
                const assetPath = path_1.default.join(assetBasePath, pathArray.join(path_1.default.sep));
                if (fs_1.existsSync(assetPath)) {
                    rimraf_1.default(assetPath, (error) => {
                        if (error) {
                            debug('Error while removing', assetPath, 'asset file');
                            return reject(error);
                        }
                        debug('Asset removed successfully');
                        return resolve(asset);
                    });
                }
                else {
                    debug(`${assetPath} did not exist!`);
                    return resolve(asset);
                }
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * @description to unpublish the asset from the filesystem
     * @param  {object} asset: asset data
     */
    unpublish(asset) {
        debug('asset unpublished called for', asset);
        return new Promise((resolve, reject) => {
            try {
                const assetBasePath = this.assetConfig.assetStore.baseDir;
                const assetPath = path_1.default.join(assetBasePath, asset.data._internal_url);
                if (fs_1.existsSync(assetPath)) {
                    rimraf_1.default(assetPath, (error) => {
                        if (error) {
                            debug('Error while removing', assetPath, 'asset file');
                            return reject(error);
                        }
                        debug('Asset removed successfully');
                        return resolve(asset);
                    });
                }
                else {
                    debug(`${assetPath} did not exist!`);
                    return resolve(asset);
                }
            }
            catch (error) {
                reject(error);
            }
        });
    }
    extractFolderPaths(asset) {
        const values = [];
        const keys = this.assetConfig.assetStore.keys;
        if (this.assetConfig.assetStore.assetFolderPrefixKey && typeof this.assetConfig.assetStore.assetFolderPrefixKey === 'string') {
            values.push(this.assetConfig.assetStore.assetFolderPrefixKey);
        }
        const regexp = new RegExp('https://(assets|images).contentstack.io/(v[\\d])/assets/(.*?)/(.*?)/(.*?)/(.*)', 'g');
        let matches;
        while ((matches = regexp.exec(asset.data.url)) !== null) {
            if (matches && matches.length) {
                if (matches[2]) {
                    asset.data.apiVersion = matches[2];
                }
                if (matches[3]) {
                    asset.data.apiKey = matches[3];
                }
                if (matches[4]) {
                    asset.data.downloadId = matches[4];
                }
            }
        }
        debug(`extracting asset url from: ${JSON.stringify(asset.data)}.\nKeys expected from this asset are: ${JSON.stringify(keys)}`);
        //values.push(asset.locale)
        for (let i = 0, keyLength = keys.length; i < keyLength; i++) {
            if (keys[i].charAt(0) !== ':') {
                continue;
            }
            const key = keys[i].slice('1');
            if (asset.data[key]) {
                values.push(asset.data[key]);
            }
            else {
                throw new TypeError(`The key ${key} did not exist on ${JSON.stringify(asset.data)}`);
            }
        }
        return values;
    }
    patternInterpretation(config) {
        const keys = lodash_1.compact(config.pattern.split('/'));
        keys.forEach((key, idx) => {
            if (key.length === 0) {
                keys.splice(idx, 1);
            }
        });
        return keys;
    }
}
exports.FsManager = FsManager;
