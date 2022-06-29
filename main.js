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
                win.loadURL(url)
                    .then(async () => {
                        const savedSessionCookie = persistence.get("session_cookie");

                        if (savedSessionCookie !== null && typeof savedSessionCookie === "object") {
                            const cookies = win.webContents.session.cookies;
                            await cookies.remove(url, "PHPSESSID");
                            try {
                                await cookies.set({
                                    url,
                                    name: savedSessionCookie.name,
                                    value: savedSessionCookie.value,
                                    domain: savedSessionCookie.domain,
                                    path: savedSessionCookie.path,
                                    secure: savedSessionCookie.secure,
                                    httpOnly: savedSessionCookie.httpOnly,
                                    expirationDate: Date.now() / 1000 + 3153600000,  // Expires in 100 years
                                    sameSite: savedSessionCookie.sameSite
                                });
                            } catch (e) {
                                persistence.delete("session_cookie");
                                dialog.showErrorBox(
                                    "nie udało się zalogować automatycznie",
                                    "nie udało się wczytać danych o sesji. zaloguj się ponownie."
                                );
                            }

                            win.webContents.reload();
                        } else {
                            win.webContents.on("did-navigate", async () => {
                                if (sessionFetched) return;

                                const matches = await win.webContents.session.cookies.get({ name: "PHPSESSID" });
                                if (matches.length === 0) return;

                                persistence.set("session_cookie", matches[0]);
                                sessionFetched = true;
                            });
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