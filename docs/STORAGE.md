# Where the apps keep things

**Nothing the app keeps leaves the device.** No cloud backup, no computer backup, no transfer to a
new phone, no roaming profile. What is on disk is an account's messages, its attachments and the
logs about them, and the legacy clients keep all of it on the device; 2.0 does the same, and on
the desktop goes further than legacy did.

## The rule

Every file the mobile app stores lives under a **root** handed out by `apps/mobile/src/storage/`.
Each root is protected and excluded from backup by the platform before anything is written into
it, so a file created inside one inherits both. A file written anywhere else does not, which is why
nothing else may reach the file system.

| root      | iOS                      | Android            |
| --------- | ------------------------ | ------------------ |
| `data`    | `<app group>/session`    | `filesDir/session` |
| `logs`    | `<app group>/logs`       | `filesDir/logs`    |
| `exports` | `Library/Caches/exports` | `cacheDir/exports` |

`data` is libsession's, with a directory per network holding the database, its -wal and -shm, the
attachment cache and the netcache.

**iOS.** The roots live in the app-group container (`group.` + the bundle identifier), so a
notification extension can share the database rather than keep a copy of its own. Each root gets
data protection class C (`completeUntilFirstUserAuthentication`) and `isExcludedFromBackup`, and
the temporary directory gets class C, as legacy's do. Class C rather than A because messages arrive
while the phone is locked and have to be written then. `modules/storage-roots` does this as the app
delegate registers its subscribers, before JavaScript runs. A build without the app-group
entitlement falls back to Application Support with the same attributes, and says so in the startup
block.

A new file inherits its directory's class. A **moved** file does not: since iOS 26 it keeps the
class of wherever it was created. So the database files are protected again after libsession opens
them, as legacy does, and anything that writes elsewhere and moves into a root has to call
`protect` on the result.

**Android.** The manifest keeps the roots out: `allowBackup="false"`, and backup rules
(`fullBackupContent` and `dataExtractionRules`, for cloud backup **and** device-to-device transfer,
which `allowBackup` alone does not stop) that exclude every domain. The data and logs are in
`filesDir` rather than `noBackupFilesDir`, which would not depend on the manifest, because
expo-file-system lets JS write only in `filesDir` and `cacheDir`. So the startup block's Storage row
reads the app's own backup flag, and a manifest that lost it shows there. App-private storage is credential-encrypted, Android's
equivalent of class C, so there is nothing per file to set.

**The database key** is in the keychain as `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: never in a backup,
so a backup restored to another phone carries a database it cannot open.

## How it is enforced

- `pnpm boundaries` (`mobile-files-go-through-storage`) and ESLint's mobile zone refuse
  `expo-file-system` in apps/mobile outside `src/storage/`.
- `apps/mobile/tests/backupConfig.test.ts` pins `allowBackup`, expo-secure-store's
  `configureAndroidBackup: false`, the backup rules and the app-group entitlement.
- At launch the startup block's `Storage` row reports each root's class and backup state, read back
  from the file system. A root missing either attribute is logged as a warning and protected again.

## Desktop

Everything is under Electron's `userData`.

- **macOS:** excluded from Time Machine at every launch (`tmutil addexclusion`, the sticky
  exclusion: an extended attribute on the directory, no root needed).
- **Windows:** under Local AppData rather than Roaming, which a roaming profile syncs.
- **Linux:** unchanged. There is no standard backup to opt out of.

The startup block's `Backup` row says which applied, or why it could not.
