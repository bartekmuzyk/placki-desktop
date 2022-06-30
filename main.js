const { app, BrowserWindow, dialog } = require("electron");
const Store = require("electron-store")
const fetch = require("node-fetch");

const persistence = new Store();
const serviceInfoUrl = "http://plackistatus.000webhostapp.com";
let sessionFetched = false;

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        center: true,
        title: "placki"
    });

    win.menuBarVisible = false;
    win.loadFile("loading.html");

    fetch(serviceInfoUrl + "/status.json")
        .then(response => {
            if (response.ok) {
                return response.json();
            }

            throw new Error();
        })
        .then(statusData => {
            const { url, maintenance } = statusData;

            if (maintenance) {
                win.loadFile("maintenance.html");
            } else {
                const setupNavigateHandler = () => win.webContents.on("did-navigate", async () => {
                    if (sessionFetched || !win.webContents.getURL().endsWith("/glowna")) return;

                    const matches = await win.webContents.session.cookies.get({ name: "PHPSESSID" });
                    if (matches.length === 0) return;

                    persistence.set("session_id", matches[0].value);
                    console.log("zapisywanie id sesji: " + persistence.get("session_id"));
                    sessionFetched = true;
                });

                win.loadURL(url)
                    .then(async () => {
                        /** @type {?string} */
                        const savedSessionId = persistence.get("session_id");

                        if (typeof savedSessionId === "string") {
                            const domain = (new URL(url)).hostname;
                            const session = win.webContents.session;

                            await session.clearStorageData({ storages: ["cookies"] });
                            await session.cookies.set({
                                url,
                                name: "abuse_interstitial",
                                value: domain,
                                domain,
                                path: "/",
                                secure: true,
                                httpOnly: false,
                                expirationDate: Date.now() / 1000 + 153600000,  // 100 years
                                sameSite: "unspecified"
                            });

                            try {
                                await session.cookies.set({
                                    url,
                                    name: "PHPSESSID",
                                    value: savedSessionId,
                                    domain,
                                    path: "/",
                                    secure: false,
                                    httpOnly: false,
                                    sameSite: "unspecified"
                                });
                            } catch (e) {
                                persistence.delete("session_id");
                                dialog.showErrorBox(
                                    "nie udało się zalogować automatycznie",
                                    "nie udało się wczytać danych o sesji. zaloguj się ponownie."
                                );
                                setupNavigateHandler();
                            }

                            win.webContents.reload();
                        } else {
                            setupNavigateHandler();
                        }
                    });
            }
        })
        .catch(() => {
            win.loadFile("error.html");
        });
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