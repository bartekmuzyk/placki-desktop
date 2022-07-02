const fs = require("fs");
const request = require("request");

/** @typedef {(percentage: number) => void} OnDownloaderProgress */

class Downloader {
    /** @type {OnDownloaderProgress} */
    onProgress;

    /**
     * @param onProgress {OnDownloaderProgress}
     */
    constructor(onProgress) {
        this.onProgress = onProgress;
    }

    /**
     * @param url {string}
     * @param filename {string}
     * @returns {Promise<void>}
     */
    download(url, filename) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filename);
            let receivedBytes = 0;
            let totalBytes = 1;

            // noinspection JSCheckFunctionSignatures
            request.get(url)
                .on("response", response => {
                    if (response.statusCode !== 200) {
                        reject("Invalid response code.");
                        return;
                    }

                    totalBytes = response.headers['content-length'];
                })
                .on("data", chunk => {
                    receivedBytes += chunk.length;
                    this.onProgress(Math.ceil((receivedBytes / totalBytes) * 100));
                })
                .pipe(file)
                .on("error", err => {
                    fs.unlinkSync(filename);
                });

            file.on("finish", () => {
                file.close(err => {
                    if (err) {
                        reject(err.message);
                    } else {
                        resolve();
                    }
                });
            });

            file.on("error", err => {
                fs.unlinkSync(filename);
                reject(err.message);
            });
        });
    }
}

module.exports = Downloader;