import { app, BrowserWindow, ipcMain, remote, shell } from 'electron';
const Store = require('./store.js');
const fs = require('fs');
const path = require('path');
const elasticlunr = require('elasticlunr');
const searchIndexFile = require('./assets/db/search/issue.full.idx.json');
const searchIndex = elasticlunr.Index.load(searchIndexFile);
const _ = require('lodash');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let printWindow = null;
const store = new Store({
  configName: 'user-preferences',
  defaults: {
    bookmarks: []
  }
});

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1280,
    minHeight: 840,
    webPreferences: {
      nodeIntegration: true,
      nativeWindowOpen: true,
    },
    show: false,
    icon: __dirname + '/assets/icons/icon.icns',
  });

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
    if (printWindow != null) {
      printWindow.close()
      printWindow = null;
    }
  });
};

ipcMain.on('printCanvas', function(event, content) {
  if (printWindow === null) {
    printWindow = new BrowserWindow({ width: 800, height: 1000, show: false })
  } else {
    printWindow.close()
    printWindow = null
    printWindow = new BrowserWindow({ width: 800, height: 1000, show: false })
  }

  printWindow.loadURL(`file://${__dirname}/print.html`);
  printWindow.webContents.on('did-finish-load', function () {
    printWindow.webContents.send('printCanvas', content)
  })
})

ipcMain.on('readyToPrint', function(event, content) {
  printWindow.webContents.print({})
})

ipcMain.on('getBookmarks', (event, args) => {
  event.sender.send('acceptBookmarks', store.get('bookmarks'))
});

ipcMain.on('updateBookmarks', (event, bookmarks) => {
  store.set('bookmarks', bookmarks)
  event.sender.send('bookmarksUpdated', "Bookmarks updated.")
});

ipcMain.on('openAttachment', function(event, filename) {
  const attachmentFilePath = path.join(__dirname, 'assets/attachments/' + filename)
  const tempFilePath = path.join((app || remote.app).getPath('temp'), filename)

  let ws = fs.createWriteStream(tempFilePath)

  fs.createReadStream(attachmentFilePath).pipe(ws)

  ws.on('finish', () => {
    shell.openItem(tempFilePath);
  })
})

ipcMain.on('printHelpAttachment', function(event) {
  const helpFilePath = path.join(__dirname, 'assets/help/Help-Archive.pdf')
  const helpTempFilePath = path.join((app || remote.app).getPath('temp'), 'Help-Archive.pdf')

  let ws = fs.createWriteStream(helpTempFilePath)

  fs.createReadStream(helpFilePath).pipe(ws)

  ws.on('finish', () => {
    shell.openItem(helpTempFilePath);
  })
})


ipcMain.on('fullTextSearch', (event, searchTerm) => {
  const rawSearchResults = searchIndex.search(searchTerm)
  const searchResults = []

  _.each(rawSearchResults, (r) => {
    let reference = r.ref.split('')
    const issue = parseInt(_.take(reference, 4).join(''), 10).toString()
    reference = _.drop(reference, 4)
    const magazine_type = parseInt(_.take(reference, 4).join(''), 10)
    const page = parseInt(_.takeRight(reference, 4).join(''), 10)
    const article_title = "Issue #" + issue + ", p." + page

    searchResults.push({
      id: r.ref,
      issue,
      magazine_type,
      page,
      dest: page,
      article_title,
    })
  })

  event.sender.send('fullTextSearchResults', searchResults)
});

const singleInstanceLock = app.requestSingleInstanceLock()

if (!singleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('ready', createWindow)
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.