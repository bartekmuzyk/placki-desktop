const { app, BrowserWindow, dialog, shell } = require("electron");
const fetch = require("node-fetch");
const path = require("path");
const platform = require("os").platform();
const fs = require("fs");
const cp = require("child_process");
const sleep = require("sleep-promise");
const isDev = require("electron-is-dev");
const Downloader = require("./downloader");

const serviceInfoUrl = "http://plackistatus.atwebpages.com";
const forceUpdate = "--force-update" in process.argv;

const createWindow = async () => {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        center: true,
        title: "placki",
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
    });
    win.menuBarVisible = false;
    await win.loadFile("loading.html");

    /** @param {string} text */
    const setText = text => win.webContents.send("changeText", text);
    /** @param {number} percentage */
    const setProgress = percentage => win.webContents.send("progress", percentage);
    const hideProgress = () => win.webContents.send("hideProgress");

    // update routine
    setText("sprawdzanie aktualizacji...");

    /** @type {?Response} */
    let versionResponse = null;

    if (!isDev) {
        try {
            versionResponse = await fetch(serviceInfoUrl + "/latest_version");

            if (!versionResponse.ok) throw new Error();
        } catch (e) {
            setText("nie udało się sprawdzić najnowszej wersji. kontynuowanie za 5 sekund.");

            for (let counter = 5; counter > 0; counter--) {
                setProgress(20 * counter - 20);
                await sleep(1000);
            }

            hideProgress();
        }
    }

    if (versionResponse !== null) {
        const latestVersion = await versionResponse.text();
        const currentVersion = app.getVersion();

        if (currentVersion !== latestVersion || forceUpdate) {
            setText(`pobieranie aktualizacji do wersji ${latestVersion}.`);
            const updateDownloader = new Downloader(setProgress);
            let filename = app.getPath("temp") + path.sep;

            switch (platform) {
                case "win32":
                    filename += "setup.exe";

                    try {
                        await updateDownloader.download(
                            `https://github.com/bartekmuzyk/placki-desktop/releases/download/v${latestVersion}/placki-desktop.Setup.${latestVersion}.exe`,
                            filename
                        );
                    } catch (e) {
                        dialog.showErrorBox(
                            "aktualizacja",
                            "aktualizacja nie powiodła się i nie zostanie zainstalowana. spróbuj pobrać " +
                            "instalator ręcznie z http://plackisocial.rf.gd. treść błędu: " + e
                        );
                        break;
                    }

                    hideProgress();
                    setText("uruchamianie instalatora...");
                    await shell.openPath(filename);
                    app.quit()
                    break;
                case "linux":
                    filename += "placki.AppImage";
                    const installDir = `/opt/placki/`;

                    try {
                        await updateDownloader.download(
                            `https://github.com/bartekmuzyk/placki-desktop/releases/download/v${latestVersion}/placki-desktop-${latestVersion}.AppImage`,
                            filename
                        );
                        setProgress(0);
                        await updateDownloader.download(
                            "https://github.com/bartekmuzyk/placki-desktop/raw/master/build/icon.png",
                            installDir + "icon.png"
                        )
                    } catch (e) {
                        dialog.showErrorBox(
                            "aktualizacja",
                            "aktualizacja nie powiodła się i nie zostanie zainstalowana. spróbuj pobrać " +
                            "plik AppImage ręcznie z http://plackisocial.rf.gd. treść błędu: " + e
                        );
                        break;
                    }

                    setText("instalowanie aktualizacji...");
                    const appImagePath = installDir + "placki_updated.AppImage";

                    setProgress(0);
                    fs.copyFileSync(filename, appImagePath);
                    setProgress(50);
                    fs.unlinkSync(filename);
                    fs.chmodSync(appImagePath, 0o777);
                    setProgress(100);
                    setText("restartowanie...");
                    const updaterProcess = cp.spawn("bash", ["/opt/placki/updater"]);
                    updaterProcess.unref();
                    app.quit();

                    break;
            }
        } else {
            setText("wersja aktualna. wczytywanie...");
        }
    }

    try {
        const statusResponse = await fetch(serviceInfoUrl + "/status.json");

        if (statusResponse.ok) {
            const { url, maintenance } = await statusResponse.json();

            if (maintenance) {
                setText("strona nie jest teraz dostępna do użytku. spróbuj ponownie później.");
            } else {
                await win.loadURL(url);
            }
        } else {
            throw new Error();
        }
    } catch (e) {
        setText("wystąpił błąd podczas sprawdzania statusu. spróbuj ponownie później.");
    }
};

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});